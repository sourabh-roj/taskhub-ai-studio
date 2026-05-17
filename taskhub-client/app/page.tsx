'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../src/utils/supabase/client'
import { User } from '@supabase/supabase-js'
import toast from 'react-hot-toast'
import { useTheme } from 'next-themes'

// 1. STRICT TYPESCRIPT INTERFACES (No 'any' allowed!)
interface GeneratedImage {
  id: string;
  image_url: string;
  image_type: string;
  prompt_used: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

interface Task {
  id: string;
  title: string;
  status: string;
  created_at: string;
  product_image_url: string;
  assigned_to: string;
  generated_images?: GeneratedImage[];
}

const REQUIREMENTS = [
  { id: 'white_bg', label: '1. White Background', desc: 'Pure white (#FFFFFF), e-commerce quality' },
  { id: 'theme_1', label: '2. Theme-Based 1', desc: 'e.g., marble surface, natural positioning' },
  { id: 'theme_2', label: '3. Theme-Based 2', desc: 'e.g., luxury velvet' },
  { id: 'creative_1', label: '4. Creative/Artistic 1', desc: 'Photorealistic lifestyle scene' },
  { id: 'creative_2', label: '5. Creative/Artistic 2', desc: 'Alternative lifestyle scene' },
  { id: 'model_front', label: '6. Model (Front)', desc: 'Realistic human model wearing product' },
  { id: 'model_side', label: '7. Model (Side Angle)', desc: '45-degree angle' },
  { id: 'model_close', label: '8. Model (Close-up)', desc: 'Macro shot of product on model' }
]

export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [isFetching, setIsFetching] = useState<boolean>(true)
  
  const [prompts, setPrompts] = useState<Record<string, string>>({})
  const [generatingType, setGeneratingType] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const supabase = createClient()
  const { theme, setTheme } = useTheme()

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

  const fetchMyTasks = async () => {
    if (!user?.email) return;
    setIsFetching(true)
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`*, generated_images ( id, image_url, image_type, prompt_used, status )`)
        .eq('assigned_to', user.email)
        .order('created_at', { ascending: false })

      if (error) throw error
      
