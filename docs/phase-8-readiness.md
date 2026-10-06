# Phase 8 readiness evidence

This records the checks that can be completed before the final Railway
redeployment. Production checks remain open in [`todos.md`](todos.md).

## Completed locally

- The root README contains copy-paste backend/frontend startup commands and the
  complete corpus refresh workflow.
- Chat turns are stored atomically in Supabase. The browser history endpoint
  returns complete durable history, while model context is bounded to the most
  recent configured messages.
- Request state is isolated by authenticated user and thread. There is no
  process-local conversation store or fixed application user; Supabase RLS and
  thread ownership checks remain authoritative. The backend is stateless and
  suitable for multiple Railway workers if the pilot needs them.
- OpenAI embedding clients created for a chat request are closed after the turn.
- Backend logs are JSON and include thread/user IDs, duration, answer status,
  citation count, safe failure category, and rejected-grounding details.
- The stream opens immediately with preparation/search/drafting status events.
  Answer text is emitted only after validation and atomic persistence so an
  unsupported partial answer is never shown. Typical live evaluation turns in
  the pre-fix report completed in roughly 8–30 seconds.
- The offline backend suite and frontend type-check, lint, and production build
  pass. The frontend build has a non-blocking bundle-size warning.

## Required after redeployment

1. Run all ten client-brief questions against the deployed configuration and
   review factual usefulness as well as automatic coverage.
2. Sign out, sign back in, and confirm an existing thread and its citations
   reload correctly.
3. Confirm the Railway backend emits start/completion/failure JSON events and
   that typical turns begin sending status events promptly.
