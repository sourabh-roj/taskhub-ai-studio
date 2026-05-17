'use client'

import { useEffect } from 'react'

export default function Error({ error, reset }: { error: Error & { digest?: string }, reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-gray-50 dark:bg-[#0a0a0a]">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Something went wrong!</h2>
      <p className="text-gray-500 dark:text-[#a3a3a3] mb-8">{error.message || "A critical UI error occurred."}</p>
      <button 
        onClick={() => reset()}
        className="px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-md font-medium"
      >
        Try again
      </button>
    </div>
  )
}