# AD05 — States, Accessibility and Feedback

This document covers what an Arvo component does when something happens to it: the interaction and lifecycle states it can express, how loading is signalled, what to show when there is nothing to show, which feedback surface to reach for, and where the accessibility contract splits between Arvo and you. It is written for designers and engineers building o9 prototypes on `@arvo/*` v2.2.5, and it assumes AD02 (which component) and AD04 (how to stand one up) are already answered. Every prop, class, attribute and token below was read out of the Arvo repo; anything that could not be confirmed is marked.

> Base path for every backticked pointer: the Arvo repo root, vendored at
> `APEX/16_ArvoDesignSystem/o9.DesignSystem/`.
> Component API claims are sourced from `packages/ai-context/components/<slug>.md`, which is generated from `descriptors/*.json` and is authoritative over the docs site.

---

## 1. The state model

Arvo expresses state in three places at once: a **prop** you set, a **class or attribute** it renders, and an **ARIA attribute** assistive technology reads. Assert on the third when you test; never write the second yourself.

| State | You set | Arvo renders | ARIA | Notes |
|---|---|---|---|---|
| **Default** | — | `arvo-{abbr}` + `--{variant}` + `--{size}` | — | Block/modifier names are internal. Never author them (`apps/docs/docs/usage/anti-patterns.mdx`). |
| **Hover** | — (CSS only) | `:hover`, always inside `@include hover` | — | The `hover` mixin wraps every hover rule in `@media (hover: hover) and (pointer: fine)` so touch never gets sticky hover — `packages/styles/src/mixins/_hover.scss`. Match this in your own CSS. |
| **Active / pressed** | — (CSS only) for `:active`; `.active` class for row-level current-item | `:active`; `.active` on list/menu/nav rows | — | `.active` on a list row paints `--arvo-color-s-theme-active-4` plus a 2px `border-inline-start` in `--arvo-color-b-theme-active` — `packages/styles/src/mixins/_list-item.scss`. |
| **Focus** | — | native focus | — | Arvo never styles bare `:focus`. |
| **Focus-visible** | — | `:focus-visible` outline | — | See §6. `.focused` is the *virtual* keyboard target used when DOM focus lives elsewhere (filterable menus driving `aria-activedescendant`) — same outline, `packages/styles/src/mixins/_list-item.scss:63-80`. |
| **Selected** | `isSelected` (Button, IconButton, ToggleButton) | `.active` | `aria-pressed` | **Parent-controlled on Button/IconButton** — click does not toggle it. Use `ArvoToggleButton` for a self-toggling control (`packages/ai-context/components/button.md`). |
| **Selected (option)** | `value` / `selectedIds` | option row treatment | `aria-selected` | Listbox family: Select, Combobox, MultiSelect, OptionList, Listbox. |
| **Selected (menu)** | `isChecked` on `MenuItemData` | left-border indicator | `aria-checked` | `menuitemcheckbox` / `menuitemradio`. |
| **Selected (nav)** | `selectedId` / `defaultSelectedId` | sliding left-edge indicator | `aria-current="page"` | `ArvoNav` never matches the URL for you. |
| **Indeterminate** | `isIndeterminate` | mixed box glyph | `aria-checked="mixed"` | Assert `aria-checked="mixed"`, not a class (`apps/docs/docs/usage/testing.mdx`). |
| **Disabled** | `isDisabled` (62 descriptors) | native `disabled`; `.is-disabled` mirror on anchor-based controls | `disabled` / `aria-disabled` | Callbacks do not fire. Disabled controls do not receive focus and do not fire focus/blur (`apps/docs/docs/usage/public-api.mdx`). Rows: `opacity: $arvo-opacity-40; pointer-events: none`. |
| **Read-only** | `isReadOnly` (20 descriptors) | dashed field border | `readonly` | "Value visible but not editable" — stays tabbable and copyable, unlike disabled (`packages/ai-context/components/textbox.md`). |
| **Required** | `isRequired` (17 descriptors) | `arvo-form-lbl--required` indicator | `aria-required="true"` | Set the prop; do not append `*` to the label string. |
| **Invalid / error** | `isInvalid` (18 descriptors) + `errorMsg` + `errorDisplay` | red border; `ArvoMessageAlert` per `errorDisplay` | `aria-invalid="true"` + `aria-describedby` → the alert id | See §3.3. |
| **Loading** | `isLoading` (58 descriptors) / `setLoading(true)` / `data-arvo-loading="true"` on an ancestor | `.loading` class, shimmer or skeleton, `pointer-events: none` | `aria-busy="true"` | Set automatically. Never write `aria-busy` yourself. See §2. |
| **Empty** | `isEmpty` / `emptyState` / `emptyConfig` / `emptyContent` / `isEmptyState` (name varies by host) | `ArvoEmptyState` | root `role="status"` + `aria-live="polite"` | See §3.1–3.2. |
| **Open / expanded** | `isOpen` / `defaultOpen` | `openClass` (`'open'`) on the surface | `aria-expanded` on the trigger | Written by the overlay engine's `triggerAria`, along with `aria-haspopup` and `aria-controls` — `packages/core/src/overlay/overlay-surface.ts`. |

### 1.1 Two naming traps

**`hasError` is not a prop.** `apps/docs/docs/usage/accessibility.mdx:62` says *"`hasError` / `setError(msg)` — renders the error message and sets `aria-invalid="true"`"*. A grep for `"hasError"` across `descriptors/` returns zero hits; the declarative prop is **`isInvalid`**. `setError(message: string | false)` *is* real, as an imperative method / ref handle, on: advance-search, checkbox, checkbox-group, combobox, date-picker, date-range-picker, datetime-picker, multi-select, number-input, radio, radio-group, search, select, textarea, textbox, time-picker. Use `isInvalid` declaratively and `setError()` imperatively; do not pass `hasError`.

**Attribute names in `architecture/14-SHARED-REFERENCE.md` §3 are corrupted** by a bad find-and-replace (`aria-isDisabled`, `.isLoading`, `data-arvo-isLoading`). The real names are `aria-disabled`, `.loading`, `data-arvo-loading`. Do not cite that file.

### 1.2 Do / Don't

| Do | Don't |
|---|---|
| Drive state through the prop or the method, then assert the ARIA attribute. | Add `.loading` / `.active` / `aria-busy` to an Arvo element yourself. |
| Pick controlled **or** uncontrolled per instance and stay there. | Mix `isChecked` with `defaultChecked`, or switch modes after mount — behaviour is undefined (`apps/docs/docs/usage/components.mdx`). |
| Use `isReadOnly` when the value must stay copyable. | Use `isDisabled` to mean "not editable right now" — it also removes the value from the tab order. |
| Let disabled suppress the callback. | Guard your handler with your own `if (disabled) return` — the component already does. |

