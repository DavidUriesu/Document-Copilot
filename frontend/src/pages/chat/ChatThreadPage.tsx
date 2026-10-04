import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { FileText, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { ChatComposer } from '@/components/chat/ChatComposer'
import { MessageList } from '@/components/chat/MessageList'
import { SourcePassagePanel } from '@/components/chat/SourcePassagePanel'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { AssistantStage, ChatMessage, CitationData, StreamErrorCode } from '@/lib/chat'
import { listMessages, messageCitations, titleFromQuestion } from '@/lib/chat'
import { env } from '@/lib/env'
import { ApiError } from '@/lib/http'
import { supabase } from '@/lib/supabase'
import { useChatLayout } from '@/pages/chat/chat-layout-context'

const exampleQuestions = [
  "How did Apple's Services revenue change across the available 10-Ks?",
  'What does NVIDIA say about Data Center supply constraints?',
  'Compare AI infrastructure investment language at Microsoft and Alphabet.',
]

interface CitationSelection {
  messageId: string
  citation: CitationData
}

const errorCopy: Record<StreamErrorCode, { title: string; detail: string }> = {
  retrieval_failed: { title: 'Filing search failed', detail: 'The source corpus could not be searched. Retry the question.' },
  grounding_failed: { title: 'Answer could not be verified', detail: 'The draft did not meet the citation requirements. Retry or narrow the question.' },
  upstream_failed: { title: 'Research service unavailable', detail: 'The answer service did not complete the request. Try again.' },
  persistence_failed: { title: 'Answer could not be saved', detail: 'No partial answer was kept. Retry the question.' },
  unexpected_failed: { title: 'Answer could not be completed', detail: 'An unexpected problem interrupted the request. Try again.' },
}

function EmptyConversation({ onSubmit }: { onSubmit: (question: string) => void }) {
  return (
    <div className="grid h-full place-items-center overflow-y-auto px-5 py-10">
      <div className="w-full max-w-2xl">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <span className="grid size-7 place-items-center rounded-md border bg-background">
            <Search className="size-3.5" />
          </span>
          Filing research
        </div>
        <h2 className="mt-5 max-w-lg text-3xl font-semibold leading-tight tracking-[-0.035em] sm:text-4xl">
          Start with a question worth verifying.
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
          Document Copilot searches the filing corpus, checks every claim, and returns the exact passages used.
        </p>
        <div className="mt-8 border-y">
          {exampleQuestions.map((question, index) => (
            <button
              className="group flex w-full items-start gap-4 border-b px-1 py-4 text-left text-sm leading-6 transition-colors last:border-b-0 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50"
              key={question}
              onClick={() => onSubmit(question)}
              type="button"
            >
              <span className="mt-0.5 text-xs tabular-nums text-muted-foreground">0{index + 1}</span>
              <span className="flex-1">{question}</span>
              <span className="text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true">→</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function Conversation({ threadId, initialMessages }: { threadId: string; initialMessages: ChatMessage[] }) {
  const { refreshThreads, threads, updateConversationTitle } = useChatLayout()
  const [stage, setStage] = useState<AssistantStage | null>(null)
  const [streamErrorCode, setStreamErrorCode] = useState<StreamErrorCode | null>(null)
  const [selection, setSelection] = useState<CitationSelection | null>(null)
  const transport = useMemo(
    () => new DefaultChatTransport<ChatMessage>({
      api: `${env.apiBaseUrl}/chat/stream`,
      prepareSendMessagesRequest: async ({ messages, headers }) => {
        const { data, error } = await supabase.auth.getSession()
        if (error) throw error
        const requestHeaders = new Headers(headers)
        if (data.session) requestHeaders.set('Authorization', `Bearer ${data.session.access_token}`)
        return { body: { threadId, messages }, headers: requestHeaders }
      },
    }),
    [threadId],
  )
  const { messages, sendMessage, regenerate, status, error, clearError, stop } = useChat<ChatMessage>({
    id: threadId,
    messages: initialMessages,
    transport,
    onData: (part) => {
      if (part.type === 'data-status') setStage(part.data.stage)
      if (part.type === 'data-error') setStreamErrorCode(part.data.code)
    },
    onError: (streamError) => {
      setStage(null)
      if (/401|unauthorized|jwt/i.test(streamError.message)) void supabase.auth.signOut()
    },
    onFinish: () => {
      setStage(null)
      void refreshThreads()
    },
  })
  const isStreaming = status === 'submitted' || status === 'streaming'
  const selectedMessage = selection ? messages.find((message) => message.id === selection.messageId) : undefined
  const selectedCitations = selectedMessage ? messageCitations(selectedMessage) : []
  const selectedPosition = selection
    ? selectedCitations.findIndex((citation) => citation.index === selection.citation.index)
    : -1
  const failure = streamErrorCode ? errorCopy[streamErrorCode] : error
    ? { title: 'Cannot reach Document Copilot', detail: 'Check your connection and that the backend is running, then retry.' }
    : null

  function selectAdjacent(offset: number) {
    const citation = selectedCitations[selectedPosition + offset]
    if (selection && citation) setSelection({ messageId: selection.messageId, citation })
  }

  async function submit(text: string) {
    setStage('preparing')
    setStreamErrorCode(null)
    clearError()
    const thread = threads.find((candidate) => candidate.id === threadId)
    if (messages.length === 0 && thread?.title === 'New conversation') {
      void updateConversationTitle(threadId, titleFromQuestion(text))
    }
    await sendMessage({ text })
  }

  async function retry() {
    setStage('preparing')
    setStreamErrorCode(null)
    clearError()
    await regenerate()
  }

  function stopResponse() {
    stop()
    setStage(null)
  }

  return (
    <div className="flex h-full min-h-0 bg-background">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1">
          {messages.length === 0 ? (
            <EmptyConversation onSubmit={(question) => void submit(question)} />
          ) : (
            <MessageList
              messages={messages}
              onSelectCitation={(messageId, citation) => setSelection({ messageId, citation })}
              stage={isStreaming ? (stage ?? 'preparing') : null}
            />
          )}
        </div>
        {failure ? <ConversationFailure {...failure} onRetry={() => void retry()} /> : null}
        <ChatComposer isStreaming={isStreaming} onSend={submit} onStop={stopResponse} />
      </div>
      <SourcePassagePanel
        citation={selection?.citation ?? null}
        canGoNext={selectedPosition >= 0 && selectedPosition < selectedCitations.length - 1}
        canGoPrevious={selectedPosition > 0}
        currentPosition={selectedPosition}
        onClose={() => setSelection(null)}
        onNext={() => selectAdjacent(1)}
        onPrevious={() => selectAdjacent(-1)}
        total={selectedCitations.length}
      />
    </div>
  )
}

function ConversationFailure({ detail, onRetry, title }: { detail: string; onRetry: () => void; title: string }) {
  return (
    <div className="mx-auto mb-2 flex w-[calc(100%-2rem)] max-w-[50rem] items-center justify-between gap-4 border-l-2 border-destructive bg-destructive/5 px-4 py-3" role="alert">
      <div>
        <p className="text-sm font-medium text-destructive">{title}</p>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{detail}</p>
      </div>
      <Button onClick={onRetry} size="sm" variant="outline">Retry</Button>
    </div>
  )
}

function ConversationLoading() {
  return (
    <div className="mx-auto flex h-full w-full max-w-[52rem] flex-col gap-8 px-6 py-10" aria-label="Loading messages">
      <Skeleton className="ml-auto h-12 w-2/3 rounded-2xl" />
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-[92%]" />
        <Skeleton className="h-4 w-[78%]" />
      </div>
    </div>
  )
}

export function ChatThreadPage() {
  const { threadId } = useParams()
  const [history, setHistory] = useState<{ threadId: string; messages: ChatMessage[] | null; error: ApiError | Error | null } | null>(null)

  useEffect(() => {
    if (!threadId) return
    let isActive = true
    void listMessages(threadId)
      .then((messages) => { if (isActive) setHistory({ threadId, messages, error: null }) })
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 401) void supabase.auth.signOut()
        if (isActive) setHistory({ threadId, messages: null, error: error instanceof Error ? error : new Error('Unable to load this conversation') })
      })
    return () => { isActive = false }
  }, [threadId])

  if (!threadId) return null
  if (history?.threadId !== threadId) return <ConversationLoading />
  if (history.error) {
    const unavailable = history.error instanceof ApiError && (history.error.status === 403 || history.error.status === 404)
    return (
      <div className="grid h-full place-items-center px-6 text-center" role="alert">
        <div className="max-w-sm">
          <FileText className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-4 font-medium">{unavailable ? 'Conversation unavailable' : 'Unable to load this conversation'}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{history.error.message}</p>
          <Button className="mt-5" nativeButton={false} render={<Link to="/chats" />}>Back to conversations</Button>
        </div>
      </div>
    )
  }
  return <Conversation key={threadId} threadId={threadId} initialMessages={history.messages ?? []} />
}
