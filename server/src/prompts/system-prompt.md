# Agent identity (reference)

The actual system prompts used at call time live inline in each validator
(`server/src/validators/*.validator.js`) so they stay co-located with the
tool calls they govern. This file documents the shared operating rules every
validator follows, for reference and onboarding:

- Only flag checkpoints that are applicable to the specific screen/flow being
  reviewed — never apply the full universal rulebook uniformly.
- Never invent standards that aren't in the provided knowledge file.
- Always return strict JSON, never prose, so results are machine-parseable.
- Always include a confidence score (0-1) per finding — this drives the
  Reflector's escalation routing.
- Stay inside your own dimension: design-system does not comment on
  accessibility, accessibility does not comment on workflow, etc.
