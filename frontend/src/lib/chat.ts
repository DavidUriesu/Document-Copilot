import type { UIMessage } from 'ai'

import { api } from '@/lib/api'

export interface ChatThread {
  id: string
  userId: string
  title: string
  createdAt: string
  updatedAt: string
}

export type AnswerStatus = 'grounded' | 'insufficient_evidence'
export type AssistantStage =
  | 'preparing'
  | 'searching'
  | 'reading'
  | 'drafting'
  | 'checking'
  | 'saving'

export type StreamErrorCode =
  | 'retrieval_failed'
  | 'grounding_failed'
  | 'upstream_failed'
  | 'upstream_timeout'
  | 'persistence_failed'
  | 'unexpected_failed'

export interface CitationData {
  index: number
  chunkId: string
  excerpt: string
  ticker: string
  companyName: string
  filingType: string
  filingDate: string
  fiscalYear: number
  pageNumber: number | null
  section: string | null
  sourceUrl: string
}

export type ChatDataParts = {
  citation: CitationData
  'answer-meta': { status: AnswerStatus }
  status: { stage: AssistantStage }
  error: { code: StreamErrorCode }
}

export type ChatMessage = UIMessage<never, ChatDataParts>

interface StoredMessage {
  id: string
  threadId: string
  role: ChatMessage['role']
  sequenceNumber: number
  content: string
  parts: ChatMessage['parts'] | null
  createdAt: string
}

export function listThreads(): Promise<ChatThread[]> {
  return api.get<ChatThread[]>('/chat/threads')
}

export function createThread(title = 'New conversation'): Promise<ChatThread> {
  return api.post<ChatThread>('/chat/threads', { title })
}

export function updateThreadTitle(threadId: string, title: string): Promise<ChatThread> {
  return api.patch<ChatThread>(`/chat/threads/${encodeURIComponent(threadId)}`, { title })
}

export function titleFromQuestion(question: string): string {
  const title = question.replace(/\s+/g, ' ').trim()
  return title.length <= 56 ? title : `${title.slice(0, 55).trimEnd()}…`
}

export async function listMessages(threadId: string): Promise<ChatMessage[]> {
  const messages = await api.get<StoredMessage[]>(
    `/chat/threads/${encodeURIComponent(threadId)}/messages`,
  )

  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    parts:
      message.parts ?? [{ type: 'text' as const, text: message.content }],
  }))
}

export function messageText(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('')
}

export function messageCitations(message: ChatMessage): CitationData[] {
  return message.parts
    .filter((part) => part.type === 'data-citation')
    .map((part) => part.data)
    .sort((left, right) => left.index - right.index)
}

export function messageAnswerStatus(message: ChatMessage): AnswerStatus | null {
  const part = message.parts.find((candidate) => candidate.type === 'data-answer-meta')
  return part?.data.status ?? null
}

const filingDate = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

export function formatFilingDate(value: string): string {
  return filingDate.format(new Date(`${value}T00:00:00Z`))
}

export function citationLocation(citation: CitationData): string | null {
  if (citation.pageNumber !== null) return `Page ${citation.pageNumber}`
  return citation.section
}
