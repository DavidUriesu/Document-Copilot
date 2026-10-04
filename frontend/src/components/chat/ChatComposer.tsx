import { ArrowUp, Square } from 'lucide-react'
import { type FormEvent, type KeyboardEvent, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface ChatComposerProps {
  isStreaming: boolean
  onSend: (text: string) => Promise<void>
  onStop: () => void
}

export function ChatComposer({ isStreaming, onSend, onStop }: ChatComposerProps) {
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  async function submit() {
    const text = input.trim()
    if (!text || isStreaming) return
    setInput('')
    await onSend(text)
    textareaRef.current?.focus()
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void submit()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      void submit()
    }
  }

  return (
    <div className="min-w-0 shrink-0 overflow-hidden bg-gradient-to-t from-background via-background to-transparent px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-6">
      <form
        className="mx-auto w-full min-w-0 max-w-[50rem] rounded-2xl border bg-background p-2 shadow-[0_8px_30px_rgba(0,0,0,0.06)] focus-within:border-foreground/30 focus-within:ring-2 focus-within:ring-ring/10"
        onSubmit={handleSubmit}
      >
        <Textarea
          aria-label="Message"
          className="min-h-12 max-h-40 resize-none border-0 bg-transparent px-2 py-2 text-[0.95rem] leading-6 shadow-none [field-sizing:content] focus-visible:border-transparent focus-visible:ring-0"
          disabled={isStreaming}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about companies, filings, metrics, or years…"
          ref={textareaRef}
          rows={1}
          value={input}
        />
        <div className="flex items-center justify-between gap-3 px-1 pb-1">
          <p className="hidden text-[11px] text-muted-foreground sm:block">
            Enter to send · Shift + Enter for a new line
          </p>
          <p className="text-[11px] text-muted-foreground sm:hidden">
            Answers include verified sources
          </p>
          {isStreaming ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button aria-label="Stop response" onClick={onStop} size="icon" type="button" />
                }
              >
                <Square className="size-3 fill-current" />
              </TooltipTrigger>
              <TooltipContent>Stop response</TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    aria-label="Send message"
                    disabled={input.trim() === ''}
                    size="icon"
                    type="submit"
                  />
                }
              >
                <ArrowUp />
              </TooltipTrigger>
              <TooltipContent>Send message</TooltipContent>
            </Tooltip>
          )}
        </div>
      </form>
      <p className="mx-auto mt-2 hidden max-w-[50rem] text-center text-[11px] text-muted-foreground sm:block">
        Verify important conclusions against the cited filing passages.
      </p>
    </div>
  )
}
