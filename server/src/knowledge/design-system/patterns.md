# UX Patterns

> Source: Arvo monorepo `apps/docs/docs/usage/anti-patterns.mdx` plus interaction
> contracts confirmed directly against component descriptors (`descriptors/*.json`).
> The source repo documents implementation-level and trigger-timing patterns, not
> full page-level UX flows — patterns below are enriched into this structure without
> inventing behavior beyond what's confirmed in source. One correction to a
> previously-documented value is flagged explicitly.

---

## Pattern: Overlay disclosure (dropdown menus, action menus, popovers)

### Problem
A trigger element needs to reveal secondary content (menu, list, form) without navigating away, while keeping focus management, ARIA wiring, and dismissal behavior consistent platform-wide.

### When to Use
Any button, icon, or field that reveals a menu, list, calendar, or form panel on interaction (DropdownButton, DropdownIconButton, ActionMenu, ContextMenu, Popover, HybridPopover, Combobox/Select dropdowns).

### Structure
Trigger element (`aria-haspopup`, `aria-expanded`, `aria-controls`) + overlay panel registered with the shared OverlaySurface engine (positioning, focus trap, outside-click, Escape, z-index band).

### User Flow
1. User activates trigger (click, or Enter/Space if focused) → overlay opens, `aria-expanded="true"`.
2. Focus moves into the overlay (or stays on trigger, per component).
3. User selects an item / dismisses via Escape / clicks outside.
4. Overlay closes, focus returns to trigger, `aria-expanded="false"`.

### Best Practices
- **Top-level trigger is always click, never hover** — confirmed across every dropdown-family descriptor.
- **Nested submenus** may use `submenuTrigger: 'hover'` (200ms delay) or `'click'` — this is a distinct, narrower surface from the top-level trigger rule; don't conflate the two.
- Use the dedicated composite component (DropdownButton, ActionMenu, HybridPopover) rather than hand-wiring a plain Button + Popover — the dedicated component sets `aria-haspopup`/`aria-expanded`/`aria-controls` and focus return automatically.

### Anti-Patterns
- Manually wiring Button+Popover and forgetting the ARIA attributes the dedicated component would have set for free.
- Simulating modality with a manual backdrop `<div>` instead of the component's `modal` mode.
- Closing an overlay by removing it from the DOM instead of calling `close()`/`onOpenChange(false)` — breaks focus return.

### Accessibility Notes
Outside-click and Escape dismissal are unconditional and silent (no `onClose` fired). Only programmatic/field-driven closes fire the cancellable callback. Overlays at the modal z-index band (1200–1299) trap focus; non-modal disclosures don't block the page.

### Validation Rules
1. Trigger opens overlay on `mouseenter` instead of `click` (top-level, non-submenu) → flag High, Platform Pattern.
2. Trigger missing `aria-haspopup`/`aria-expanded` while controlling a visible overlay → flag High, Accessibility.
3. Overlay-open button lacking a `.open`/equivalent visual state → flag Medium, Design System.

---

## Pattern: Tooltip disclosure

### Problem
Supplemental, non-critical information needs to surface on hover/focus without being mistaken for the element's accessible name or without causing flicker on incidental pointer movement.

### When to Use
Any element where a short text hint helps but isn't required to understand or operate the control (icon button clarification, truncated-label recovery, keyboard-shortcut hints).

### Structure
Trigger element + singleton tooltip bubble (only one visible platform-wide at a time), positioned via the shared collision-aware engine (flips across top/bottom/left/right).

### User Flow
1. Pointer hovers trigger → after delay, tooltip fades in. **OR** trigger receives keyboard focus → tooltip appears immediately, no delay.
2. Pointer leaves / focus moves away → tooltip dismisses.

### Best Practices
- **⚠️ Corrected value:** default hover delay is **400ms** (not 200ms as previously documented) — confirmed directly in the Tooltip descriptor's `hoverDelay` field, specifically to prevent flicker on quick mouse passes.
- Keyboard focus shows the tooltip with **no delay** — this is intentionally asymmetric with hover.
- Tooltip content must stay non-interactive (`pointer-events: none`, `user-select: none`); for interactive supplemental content (header/badge/actions), use RichTooltip instead, which is a distinct component with its own hover/focus contract and a panel hover-bridge.
- Hover listeners are gated by `@media (hover: hover) and (pointer: fine)` — touch devices should rely on visible labels instead of relying on tooltip disclosure.

