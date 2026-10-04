import { FileText } from 'lucide-react'

import type { CitationData } from '@/lib/chat'
import { citationLocation, formatFilingDate } from '@/lib/chat'

interface CitationChipProps {
  citation: CitationData
  onSelect: () => void
}

export function CitationChip({ citation, onSelect }: CitationChipProps) {
  const location = citationLocation(citation)
  const label = `${citation.companyName}, ${citation.filingType}, filed ${formatFilingDate(citation.filingDate)}${location ? `, ${location}` : ''}`

  return (
    <button
      aria-label={`Open citation ${citation.index}, ${label}`}
      className="group flex max-w-full items-center gap-2 rounded-lg border bg-background px-2.5 py-2 text-left text-xs transition-colors hover:border-foreground/35 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      onClick={onSelect}
      type="button"
    >
      <span className="grid size-6 shrink-0 place-items-center rounded-md bg-muted font-semibold tabular-nums group-hover:bg-foreground group-hover:text-background">
        {citation.index}
      </span>
      <FileText className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate text-muted-foreground">
        <span className="font-medium text-foreground">{citation.ticker}</span>
        {' · '}{citation.filingType}{' · '}{formatFilingDate(citation.filingDate)}
        {location ? ` · ${location}` : ''}
      </span>
    </button>
  )
}
