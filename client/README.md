# Client

React (Vite) app. Thin client — it only talks to the server's REST API under
`/api` (proxied to `http://localhost:4000` in dev, see `vite.config.js`).

```
src/
├── components/    UrlInputForm · PlanPreview · ReportCard · SeverityBadge · ScoreChart · ScreenTabs
├── pages/         NewValidation · Dashboard · ReportDetail
├── api/           client.js — fetch wrapper for backend REST calls
├── App.jsx        router shell
└── main.jsx        entrypoint
```

## Flow

1. `NewValidation` — paste a Figma URL / live URL / requirement ID, calls
   `POST /api/plan`, shows the `PlanPreview`.
2. Confirming the plan calls `POST /api/validate` and routes to
   `ReportDetail`, which renders the full `ReportCard` (severity table,
   per-dimension scores, escalations).
3. `Dashboard` lists run history via `GET /api/reports`.

## Dev

```bash
npm install
npm run dev   # http://localhost:5173, expects the server running on :4000
```
