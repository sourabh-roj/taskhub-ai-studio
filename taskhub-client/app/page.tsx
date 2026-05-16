'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../src/utils/supabase/client'
import { User } from '@supabase/supabase-js'

export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [apiResponse, setApiResponse] = useState<string | null>(null) 
  
  // NEW: State for the AI Generator
  const [prompt, setPrompt] = useState<string>('')
  const [isGenerating, setIsGenerating] = useState<boolean>(false)

  const supabase = createClient()

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
    }
    checkUser()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [supabase.auth])

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` }
    })
  }

  const signInWithGithub = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: `${window.location.origin}/auth/callback` }
    })
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setApiResponse(null)
  }

  const testBackendConnection = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return setApiResponse("Error: No access token.")

      const response = await fetch('http://localhost:5000/api/me', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      })
      const data = await response.json()
      setApiResponse(JSON.stringify(data, null, 2))
    } catch (error: any) {
      setApiResponse(`Request failed: ${error.message}`)
    }
  }

  // NEW: Function to trigger AI Generation
  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setApiResponse("Sending prompt to AI...");

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error("Not logged in");

      const response = await fetch('http://localhost:5000/api/generate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt: prompt })
      })

      const data = await response.json()
      setApiResponse(JSON.stringify(data, null, 2))
      setPrompt('') // Clear the input box
      
    } catch (error: any) {
      setApiResponse(`Generation failed: ${error.message}`)
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-50 dark:bg-gray-900">
      <div className="z-10 max-w-5xl w-full items-center justify-center font-mono text-sm flex flex-col gap-8">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
          Welcome to TaskHub AI
        </h1>

        {user ? (
          <div className="flex flex-col items-center gap-4 bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 w-full max-w-2xl">
            <p className="text-lg text-green-600 dark:text-green-400 font-semibold">
              Authenticated successfully!
            </p>
            <p className="text-gray-600 dark:text-gray-300">Logged in as: {user.email}</p>
            
            {/* NEW: AI Generator UI */}
            <div className="w-full mt-4 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
              <h2 className="text-xl font-bold mb-4 text-blue-900 dark:text-blue-100">AI Image Studio</h2>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe an image to generate..."
                  className="flex-1 px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button 
                  onClick={handleGenerate}
                  disabled={isGenerating || !prompt.trim()}
                  className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white rounded-md transition-all font-medium"
                >
                  {isGenerating ? "Queuing..." : "Generate!"}
                </button>
              </div>
            </div>

            <div className="w-full mt-2 flex flex-col gap-4">
              <button 
                onClick={testBackendConnection}
                className="px-6 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white rounded-md transition-colors text-sm"
              >
                Test Secure Connection
              </button>
              
              {apiResponse && (
                <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded-md w-full overflow-x-auto text-xs text-left text-gray-800 dark:text-gray-200">
                  <code>{apiResponse}</code>
                </pre>
              )}
            </div>

            <button onClick={signOut} className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors">
              Sign Out
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 w-full max-w-md">
            <p className="text-center text-gray-600 dark:text-gray-300 mb-4">Sign in to access your task dashboard and AI studio.</p>
            <button onClick={signInWithGoogle} className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-md transition-colors font-medium">
              Continue with Google
            </button>
            <button onClick={signInWithGithub} className="flex items-center justify-center gap-2 px-4 py-2 bg-[#24292F] hover:bg-[#24292F]/90 text-white rounded-md transition-colors font-medium">
              Continue with GitHub
            </button>
          </div>
        )}
      </div>
    </main>
  )
}