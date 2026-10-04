import { Check, Copy } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export function AssistantActions({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="mt-3 flex items-center gap-1 opacity-70 transition-opacity group-hover/message:opacity-100 group-focus-within/message:opacity-100">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-label={copied ? 'Copied response' : 'Copy response'}
              onClick={() => void copy()}
              size="icon-xs"
              variant="ghost"
            />
          }
        >
          {copied ? <Check /> : <Copy />}
        </TooltipTrigger>
        <TooltipContent>{copied ? 'Copied' : 'Copy response'}</TooltipContent>
      </Tooltip>
    </div>
  )
}
