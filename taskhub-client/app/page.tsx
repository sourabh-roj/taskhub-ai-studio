'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../src/utils/supabase/client'
import { User } from '@supabase/supabase-js'

export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  // State to hold the response from Flask
  const [apiResponse, setApiResponse] = useState<string | null>(null) 
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

  // Function to securely talk to your Flask server
  const testBackendConnection = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.access_token) {
        setApiResponse("Error: No access token found.")
        return
      }

      const response = await fetch('http://localhost:5000/api/me', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()
      setApiResponse(JSON.stringify(data, null, 2))
      
    } catch (error: any) {
      setApiResponse(`Request failed: ${error.message}`)
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
            
            {/* THE NEW TEST BUTTON AREA */}
            <div className="w-full mt-6 p-4 border-t border-gray-200 dark:border-gray-700 flex flex-col items-center gap-4">
              <button 
                onClick={testBackendConnection}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors font-medium"
              >
                Test Secure Connection to Flask
              </button>
              
              {apiResponse && (
                <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded-md w-full overflow-x-auto text-xs text-left text-gray-800 dark:text-gray-200">
                  <code>{apiResponse}</code>
                </pre>
              )}
            </div>

            <button 
              onClick={signOut}
              className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
            >
              Sign Out
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 w-full max-w-md">
            <p className="text-center text-gray-600 dark:text-gray-300 mb-4">
              Sign in to access your task dashboard and AI studio.
            </p>
            
            <button 
              onClick={signInWithGoogle}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-md transition-colors font-medium"
            >
              <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google" />
              Continue with Google
            </button>

            <button 
              onClick={signInWithGithub}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-[#24292F] hover:bg-[#24292F]/90 text-white rounded-md transition-colors font-medium"
            >
              <img src="https://www.svgrepo.com/show/512317/github-142.svg" className="w-5 h-5 filter invert" alt="GitHub" />
              Continue with GitHub
            </button>
          </div>
        )}

      </div>
    </main>
  )
}