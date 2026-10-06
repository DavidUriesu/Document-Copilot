# Client-brief evaluation

Run all ten live questions from `backend/`:

```powershell
uv run python evals/run_client_brief.py
```

Run selected questions while tuning:

```powershell
uv run python evals/run_client_brief.py --question 1 --question 6
```

The runner uses the configured Supabase corpus and OpenAI account. It validates
the same grounding contract as production, records citations, tool usage,
progress timing, total latency, and required company/year coverage in
`evals/client_brief_results.json`. An automatic pass proves structural
grounding and coverage; set each `human_review` field after checking factual
support and analytical usefulness.
