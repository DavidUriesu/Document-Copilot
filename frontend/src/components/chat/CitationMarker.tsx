import type { CitationData } from '@/lib/chat'

interface CitationMarkerProps {
  citation: CitationData
  onSelect: () => void
}

export function CitationMarker({ citation, onSelect }: CitationMarkerProps) {
  return (
    <button
      aria-label={`Open citation ${citation.index}`}
      className="mx-0.5 inline-flex min-h-5 items-center rounded-sm border border-foreground/15 bg-muted px-1.5 align-baseline text-[0.72em] font-semibold leading-5 text-foreground transition-colors hover:border-foreground/40 hover:bg-foreground hover:text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      onClick={onSelect}
      type="button"
    >
      {citation.index}
    </button>
  )
}
