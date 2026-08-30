import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));  
dotenv.config({ path: path.resolve(__dirname, "../.env") });

console.log("[startup] FIGMA_ACCESS_TOKEN loaded:", Boolean(process.env.FIGMA_ACCESS_TOKEN));
console.log("[startup] key length:", (process.env.FIGMA_ACCESS_TOKEN || "").length);

// Print full stack traces instead of silently restarting
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});

import planRoute from "./routes/plan.js";
import validateRoute from "./routes/validate.js";
import reportRoute from "./routes/report.js";
import webhookRoute from "./routes/webhook.js";
import explainRoute from "./routes/explain.js";

const app = express();

const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((s) => s.trim());

app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: "5mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "ux-validator-agent-server" });
});

app.use("/api/plan", planRoute);
app.use("/api/validate", validateRoute);
app.use("/api/reports", reportRoute);
app.use("/api/webhook", webhookRoute);
app.use("/api/explain", explainRoute);

// Centralised error handler — every route forwards errors here via next(err)
app.use((err, _req, res, _next) => {
  console.error("[ux-validator-agent] request failed:", err);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
  });
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`UX Validator Agent server listening on http://localhost:${port}`);
});