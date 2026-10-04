import { type CSSProperties, useCallback, useEffect, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'

import { ChatHeader } from '@/components/app/ChatHeader'
import { ThreadSidebar } from '@/components/chat/ThreadSidebar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { createThread, listThreads, type ChatThread, updateThreadTitle } from '@/lib/chat'
import { ApiError } from '@/lib/http'
import { supabase } from '@/lib/supabase'
import { ChatLayoutContext } from '@/pages/chat/chat-layout-context'

export function ChatLayout() {
  const navigate = useNavigate()
  const [threads, setThreads] = useState<ChatThread[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const refreshThreads = useCallback(async () => {
    try {
      const nextThreads = await listThreads()
      setThreads(nextThreads)
      setErrorMessage(null)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) void supabase.auth.signOut()
      setErrorMessage(error instanceof ApiError ? error.message : 'Unable to refresh conversations')
    }
  }, [])

  useEffect(() => {
    let isActive = true
    void listThreads()
      .then((nextThreads) => {
        if (isActive) setThreads(nextThreads)
      })
      .catch((error: unknown) => {
        if (!isActive) return
        if (error instanceof ApiError && error.status === 401) void supabase.auth.signOut()
        setErrorMessage(error instanceof ApiError ? error.message : 'Unable to load conversations')
      })
      .finally(() => {
        if (isActive) setIsLoading(false)
      })
    return () => {
      isActive = false
    }
  }, [])

  async function handleCreate() {
    setErrorMessage(null)
    setIsCreating(true)
    try {
      const thread = await createThread()
      setThreads((current) => [thread, ...current])
      navigate(`/chats/${thread.id}`)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) void supabase.auth.signOut()
      setErrorMessage(error instanceof ApiError ? error.message : 'Unable to create a conversation')
    } finally {
      setIsCreating(false)
    }
  }

  async function handleTitleUpdate(threadId: string, title: string) {
    try {
      const updated = await updateThreadTitle(threadId, title)
      setThreads((current) => current.map((thread) => thread.id === threadId ? updated : thread))
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) void supabase.auth.signOut()
      setErrorMessage(error instanceof ApiError ? error.message : 'Unable to update the conversation title')
    }
  }

  return (
    <ChatLayoutContext.Provider value={{
      threads,
      refreshThreads,
      createConversation: handleCreate,
      updateConversationTitle: handleTitleUpdate,
      isCreating,
    }}>
      <SidebarProvider
        className="h-svh min-h-0 overflow-hidden"
        style={{ '--sidebar-width': '17.5rem' } as CSSProperties}
      >
        <ThreadSidebar
          threads={threads}
          isCreating={isCreating}
          isLoading={isLoading}
          onCreate={() => void handleCreate()}
        />
        <SidebarInset className="h-svh min-h-0 min-w-0 overflow-hidden">
          <ChatHeader />
          {errorMessage ? (
            <p className="border-b bg-destructive/10 px-4 py-2 text-sm text-destructive" role="alert">
              {errorMessage}
            </p>
          ) : null}
          <section className="min-h-0 min-w-0 flex-1">
            <Outlet />
          </section>
        </SidebarInset>
      </SidebarProvider>
    </ChatLayoutContext.Provider>
  )
}
