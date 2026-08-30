# Server

Express API + agent core. Owns every real integration — nothing in `client/`
ever calls Figma, Playwright, axe-core or Claude directly.

```
src/
├── app.js              Express entrypoint, mounts routes
├── routes/              plan.js · validate.js · report.js · webhook.js
├── agent/                planner.js · memory.js · reflector.js
├── validators/           designSystem.validator.js · accessibility.validator.js
│                         workflow.validator.js · confidenceScorer.js
├── tools/                figmaClient.js · playwrightRunner.js · axeRunner.js
│                         claudeClient.js · geminiClient.js · llmClient.js (provider switch)
├── knowledge/            .md skill files — what the agent validates AGAINST
├── prompts/              reference docs for each validator's system prompt
└── models/                run persistence (in-memory for v1)
```

## API

- `POST /api/plan` — `{ figmaUrl?, liveUrl?, prd? }` → which checks are applicable and why
- `POST /api/validate` — `{ figmaUrl?, liveUrl?, requirementId?, checks?[] }` → full UX health report
- `GET /api/reports` — run history
- `GET /api/reports/:id` — a single report
- `POST /api/webhook/ado` — placeholder for a future PR auto-trigger

## Swapping the LLM provider

`validators/designSystem.validator.js` and `validators/workflow.validator.js`
import from `tools/llmClient.js`, not `claudeClient.js` directly. That file
picks Claude or Gemini based on `LLM_PROVIDER` in `.env`:

```env
LLM_PROVIDER=gemini      # use GEMINI_API_KEY (no Anthropic key yet)
LLM_PROVIDER=anthropic   # use ANTHROPIC_API_KEY (default)
```

Get a Gemini key at https://aistudio.google.com/apikey. When your Anthropic
key is ready, just flip `LLM_PROVIDER` back and restart the server — no
validator code changes needed. `accessibility.validator.js` doesn't call
either — axe-core is its deterministic source of truth.

## Extending

- Edit `src/knowledge/**/*.md` to reflect your real design tokens, WCAG list and
  user flows — no code change needed.
- Add a new validator by creating `src/validators/<name>.validator.js`, wiring
  it into `VALIDATOR_FNS` in `routes/validate.js` and `VALIDATOR_REQUIREMENTS`
  in `agent/planner.js`.
- Swap `agent/memory.js`'s in-memory `runHistory` array for a real database
  when you move past the demo stage.
