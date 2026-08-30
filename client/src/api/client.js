const BASE = "/api";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export function getPlan({ figmaUrl, liveUrl, prd }) {
  return request("/plan", {
    method: "POST",
    body: JSON.stringify({ figmaUrl, liveUrl, prd }),
  });
}

export function runValidation({ figmaUrl, liveUrl, prd, requirementId, checks }) {
  return request("/validate", {
    method: "POST",
    body: JSON.stringify({ figmaUrl, liveUrl, prd, requirementId, checks }),
  });
}

export function listReports() {
  return request("/reports");
}

export function getReport(id) {
  return request(`/reports/${id}`);
}

// Follow-up Q&A about an already-generated report — no re-validation happens
// server-side, just a plain-language answer grounded in the report JSON.
export function explainReport({ question, report, reportId }) {
  return request("/explain", {
    method: "POST",
    body: JSON.stringify({ question, report, reportId }),
  });
}