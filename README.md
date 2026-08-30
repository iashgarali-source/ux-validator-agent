# UX Validator Agent

An AI agent that reviews implemented UI/UX — from a Figma link and/or a live page URL —
against your company's own standards (design system, accessibility, workflow), and
returns a structured UX health report.

Stack: **React (Vite) client** + **Node/Express server**. The server owns every real
integration (Figma API, Playwright, axe-core, Claude API) — the client never talks to
those services directly, only to the server's REST API.

## Project layout

```
ux-validator-agent/
├── client/     React app (input form, plan preview, report dashboard)
├── server/     Express app (agent core, validators, tool integrations, knowledge files)
└── docs/       planning docs
```

See `server/README.md` and `client/README.md` for details on each half.

## Quick start

```bash
npm install                      # installs both workspaces
cp server/.env.example server/.env
# fill in ANTHROPIC_API_KEY and FIGMA_ACCESS_TOKEN in server/.env
npx playwright install chromium  # one-time browser download for the accessibility/workflow validators

npm run dev                      # runs client (5173) + server (4000) together
```

Open http://localhost:5173, paste a Figma URL and/or a live page URL, and click
**Run validation**.

## How a run works

1. Client calls `POST /api/plan` with the input URLs.
2. The **Planner** classifies the input and returns which validators are applicable
   (design-system needs a Figma URL, accessibility/workflow need a live URL).
3. Client confirms the plan and calls `POST /api/validate`.
4. Each applicable validator runs in isolation, loading only the knowledge files and
   tools it needs, and returns findings.
5. The **Reflector** applies contextual checkpoint scoring (satisfied / applicable
   checkpoints, not fixed category weights) and a confidence label per finding.
6. The server returns a UX health report; low-confidence findings are marked for
   designer escalation instead of being silently included.
7. Client renders the report and stores it in run history (`GET /api/reports`).

## Knowledge files

Everything the agent validates *against* lives in `server/src/knowledge/*.md`. Edit
these to reflect your actual design tokens, WCAG checklist and user flows — no code
change needed to update what "correct" means.