---

## 2. Loading

### 2.1 The three patterns

Each component declares exactly one `loadingPattern` in its descriptor (`'A' | 'B' | 'C' | null`), always with a `loadingPatternRationale` (`.claude/rules/arvo/descriptors.md`).

| Pattern | Name | Applies to | What the user sees |
|---|---|---|---|
| **A** | Simple overlay | Atomic surfaces — button, badge, input, label, icon, chip, avatar | A shimmer sweep covers the whole element; real content goes `color: transparent`; dimensions are preserved; `pointer-events: none`. |
| **B** | Structured skeleton | Regions with distinct internal parts — menu, list, panel, dialog, popover, calendar | A `.{block}__skeleton` child mimicking the eventual layout is shown; the real `__content` is `display: none`. |
| **C** | Hybrid | Wrappers around children — form group, select/combobox/multi-select, pickers, button group | The wrapper suppresses interaction (`pointer-events: none`, `aria-busy`); children shimmer via the parent cascade; the overlay panel is blocked from opening by a JS guard. On the field family the visible tell is a **spinner replacing the chevron** — a 16px `border-top-color: var(--arvo-color-b-theme)` ring spinning at `arvo-spin 0.7s linear infinite` (`packages/styles/src/components/inputs/_arvo-sel.scss:178-206`). |

Definitions: `architecture/13-COMPONENT-STRATEGY.md:508-536`, `architecture/05-COMPONENT-PIPELINE.md:749-757`.

### 2.2 Who uses which

| Pattern | Components (spot-verified in `descriptors/*.json`) |
|---|---|
| **A** | Button, ButtonLink, IconButton, Avatar, BannerAlert, Breadcrumb, AdvanceSearch, Checkbox, Textbox, Textarea, NumberInput, Search |
| **B** | ActionMenu, OptionList, AlertDialog, Accordion, AccordionItem, Popover, HybridPopover, Listbox, Calendar, TimeDropdown, panel-shell (Panel / SidePanel / Drawer) |
| **C** | ButtonGroup, CheckboxGroup, RadioGroup, AvatarGroup, Select, Combobox, MultiSelect, all four pickers |
| **`null`** | Badge, Calendar-Dropdown family — loading is N/A; they load inside a loading-capable parent |

On the text-field family, Pattern A is applied to the `__field` wrapper, not the native `<input>`, so the pseudo-elements have a positioned parent (`architecture/14-SHARED-REFERENCE.md:722`).

### 2.3 The three ways to trigger it

Every loading-capable component supports all three (`.claude/rules/arvo/scss.md`).

```jsx
// 1. Per component
<ArvoButton label="Run plan" isLoading />        // React
btn.setLoading(true);                            // JS

// 2. Parent cascade — suspend a whole region
<form data-arvo-loading="true">
  <ArvoTextbox label="Horizon" />
  <ArvoButton label="Submit" />
  <ArvoButton label="Cancel" data-arvo-loading-ignore="true" />
</form>

// 3. Around an async handler
btn.setLoading(true);
try { await recalc(); } finally { btn.setLoading(false); }
```

`data-arvo-loading="true"` on **any** ancestor puts every loading-aware descendant into loading; `data-arvo-loading-ignore="true"` opts one back out. This is the supported way to suspend a region (`apps/docs/docs/usage/composition.mdx:121-131`).

Two rules that save you code:
- **`aria-busy="true"` is automatic.** Do not add it, do not override it.
- **The shimmer is the double-click guard.** While loading, the component suppresses interaction at the API level and callbacks do not fire. Do not add a debounce (`apps/docs/docs/usage/components.mdx:279-294`).

### 2.4 Styling hooks

`packages/styles/src/mixins/_loading.scss` exposes three overridable custom properties, settable on your own block:

| Property | Default |
|---|---|
| `--arvo-loading-bg-color` | `var(--arvo-color-s-disabled)` |
| `--arvo-loading-shimmer-color` | `rgba(255, 255, 255, 0.3)` |
| `--arvo-loading-shimmer-speed` | `1.5s` |

Two shimmer keyframes exist: `arvo-shimmer` in the mixin file, and `arvo-skeleton-shimmer` emitted globally from `packages/styles/src/base/_global.scss:8-16` for skeleton bars authored outside the mixin. Buttons use the global one with `--arvo-color-s-pulse-light` / `--arvo-color-s-pulse-dark` (`packages/styles/src/components/actions/_arvo-btn.scss:119-150`) — if you hand-roll a skeleton row for a planning table, reuse that keyframe and that token pair so it matches.

> Historical note: several `CHANGELOG.md` files mention a global `ARVO_LOADING_ENABLED` flag "currently off" that gated all loading states. **No such flag exists in the v2.2.5 source** — a grep across `packages/{core,react,js,styles}/src` finds only a prose reference in `packages/react/src/components/Loader/Loader.mdx:272`. Loading styles are emitted and live. Ignore the changelog wording.

### 2.5 `ArvoLoader` — the explicit alternative

`ArvoLoader` is a standalone presentational primitive (`variant`: `dot` | `circular` | `square`; `size` `sm`/`md`/`lg`; `orientation`; `tone` `theme`/`inverse`/`subtle`; `message`, default `"Loading"`). It carries `role="status"` + `aria-live="polite"` + `aria-label`, and is non-focusable. It **complements, not replaces**, patterns A/B/C: use it where you own the surface and Arvo has no loading state to cascade into — a "load more" row, a lazily-mounted section, an in-flight fetch inside your own card (`packages/ai-context/components/loader.md`). `ArvoTreeView` uses it internally for its async-children row.

### 2.6 Choosing skeleton, spinner, or inline for planning data

Planning screens are slow in specific, predictable ways. Match the visual to the *shape* of what is arriving, not to the duration.

| Situation | Use | Why |
|---|---|---|
| A table, list, or panel whose row count and column layout are already known | **Pattern B skeleton** (or a hand-rolled skeleton on the same keyframe) | Preserves layout; the page does not jump when data lands. This is the default for a planning grid. |
| A single value, KPI tile, chip, or button label refreshing | **Pattern A shimmer** on that element | Keeps the surrounding layout stable and reads as "this one number is stale". |
| A field whose options are being fetched (scenario picker, item selector) | **Pattern C** via `isLoading` on the Select/Combobox/MultiSelect | You get the chevron spinner, the typing block, and the panel-open guard for free. |
| Submitting an action — recalc, publish, commit a scenario | `isLoading` on the submitting button, plus `data-arvo-loading` on the form if the whole region must freeze | Pattern A on the button doubles as the double-submit guard. |
| Paginated "load more", or a region Arvo does not own | **`ArvoLoader`** (`variant="dot"`, `size="sm"`) | The only case where an explicit spinner is correct. |
| A long recalculation with real progress semantics | Neither — say what is happening in text, with an `ArvoLoader` beside it | Arvo ships no progress bar. Do not fake one. |

