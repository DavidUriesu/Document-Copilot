import { ArrowRight, FileCheck2, Library, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useChatLayout } from '@/pages/chat/chat-layout-context'

const capabilities = [
  { icon: Search, label: 'Search across filings' },
  { icon: FileCheck2, label: 'Verify every claim' },
  { icon: Library, label: 'Return to past research' },
]

export function ChatListPage() {
  const { createConversation, isCreating, threads } = useChatLayout()

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex min-h-full w-full max-w-5xl items-center px-6 py-12 sm:px-10">
        <div className="grid w-full gap-12 lg:grid-cols-[1.3fr_0.7fr] lg:items-end">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Driftwood Capital · Filing research</p>
            <h2 className="mt-5 max-w-2xl text-4xl font-semibold leading-[1.04] tracking-[-0.045em] sm:text-6xl">
              Evidence first.<br />Analysis second.
            </h2>
            <p className="mt-6 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
              Ask a precise question, inspect the filing language behind the answer, and keep the full research trail in one place.
            </p>
            <Button
              className="mt-8 h-10 px-4"
              disabled={isCreating}
              onClick={() => void createConversation()}
            >
              {isCreating ? 'Creating conversation…' : threads.length === 0 ? 'Start first conversation' : 'Start new research'}
              <ArrowRight />
            </Button>
          </div>
          <div className="border-t lg:border-l lg:border-t-0 lg:pl-8">
            {capabilities.map(({ icon: Icon, label }, index) => (
              <div className="flex items-center gap-4 border-b py-4" key={label}>
                <span className="text-xs tabular-nums text-muted-foreground">0{index + 1}</span>
                <Icon className="size-4" />
                <span className="text-sm">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
