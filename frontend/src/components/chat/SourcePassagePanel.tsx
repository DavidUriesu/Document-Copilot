import { ArrowLeft, ArrowRight, ExternalLink, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/use-mobile'
import type { CitationData } from '@/lib/chat'
import { citationLocation, formatFilingDate } from '@/lib/chat'

interface SourcePassagePanelProps {
  citation: CitationData | null
  canGoNext: boolean
  canGoPrevious: boolean
  currentPosition: number
  onClose: () => void
  onNext: () => void
  onPrevious: () => void
  total: number
}

function SourceContent({
  citation,
  canGoNext,
  canGoPrevious,
  currentPosition,
  onClose,
  onNext,
  onPrevious,
  total,
}: Omit<SourcePassagePanelProps, 'citation'> & { citation: CitationData }) {
  const location = citationLocation(citation)

  return (
    <>
      <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">
            Citation {currentPosition + 1} of {total}
          </p>
          <h2 className="mt-1 truncate text-base font-semibold tracking-tight">
            {citation.companyName} ({citation.ticker})
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {citation.filingType} · Filed {formatFilingDate(citation.filingDate)} · FY {citation.fiscalYear}
            {location ? ` · ${location}` : ''}
          </p>
        </div>
        <Button aria-label="Close source" onClick={onClose} size="icon-sm" variant="ghost">
          <X />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <p className="mb-3 text-xs font-medium text-muted-foreground">Exact source passage</p>
        <blockquote className="border-l-2 border-foreground pl-4 text-sm leading-7 text-foreground">
          {citation.excerpt}
        </blockquote>
      </div>
      <div className="flex items-center justify-between gap-3 border-t px-4 py-3">
        <div className="flex gap-1">
          <Button aria-label="Previous citation" disabled={!canGoPrevious} onClick={onPrevious} size="icon-sm" variant="outline">
            <ArrowLeft />
          </Button>
          <Button aria-label="Next citation" disabled={!canGoNext} onClick={onNext} size="icon-sm" variant="outline">
            <ArrowRight />
          </Button>
        </div>
        <Button nativeButton={false} render={<a href={citation.sourceUrl} target="_blank" rel="noreferrer" />} size="sm">
          Open filing
          <ExternalLink />
        </Button>
      </div>
    </>
  )
}

export function SourcePassagePanel(props: SourcePassagePanelProps) {
  const isMobile = useIsMobile()
  const { citation, onClose } = props
  if (!citation) return null

  const content = <SourceContent {...props} citation={citation} />

  if (isMobile) {
    return (
      <Sheet open onOpenChange={(open) => { if (!open) onClose() }}>
        <SheetContent className="w-[94vw]! max-w-[34rem]! gap-0 p-0" showCloseButton={false} side="right">
          <SheetHeader className="sr-only">
            <SheetTitle>Source passage</SheetTitle>
            <SheetDescription>Exact filing evidence for the selected citation.</SheetDescription>
          </SheetHeader>
          {content}
          <SheetFooter className="hidden" />
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <aside className="hidden h-full w-[min(34vw,26rem)] shrink-0 flex-col border-l bg-muted/25 md:flex" aria-label="Source passage">
      {content}
    </aside>
  )
}