**Do not** replace a component's loading skeleton with a custom spinner — the checklist lists that as unsupported (`apps/docs/docs/usage/checklist.mdx:84-97`). **Do not** show a skeleton for anything under ~200ms; flicker reads as a bug.

---

## 3. Empty, error and zero states

### 3.1 `ArvoEmptyState`

The one primitive for "there is nothing here". Public and stable, but it has **no docs-site page** — its API lives only in `packages/ai-context/components/empty-state.md`.

| Prop | Type | Default |
|---|---|---|
| `size` | `xs` \| `sm` \| `md` \| `lg` \| `xl` | `md` |
| `orientation` | `vertical` \| `horizontal` | `vertical` |
| `illustration` | token or any `o9illus-*` name | `no-results` |
| `title` | string (empty string suppresses it) | `"No results found"` |
| `message` | string (empty string suppresses it) | `"Adjust your filter search query."` |
| `primaryAction` | `EmptyStateButtonAction \| null` | `null` — renders an `ArvoButton` `size='sm'`, variant `primary` |
| `secondaryAction` | `EmptyStateButtonAction \| null` | `null` — renders left of primary, variant `outline` |
| `link` | `EmptyStateLinkAction \| null` | `null` — an `ArvoLink` `size='sm'` below the buttons |

Six first-class illustration tokens: `no-results`, `no-data`, `no-tasks`, `no-notifications`, `restricted-access`, `dashboard`. Any other `o9illus-*` glyph is accepted as-is; a bare name is auto-prefixed. Sizes: `xs`/`sm` inside overlays and inline regions, `md` for a page section, `lg`/`xl` for hero use.

Accessibility is handled: the root carries `role="status"` + `aria-live="polite"` so the title and message announce once when they appear, `__illus` is `aria-hidden`, and the actions are real `ArvoButton` / `ArvoLink` so keyboard, focus and disabled semantics come free.

### 3.2 The empty slot on every host

You almost never mount `ArvoEmptyState` yourself inside another Arvo component — you hand the host a config and it renders the figure. The prop name is not uniform:

| Host | Prop | Shape |
|---|---|---|
| `ArvoList` | `isEmpty` + `emptyState` | `ArvoListEmptyState`. Omit `emptyState` and the list collapses to zero height instead of showing a figure. |
| `ArvoAccordionItem` | `isEmpty` + `emptyState` | `{ title?, message?, illustration? }`; renders `size='sm'` |
| `ArvoActionMenu`, `ArvoContextMenu` | `emptyConfig` | `Partial<…EmptyConfig>`. ContextMenu with no items and no `emptyConfig` **declines the gesture** and lets the native browser menu show. |
| `ArvoOptionList` | `emptyConfig` | Merged over built-in defaults for `noData`, `noResults`, `noResults + isCreatable`; figure locked to `size='sm'`, `orientation='vertical'` |
| `ArvoHybridPopover` | `emptyConfig` | `HybridPopoverEmptyConfig`, forwarded into the embedded `ArvoList` |
| `ArvoDropdownTree`, `ArvoTreeView` | `emptyConfig` | Overrides copy + illustration |
| `ArvoPopover` | `emptyContent` | Replaces body children entirely |
| `ArvoWindow` | `isEmptyState` + `emptyContent` | Forces auto-derived `size` and `orientation='vertical'` |
| panel-shell (Panel / SidePanel / Drawer) | owned by the shell | Ships two states: no-data illustration, and no-results with a **Clear Search** action |

### 3.3 Zero results vs zero data — they are different states

List-bearing surfaces branch on a **data state**, not a boolean. `ArvoDropdownTree` and `ArvoHybridPopover` declare it explicitly (`data` / `noData` / `noResults` — HybridPopover adds `appliesToAll` and auto-hides its footer on `noData`); `ArvoOptionList` derives it. Reflect the same distinction in anything you hand-build:

| Branch | Meaning | Copy pattern | Recovery |
|---|---|---|---|
| `noData` | The source is genuinely empty | State the fact, not the failure — "No open exceptions" | Often none. Do not offer "Clear filters" when no filter is applied. |
| `noResults` | The source has rows; the current query/filter excludes them all | "No items match 'X'" | **Always** offer the undo — Clear search / Reset filters |
| `restricted` | The user is not permitted | Say so plainly; illustration `restricted-access` | A route to request access, or nothing |
| `error` | The fetch failed | Not an empty state — see §4 | Retry |

### 3.4 Form validation surfaces

`ArvoMessageAlert` (`arvo-msg-alert`) is the atomic validation primitive under every form input. Two modes:

- `isInline={false}` (default) — icon + message + optional dismiss. This is the row below a field, and the panel-shell `__info` slot.
- `isInline={true}` — **icon only**, 16×16. This is the in-field error icon used when `errorDisplay === 'tooltip'`. `message` and `isDismissable` are ignored, but a string `message` is mirrored into `aria-label`.

Six types: `negative` (default), `positive`, `warning`, `info`, `neutral`, `block`. Note `error` → `negative` and `success` → `positive` were renamed to match the rest of the alert family; the older names survive in some architecture prose (`packages/ai-context/components/message-alert.md`).

`role` defaults to `"auto"` and resolves from `type`: negative / warning / block → `alert` (assertive); info / positive / neutral → `status` (polite). Pass it explicitly to override. The role applies in both modes.

Form inputs choose the presentation with **`errorDisplay`** (13 descriptors):

| Value | What renders | ARIA |
|---|---|---|
| `'inline'` (default) | `ArvoMessageAlert` below the field; the character counter is hidden while it is visible | `role="alert"`; input `aria-describedby` → the alert id |
| `'tooltip'` | Inline icon inside `__field`; message in a tooltip; `.error-tooltip` on the root | Message via `aria-label` |
| `'none'` | State only — the red border still applies via `isInvalid` | `aria-invalid` only |

Default message constant when `errorMsg` is null: `ARVO_MSG_ALERT_DEFAULT_ERROR` = `"Form field value is invalid"` — always override it with something a planner can act on.

`isDismissable` (note the two-a spelling) renders an internal `ArvoIconButton` (`size='xs'`, `icon='close'`, `tooltip='Dismiss'`) only when `isInline={false}`. It fires `msg-alert:dismiss` + `onDismiss` but **does not remove itself** — you own visibility.

### 3.5 Writing empty and error copy