### Anti-Patterns
- Using tooltip content as the *only* source of an element's accessible name — the trigger must already have a real accessible name; tooltip is supplemental only.
- Interactive content (a button, a link) inside a plain Tooltip instead of RichTooltip.

### Accessibility Notes
Managed by a singleton manager — only one tooltip visible platform-wide at any time.

### Validation Rules
1. Tooltip hover delay implemented at anything other than ~400ms → flag Medium, Platform Pattern.
2. Icon-only trigger whose *only* accessible-name source is tooltip content (no `aria-label` on the trigger itself) → flag High, Accessibility.
3. Interactive elements found inside a plain-tooltip bubble → flag Medium, Custom Component (should be RichTooltip).

---

## Pattern: Destructive action confirmation

### Problem
Irreversible or high-consequence actions (delete, remove) need a deliberate confirmation step that can't be dismissed accidentally.

### When to Use
Any delete/remove action, or any action the product considers equivalently destructive.

### Structure
AlertDialog with `hasDangerAction: true` — swaps the primary footer button for a red/negative-styled danger button. Footer holds a right-aligned button group: secondary (Cancel, default label) to the **left**, primary (danger) to the **right**, each with a 112px minimum width. AlertDialog is capped at a maximum of 3 footer actions (in practice: primary + optional secondary, since it's semantically a 2-button surface).

### User Flow
1. User triggers a destructive action.
2. AlertDialog opens (modal, scrim, focus trap) — never auto-dismisses on outside click by default.
3. User confirms (danger button) or cancels (secondary button, or Escape).
4. Dialog closes; focus returns to the trigger.

### Best Practices
- Route every destructive action through AlertDialog rather than a bare `confirm()` or a custom-built modal.
- Keep the secondary/Cancel button's default label as "Cancel" unless there's a strong product reason to rename it.

### Anti-Patterns
- A destructive action that executes immediately on a single click with no confirmation step.
- A custom-built confirmation modal that doesn't share AlertDialog's focus-trap/scrim/no-auto-dismiss contract.
- Primary (danger) button placed to the left of Cancel — footer order is fixed platform-wide.

### Accessibility Notes
Modal, scrim via the shared `mask` overlay primitive, focus trap, Escape-to-cancel. Built on the overlay hub at the modal z-index band.

### Validation Rules
1. A delete/remove control with no confirmation step at all → flag High, Platform Pattern.
2. Confirmation surface present but Cancel/secondary is right of the danger/primary button → flag Medium, Platform Pattern.
3. More than 3 action buttons in the confirmation footer → flag Medium, Platform Pattern.

---

## Implementation-level anti-patterns (code-level, not visual)

Source: the same anti-patterns doc. These require source-code access, not just
a rendered screen — listed here for completeness and for a future code-aware
validator pass; a purely visual/DOM validator can realistically only catch
items 2, 6, 7, and 8.

1. Deep imports into private module paths instead of the public package entry.
2. Internal selector coupling — styling/querying by BEM class names instead of CSS variables / role-based queries.
3. Direct DOM mutation to control component state instead of the public API.
4. Manual prop/option mutation outside public APIs.
5. Undocumented event dependence (internal coordination events vs. documented public events).
6. Hardcoded token values instead of consuming tokens.
7. Copy-paste forking of library components instead of composing/wrapping.
8. App-level CSS overrides with `!important`.
9. Tests asserting internal markup/classnames instead of role/name queries.
10. Skipping release-note review on version bumps.
11. Mixing framework boundaries (vanilla-JS class inside React, or using `@arvo/core` directly).
12. Using experimental/undocumented props in production.

### Validation Rules (visually detectable subset)
1. Computed styles using literal hex/px values where a token-driven property is expected → flag Medium, Anti-Pattern (#6).
2. `!important` present in computed/inline styles overriding an Arvo component → flag Medium, Anti-Pattern (#8).
3. Markup that visually replicates an Arvo component's structure but doesn't use its real BEM classes/DOM shape → flag Medium, Anti-Pattern (#7, Custom Component overlap — use whichever category is more specific).