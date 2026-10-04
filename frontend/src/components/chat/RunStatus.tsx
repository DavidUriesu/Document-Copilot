import { LoaderCircle } from 'lucide-react'

import { Marker, MarkerContent, MarkerIcon } from '@/components/ui/marker'
import type { AssistantStage } from '@/lib/chat'

const labels: Record<AssistantStage, string> = {
  preparing: 'Preparing your question…',
  searching: 'Searching relevant filings…',
  reading: 'Reading supporting passages…',
  drafting: 'Drafting a grounded answer…',
  checking: 'Checking claims and citations…',
  saving: 'Saving the verified answer…',
}

export function RunStatus({ stage }: { stage: AssistantStage }) {
  return (
    <Marker aria-atomic="true" aria-live="polite" role="status">
      <MarkerIcon>
        <LoaderCircle className="animate-spin motion-reduce:animate-none" />
      </MarkerIcon>
      <MarkerContent className="shimmer">{labels[stage]}</MarkerContent>
    </Marker>
  )
}