| Do | Don't |
|---|---|
| Name the thing that is missing: "No exceptions above threshold". | "No data." — true and useless. |
| Distinguish "none exist" from "none match". Offer the undo only in the second case. | Ship the default `"No results found"` / `"Adjust your filter search query."` on a page-level empty state. |
| Put the recovery in `primaryAction`, the alternative in `secondaryAction`, the explainer in `link`. | Write a paragraph in `message`. It is a 14px regular line, not a body slot. |
| Say what to do next in an error: "Retry", "Check the scenario is published". | Surface a stack trace, a status code, or "Something went wrong". |
| Keep the required indicator on `isRequired`. | Append `*` to the label string. |

---

## 4. Feedback hierarchy

Six surfaces, and picking wrongly is the most visible design error in a planning UI. Decide on three axes: **urgency**, **persistence**, and **must the user act**.

| Surface | Blocks? | Persists? | User must act? | Placement | Reach for it when |
|---|---|---|---|---|---|
| `ArvoStatus` | no | with the entity | no | inline, or corner-overlaid on a `corner-host` | The state *is* an attribute of a thing — a row, an avatar, a tab, a node. 19 types across progress / priority / generic-semantic families. |
| `ArvoBadge` | no | with the entity | no | inline or `top-right` | You are carrying a **label or a count**, not a state glyph. Badge = `label` \| `counter`; Status = state. Badge supports `inline` + `top-right` only; Status adds `bottom-right`. |
| `ArvoMessageAlert` | no | until you remove it | usually yes, in-place | under a field, or the panel `__info` slot | Field-level or region-level validation. The atomic row. |
| `ArvoBannerAlert` | no | until dismissed | maybe | full-width, page or panel level | A condition that stays true while the user works — stale data, degraded connector, a scenario in review. Also the panel-shell `__banner` strip. |
| `ArvoToast` | no | seconds | no | overlay, `top-right` (default) or `bottom-right` | The result of an action the user just took, that they do not need to act on. |
| `ArvoAlertDialog` | **yes** | until answered | **yes** | centred modal + scrim | An irreversible or ambiguous decision. Never auto-dismisses on outside click by default. |

### 4.1 The decision, as a sequence

```
Is it a property of one entity on screen?            -> Status (state) or Badge (count/label)
Is it about one field or one region's validity?      -> MessageAlert
Does the condition remain true while they work?      -> BannerAlert
Did they just do something, and it worked?           -> Toast
Must they choose before anything else can happen?    -> AlertDialog
None of the above, and it needs explaining?          -> Popover / RichTooltip, not an alert
```

### 4.2 Toast specifics that change the design

`ArvoToast` derives its auto-dismiss duration from `type` (`packages/ai-context/components/toast.md`):

| `type` | Duration | Default role |
|---|---|---|
| `positive`, `neutral` | 4000 ms | `status` (polite) |
| `info` (default) | 5000 ms | `status` |
| `warning` | 6000 ms | `status` |
| `negative` | 8000 ms | `alert` (assertive) |
| `block` | **persistent** — never auto-dismisses | `alert` |

Hover pauses the timer and pins the toast; leaving restarts the timeout from the beginning. `timeout` overrides the type default (ignored for `block`). `fadeAway={false}` makes any type persistent; `block` forces it false regardless. Position is a **container-level** setting shared by every toast from one manager — `top-right` | `bottom-right` only; the left placements were removed. The `link` slot takes `{ label, href, icon?, isExternal?, onClick? }` and renders an internal `ArvoLink` — never append your own anchor to the toast DOM.

**Design consequence:** a toast is not a place for anything the user might need again. If a planner would want to re-read it 30 seconds later, it is a BannerAlert or a row in a log, not a toast.

### 4.3 AlertDialog specifics

Differs from Popover in three explicit ways: centred/modal (not anchored), always paints a scrim through the shared mask, and demands explicit action. `closeOnBackdrop` defaults to **`false`**. `closeOnEscape` defaults to `true`, and the Escape path is engine-driven — `onClose` is **not** called, `alert-dlg:close` is **not** dispatched, and `secondaryAction.onClick` is **not** invoked. Observe every dismissal path through `onOpenChange(false)`.

`confirmInput` with `expectedValue` gives you the canonical "type DELETE to confirm" gate: the primary button stays disabled until the input matches. `hasDangerAction` swaps the primary for the danger variant. `bannerAlert` nests an `ArvoBannerAlert` between header and body for context that should not compete with the message.

### 4.4 Stacking, and what "z-index band" means

Component prose quotes bands ("toasts at 1300-1399", "modal at 1200-1299"). **Those numbers are not shipped values.** At runtime the overlay hub allocates `z = zIndexBase + stackIndex * 10` with `zIndexBase: 1000`, over a flattened tree ordering where roots sort by `rootStackPriority` — `tooltip = 2`, `toast = 1`, everything else `0` (`packages/core/src/overlay/overlay-hub.ts:228-343`). The practical guarantee is the ordering, not the integer: **tooltips are always topmost, toasts next, children always outrank their parents.** Component SCSS declares `z-index: var(--arvo-z-popover, 1000)` as a pre-hydration fallback; `--arvo-z-*` is not a token in `packages/tokens` — it is a fallback var name only. If your app shell sits in a high stacking context, raise `overlayHub.configure({ zIndexBase })` app-wide rather than setting per-overlay `zIndex`.

Also relevant to feedback: opening a `modal` or `side-panel` **closes** every open dropdown, popover, and action-menu (`DISPLACED_BY_MODAL`). Do not design a flow where a menu selection must stay visible behind a dialog.

---

## 5. Accessibility contract

The governing rule, verbatim (`apps/docs/docs/usage/accessibility.mdx:11`):

> Use components in the accessible pattern they were built for. Provide required labels and descriptions. Don't strip `aria-*`, `role`, focus styles, or focus management; don't recreate accessibility behavior that the component already provides.

### 5.1 What Arvo guarantees

When used as documented, every `Arvo*` component ships:

1. The correct semantic role (button, checkbox, combobox, dialog, listbox, menu, tab, …).
2. The ARIA wiring for that widget pattern — `aria-haspopup`, `aria-expanded`, `aria-controls`, `aria-activedescendant`, `aria-selected`, `aria-checked`.
3. Keyboard support per the WAI-ARIA Authoring Practices for that pattern.
4. Visible focus styles on every interactive element.
5. Focus management for overlays — trap inside open dialogs/popovers, return to the trigger on close.
6. Live-region announcements where applicable (toasts, message alerts, error messages).
7. `aria-busy="true"` while loading.
8. `disabled` / `aria-disabled` semantics on disabled controls.

### 5.2 What you must supply

**Accessible names** (`accessibility.mdx:40-52`):

