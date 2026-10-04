import { AssistantMessage } from '@/components/chat/AssistantMessage'
import { RunStatus } from '@/components/chat/RunStatus'
import { Bubble, BubbleContent } from '@/components/ui/bubble'
import { Message, MessageContent } from '@/components/ui/message'
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@/components/ui/message-scroller'
import type { AssistantStage, ChatMessage, CitationData } from '@/lib/chat'
import { messageText } from '@/lib/chat'

interface MessageListProps {
  messages: ChatMessage[]
  onSelectCitation: (messageId: string, citation: CitationData) => void
  stage: AssistantStage | null
}

export function MessageList({ messages, onSelectCitation, stage }: MessageListProps) {
  return (
    <MessageScrollerProvider key={messages[0]?.id ?? 'empty'}>
      <MessageScroller>
        <MessageScrollerViewport>
          <MessageScrollerContent className="mx-auto w-full max-w-[52rem] overflow-x-hidden gap-8 px-4 py-8 sm:px-7 md:py-10">
            {messages.map((message) => (
              <MessageScrollerItem
                key={message.id}
                messageId={message.id}
                scrollAnchor={message.role === 'user'}
              >
                <Message align={message.role === 'user' ? 'end' : 'start'}>
                  <MessageContent>
                    {message.role === 'assistant' ? (
                      <Bubble className="max-w-full" variant="ghost">
                        <BubbleContent className="w-full">
                          <AssistantMessage
                            message={message}
                            onSelectCitation={(citation) => onSelectCitation(message.id, citation)}
                          />
                        </BubbleContent>
                      </Bubble>
                    ) : (
                      <Bubble align="end" className="max-w-[88%] sm:max-w-[75%]" variant="secondary">
                        <BubbleContent className="max-w-full rounded-2xl rounded-br-md px-4 py-2.5 text-[0.9rem] leading-6">
                          <p className="whitespace-pre-wrap break-words">{messageText(message)}</p>
                        </BubbleContent>
                      </Bubble>
                    )}
                  </MessageContent>
                </Message>
              </MessageScrollerItem>
            ))}
            {stage ? (
              <MessageScrollerItem>
                <RunStatus stage={stage} />
              </MessageScrollerItem>
            ) : null}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton className="bottom-5 shadow-sm" />
      </MessageScroller>
    </MessageScrollerProvider>
  )
}