      if (data) {
        setTasks(data as Task[])
        setSelectedTask((prevTask: Task | null) => {
          if (!prevTask) return null;
          return (data as Task[]).find((t: Task) => t.id === prevTask.id) || prevTask;
        })
      }
      
    } catch (error: unknown) {
      if (error instanceof Error) toast.error(`Sync error: ${error.message}`)
    } finally {
      setIsFetching(false)
    }
  }

  useEffect(() => {
    if (user) fetchMyTasks()
  }, [user])

  useEffect(() => {
    if (!selectedTask) return;
    const isAnyProcessing = selectedTask.generated_images?.some((img: GeneratedImage) => img.status === 'processing');
    if (isAnyProcessing) {
      const interval = setInterval(() => fetchMyTasks(), 3000); 
      return () => clearInterval(interval); 
    }
  }, [selectedTask, fetchMyTasks]);

  const handleGenerate = async (imageType: string) => {
    const prompt = prompts[imageType]
    if (!prompt || !selectedTask) return;
    
    setGeneratingType(imageType);
    const toastId = toast.loading(`Starting generation for ${imageType}...`)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error("Authentication missing");

      const response = await fetch('http://localhost:5000/api/generate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          task_id: selectedTask.id,
          prompt: prompt,
          image_type: imageType,
          original_image: selectedTask.product_image_url
        })
      })

      if (!response.ok) throw new Error("Server rejected request")
      
      toast.success("AI is painting in the background!", { id: toastId })
      setPrompts(prev => ({ ...prev, [imageType]: '' }))
      setTimeout(fetchMyTasks, 1000) 
      
    } catch (error: unknown) {
      if (error instanceof Error) toast.error(error.message, { id: toastId })
    } finally {
      setGeneratingType(null);
    }
  }

  const handleSubmitFinal = async () => {
    if (!selectedTask || !user) return;
    
    const completedCount = selectedTask.generated_images?.filter((img: GeneratedImage) => img.status === 'completed').length || 0;
    if (completedCount < 8) {
      toast.error("You must complete all 8 images first.");
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading("Submitting project for review...")

    try {
      const { error: dbError } = await supabase
        .from('tasks')
        .update({ status: 'submitted' })
        .eq('id', selectedTask.id);

      if (dbError) throw dbError;

      try {
        await fetch('/api/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'submitted',
            to: user.email, 
            taskTitle: selectedTask.title,
            userName: user.email,
            taskUrl: 'http://localhost:3000/admin'
          })
        });
      } catch (emailError) {
        console.warn("Email silently failed", emailError);
      }

      toast.success("Project successfully submitted!", { id: toastId });
      setSelectedTask(null);
      fetchMyTasks();

    } catch (error: unknown) {
      if (error instanceof Error) toast.error(error.message, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  }

  const handlePromptChange = (type: string, value: string) => {
    setPrompts(prev => ({ ...prev, [type]: value }))
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-[#0a0a0a] p-4 transition-colors">
        <div className="flex flex-col gap-4 bg-white dark:bg-[#171717] p-8 rounded-xl shadow-2xl border border-gray-200 dark:border-[#262626] w-full max-w-md">
          <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-white tracking-tight">TaskHub Studio</h1>
          <p className="text-center text-gray-500 dark:text-[#a3a3a3] mb-4 text-sm">Sign in to access your creative workspace.</p>
          <button onClick={() => supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/auth/callback` } })} className="px-4 py-3 bg-gray-100 dark:bg-white text-black hover:bg-gray-200 rounded-md font-medium transition-colors">Continue with Google</button>
          <button onClick={() => supabase.auth.signInWithOAuth({ provider: 'github', options: { redirectTo: `${window.location.origin}/auth/callback` } })} className="px-4 py-3 bg-gray-900 dark:bg-[#262626] text-white hover:bg-gray-800 dark:hover:bg-[#404040] border border-transparent dark:border-[#404040] rounded-md font-medium transition-colors">Continue with GitHub</button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen p-4 md:p-12 bg-gray-50 dark:bg-[#0a0a0a] text-gray-900 dark:text-gray-100 transition-colors">
      <div className="max-w-7xl mx-auto flex flex-col gap-8">
        
        {/* Header with Theme Toggle */}
        <div className="flex justify-between items-center bg-white dark:bg-[#171717] p-6 rounded-xl shadow-sm dark:shadow-lg border border-gray-200 dark:border-[#262626]">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Studio Workspace</h1>
            <p className="text-sm text-gray-500 dark:text-[#a3a3a3]">{user.email}</p>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setTheme(theme === 'dark' || theme === 'system' ? 'light' : 'dark')}
              className="p-2 rounded-full bg-gray-100 dark:bg-[#262626] hover:bg-gray-200 dark:hover:bg-[#404040] transition-colors"
              title="Toggle Theme"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button onClick={() => supabase.auth.signOut()} className="px-4 py-2 bg-gray-200 dark:bg-[#262626] hover:bg-gray-300 dark:hover:bg-[#404040] text-gray-900 dark:text-white border border-transparent dark:border-[#404040] rounded-md text-sm transition-colors">Sign Out</button>
          </div>
        </div>

        {selectedTask ? (
          <div className="flex flex-col gap-6">
            <button onClick={() => setSelectedTask(null)} className="text-gray-500 dark:text-[#a3a3a3] hover:text-black dark:hover:text-white transition-colors w-fit flex items-center gap-2 text-sm font-medium">
              ← Back to Overview
            </button>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="col-span-1 bg-white dark:bg-[#171717] p-6 rounded-xl shadow-sm border border-gray-200 dark:border-[#262626] h-fit sticky top-6">
                <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-white tracking-tight">Source Material</h2>
                <div className="aspect-square bg-gray-50 dark:bg-[#0a0a0a] rounded-lg overflow-hidden mb-4 border border-gray-200 dark:border-[#262626]">
                  <img src={selectedTask.product_image_url} alt="Product" className="w-full h-full object-contain p-4" />
                </div>
                <h3 className="font-semibold text-md text-gray-900 dark:text-white">{selectedTask.title}</h3>
                <p className="text-xs text-gray-500 dark:text-[#a3a3a3] uppercase tracking-widest mt-2 font-semibold">Status: {selectedTask.status}</p>
              </div>

              <div className="col-span-1 lg:col-span-2 bg-white dark:bg-[#171717] p-6 rounded-xl shadow-sm border border-gray-200 dark:border-[#262626]">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">Generation Queue (8 Required)</h2>
                  <button onClick={() => fetchMyTasks()} className="text-xs bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#e5e5e5] border border-gray-200 dark:border-[#404040] px-3 py-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-[#404040] transition-colors">↻ Sync</button>
                </div>
                
                <div className="flex flex-col gap-4">
                  {REQUIREMENTS.map((req) => {
                    const existingImage = selectedTask.generated_images?.find((img: GeneratedImage) => img.image_type === req.id)
                    const isWorking = generatingType === req.id || existingImage?.status === 'processing'

                    return (
                      <div key={req.id} className="p-4 rounded-lg border border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#0a0a0a] flex flex-col md:flex-row gap-4">
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-900 dark:text-[#e5e5e5] text-sm flex items-center gap-2 tracking-tight">
                            {existingImage?.status === 'completed' && <span className="text-green-500 dark:text-[#a3a3a3]">✓</span>}
                            {req.label}
                          </h3>
                          <p className="text-xs text-gray-500 dark:text-[#737373] mb-4 mt-1">{req.desc}</p>
                          
                          {existingImage?.status === 'processing' ? (
                            <div className="text-xs text-blue-600 dark:text-[#a3a3a3] italic animate-pulse bg-blue-50 dark:bg-[#171717] p-2 rounded border border-blue-100 dark:border-[#262626]">
                              Processing: "{existingImage.prompt_used}"
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2">
                              {existingImage?.status === 'completed' && (
                                <div className="text-xs text-gray-400 dark:text-[#737373] italic">
                                  Last prompt: "{existingImage.prompt_used}"
                                </div>
                              )}
                              <div className="flex gap-2">
                                <input 
                                  type="text"
                                  placeholder={existingImage ? "Refine prompt..." : `Direct the AI...`}
                                  value={prompts[req.id] || ''}
                                  onChange={(e) => handlePromptChange(req.id, e.target.value)}
                                  className="flex-1 text-sm px-3 py-2 rounded-md border border-gray-300 dark:border-[#404040] bg-white dark:bg-[#171717] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-[#737373] focus:outline-none focus:border-gray-500 dark:focus:border-[#737373] transition-colors"
                                />
                                <button 
                                  onClick={() => handleGenerate(req.id)}
                                  disabled={isWorking || !prompts[req.id]?.trim()}
                                  className="px-4 py-2 bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50 text-white dark:text-black rounded-md text-sm font-semibold whitespace-nowrap transition-colors"
                                >
                                  {isWorking ? "..." : (existingImage ? "Redo" : "Run")}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="w-24 h-24 shrink-0 bg-white dark:bg-[#171717] rounded-md border border-gray-200 dark:border-[#404040] flex items-center justify-center overflow-hidden">
                          {existingImage?.status === 'completed' ? (
                            <img src={existingImage.image_url} className="w-full h-full object-cover" alt={req.label} />
                          ) : isWorking ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900 dark:border-white"></div>
                          ) : (
                            <span className="text-[10px] text-gray-400 dark:text-[#737373] text-center px-2 uppercase tracking-wider">Awaiting</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="mt-8 pt-6 border-t border-gray-200 dark:border-[#262626] flex justify-between items-center">
                  <p className="text-xs text-gray-500 dark:text-[#737373] uppercase tracking-wider font-semibold">
                    {selectedTask.generated_images?.filter((img: GeneratedImage) => img.status === 'completed').length || 0}/8 Required Images
                  </p>
                  <button 
                    onClick={handleSubmitFinal}
                    disabled={isSubmitting || (selectedTask.generated_images?.filter((img: GeneratedImage) => img.status === 'completed').length || 0) < 8}
                    className="px-6 py-3 bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-200 disabled:bg-gray-300 dark:disabled:bg-[#262626] disabled:text-gray-500 dark:disabled:text-[#737373] text-white dark:text-black rounded-md font-bold transition-colors text-sm uppercase tracking-wider shadow-sm"
                  >
                    {isSubmitting ? "Submitting..." : "Submit Final Project"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-[#171717] p-6 rounded-xl shadow-sm border border-gray-200 dark:border-[#262626]">
            <h2 className="text-xl font-bold mb-6 text-gray-900 dark:text-white tracking-tight">Active Projects</h2>
            
            {isFetching ? (
              <p className="text-gray-500 dark:text-[#a3a3a3] text-sm">Synchronizing database...</p>
            ) : tasks.length === 0 ? (
              <p className="text-gray-500 dark:text-[#737373] py-8 text-center border border-dashed border-gray-300 dark:border-[#404040] rounded-lg text-sm">Workspace empty. Waiting for admin assignment.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {tasks.map(task => (
                  <div key={task.id} className="border border-gray-200 dark:border-[#262626] rounded-xl overflow-hidden flex flex-col hover:border-gray-400 dark:hover:border-[#737373] transition-colors cursor-pointer bg-gray-50 dark:bg-[#0a0a0a]" onClick={() => setSelectedTask(task)}>
                    <div className="aspect-video bg-white dark:bg-[#171717] flex items-center justify-center border-b border-gray-200 dark:border-[#262626] overflow-hidden p-4">
                       <img src={task.product_image_url} alt="Product" className="w-full h-full object-contain opacity-80 hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="p-5 flex-1">
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="font-bold text-gray-900 dark:text-white text-sm line-clamp-1">{task.title}</h3>
                        <span className={`text-[9px] uppercase font-bold px-2 py-1 rounded border ${task.status === 'submitted' ? 'bg-green-100 dark:bg-[#1a3320] text-green-800 dark:text-[#80ff9f] border-green-200 dark:border-[#2d5939]' : 'bg-gray-200 dark:bg-[#262626] text-gray-600 dark:text-[#a3a3a3] border-gray-300 dark:border-[#404040]'}`}>
                          {task.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 dark:text-[#737373] mb-4 uppercase tracking-wider">Assigned: {new Date(task.created_at).toLocaleDateString()}</p>
                      
                      <div className="w-full bg-gray-200 dark:bg-[#262626] rounded-full h-1.5 mb-2 overflow-hidden">
                        <div className="bg-gray-900 dark:bg-white h-full rounded-full" style={{ width: `${((task.generated_images?.length || 0) / 8) * 100}%` }}></div>
                      </div>
                      <p className="text-[11px] text-right text-gray-500 dark:text-[#a3a3a3] font-medium">{task.generated_images?.length || 0}/8 Complete</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}