| Component family | Required label source |
|---|---|
| Textbox, Textarea, NumberInput, Search, Select, Combobox | `label` prop (renders a `<label>`) **or** `aria-label` / `aria-labelledby` |
| Checkbox, Radio, Switch | `label` prop **or** wrapped in a CheckboxGroup / RadioGroup with a group label |
| CheckboxGroup, RadioGroup | `label` prop |
| Listbox | `label` prop or `aria-label` |
| **IconButton, FabButton, IconButtonLink** | `label` prop (renders `aria-label`) — **mandatory** |
| Button, ButtonLink, Link | `label` prop (the visible text) |
| Tooltip | the trigger supplies the name; the tooltip is supplemental |
| Badge | label text / counter `aria-label` |
| Toast | `title` plus `description`; the live region announces both |
| Dialog / overlay | `title`, or `aria-labelledby` pointing at the title element |

Plus, in order:

- **Descriptions** — use `description` / `helpText` / `errorMsg`; the component wires `aria-describedby`. Do not hand-roll a `<p>` and link it manually unless the component has no description prop.
- **Required and invalid** — `isRequired` → `aria-required="true"`; `isInvalid` / `setError(msg)` → the message plus `aria-invalid="true"` and `aria-describedby`.
- **Heading order and landmarks** — Arvo ships **no page-layout components** and therefore no `<h1>`–`<h6>` order and no landmark structure. `ArvoNavPanel` renders a `<nav>` landmark in docked mode; `ArvoBreadcrumb` renders `role="navigation"` when given a `label`. Everything else — one `<h1>` per screen, descending heading order, `<main>`, `<header>`, `<aside>` — is yours. This is the single largest a11y gap when standing up a prototype.
- **Meaningful alt text** — Arvo marks its own decorative glyphs `aria-hidden` (`ArvoEmptyState.__illus`, `ArvoBadge.__ico`, `ArvoStatus.__ico`). Any image you bring is yours to describe.
- **Colour-independent meaning** — never rely on colour alone; pair it with an icon or text (`accessibility.mdx:191`). `ArvoStatus` already does this: 19 types, most rendered as a circle, but `critical` and `warning` as a **square**, and every type carries a distinct `aria-label`.

### 5.3 The Don'ts

| Don't | Because |
|---|---|
| `<ArvoIconButton icon="trash" />` with no `label` | No accessible name at all. |
| `<ArvoCombobox role="textbox" />` | Breaks the combobox pattern. |
| `.arvo-btn { outline: none !important }` / `*:focus { outline: 0 }` | Kills the focus ring. Use `.focus-border` (§6) if it collides. |
| `<ArvoListbox onKeyDown={handleArrowKeys} />` | Duplicates the APG keyboard map and fights it. Add extra shortcuts at a higher container scope. |
| Portal an Arvo overlay yourself, `el.focus()` something else while it is open, or close it by removing it from the DOM | Breaks the focus trap and the focus return. Always call `close()` / `onOpenChange(false)`. |
| Set two of `label`, `aria-label`, `aria-labelledby` | Conflicting names; the screen reader may pick the worse one. |
| `<ArvoButton as="div" />`, `<ArvoLink as="span" />` | Tag swapping is unsupported. The element type is part of the contract. |
| Simulate modality with your own backdrop | Popover / HybridPopover / ActionMenu have a `modal` mode. |

### 5.4 Keyboard map summary

Component-owned. Never re-implement. This is the summary; the per-component table lives in `packages/ai-context/components/<slug>.md` under **Accessibility → Keyboard**.

| Pattern / component | Keys |
|---|---|
| Button, ButtonLink | `Enter`, `Space` activate; `Tab` / `Shift+Tab` move |
| Checkbox | `Space` toggles; indeterminate clears to checked; disabled leaves the tab order |
| Switch | `Space` **and** `Enter` toggle (Enter is wired explicitly); blocked when disabled, readonly, or loading |
| Listbox / OptionList / Select | `Up`/`Down` move the highlight, `Home`/`End` jump, type-ahead matches, `Enter`/`Space` select, `Escape` closes and returns focus. Multi keeps the surface open. `Tab` no longer auto-selects the highlight. |
| Combobox | Typing filters and opens; `Down` moves into options; `Enter` selects the highlight; `Escape` closes, then clears typed text |
| MultiSelect | As Combobox, plus `Left`/`Right` walk a chip cursor via `aria-activedescendant` (focus stays in the input); `Backspace`/`Delete` remove the highlighted or last chip |
| ActionMenu / ContextMenu | `Up`/`Down`/`Home`/`End`, `Enter`/`Space` activate, type-ahead (300 ms buffer), `Escape` pops one inline panel → closes a submenu → closes the menu. `Right`/`Left` open/close submenus and step into trailing row actions. `Tab` cycles only search ↔ active row. |
| List | `Tab` enters at the roving-active row; arrows + `Home`/`End`; `Space` toggles/selects; `Enter` activates; `Shift+Space` range-selects; `Ctrl/Cmd+A` selects all; `Escape` cancels a drag; `Shift+F10` / `Ctrl+Shift+X` fires the context menu |
| TreeView | Arrows per APG — `Right` opens then descends, `Left` closes then ascends; **no wrap**; `Enter`/`Space` routed by `variant`; type-ahead |
| Tabstrip | Arrows (wrapping) + `Home`/`End`; `Enter`/`Space` select; `Delete`/`Backspace` close a closable tab; `Shift+F10` / `Ctrl+Shift+\` open the tab menu; `Ctrl/Cmd+P` toggles pin |
| Nav | `Tab` enters at the selected item; arrows wrap; `Enter` activates (anchors are Enter-only per APG); `Space` for button items |
| Accordion | `Tab` between headers; `Enter`/`Space` toggle; arrows wrap; `Home`/`End` |
| Breadcrumb | `Tab` to links and the overflow trigger; `Enter` navigates or opens; `Down` opens the overflow menu |
| ChipList | Filter lists roam with arrows from a single tab stop; general/input lists make each chip a tab stop; `Backspace`/`Delete` remove a dismissible input chip |
| Popover | `Escape` closes and returns focus; `Tab` cycles inside when interactive |
| AlertDialog | `Escape` closes (engine-driven, unconditional); `Tab` order is close-btn → confirm-input → don't-show → secondary → primary |
| DatePicker | `Alt+Down` opens and focuses the selected/today cell; `Alt+Up` closes; `Enter` commits; `Escape` closes and **preserves the last applied value**; segment `Left`/`Right` move, `Up`/`Down` increment with month-aware bounds, `0-9` auto-advance |
| Any non-modal overlay | No keyboard trap (WCAG 2.1.2); focus returns to the trigger on close |

The substrate behind most of this is `createArrowNav` in `packages/core/src/keyboard/arrow-nav.ts` — arrow navigation, `skipDisabled`, and type-ahead with a 300 ms debounce (`TYPE_AHEAD_DEFAULT_MS`). It is shared byte-identically by `@arvo/react` and `@arvo/js`.

### 5.5 Live regions Arvo already owns

Do not add a second announcer over these.

| Component | Announcement contract |
|---|---|
| `ArvoToast` | `role` from `type`: `status`/polite, or `alert`/assertive for negative and block. Uses `aria-live`, `aria-atomic`, `aria-label`. Announces title + message. |
| `ArvoBannerAlert` | Same derivation. **React: prop changes across re-renders work. JS: read once at construction** — rebuild the instance to change it. |
| `ArvoMessageAlert` | `aria-live` implicit via the resolved `role`. |
| `ArvoEmptyState` | Root `role="status"` + `aria-live="polite"`. |
| `ArvoLoader` | `role="status"` + `aria-live="polite"` + `aria-label` (falls back to `"Loading"`). |
| `ArvoStatus` | `role="img"` with `aria-label` from `tooltip` or the type's default label; `__ico` is `aria-hidden`. Not focusable. |
| `ArvoBadge` | `role="status"` by default; set `role="alert"` for urgent. Counter badges auto-generate a label ("99 or more", "2 out of 100"). Not focusable. |
| `ArvoChipList` | Internal polite region announcing selection changes, dismissal, and overflow-count changes. |
| `ArvoTreeView` | `aria-live` region for expand / collapse / async-load transitions. |
| `ArvoDateRangePicker`, `ArvoCalendarRangeDropdown` | `aria-live="polite"` for range and member messaging. |
| Filter result counts | Announced `aria-live="polite"` (WCAG 4.1.3) — `architecture/17-OVERLAY-COMPOSITION-STRATEGY.md:661`. The panel-shell helper is `formatMatchCountMessage` in `packages/utils/src/panel-shell.ts:588`. |

`ArvoTabstrip` composes a per-tab accessible name when `ariaLabel` is omitted: `'<label> tab[, selected][, <badge>][, <alertLabel>][, status: <statusLabel>][, pinned]'`. Copy that pattern when you build a composite row of your own.

### 5.6 The WCAG commitments Arvo makes

From `architecture/17-OVERLAY-COMPOSITION-STRATEGY.md:653-670`:

| Criterion | Commitment |
|---|---|
| 1.3.1 | Correct roles; grouped options wrapped in `role="group"` + `aria-labelledby` to the group header |
| 2.1.1 / 2.1.2 | Full keyboard operability; modal traps are escapable |
| 2.4.3 / 3.2.1 | Predictable focus into the overlay and back to the trigger; **focusing a trigger never auto-opens it** |
| 2.4.7 / 2.4.11 | Visible focus; `scrollToIndex` keeps the active option in view; positioning keeps the surface in the viewport |
| 2.5.8 | Option and menu rows ≥ 24×24 (Arvo rows are 32 / 40 px) |
| 1.4.11 | **3:1 non-text contrast** on selection, active and focus indicators |
| 4.1.2 / 4.1.3 | Correct name/role/value; filter counts announced politely |
| 1.4.13 | Tooltips and hover overlays are dismissable, hoverable, persistent |

Contrast of your own colour choices is not covered by any of this. AD01 has the token values; run them.

---

## 6. Focus management and the focus ring

### 6.1 The ring

The canonical pattern, from `packages/styles/src/components/actions/_arvo-btn.scss:86-94`:

```scss
&:focus-visible {
  outline: 1px solid var(--arvo-color-b-theme-focus);
  outline-offset: $arvo-space-2;      // 2px
}

