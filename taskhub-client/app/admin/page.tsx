'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../src/utils/supabase/client'

export default function AdminDashboard() {
  const [title, setTitle] = useState('')
  const [assigneeEmail, setAssigneeEmail] = useState('')
  const [file, setFile] = useState<File | null>(null)
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  
  const supabase = createClient()

  useEffect(() => {
    if (statusMessage?.type === 'success') {
      const timer = setTimeout(() => setStatusMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [statusMessage])

  const handleSubmitTask = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setStatusMessage(null)

    if (!file || !title || !assigneeEmail) {
      setStatusMessage({ type: 'error', text: 'Please fill in all fields and select an image.' })
      setIsSubmitting(false)
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Authentication required.")

      const fileExt = file.name.split('.').pop()
      const fileName = `admin_${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName)

      const { error: dbError } = await supabase
        .from('tasks')
        .insert({
          title: title,
          description: "Admin Generated",
          status: "assigned", 
          assigned_to: assigneeEmail,
          product_image_url: publicUrl,
          base_image_url: publicUrl, 
          user_id: user.id 
        })

      if (dbError) throw dbError

      try {
        await fetch('/api/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'assigned',
            to: assigneeEmail, 
            taskTitle: title,
            taskUrl: 'http://localhost:3000' 
          })
        })
      } catch (emailError) {
        console.error("Email failed:", emailError)
      }

      setStatusMessage({ type: 'success', text: 'Project deployed successfully.' })
      setTitle('')
      setAssigneeEmail('')
      setFile(null)
      const fileInput = document.getElementById('file-upload') as HTMLInputElement
      if (fileInput) fileInput.value = ''

    } catch (error: any) {
      setStatusMessage({ type: 'error', text: `System Error: ${error.message}` })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen p-4 md:p-12 bg-[#0a0a0a] text-gray-100 flex justify-center">
      <div className="max-w-3xl w-full flex flex-col gap-8">
        
        <div className="flex justify-between items-center bg-[#171717] p-6 rounded-xl border border-[#262626] shadow-lg">
          <h1 className="text-2xl font-bold text-white tracking-tight">Admin Console</h1>
          <a href="/" className="text-sm text-[#a3a3a3] hover:text-white transition-colors">← Exit Console</a>
        </div>

        <div className="bg-[#171717] p-8 rounded-xl border border-[#262626] shadow-lg">
          <h2 className="text-lg font-bold text-white mb-6 tracking-tight">Deploy New Project</h2>
          
          <form onSubmit={handleSubmitTask} className="flex flex-col gap-6">
            
            <div className="flex flex-col gap-2">
              <label htmlFor="title" className="text-xs font-semibold uppercase tracking-wider text-[#a3a3a3]">Project Identifier</label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., FW24 Accessory Line"
                className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#404040] rounded-md focus:outline-none focus:border-[#a3a3a3] text-white placeholder-[#404040] transition-colors text-sm"
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-[#a3a3a3]">Assign To</label>
              <input
                id="email"
                type="email"
                value={assigneeEmail}
                onChange={(e) => setAssigneeEmail(e.target.value)}
                placeholder="artist@studio.com"
                className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#404040] rounded-md focus:outline-none focus:border-[#a3a3a3] text-white placeholder-[#404040] transition-colors text-sm"
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="file-upload" className="text-xs font-semibold uppercase tracking-wider text-[#a3a3a3]">Source Image</label>
              <div className="relative flex items-center w-full px-4 py-3 bg-[#0a0a0a] border border-[#404040] rounded-md">
                <input
                  id="file-upload"
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-[#737373] file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs file:font-bold file:uppercase file:tracking-wider file:bg-white file:text-black hover:file:bg-gray-200 cursor-pointer transition-colors"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-6 w-full py-3 px-4 bg-white hover:bg-gray-200 disabled:bg-[#262626] disabled:text-[#737373] text-black font-bold text-sm uppercase tracking-wider rounded-md transition-colors flex justify-center items-center"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black"></div>
                  Initializing...
                </span>
              ) : (
                "Deploy Project"
              )}
            </button>
          </form>

          {statusMessage && (
            <div className={`mt-6 p-4 rounded-md text-sm font-medium flex items-center gap-3 ${statusMessage.type === 'success' ? 'bg-[#171717] text-white border border-[#404040]' : 'bg-[#2a0a0a] text-[#ff8080] border border-[#661a1a]'}`}>
              <span>{statusMessage.type === 'success' ? 'SYSTEM:' : 'ERROR:'}</span>
              <p>{statusMessage.text}</p>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}