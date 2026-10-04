# Phase 7 trust UI implementation plan

## Outcome

Phase 7 is complete when an analyst can submit a filing question, understand
what the system is doing while the grounded answer is prepared, identify every
source used by an assistant message, and open the exact validated excerpt in
one click. The same experience must work for a newly streamed answer and after
reloading a persisted conversation.

The product invariant remains:

> Progress may stream immediately, but answer text and citations appear only
> after the backend has validated and persisted the complete grounded turn.

## Current state

The backend already emits and persists trusted `data-citation` parts containing
the citation index, chunk ID, verbatim excerpt, company, ticker, filing type,
filing date, fiscal year, optional page and section, and SEC source URL.
Reloaded message history includes those parts.

The frontend currently renders only text parts, so citation metadata is
discarded visually. It also reduces the complete assistant run to a generic
"responding" indicator. The stream sends one transient `retrieving` status,
but `useChat` does not yet consume it.

The backend deliberately buffers the model result until grounding validation
and persistence succeed. Phase 7 must not weaken that rule to obtain apparent
token-by-token output.

## User experience

### Assistant messages and citations

Render an assistant response as readable plain text with its `[n]` markers
converted into accessible citation buttons. Below the answer, render one chip
per unique citation in citation-index order.

Each chip should show the most useful compact label available:

```text
[1] Apple · 10-K · Oct 31, 2025 · Item 7
```

Use `Page 42` when a page is available, otherwise use the section. If neither
exists, omit that segment rather than displaying an empty placeholder. The
company name may collapse to the ticker on narrow screens.

Clicking either an inline `[n]` marker or its chip selects that citation and
opens the source passage panel. Citation controls must be real buttons with an
accessible label such as "Open citation 1, Apple 10-K filed October 31, 2025."

Do not add a Markdown rendering dependency in this phase. The current answers
are safely rendered as text, and citation markers can be split with a small
typed helper. Rich Markdown can be a separate, security-reviewed enhancement.

### Source passage panel

Add a persistent contextual panel beside the conversation on desktop and a
full-width overlay/panel above the composer on small screens. It contains:

- company and ticker;
- filing type, filing date, and fiscal year;
- page when present and section when present;
- the exact validated excerpt, visually emphasized as source text;
- an "Open SEC filing" external link using `sourceUrl`;
- previous/next citation controls when the message has multiple citations;
- a close control that returns focus to the citation button that opened it.

The panel displays the citation payload already attached to the message. It
does not fetch a second copy of the passage, because the trusted verbatim
excerpt is already validated, streamed, and persisted. A later full-document
reader may use `chunkId`, but no new source-passage endpoint is required for
Phase 7.

Selection state should be `{ messageId, citationIndex }`, not just an index,
because citation numbering restarts for each assistant message. Clear the
selection when changing threads.

### Waiting and progress

Replace the generic waiting line with one live status region for the active
assistant run. Use stable, user-facing stages rather than exposing model or
database implementation details:

| Wire stage | UI copy |
| --- | --- |
| `preparing` | Preparing your question… |
| `searching` | Searching relevant filings… |
| `reading` | Reading supporting passages… |
| `drafting` | Drafting a grounded answer… |
| `checking` | Checking claims and citations… |
| `saving` | Saving the verified answer… |

The frontend should consume transient `data-status` events through the AI SDK
`onData` callback and keep the latest stage in local state. Clear it on finish,
error, cancellation, or thread change. Use `aria-live="polite"` and preserve the
composer-disabled behavior while a run is active.

The backend should report stages from real orchestration boundaries and tool
activity, not rotate them on timers. Add a small request-scoped async progress
callback to `DocumentAgentDeps`; retrieval tools report `searching` before a
search and `reading` before exact/neighbor reads. The orchestrator reports
`preparing`, `drafting`, `checking`, and `saving` around history loading, agent
execution, final validation, and atomic persistence.

Because `agent.run()` and the progress stream must advance concurrently, run
the turn in an asyncio task and relay progress through a bounded request-local
queue in the route. When the task finishes, emit the already validated text and
citations exactly as Phase 6 does. Cancel the task if the client disconnects.