&.focus-border:focus-visible {
  outline-offset: -1px;               // inset, for dense/adjacent layouts
}
```

Three facts that follow:

1. **`--arvo-color-b-theme-focus` is the one focus colour.** It is theme-aware (`#010101` under `o9theme`, `#3D6DCC` under `o9default` (Sky Blue), and so on) and defined in `packages/tokens/src/scss/_root.scss`.
2. **The ring is `:focus-visible` only.** Arvo never paints a ring on mouse `:focus`. Do not add one.
3. **`.focus-border` is the only sanctioned adjustment.** It flips the offset to `-1px` so the ring sits inside the element instead of colliding with a neighbour. `ArvoButtonGroup` applies it automatically. Verified on `_arvo-btn.scss:92` and `_arvo-toggle-btn.scss:104` — it is not a global utility, so it works on buttons and toggle buttons, not on arbitrary elements.

Customising the focus ring's offset or colour is listed as **unsupported** in the customization matrix: *"focus is part of the a11y contract"* (`apps/docs/docs/usage/checklist.mdx:84-97`).

A 1px outline plus a 2px offset needs 3px of clearance. When laying out a dense planning toolbar, reserve it — do not solve the collision by removing the ring.

### 6.2 Focus inside overlays

The overlay surface engine owns this. Two modes (`packages/core/src/overlay/overlay-surface.ts`):

| `focus.mode` | Behaviour | Used by |
|---|---|---|
| `'trap'` | DOM focus moves into the surface and Tab cycles within it | AlertDialog, interactive Popover, ActionMenu (+ submenus), Drawer / SidePanel (after the transition), pickers |
| `'none'` (default) | DOM focus **stays on the trigger**; the component drives `aria-activedescendant` | OptionList, Select, Combobox, MultiSelect, Listbox |

Sub-options: `initialFocus` (`HTMLElement | 'first' | 'none'`, default `'first'`), `returnFocus` (default `Boolean(trigger)`), `escapeDeactivates`, `allowOutsideClick`, `getOrderedElements` for a custom tab order, and `activateAfterTransition` (set `true` for slide-in panels so the trap activates after the animation).

### 6.3 The focus-return guard you must not fight

Both engines re-focus the trigger on close **only** when focus has been lost (`null`, `body`, `documentElement`) or is still inside the closing surface. If focus legitimately moved elsewhere — for example a sibling dropdown that the hub's stacking rules just opened — the engine leaves it alone (`packages/core/src/overlay/overlay-surface.ts:626-669`, `packages/react/src/hooks/useOverlaySurface.ts:341-377`). The trap's `returnFocusTo` is a **function** (`() => _trigger`), resolved at deactivation time, not at activation.

Consequence: if you call `el.focus()` in an `onClose` handler you are racing the engine and will produce a focus flicker. Let it return, then move focus in a follow-up frame if you truly need to.

### 6.4 Rules of thumb

| Do | Don't |
|---|---|
| Give a trigger to the component (`triggerRef` / `trigger`) and let it wire `aria-haspopup` / `aria-expanded` / `aria-controls`. | Wire those by hand when a dedicated disclosure component exists. |
| Close overlays with `close()` / `onOpenChange(false)`. | Unmount an open overlay — focus goes to `<body>` and never returns. |
| Move focus into new content **you** render (e.g. a newly expanded region) explicitly. | Assume Arvo will move focus into DOM it does not own. |
| Call `overlayHub.closeAll()` on SPA route change if your router does not emit `popstate`. | Leave an overlay trapped over a page that no longer exists. |
| Use `getOrderedElements` when the tab order must differ from DOM order. | Reorder the DOM to fake a tab order. |

