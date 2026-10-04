import { useParams } from 'react-router-dom'

import { SidebarTrigger } from '@/components/ui/sidebar'
import { useChatLayout } from '@/pages/chat/chat-layout-context'

export function ChatHeader() {
  const { threadId } = useParams()
  const { threads } = useChatLayout()
  const thread = threads.find((candidate) => candidate.id === threadId)

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background px-3 sm:px-5">
      <SidebarTrigger className="size-8" />
      <div className="h-5 w-px bg-border" aria-hidden="true" />
      <div className="min-w-0">
        <h1 className="truncate text-sm font-medium">
          {thread?.title ?? 'Research workspace'}
        </h1>
        <p className="truncate text-xs text-muted-foreground">
          {thread ? 'Grounded in the filing corpus' : 'Ask sourced questions across company filings'}
        </p>
      </div>
    </header>
  )
}