Coalesce repeated stages so several retrieval tool calls do not make the UI
flicker. Progress delivery is best-effort and must never affect grounding or
persistence if the browser disconnects between status events.

## Typed frontend message contract

Define the application-owned data shapes in `frontend/src/lib/chat.ts`:

```ts
interface CitationData {
  index: number
  chunkId: string
  excerpt: string
  ticker: string
  companyName: string
  filingType: string
  filingDate: string
  fiscalYear: number
  pageNumber: number | null
  section: string | null
  sourceUrl: string
}

type AssistantStage =
  | 'preparing'
  | 'searching'
  | 'reading'
  | 'drafting'
  | 'checking'
  | 'saving'
```

Add narrow type guards for `data-citation` and `data-status` parts. Do not use
`any` or cast an entire incoming message. Helpers should extract and sort
citations, format filing labels with native `Intl.DateTimeFormat`, and split
text into text/marker tokens.

Add one persistent answer metadata part:

```json
{"type":"data-answer-meta","data":{"status":"grounded"}}
```

Its status is `grounded` or `insufficient_evidence`. Persist and stream it with
the assistant message. This lets the UI render a deliberate no-corpus-match
state instead of guessing from an empty citation list. Existing stored messages
without this part may render normally; do not add a broader compatibility
layer.

## Component changes

Keep components focused:

```text
frontend/src/components/chat/
├── AssistantMessage.tsx
├── CitationChip.tsx
├── RunStatus.tsx
├── SourcePassagePanel.tsx
├── MessageList.tsx
└── ChatComposer.tsx
```

- `MessageList` owns no citation parsing; it delegates assistant rendering and
  forwards citation selection.
- `AssistantMessage` renders text, inline citation controls, citation chips,
  and the insufficient-evidence notice.
- `CitationChip` formats one compact citation identity.
- `SourcePassagePanel` renders the selected trusted excerpt and source link.
- `RunStatus` maps the closed stage union to user-facing copy and animation.
- `ChatThreadPage` owns selected citation, current progress stage, and stream
  error state because they span the message list and source panel.

Update the conversation layout to use a two-column content area only while a
citation is selected. Keep the message column width readable and allow the
panel itself to scroll without moving the composer.

Use existing Tailwind tokens and lucide icons. Add a shadcn primitive only if a
real interaction need emerges during implementation; this plan does not
require a new runtime dependency.

## Empty states

Implement distinct states rather than one generic blank screen:

- **No threads:** keep the sidebar message, and make the main empty state's
  primary action create the first conversation.
- **Empty thread:** show example filing questions derived from the client brief;
  clicking one should populate or submit the composer. Keep examples concise
  and within the actual five-company corpus.
- **No corpus match:** use the persisted `insufficient_evidence` answer status
  to show that no reliable answer was found and suggest narrowing or correcting
  company, filing type, metric, or year. Do not describe this as an application
  error.
- **No citations on legacy/non-grounded assistant content:** render the text
  without citation controls. Do not invent a source or show a broken panel.

## Error states

Create a small frontend error classifier that maps known conditions to an
actionable title, explanation, and recovery action:

| Condition | Presentation | Recovery |
| --- | --- | --- |
| HTTP 401 / expired session | Session expired | Sign in again; preserve no unsent secret state |
| Retrieval failure | Filing search failed | Retry the question |
| Grounding failure | Answer could not be verified | Retry or narrow the question |
| Network, timeout, or CORS | Cannot reach Document Copilot | Check connection/backend and retry |
| 403 / 404 thread | Conversation unavailable | Return to conversations |
| Unexpected failure | Answer could not be completed | Retry |

Before the SSE response starts, continue using HTTP status codes. After the
stream starts, emit a transient structured `data-error` with a safe closed code
(`retrieval_failed`, `grounding_failed`, `upstream_failed`, or
`persistence_failed`) followed by the AI SDK error event. Never send exception
messages, prompts, SQL, or provider details.

The backend should catch known exception classes close enough to classify them;
retain one generic streaming-boundary fallback for unexpected exceptions.
Network/CORS errors remain a frontend classification because no response
arrives. On a 401, sign out the stale Supabase session and route to sign-in.

