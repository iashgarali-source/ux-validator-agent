# User flow: [module name] — demo template

Describe the expected flow in plain language first, for human readers and for
Claude's judgement of ordering/dead-ends/intent. Then provide a machine-runnable
`steps` block — the same file is both documentation and an executable script for
Playwright.

## Expected flow (human-readable)

1. User lands on the module's entry screen.
2. User clicks "New request" to start the flow.
3. User fills the required fields and clicks "Submit".
4. A confirmation screen appears showing the request was created.

## Steps (machine-runnable)

Each step needs a `description` and one or more `selectorHints` — Playwright
locator strings tried in order until one matches (e.g. `text=`, `role=`, CSS).

```steps
[
  {
    "description": "Click 'New request' to start the flow",
    "selectorHints": ["text=New request", "role=button[name=New request]"]
  },
  {
    "description": "Submit the request form",
    "selectorHints": ["text=Submit", "role=button[name=Submit]", "button[type=submit]"]
  },
  {
    "description": "Confirmation screen is shown",
    "selectorHints": ["text=Request created", "text=Success"],
    "click": false
  }
]
```

## Workflow checks (WF-01 to WF-10 reference)

- WF-01 Progress indicator shown for multi-step flows
- WF-02 Back navigation available at every step
- WF-03 Interruption recovery (state not lost on refresh/back)
- WF-04 Per-step validation (errors shown inline, not only on submit)
- WF-05 Data persistence between steps
- WF-06 Confirmation screen after completion
- WF-07 Step complexity reasonable (not too many fields per step)
- WF-08 Loading states shown during async actions
- WF-09 Mobile usability of each step
- WF-10 Clear completion path back to a sensible next screen
