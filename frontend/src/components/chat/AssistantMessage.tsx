import { AlertCircle, BookOpenText } from 'lucide-react'

import { AnswerContent } from '@/components/chat/AnswerContent'
import { AssistantActions } from '@/components/chat/AssistantActions'
import { CitationChip } from '@/components/chat/CitationChip'
import type { ChatMessage, CitationData } from '@/lib/chat'
import { messageAnswerStatus, messageCitations, messageText } from '@/lib/chat'

interface AssistantMessageProps {
  message: ChatMessage
  onSelectCitation: (citation: CitationData) => void
}

export function AssistantMessage({ message, onSelectCitation }: AssistantMessageProps) {
  const text = messageText(message)
  const citations = messageCitations(message)
  const citationsByIndex = new Map(citations.map((citation) => [citation.index, citation]))
  const isInsufficient = messageAnswerStatus(message) === 'insufficient_evidence'

  return (
    <div className="w-full min-w-0">
      {isInsufficient ? (
        <div className="mb-5 flex gap-3 border-l-2 border-foreground bg-muted/60 px-4 py-3 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">The corpus does not support a reliable answer</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Try narrowing the company, filing, metric, or year.
            </p>
          </div>
        </div>
      ) : null}
      <AnswerContent citations={citationsByIndex} onSelectCitation={onSelectCitation} text={text} />
      {citations.length > 0 ? (
        <section className="mt-6 border-t pt-4" aria-label="Sources used">
          <div className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <BookOpenText className="size-3.5" />
            Sources used · {citations.length}
          </div>
          <div className="flex flex-wrap gap-2">
            {citations.map((citation) => (
              <CitationChip
                citation={citation}
                key={citation.chunkId}
                onSelect={() => onSelectCitation(citation)}
              />
            ))}
          </div>
        </section>
      ) : null}
      <AssistantActions text={text} />
    </div>
  )
}