Show failures in an alert adjacent to the failed turn with a retry button that
resubmits the last user text. Do not persist a failed assistant message. Keep
the global layout banner for thread-list/create failures only.

## Backend work

1. Add typed progress and safe error codes to the chat streaming contract.
2. Add an optional async progress reporter to `DocumentAgentDeps` and report
   real retrieval-tool stages.
3. Split `run_chat_turn` into explicit history/agent/validation/persistence
   boundaries that report progress without changing validation order.
4. Relay progress concurrently from `POST /chat/stream`, then emit validated
   answer parts only after the turn task completes.
5. Include `data-answer-meta` in both persisted parts and the live stream.
6. Classify retrieval, grounding, upstream, and persistence failures into safe
   client codes while logging full internal context server-side.
7. Preserve atomic turn persistence and the existing rule that a failed run
   stores no partial messages or citations.

## Frontend work

1. Define citation, answer metadata, progress, and stream-error types plus
   narrow parsers in `src/lib/chat.ts`.
2. Consume transient status/error data from `useChat` and normalize transport
   failures, including network/CORS and expired auth.
3. Build assistant text marker rendering and citation chips.
4. Build the responsive source passage panel and citation navigation.
5. Add the active-run status component and replace the generic streaming line.
6. Add first-thread, empty-thread, and insufficient-evidence states.
7. Add contextual error cards and retry behavior.
8. Verify loaded history and live messages render identically.

## Verification

### Backend automated tests

- status and structured error events follow the installed AI SDK data-part
  protocol;
- orchestration reports stages in valid order while repeated retrieval stages
  are coalesced;
- no answer text or citation event precedes successful grounding validation and
  persistence;
- `data-answer-meta` is identical in live and persisted parts;
- known failures map to safe codes and leak no exception details;
- cancellation stops unfinished work and stores no partial turn;
- existing grounding, citation, and API tests remain green.

### Frontend checks

Per repository policy, do not add a frontend test framework. Run:

```powershell
pnpm tsc --noEmit
pnpm lint
pnpm build
```

Then verify manually in the browser:

1. Create the first thread from the no-threads state.
2. Submit a client-brief question and observe real stage changes while waiting.
3. Confirm answer text does not appear before the checking/saving stages finish.
4. Click an inline citation marker and a citation chip.
5. Confirm the panel shows the exact streamed excerpt, filing metadata, and a
   working SEC link.
6. Reload the page and confirm the same citation opens the same passage.
7. Check a multi-citation response, previous/next controls, keyboard focus,
   screen-reader labels, narrow viewport behavior, and long excerpts.
8. Trigger an insufficient-evidence response and confirm it is not presented as
   a system failure.
9. Exercise expired auth, backend unavailable/CORS, retrieval failure, and
   grounding failure; confirm each has the correct recovery action.

The decisive acceptance test is:

> Click citation `[n]` beside a claim and see the exact verbatim excerpt and
> filing identity that the backend validated for citation `n`, both immediately
> after streaming and after a full page reload.

## Implementation order

1. Extend the backend stream contract with answer metadata, progress stages,
   and safe error codes; cover event encoders with unit tests.
2. Add request-scoped progress reporting to agent tools and orchestration.
3. Relay progress concurrently in the route without moving answer emission
   ahead of validation and persistence.
4. Add frontend data-part types, guards, formatters, and error classification.
5. Implement citation markers/chips and the source passage panel.
6. Implement live run status, empty states, and retryable error states.
7. Run backend tests and frontend typecheck/lint/build.
8. Complete the browser verification matrix, then check off Phase 7 in
   `docs/todos.md`.

## Definition of done

- Every citation on live and reloaded assistant messages is visible and
  clickable.
- One click reveals the exact validated excerpt and filing metadata.
- Progress reflects actual pipeline activity without exposing unvalidated
  answer text.
- Insufficient evidence is distinguishable from a pipeline failure.
- Auth, retrieval, grounding, and network failures have distinct safe UI states
  and clear recovery actions.
- Citation navigation is keyboard accessible and usable on desktop and narrow
  screens.
- No new runtime dependency is introduced.
- Backend tests pass; frontend typecheck, lint, and production build pass.