---

## 7. The truncation-tooltip precedence rule

Stated precisely, because it is the rule prototypes break most often.

**(a) Which components take a `tooltip` prop.** `apps/docs/docs/components/overlays/tip.mdx:34`, verbatim:

> Label-bearing components (`ArvoButton`, `ArvoDropdownButton`, `ArvoSplitButton`, `ArvoButtonLink`) do **not** accept a `tooltip` prop — wrap them with `ArvoTooltip` when one is needed. Only icon-only components (`ArvoIconButton`, `ArvoIconButtonLink`, `ArvoFabButton`, `ArvoDropdownIconButton`, `ArvoSplitIconButton`) expose a single `tooltip` / `label` prop because the value also drives `aria-label`.

**(b) The precedence.** Every tooltip connection declares a `kind` (`packages/core/src/tooltip/types.ts:42-65`):

- `'explicit'` (default) — a consumer-wired tooltip: a wrapping `<ArvoTooltip>`, or `ArvoTooltip.initialize(el, …)`. It registers the anchor in a module-level reference-counted `WeakMap` and uses `aria-describedby` description semantics.
- `'truncation'` — a component-internal recovery affordance for a visually clipped label. It **skips `aria-describedby`**, because the full text is already part of the anchor's accessible name and a description would make assistive tech announce it twice.

The rule, in three clauses:

1. **A truncation tooltip shows only when the label is actually clipped at runtime.** The gate is `isTruncated(el)` = `el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight` (`packages/core/src/dom/truncation.ts:12-16`).
2. **An explicit tooltip always wins.** A `'truncation'` connector yields whenever an explicit owner exists **on the same anchor or on any ancestor** — the walk is `hasExplicitInAncestors`, climbing `parentElement` to the root (`packages/core/src/tooltip/tooltip-connector.ts:47-55`). So a card-level `<ArvoTooltip>` suppresses the truncation tooltip on every truncated label inside that card.
3. **Collision is evaluated before measurement.** The explicit owner wins even when the label genuinely is truncated (`tooltip-connector.ts`, `shouldSuppress`).

**(c) Where it is wired.** `ArvoButton` exposes it as a prop — `hasTruncationTooltip`, **default `true`** (`descriptors/button.json:291`). Everywhere else it is automatic and has no prop: Toast, BannerAlert, AccordionItem, List / ListItem, Tabstrip, ActionMenu and the option-list / menu row renderers all call `attachTitleTruncationTooltip` internally (verified across `packages/react/src` and `packages/js/src`).

**(d) The util, if you build a truncating surface of your own.** `attachTitleTruncationTooltip({ element, content, placement? })` from `@arvo/utils` composes `connectTooltip` with `autoOnTruncation: true` plus a `ResizeObserver`. The handle exposes `update(content)` and `destroy()`. **Always call `destroy()` before removing the host element.**

> **`showTooltipOnOverflow` does not exist.** `apps/docs/docs/components/overlays/tip.mdx:34` suggests *"use a truncation-aware prop (e.g. `showTooltipOnOverflow`)"*. No component ships a prop by that name: a grep across the whole repo finds it in exactly three prose lines — that sentence in `tip.mdx`, plus `.claude/rules/arvo/react.md:75` and `.cursor/rules/react-components.mdc:70`, which repeat it. It appears in no descriptor and no source file. Treat `showTooltipOnOverflow` as a naming aspiration; the only shipped prop is `hasTruncationTooltip` on Button.

**Design consequence.** If you wrap a truncated row in your own explanatory tooltip, you silently disable the label-recovery tooltip for everything inside it. In a planning table that is a real loss — the SKU name *is* the recovery. Put your tooltip on a sibling info affordance instead of on the row.

---

## 8. Reduced motion and contrast

### 8.1 Reduced motion — what Arvo actually covers

`apps/docs/docs/usage/accessibility.mdx:165` says *"`@arvo/styles/base` respects `prefers-reduced-motion`."* That is narrower than it reads. The global block in `packages/styles/src/base/_global.scss:31-38` covers **loading shimmers only**:

```css
@media (prefers-reduced-motion: reduce) {
  .loading::before, .loading::after,
  [data-arvo-loading="true"] *::before,
  [data-arvo-loading="true"] *::after { animation: none !important; }
}
```

The static skeleton background stays; only the sweep stops.

Per-component guards are real and widespread — **32 SCSS files** carry a `prefers-reduced-motion: reduce` block, including `_popup-animation.scss:87` (every trigger-anchored overlay), `_inline-panel-stack.scss:124`, `_arvo-alert-dlg.scss:350`, `_arvo-pnl.scss:220,590`, `_arvo-win.scss:444`, `_arvo-sp.scss:182`, `_arvo-drw.scss:139`, `_arvo-dd-tree.scss:347`, `_arvo-tabs.scss:624,733`, `_arvo-nav.scss:119,534,595`, `_arvo-toast.scss:255`, `_arvo-loader.scss:254`, `_arvo-sts.scss:206`. On the JS side, `enter()` / `exit()` resolve immediately under reduced motion, and `@arvo/core` exports `prefersReducedMotion()` and `onReducedMotionChange()` (`packages/core/src/animation/reduced-motion.ts`).

**Net: Arvo covers its own animated surfaces. Every animation you add is yours to guard.** The documented pattern:

```scss
@use '@arvo/tokens/scss' as *;

@media (prefers-reduced-motion: no-preference) {
  .apex-card { transition: transform $arvo-duration-fast $arvo-ease-standard; }
}
```

Note the direction: opt motion **in** under `no-preference`, rather than trying to strip it out under `reduce`. That way the default is still.

### 8.2 Contrast and forced colours

The documented rules (`accessibility.mdx:188-193`):

- Do not paint a background and its border with the same colour value — under Windows High Contrast both are replaced and the structure disappears.
- Do not rely on colour alone. Pair it with an icon, a shape, or text.
- Test in Forced Colors mode at least once per release.

**What Arvo implements is thinner than that implies.** A grep for `forced-colors: active` across `packages/styles/src` returns **one** file: `packages/styles/src/components/data-display/_arvo-tree.scss:806-814`, which sets `outline: 2px solid Highlight` on the focused row and `background-color: Highlight; color: HighlightText` on the selected row. There is no system-wide forced-colors layer. Treat Forced Colors as a manual check, not a guarantee.

The one hard contrast commitment is **3:1 on selection, active and focus indicators** (WCAG 1.4.11, `17-OVERLAY-COMPOSITION-STRATEGY.md:665`). It applies to Arvo's own indicators. If you introduce a custom selected-row treatment or a chart palette, that ratio is yours to hit — and the ramp `--arvo-color-t-primary` → `-t-secondary` → `-t-tertiary` is not a substitute for measuring.

