# Railway deployment

Document Copilot deploys as two Railway services from the same GitHub repository:

- `backend`: FastAPI in `backend/`
- `frontend`: the Vite build served as a static SPA from `frontend/`

Both directories contain a `Dockerfile`. Railway detects each Dockerfile after the
service root directory is set, so no custom build or start command is required.

## 1. Production prerequisites

Before creating the Railway services, have these ready:

- a Supabase project with its project URL, anon key, service-role key, and direct
  database connection string
- an OpenAI API key
- this repository pushed to GitHub
- the production corpus under `data/markdown/` in your local checkout

Keep the Supabase service-role key, database URL, and OpenAI key in the backend
service only. `VITE_*` values are compiled into browser JavaScript and must never
contain secrets.

## 2. Create the services

Create one Railway project, then create two empty services named `backend` and
`frontend`. Connect both services to this GitHub repository.

Set each service's root directory under **Settings -> Source**:

| Service | Root directory |
| --- | --- |
| `backend` | `/backend` |
| `frontend` | `/frontend` |

Generate a Railway domain for both services before setting the URL variables.
Keep the two resulting HTTPS URLs handy and omit trailing slashes in variables.

## 3. Configure the backend

Add these variables to the backend service:

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role secret key |
| `DATABASE_URL` | Supabase direct/session Postgres connection string |
| `OPENAI_API_KEY` | OpenAI secret key |
| `OPENAI_CHAT_MODEL` | For example, `gpt-5-mini` |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` |
| `OPENAI_EMBEDDING_DIMENSIONS` | `1536` |
| `OPENAI_REQUEST_TIMEOUT_SECONDS` | `60` |
| `CHAT_TURN_TIMEOUT_SECONDS` | `180` |
| `CHAT_HISTORY_MESSAGE_LIMIT` | `40` |
| `ALLOWED_ORIGINS` | The frontend Railway URL, with no trailing slash |

Use the direct Supabase connection or the session pooler for `DATABASE_URL`.
Do not use the transaction pooler for Alembic migrations.

Under **Settings -> Deploy** configure:

- Pre-deploy command: `alembic upgrade head`
- Healthcheck path: `/health`
- Restart policy: `ON_FAILURE`

Do not set `PORT`; Railway supplies it. The container starts Uvicorn on
`0.0.0.0:$PORT`.

## 4. Configure the frontend

Add these variables to the frontend service:

| Variable | Value |
| --- | --- |
| `VITE_API_BASE_URL` | The backend Railway URL, with no trailing slash |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key |

The frontend Dockerfile declares these as build arguments because Vite embeds
them during `pnpm build`. Changing any `VITE_*` value requires a new deployment.

Set the frontend healthcheck path to `/`. The Nginx configuration listens on
Railway's `PORT`, caches hashed assets, and sends unknown routes to `index.html`
so direct visits to React Router URLs work.

## 5. Configure Supabase Auth

In the Supabase dashboard under **Authentication -> URL Configuration**:

1. Set **Site URL** to the frontend Railway URL.
2. Add the frontend Railway URL to the redirect allow list.
3. Under **Authentication -> Providers -> Email**, enable email confirmation for
   production if it was disabled during development.

For the current public portfolio demo, email confirmation is intentionally
disabled by the project owner after a confirmation email did not arrive.
Email delivery and the confirmation-link flow are not verified. The deployed
smoke test was completed with an existing account; see `docs/todos.md` for scope.

## 6. Deploy and load the corpus

Deploy the backend first. Its pre-deploy command applies the committed Alembic
migrations before the new container starts. Confirm:

```text
https://<backend-domain>/health
```

returns `{"status":"ok"}`. Then deploy the frontend and open its generated
domain.

Migrations create the schema but do not load source documents or embeddings.
Run ingestion from the full local repository, where `data/markdown/` is present.
Put the production backend values in `backend/.env`, then run from `backend/`:

```powershell
uv run python ingest/source_documents.py
uv run python ingest/pipeline.py --upload --full
uv run python ingest/verify.py
```

The full pipeline makes paid OpenAI embedding calls. Use the documented
single-chunk check in `backend/README.md` first if this is a new OpenAI or
Supabase configuration.

## 7. Production smoke test

Verify all of the following:

1. Create and confirm a new email account.
2. Sign in and start a chat.
3. Ask a question that should retrieve a known filing passage.
4. Confirm the answer streams and its citations open the source passage panel.
5. Refresh a nested chat URL to confirm SPA fallback works.
6. Sign out and sign back in to confirm chat history persists.
7. Run `uv run python evals/run_client_brief.py` locally against production and
   review the generated ten-question report before opening the pilot.

## Notes

- The app uses hosted Supabase; do not add a Railway Postgres service.
- No persistent Railway volume is required.
- Railway's legacy `railway.toml` Config as Code path is deprecated, so service
  root directories, health checks, and the pre-deploy command are intentionally
  configured in Railway.
