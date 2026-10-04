import type { ReactNode } from 'react'

import { CitationMarker } from '@/components/chat/CitationMarker'
import type { CitationData } from '@/lib/chat'

interface AnswerContentProps {
  citations: Map<number, CitationData>
  onSelectCitation: (citation: CitationData) => void
  text: string
}

function inlineContent(
  text: string,
  citations: Map<number, CitationData>,
  onSelect: (citation: CitationData) => void,
): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\[\d+])/g).map((token, index) => {
    const citationMatch = /^\[(\d+)]$/.exec(token)
    const citation = citationMatch ? citations.get(Number(citationMatch[1])) : undefined
    if (citation) {
      return (
        <CitationMarker
          citation={citation}
          key={`${citation.chunkId}-${index}`}
          onSelect={() => onSelect(citation)}
        />
      )
    }
    if (token.startsWith('**') && token.endsWith('**')) {
      return <strong key={index}>{token.slice(2, -2)}</strong>
    }
    return token
  })
}

export function AnswerContent({ citations, onSelectCitation, text }: AnswerContentProps) {
  const lines = text.split('\n')
  const content: ReactNode[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index].trim()
    if (!line) {
      index += 1
      continue
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(line)
    if (heading) {
      content.push(
        <h2 className="mt-6 text-base font-semibold tracking-tight first:mt-0" key={index}>
          {inlineContent(heading[2], citations, onSelectCitation)}
        </h2>,
      )
      index += 1
      continue
    }

    const unordered = /^[-*]\s+/.test(line)
    const ordered = /^\d+[.)]\s+/.test(line)
    if (unordered || ordered) {
      const items: ReactNode[] = []
      const pattern = unordered ? /^[-*]\s+(.+)$/ : /^\d+[.)]\s+(.+)$/
      while (index < lines.length) {
        const match = pattern.exec(lines[index].trim())
        if (!match) break
        items.push(
          <li className="pl-1" key={index}>
            {inlineContent(match[1], citations, onSelectCitation)}
          </li>,
        )
        index += 1
      }
      const listClass = 'my-3 space-y-2 pl-5 marker:text-muted-foreground'
      content.push(
        unordered ? (
          <ul className={`${listClass} list-disc`} key={`list-${index}`}>{items}</ul>
        ) : (
          <ol className={`${listClass} list-decimal`} key={`list-${index}`}>{items}</ol>
        ),
      )
      continue
    }

    content.push(
      <p className="my-3 first:mt-0 last:mb-0" key={index}>
        {inlineContent(line, citations, onSelectCitation)}
      </p>,
    )
    index += 1
  }

  return <div className="min-w-0 break-words text-[0.95rem] leading-7 text-foreground">{content}</div>
}