Two o9-house rules that intersect here: our design language sets radius 0 and borderless widgets separated by the paper/base surface pair (`--arvo-color-s-layer-01` on `--arvo-color-s-base`). A surface-only separation carries **no** contrast guarantee under Forced Colors — the two backgrounds collapse to one. Where a boundary must survive, use a real border token (`--arvo-color-b-base` / `--arvo-color-b-dark`), not a fill difference.

---

## 9. Accessibility review checklist for a prototype screen

Run this on any screen before it is shown. Items are ordered so failures surface early. This is the Arvo consumer checklist (`apps/docs/docs/usage/checklist.mdx:47-53`) plus the gaps Arvo cannot close for you.

**Structure (yours, entirely)**
- [ ] Exactly one `<h1>`; heading levels descend without skipping.
- [ ] `<main>` exists; navigation is in `<nav>` (or `ArvoNavPanel` docked); complementary regions in `<aside>`.
- [ ] Page `<title>` and `<html lang>` are set. `lang` also feeds the date/time locale cascade.

**Names and roles**
- [ ] Every `ArvoIconButton`, `ArvoFabButton`, `ArvoIconButtonLink` has a `label`.
- [ ] Every input has a `label` prop, or an explicit `aria-label` / `aria-labelledby` — never a placeholder standing in for one.
- [ ] Exactly one labelling source per control.
- [ ] No `role` or `aria-*` override on an Arvo component that already wires it.
- [ ] No `as=` tag swapping.
- [ ] Every image you brought has meaningful alt text; decorative ones are `aria-hidden`.

**Keyboard**
- [ ] Tab through the whole screen. Order matches reading order; nothing is unreachable.
- [ ] The focus ring is visible on every stop. No `outline: none` anywhere in your CSS.
- [ ] Every overlay closes on `Escape` and returns focus to its trigger.
- [ ] No custom `onKeyDown` on a component that owns a keyboard map.
- [ ] Custom shortcuts live at a container scope and do not collide with the maps in §5.4.
- [ ] Focusing a trigger never opens its overlay.

**States**
- [ ] Loading is driven by `isLoading` / `setLoading()` / `data-arvo-loading` — no hand-rolled overlay, no added debounce, no manual `aria-busy`.
- [ ] Invalid fields use `isInvalid` + `errorMsg` (or `setError`), not ad-hoc red text.
- [ ] `isRequired` carries the indicator; no `*` appended to a label string.
- [ ] `isDisabled` vs `isReadOnly` is the right choice for each field.
- [ ] Empty states distinguish "no data" from "no results", and the second offers the undo.

**Announcements**
- [ ] Filter and search result counts announce politely.
- [ ] Toasts are used only for things the user does not need to re-read; anything durable is a BannerAlert.
- [ ] No second live region layered over `ArvoToast` / `ArvoBannerAlert` / `ArvoEmptyState` / `ArvoLoader`.

**Colour and motion**
- [ ] No state is conveyed by colour alone.
- [ ] Background and border of the same element are not the same colour value.
- [ ] Every animation you added is wrapped in `@media (prefers-reduced-motion: no-preference)`.
- [ ] Selection / active / focus indicators clear 3:1 against their surroundings — measured, not assumed.
- [ ] Checked once in Forced Colors mode.

**Verification**
- [ ] Automated pass with `@axe-core/react` / `vitest-axe` / the Storybook a11y addon — the three tools Arvo names.
- [ ] Tests query by role + accessible name; assertions are on `aria-busy`, `aria-expanded`, `aria-invalid`, `aria-checked`, not on `arvo-*` classnames.
- [ ] A screen-reader pass (NVDA, VoiceOver, or JAWS) on any pattern new to this screen.

> `@arvo/test-utils` is a **private, unpublished, zero-export stub** (`packages/test-utils/src/index.ts` is nine lines total — seven comment lines, a blank, and `export {};`). Do not try to install it. Use Testing Library and axe directly.

---

## Sources

| Claim area | Read from |
|---|---|
| Accessibility contract, labels, don'ts, composition rules | `apps/docs/docs/usage/accessibility.mdx` (whole file) |
| Standard prop surface, controlled/uncontrolled, loading layers | `apps/docs/docs/usage/components.mdx`, `apps/docs/docs/usage/public-api.mdx`, `descriptors/*.json` |
| Consumer checklist, customization matrix, testing discipline | `apps/docs/docs/usage/checklist.mdx`, `apps/docs/docs/usage/testing.mdx` |
| Loading patterns A/B/C and their consumers | `architecture/13-COMPONENT-STRATEGY.md:508-536`, `architecture/05-COMPONENT-PIPELINE.md:749-757`, `packages/styles/src/mixins/_loading.scss`, `descriptors/*.json` |
| Overlay focus, stacking, dismissal, ARIA | `architecture/17-OVERLAY-COMPOSITION-STRATEGY.md`, `architecture/18-OVERLAY-SURFACE-ENGINE.md`, `packages/core/src/overlay/{overlay-surface,overlay-hub}.ts`, `packages/react/src/hooks/useOverlaySurface.ts` |
| Focus primitives | `packages/core/src/focus/{focus-trap,tab-roving}.ts` |
| Keyboard maps, live regions, per-component ARIA | `packages/ai-context/components/*.md` |
| Truncation tooltip | `packages/core/src/tooltip/{types.ts,tooltip-connector.ts}`, `packages/core/src/dom/truncation.ts`, `descriptors/button.json:291` |
| Focus ring, reduced motion, forced colors, `.arvo-sr-only` | `packages/styles/src/base/_global.scss`, `packages/styles/src/components/actions/_arvo-btn.scss`, `packages/styles/src/components/data-display/_arvo-tree.scss` |
| Feedback component APIs | `packages/ai-context/components/{toast,banner-alert,message-alert,alert-dialog,empty-state,status,badge,loader}.md` |



## Text Contrast (WCAG 1.4.3 — not Arvo-specific, applies universally)

- Normal text: ≥ 4.5:1 against its background
- Large text (18pt+/14pt+bold): ≥ 3:1 against its background
- Deterministic — checked via axe-core on live pages, or computed luminance
  on Figma fills.


  ## Typography & Readability (WCAG 1.4.12 — universal, not Arvo-specific)

- **Requirement:** Body text ≥ 12px (≈9pt). Text must not be clipped or
  overlap when line-height, letter-spacing, or paragraph spacing are
  adjusted per the WCAG 1.4.12 reflow requirements.
- **Font size floor:** 12px
- **Why it matters:** Undersized text is unreadable for low-vision users.
- **How to validate:** Computed font-size check on all text nodes.
- **Severity:** Major