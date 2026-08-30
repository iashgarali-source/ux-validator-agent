# PRD: REQ-123 — New request creation

> Dynamic per requirement — one file per ticket, not reused across features.
> Referenced by passing `requirementId: "example-req-123"` to /api/validate.

**Goal:** Let a user create a new request from the module's entry screen in
three steps or fewer.

**Acceptance criteria:**
- Entry screen has a clearly visible "New request" action.
- The form validates required fields inline before submit.
- On success, the user sees a confirmation screen with the new request ID.
- The flow is abandon-safe: navigating back does not lose entered data.
