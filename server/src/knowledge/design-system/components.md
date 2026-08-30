# Component Specifications

> Source: Arvo monorepo `descriptors/*.json` (76 components, 8 categories). Each
> descriptor is the actual build source consumed by the React/JS/SCSS generators —
> not a design mockup description. Full state machines/prop lists/ARIA tables exist
> per component in source; compressed here to what a validator checks against a
> rendered screen. The Actions family (below) is done at full worked-example depth;
> all other families follow the same schema at compact depth — request any single
> component expanded to full depth on demand.

---

# Button

## Purpose
Interactive element for triggering actions, submitting forms, or opening associated content.

## Anatomy
`arvo-btn` root -> optional `__ico` (leading icon) -> `__lbl` (text, required). Optional `badge`/`status` slots anchor to a corner via the shared `corner-host` pattern.

## Variants
`primary, secondary, tertiary, outline, danger-primary, danger (alias of danger-primary), danger-tertiary, danger-outline, nova-primary, inline`

## States
| State | Selector |
|---|---|
| Default | no modifier |
| Hover | `:hover` (gated `@media (hover:hover) and (pointer:fine)`) |
| Focus | `:focus-visible` |
| Active | `:active` or `.active` |
| Disabled | `:disabled` |
| Loading | `.loading` — Pattern A full shimmer overlay |
| Open | `.open` — associated overlay is open (dropdown-trigger buttons) |

## Size Rules
| Size | Height | Font | Icon |
|---|---|---|---|
| sm | 24px | 12px | 16px |
| md (default) | 32px | 14px | 20px |
| lg | 40px | 16px | 24px |

## Spacing Rules
`--arvo-btn-padding-block: space-6`, `--arvo-btn-padding-inline: space-12`, `--arvo-btn-gap: space-4`.

## Accessibility Requirements
- Implicit `role=button` on native `<button>` — never add `role` explicitly.
- `label` prop required (visible text); icon-only usage requires `aria-label`.
- `aria-pressed` set only when parent passes `isSelected` (controlled active-state visual).
- `aria-expanded`/`aria-haspopup` for buttons that open overlays.
- `aria-busy="true"` during loading.
- Focus ring: `1px solid` focus-token, `space-2` offset (`-1px` inner offset if `.focus-border` utility applied).
- Keyboard: `Enter`/`Space` activates, `Tab`/`Shift+Tab` moves focus.

## Content Guidelines
Label is required text content (falls back to element text if prop omitted). `hasTruncationTooltip` (default true) shows the full label in a tooltip ONLY when visibly truncated and no explicit tooltip is already bound — prevents double-announcement to assistive tech.

## Interaction Notes
`isDisabled` suppresses all interaction and overrides any `state` prop. `isLoading` hides content and blocks interaction while showing the shimmer. `nova-primary`'s gradient is a static brand signal — hover doesn't shift its palette (only text/icon dim on active/disabled).

## Validation Rules
1. Icon-only rendering without `aria-label` -> flag High, Accessibility.
2. `inline` variant applied to an icon-only control (ArvoIconButton) -> flag High, Custom Component (inline is Button-only; SCSS layer no-ops it).
3. Any variant string outside the 10 listed -> flag High, Custom Component.
4. Height/font/icon triple not matching one of the 3 size rows -> flag Medium, Design System.
5. Focus ring removed/suppressed -> flag High, Accessibility.
6. `danger-secondary` or any other unlisted danger-* combination -> flag High, Custom Component (only primary/tertiary/outline exist for danger).

---

# Actions family

## ButtonGroup
`btn-grp` — status: **stable**

**Purpose:** Horizontal grouping of ArvoButton or ArvoIconButton items acting as a unified selection control.

**Variants:** primary, secondary, outline

**Sizes:** sm, lg

**States:** default, hover-default, hover-active-primary, hover-active-secondary, focus, active-primary, active-secondary, outline, disabled, loading, overflow, expand-label-selected, expand-label-unselected

**Anatomy (BEM elements):** ind, overflow

**Accessibility role:** `toolbar`

**Validation Rules:**
- Variant outside {primary, secondary, outline} -> flag High, Custom Component.
- Size outside {sm, lg} -> flag Medium, Design System.

## DropdownButton
`dd-btn` — status: **stable**

**Purpose:** Button trigger for a list of selectable actions or options.

**Variants:** primary, secondary, tertiary, outline

**Sizes:** sm, md, lg

**States:** default, hover, focus, active, disabled, loading, open

**Anatomy (BEM elements):** icon, lbl, caret

**Accessibility role:** `button`

**Validation Rules:**
- Variant outside {primary, secondary, tertiary, outline} -> flag High, Custom Component.
- Size outside {sm, md, lg} -> flag Medium, Design System.

## DropdownIconButton
`dd-icon-btn` — status: **stable**

**Purpose:** Icon-only button trigger.

**Variants:** primary, secondary, tertiary, outline

**Sizes:** sm, md, lg

**States:** default, hover, focus, active, disabled, loading, open

**Anatomy (BEM elements):** icon, caret

**Accessibility role:** `button`

**Validation Rules:**
- Variant outside {primary, secondary, tertiary, outline} -> flag High, Custom Component.
- Size outside {sm, md, lg} -> flag Medium, Design System.

## FabButton
`fab-btn` — status: **stable**

**Purpose:** Floating Action Button — a persistent, elevated button that floats above page content for a primary or secondary contextual action.

**Variants:** primary, secondary

**Sizes:** — none

**States:** default-primary-icon-only, default-primary-with-label, default-secondary-icon-only, default-secondary-with-label, hover-primary, hover-secondary, focus, active-primary, active-secondary, disabled, loading

**Anatomy (BEM elements):** — root only

**Accessibility role:** `button`

**Validation Rules:**
- Variant outside {primary, secondary} -> flag High, Custom Component.

## IconButton
`icon-btn` — status: **stable**

**Purpose:** Square, icon-only interactive element for compact actions where space is limited or visual simplicity is preferred.

**Variants:** primary, secondary, tertiary, outline, danger-primary, danger, danger-tertiary, danger-outline, nova-primary

**Sizes:** xs, sm, md, lg

**States:** default, hover, focus, active, disabled, loading, open

**Anatomy (BEM elements):** ico

**Accessibility role:** `button`

**Validation Rules:**
- Variant outside {primary, secondary, tertiary, outline, danger-primary, danger, danger-tertiary, danger-outline, nova-primary} -> flag High, Custom Component.
- Size outside {xs, sm, md, lg} -> flag Medium, Design System.

## SplitButton
`split-btn` — status: **new**

**Purpose:** Two-segment action control composed of an executable action button and a separate dropdown trigger button.

**Variants:** primary, secondary, tertiary

**Sizes:** sm, md, lg

**States:** default, hover, focus, active, disabled, loading, open

**Anatomy (BEM elements):** action, trigger, icon, lbl, caret

**Accessibility role:** `group`

**Validation Rules:**
- Variant outside {primary, secondary, tertiary} -> flag High, Custom Component.
- Size outside {sm, md, lg} -> flag Medium, Design System.

## SplitIconButton
`split-icon-btn` — status: **new**

**Purpose:** Icon-only two-segment action control.

**Variants:** primary, secondary, tertiary

**Sizes:** sm, md, lg

**States:** default, hover, focus, active, disabled, loading, open

**Anatomy (BEM elements):** action, trigger, icon, caret

**Accessibility role:** `group`

**Validation Rules:**
- Variant outside {primary, secondary, tertiary} -> flag High, Custom Component.
- Size outside {sm, md, lg} -> flag Medium, Design System.

## ToggleButton
`toggle-btn` — status: **new**

**Purpose:** Dedicated two-state toggle control.

**Variants:** secondary, tertiary, outline

**Sizes:** sm, md, lg

**States:** default, hover, focus, active, selected, disabled, loading

**Anatomy (BEM elements):** ico, lbl

**Accessibility role:** `button`

**Validation Rules:**
- Variant outside {secondary, tertiary, outline} -> flag High, Custom Component.
- Size outside {sm, md, lg} -> flag Medium, Design System.

---

# Navigation family

## Breadcrumb
`bc` — status: **stable**

**Purpose:** Horizontal trail of navigational links showing the user's current location within a page hierarchy.

**Variants:** — none (single treatment)

**Sizes:** sm, lg

**States:** link-default, link-hover, link-focus, link-dropdown-default, link-dropdown-hover, link-dropdown-focus, link-dropdown-open, current-page, current-dropdown-default, current-dropdown-hover, current-dropdown-focus, current-dropdown-open, home-icon-default, home-icon-hover, overflow-default, overflow-hover, overflow-focus, overflow-open, disabled, loading

**Anatomy (BEM elements):** list, item, lnk, lnk-inner, ico, lbl, chev, overflow, skl

**Accessibility role:** `navigation`

**Validation Rules:**
- Variant outside {n/a} -> flag High, Custom Component.
- Size outside {sm, lg} -> flag Medium, Design System.

## ButtonLink
`btn-lnk` — status: **stable**

**Purpose:** An anchor element styled identically to ArvoButton — visually appears as a button but navigates like a link.

**Variants:** primary, secondary, tertiary, outline

**Sizes:** sm, md, lg

**States:** note, default, hover, focus, active, disabled, loading

**Anatomy (BEM elements):** ico, lbl

**Accessibility role:** `link`

**Validation Rules:**
- Variant outside {primary, secondary, tertiary, outline} -> flag High, Custom Component.
- Size outside {sm, md, lg} -> flag Medium, Design System.

## IconButtonLink
`ico-btn-lnk` — status: **stable**

**Purpose:** An anchor element styled identically to ArvoIconButton — visually appears as a square icon-only button but navigates like a link.

**Variants:** primary, secondary, tertiary, outline

**Sizes:** sm, md, lg

**States:** note, default, hover, focus, active, disabled, loading

**Anatomy (BEM elements):** ico

**Accessibility role:** `link`

**Validation Rules:**
- Variant outside {primary, secondary, tertiary, outline} -> flag High, Custom Component.
- Size outside {sm, md, lg} -> flag Medium, Design System.

## Link
`lnk` — status: **stable**

**Purpose:** Inline navigational anchor for linking to internal pages, external URLs, or downloadable resources.

**Variants:** primary, secondary, tertiary

**Sizes:** sm, lg

**States:** default-primary, default-secondary, default-tertiary, hover, focus, active, visited, disabled, loading, transition

**Anatomy (BEM elements):** ico, lbl, ext

**Accessibility role:** `link`

**Validation Rules:**
- Variant outside {primary, secondary, tertiary} -> flag High, Custom Component.
- Size outside {sm, lg} -> flag Medium, Design System.

## Nav
`nav` — status: **new**

**Purpose:** Vertical destination list with a state-driven active selection.

**Variants:** — none (single treatment)

**Sizes:** sm, md, lg

**States:** default, loading, disabled

**Anatomy (BEM elements):** list, indicator, highlight

**Accessibility role:** `navigation`

**Validation Rules:**
- Variant outside {n/a} -> flag High, Custom Component.
- Size outside {sm, md, lg} -> flag Medium, Design System.

## NavItem
`nav-item` — status: **new**

**Purpose:** Internal navigation row primitive consumed by ArvoNav.

**Variants:** — none (single treatment)

**Sizes:** sm, md, lg

**States:** default, hover, focus, selected-default, selected-hover, selected-focus, disabled, selected-disabled, loading

**Anatomy (BEM elements):** lft, ico, avt, lbl, actions, sts, pin, act, overflow, bdg, skel

**Accessibility role:** `link or button`

**Validation Rules:**
- Variant outside {n/a} -> flag High, Custom Component.
- Size outside {sm, md, lg} -> flag Medium, Design System.

## Tabstrip
`tabs` — status: **stable**

**Purpose:** Tab navigation for switching between related content panels.

**Variants:** primary, secondary

**Sizes:** sm, lg

**States:** default, hover, focus, active, disabled, loading, dragging, drop-target, truncated

**Anatomy (BEM elements):** list, tab, tab-lft, tab-ico, tab-lbl, tab-lbl-text, tab-alert, tab-badge, tab-status, tab-actions, tab-menu, tab-pin, tab-close, divider, indicator, overflow-btn, add-btn, skel

**Accessibility role:** `tablist`

**Validation Rules:**
- Variant outside {primary, secondary} -> flag High, Custom Component.
- Size outside {sm, lg} -> flag Medium, Design System.

---

# Inputs family

## AdvanceSearch
`adv-search` — status: **new**

**Purpose:** Composed search input that pairs a 40px search row with exactly one context or filtering control.

**Variants:** scoped-search, custom-filter, filter-by

**Sizes:** sm, md, lg

**States:** default-empty, default-filled, hover, focused-empty, focused-filled, open, invalid, disabled, readonly, loading

**Anatomy (BEM elements):** field, lead, input-group, ico, input, actions, shortcut, counter, clear, err-ico, sep, submit, trigger, underline, message

**Accessibility role:** `search`

**Validation Rules:**
- Variant outside {scoped-search, custom-filter, filter-by} -> flag High, Custom Component.
- Size outside {sm, md, lg} -> flag Medium, Design System.

## Checkbox
`cb` — status: **stable**

**Purpose:** Boolean selection control supporting checked, unchecked, indeterminate, and excluded states with visible inline label and optional size variants.

**Variants:** — none (single treatment)

**Sizes:** sm, lg

**States:** unchecked, checked, indeterminate, hover, focus, disabled, disabled-checked, excluded, error, readonly, loading

**Anatomy (BEM elements):** field, input-wrapper, input, icon, text-container, lbl, desc, err-ico, err-msg

**Accessibility role:** see descriptor (composite widget)

**Validation Rules:**
- Variant outside {n/a} -> flag High, Custom Component.
- Size outside {sm, lg} -> flag Medium, Design System.

## CheckboxGroup
`cb-grp` — status: **stable**

**Purpose:** Container managing multiple ArvoCheckbox children with group-level label, validation, optional select-all capability, orientation control, and size propagation.

**Variants:** — none (single treatment)

**Sizes:** sm, lg

**States:** default, horizontal, label-start, error, disabled, readonly, loading

**Anatomy (BEM elements):** lbl, bdy, items

**Accessibility role:** `group`

**Validation Rules:**
- Variant outside {n/a} -> flag High, Custom Component.
- Size outside {sm, lg} -> flag Medium, Design System.

## Chip
`chip` — status: **new**

**Purpose:** Compact inline element that represents a discrete entity, attribute, filter, or user-entered value inside a sharp-cornered chip surface.

**Variants:** general, filter, input

**Sizes:** sm, md, lg

**States:** default, hover, focus, selected, disabled, readonly, invalid, warning, excluded, loading

**Anatomy (BEM elements):** grip, ico, avatar, title, lbl, counter, alert, exclude, status, dismiss

**Accessibility role:** `button | group`

**Validation Rules:**
- Variant outside {general, filter, input} -> flag High, Custom Component.
- Size outside {sm, md, lg} -> flag Medium, Design System.

## ChipList
`chip-list` — status: **new**

**Purpose:** Collection component that renders a group of ArvoChip children with consistent sizing, visual treatment, spacing, wrapping, overflow behavior, accessibility, and filter-selection coordination.

**Variants:** general, filter, input

**Sizes:** sm, md, lg

**States:** default, wrap, single-line, max-rows, reorderable, disabled, readonly, loading

**Anatomy (BEM elements):** overflow

**Accessibility role:** `group`

**Validation Rules:**
- Variant outside {general, filter, input} -> flag High, Custom Component.
- Size outside {sm, md, lg} -> flag Medium, Design System.

## Combobox
`combobox` — status: **stable**

**Purpose:** Filterable single-select form field: a form-input-styled text input (role='combobox', aria-autocomplete='list') composed over the ArvoOptionList overlay.

**Variants:** — none (single treatment)

**Sizes:** sm, lg

**States:** default, hover, focus, open, filled, disabled, readonly, invalid, loading

**Anatomy (BEM elements):** lbl, field, ico, prefix, prefix-sep, input, actions, clear, sep, err-ico, chevron, border

**Accessibility role:** `combobox`

**Validation Rules:**
- Variant outside {n/a} -> flag High, Custom Component.
- Size outside {sm, lg} -> flag Medium, Design System.

## Listbox
`listbox` — status: **alpha**

**Purpose:** Standalone keyboard-navigable list of selectable options for inline (non-overlay) contexts.

**Variants:** — none (single treatment)

**Sizes:** — none

**States:** default, hover, highlighted, selected, disabled, loading

**Anatomy (BEM elements):** lbl, search, list, opt, opt__ico, opt__lbl, opt__check, grp, grp-hdr, divider, empty, skeleton, skeleton-row, skeleton-icon, skeleton-text

**Accessibility role:** `listbox`

**Validation Rules:**
- Variant outside {n/a} -> flag High, Custom Component.

## MultiSelect
`multi-sel` — status: **new**

**Purpose:** Multi-value select form field: a form-input-styled field (role='combobox') that renders its selected values as removable ArvoChips inside the field and composes the ArvoOptionList overlay in multiple-selection mode (checkbox option rows) as its dropdown.

**Variants:** — none (single treatment)

**Sizes:** — none

**States:** default, hover, focus, open, filled, expanded, disabled, readonly, invalid, loading

**Anatomy (BEM elements):** lbl, field, value, chips, input, actions, clear, sep, ico, err-ico, border

**Accessibility role:** `combobox`

**Validation Rules:**
- Variant outside {n/a} -> flag High, Custom Component.

## NumberInput
`number-input` — status: **stable**

**Purpose:** Numeric input with increment/decrement stepper buttons, animated bottom border, min/max/step constraints, and optional prefix/suffix labels via the shared form-input-affix pattern.

**Variants:** — none (single treatment)

**Sizes:** sm, lg

**States:** — not state-bearing

**Anatomy (BEM elements):** lbl, field, prefix, prefix-sep, input, suffix, steppers, increment-btn, decrement-btn, border, err-ico, err-msg

**Accessibility role:** `spinbutton`

**Validation Rules:**
- Variant outside {n/a} -> flag High, Custom Component.
- Size outside {sm, lg} -> flag Medium, Design System.

## Radio
`radio` — status: **stable**

**Purpose:** Single-selection control within a mutual-exclusion group, displayed as a circular button with inner dot and visible inline label.

**Variants:** — none (single treatment)

**Sizes:** sm, lg

**States:** unchecked, checked, hover, focus, disabled, disabled-checked, error, readonly, loading

**Anatomy (BEM elements):** field, input-wrapper, input, control, text-container, text, desc

**Accessibility role:** see descriptor (composite widget)

**Validation Rules:**
- Variant outside {n/a} -> flag High, Custom Component.
- Size outside {sm, lg} -> flag Medium, Design System.

## RadioGroup
`rb-grp` — status: **stable**

**Purpose:** Container managing mutual exclusion across multiple ArvoRadio children with group-level label, validation, orientation control, and size propagation.

**Variants:** — none (single treatment)

**Sizes:** sm, lg

**States:** default, horizontal, label-start, error, disabled, readonly, loading

**Anatomy (BEM elements):** lbl, bdy, items

**Accessibility role:** `radiogroup`

**Validation Rules:**
- Variant outside {n/a} -> flag High, Custom Component.
- Size outside {sm, lg} -> flag Medium, Design System.

## Search
`search` — status: **stable**

**Purpose:** Search input with three variants: filter (filters a list of items, supports multiline), expandable-filter (collapses to an icon-only trigger and expands to a full filter field), and find (navigates through matched items with prev/next controls).

**Variants:** filter, expandable-filter, find

**Sizes:** — none

**States:** enabled-empty, enabled-filled, hover-empty, hover-filled, focused-empty, focused-filled, error-idle, error-focused, disabled, readonly, loading, multi-line, summary, expandable-collapsed, expandable-expanded

**Anatomy (BEM elements):** field, ico, input, actions, clear, sep, shortcut, counter, prev, next, submit, err-ico, expand-trigger, border

**Accessibility role:** `search`

**Validation Rules:**
- Variant outside {filter, expandable-filter, find} -> flag High, Custom Component.

## Select
`sel` — status: **stable**

**Purpose:** Single-select form field: a form-input-styled trigger (role='combobox') composed over the ArvoOptionList overlay.

**Variants:** — none (single treatment)

**Sizes:** sm, lg

**States:** default, hover, focus, open, filled, disabled, readonly, invalid, loading

**Anatomy (BEM elements):** lbl, field, ico, input, placeholder, chevron, border, err-ico

**Accessibility role:** `combobox`

**Validation Rules:**
- Variant outside {n/a} -> flag High, Custom Component.
- Size outside {sm, lg} -> flag Medium, Design System.

## Switch
`sw` — status: **stable**

**Purpose:** Toggle control for binary on/off states.

**Variants:** — none (single treatment)

**Sizes:** sm, lg

**States:** unchecked, checked, hover-unchecked, hover-checked, focus-unchecked, focus-checked, disabled-unchecked, disabled-checked, readonly, loading

**Anatomy (BEM elements):** field, input, track, thumb, lbl

**Accessibility role:** `switch`

**Validation Rules:**
- Variant outside {n/a} -> flag High, Custom Component.
- Size outside {sm, lg} -> flag Medium, Design System.

## Textarea
`textarea` — status: **stable**

**Purpose:** Multi-line text input with animated bottom border, optional character counter, and auto-resize support.

**Variants:** — none (single treatment)

**Sizes:** sm, lg

**States:** — not state-bearing

**Anatomy (BEM elements):** lbl, field, input, border, counter, ico, actions, clear, err-ico, err-msg

**Accessibility role:** see descriptor (composite widget)

**Validation Rules:**
- Variant outside {n/a} -> flag High, Custom Component.
- Size outside {sm, lg} -> flag Medium, Design System.

## Textbox
`textbox` — status: **stable**

**Purpose:** Single-line text input with animated bottom border, optional leading icon and prefix/suffix labels (shared form-input-affix pattern), character counter, clearable support, and inline / tooltip error display.

**Variants:** — none (single treatment)

**Sizes:** sm, lg

**States:** — not state-bearing

**Anatomy (BEM elements):** lbl, field, ico, prefix, prefix-sep, input, suffix, border, counter, clear, pw-toggle, err-ico, err-msg

**Accessibility role:** see descriptor (composite widget)

**Validation Rules:**
- Variant outside {n/a} -> flag High, Custom Component.
- Size outside {sm, lg} -> flag Medium, Design System.

---

# Date & Time family

## Calendar
`cal` — status: **stable**

**Purpose:** Internal calendar grid that renders one view at a time (days / months / quarters / years / member tiles).

**Variants:** — none (single treatment)

**Sizes:** — none

**States:** default, cell-hover, cell-focus, cell-selected, cell-selected-hover, cell-selected-focus, cell-in-range, cell-disabled, cell-today, cell-current-member, cell-key-highlight, cell-key-highlight-focus, cell-preview

**Anatomy (BEM elements):** grid, row, weekday-hdr, week, cell, cell-label, cell-sublabel

**Accessibility role:** `application`

**Validation Rules:**
- Variant outside {n/a} -> flag High, Custom Component.

## CalendarDropdown
`cal-drop` — status: **stable**

**Purpose:** Public Layer 4 floating calendar dropdown built on the internal OverlaySurface engine.

**Variants:** — none (single treatment)

**Sizes:** — none

**States:** default, open, disabled

**Anatomy (BEM elements):** header, body

**Accessibility role:** `dialog`

**Validation Rules:**
- Variant outside {n/a} -> flag High, Custom Component.

## CalendarRangeDropdown
`cal-rng-drop` — status: **stable**

**Purpose:** Public Layer 4 floating date range dropdown built on the internal OverlaySurface engine.

**Variants:** — none (single treatment)

**Sizes:** — none

**States:** default, open, absolute, member, rolling, disabled

**Anatomy (BEM elements):** header, body, cal, rolling-setting, info-alert, tile-panel, mtg-scroll, mtg-grid, mtg-tile, rolling-row, rolling-block, hdr-switch, hdr-tabs, footer, current-ind, footer-cancel, footer-save

**Accessibility role:** `dialog`

**Validation Rules:**
- Variant outside {n/a} -> flag High, Custom Component.

## DatePicker
`dp` — status: **stable**

**Purpose:** Single-date picker.

**Variants:** — none (single treatment)

**Sizes:** sm, lg

**States:** default, hover, focus, open, filled, disabled, readonly, invalid, loading

**Anatomy (BEM elements):** lbl, field, input, actions, clear-btn, trigger-btn, err-ico, err-msg, border, popover, header, body

**Accessibility role:** `combobox-like`

**Validation Rules:**
- Variant outside {n/a} -> flag High, Custom Component.
- Size outside {sm, lg} -> flag Medium, Design System.

## DateRangePicker
`drp` — status: **stable**

**Purpose:** Date range picker with three config-gated capability layers (ADR-1): (a) absolute dual-calendar range, (b) member/timeframe range with scrollable member-tile panel, (c) rolling time with Start/End steppers + sticky Save/Cancel footer.

**Variants:** — none (single treatment)

**Sizes:** sm, lg

**States:** default, hover, focus, open, filled, disabled, readonly, invalid, loading

**Anatomy (BEM elements):** lbl, field, input, actions, clear-btn, trigger-btn, err-ico, err-msg, border, popover, header, body, rolling-setting, info-alert, tile-panel, footer, current-ind, value, seg, seg--start, seg--end, arrow, seg-divider, cal, mtg-scroll, mtg-grid, mtg-tile, rolling-row, rolling-block, hdr-switch, hdr-tabs, footer-cancel, footer-save

**Accessibility role:** `combobox-like`

**Validation Rules:**
- Variant outside {n/a} -> flag High, Custom Component.
- Size outside {sm, lg} -> flag Medium, Design System.

## DateTimeDropdown
`dt-drop` — status: **stable**

**Purpose:** Public Layer 4 floating date+time dropdown built on the internal OverlaySurface engine.

**Variants:** — none (single treatment)

**Sizes:** — none

**States:** default, open, disabled

**Anatomy (BEM elements):** header, cal-grid, sep, cal, time

**Accessibility role:** `dialog`

**Validation Rules:**
- Variant outside {n/a} -> flag High, Custom Component.

## DateTimePicker
`dtp` — status: **stable**

**Purpose:** Combined date+time picker.

**Variants:** — none (single treatment)

**Sizes:** sm, lg

**States:** default, hover, focus, open, filled, disabled, readonly, invalid, loading

**Anatomy (BEM elements):** lbl, field, input, actions, clear-btn, trigger-btn, err-ico, err-msg, border, popover, header, cal-grid, sep, cal, time

**Accessibility role:** `combobox-like`

**Validation Rules:**
- Variant outside {n/a} -> flag High, Custom Component.
- Size outside {sm, lg} -> flag Medium, Design System.

## TimeDropdown
`tdrop` — status: **stable**

**Purpose:** Internal scrollable time list with optional AM/PM tabs in 12-hour mode.

**Variants:** — none (single treatment)

**Sizes:** — none

**States:** default, item-hover, item-focus, item-active, tab-selected, tab-disabled

**Anatomy (BEM elements):** tabs, tab, list, item, label

**Accessibility role:** `dialog`

**Validation Rules:**
- Variant outside {n/a} -> flag High, Custom Component.

## TimePicker
`tp` — status: **stable**

**Purpose:** Time-only picker.

**Variants:** default

**Sizes:** sm, lg

**States:** default, hover, focus, open, filled, disabled, readonly, invalid, loading

**Anatomy (BEM elements):** lbl, field, input, actions, clear-btn, trigger-btn, err-ico, err-msg, border, popover, body

**Accessibility role:** `combobox-like`

**Validation Rules:**
- Variant outside {default} -> flag High, Custom Component.
- Size outside {sm, lg} -> flag Medium, Design System.

## TimePickerDropdown
`tp-drop` — status: **stable**

**Purpose:** Public Layer 4 floating time dropdown built on the internal OverlaySurface engine.

**Variants:** — none (single treatment)

**Sizes:** — none

**States:** default, open, disabled

**Anatomy (BEM elements):** body

**Accessibility role:** `dialog`

**Validation Rules:**
- Variant outside {n/a} -> flag High, Custom Component.

---

# Data Display family

## Accordion
`acc` — status: **new**

**Purpose:** Progressive disclosure container that stacks one or more ArvoAccordionItem rows edge-to-edge with 1px dividers.

**Variants:** surface, transparent

**Sizes:** sm, lg

**States:** default, loading, disabled

**Anatomy (BEM elements):** list, skel, skel-row

**Accessibility role:** `none`

**Validation Rules:**
- Variant outside {surface, transparent} -> flag High, Custom Component.
- Size outside {sm, lg} -> flag Medium, Design System.

## AccordionItem
`acc-item` — status: **new**

**Purpose:** Public composable child of ArvoAccordion.

**Variants:** — none (single treatment)

**Sizes:** sm, lg

**States:** default, hover, focus, expanded, disabled, loading, empty, is-searching

**Anatomy (BEM elements):** trg, chev, hdr, lft, ico, title, sts, desc, bdg, actions, act, menu, switch, search, panel, empty, skel, skel-bar, skel-trail

**Accessibility role:** `button + region`

**Validation Rules:**
- Variant outside {n/a} -> flag High, Custom Component.
- Size outside {sm, lg} -> flag Medium, Design System.

## FilterPanel
`pnl` — status: **new**

**Purpose:** Purpose-built panel for flat and Accordion-grouped filter matrices.

**Variants:** — none (single treatment)

**Sizes:** — none

**States:** — not state-bearing

**Anatomy (BEM elements):** pane, pin, rich-hdr, rich-hdr-content, rich-hdr-clear, fab, overlay-mask

**Accessibility role:** `dialog | region`

**Validation Rules:**
- Variant outside {n/a} -> flag High, Custom Component.

## NavPanel
`pnl` — status: **new**

**Purpose:** Purpose-built panel for application destinations.

**Variants:** — none (single treatment)

**Sizes:** size-sm, size-md, size-lg

**States:** — not state-bearing

**Anatomy (BEM elements):** pane, pin, rich-hdr, rich-hdr-content, rich-hdr-clear, fab, overlay-mask

**Accessibility role:** `dialog | navigation`

**Validation Rules:**
- Variant outside {n/a} -> flag High, Custom Component.
- Size outside {size-sm, size-md, size-lg} -> flag Medium, Design System.

## Panel
`pnl` — status: **new**

**Purpose:** General-purpose edge-attached container for custom / product-specific content.

**Variants:** — none (single treatment)

**Sizes:** — none

**States:** — not state-bearing

**Anatomy (BEM elements):** pane, splitter, pin, rich-hdr, rich-hdr-content, rich-hdr-clear, fab, overlay-mask

**Accessibility role:** see descriptor (composite widget)

**Validation Rules:**
- Variant outside {n/a} -> flag High, Custom Component.

## TreeView
`tree` — status: **new**

**Purpose:** Hierarchical, multi-level list container for nested data such as folders/files, org charts, taxonomies, or any parent-child structure.

**Variants:** expandOnly, singleSelect, multiSelect, navigation, navigationMultiSelect

**Sizes:** sm, lg

**States:** default, row-hover, row-focus, row-selected, row-selected-hover, row-selected-focus, row-active, row-active-selected, row-disabled, row-emphasized, row-search-highlighted, row-async-loading, row-empty, row-loading, tree-loading

**Anatomy (BEM elements):** group, item, connector, drag, chevron, check, content, icon, label, label-match, meta, meta-icon, meta-text, badge, loader, empty, skeleton, skeleton-row, skeleton-text, skeleton-icon, actions, live

**Accessibility role:** `tree`

**Validation Rules:**
- Variant outside {expandOnly, singleSelect, multiSelect, navigation, navigationMultiSelect} -> flag High, Custom Component.
- Size outside {sm, lg} -> flag Medium, Design System.

---

# Overlays family

## ActionMenu
`action-menu` — status: **stable**

**Purpose:** Overlay menu of actionable items triggered from a button or icon button.

**Variants:** — none (single treatment)

**Sizes:** — none

**States:** closed, open, item-hover, item-active, item-focus, item-disabled, item-destructive, item-actions-on-hover, loading, inline-panel-open

**Anatomy (BEM elements):** scroll, search, hdr, divider, skeleton, inline-panel, empty

**Accessibility role:** `menu`

**Validation Rules:**
- Variant outside {n/a} -> flag High, Custom Component.

## ContextMenu
`context-menu` — status: **beta**

**Purpose:** Pop-up menu opened in response to a secondary gesture (pointer right-click / Shift+F10 / ContextMenu key / optional touch long-press) rather than a dedicated visible trigger button.

**Variants:** — none (single treatment)

**Sizes:** — none

**States:** closed, open, item-hover, item-focused, item-active, item-disabled, item-destructive, checkbox-checked, radio-checked, submenu-open, empty

**Anatomy (BEM elements):** scroll, hdr, divider, empty

**Accessibility role:** `menu`

**Validation Rules:**
- Variant outside {n/a} -> flag High, Custom Component.

## Drawer
`drw` — status: **deprecated**

**Purpose:** Viewport-anchored slide-in overlay panel.

**Variants:** — none (single treatment)

**Sizes:** — none

**States:** default-closed, default-open-with-mask, default-open-no-mask, loading, is-disabled, no-data, no-results

**Anatomy (BEM elements):** pane

**Accessibility role:** `dialog`

**Validation Rules:**
- Variant outside {n/a} -> flag High, Custom Component.
- Component is **deprecated** — presence at all -> flag Medium, 'uses a deprecated component, migrate per docs' (not High; it's still a functioning approved component on a migration path).

## DropdownTree
`dd-tree` — status: **new**

**Purpose:** Tree picker overlay composed of an ArvoPopover shell plus an embedded ArvoTreeView body, a sticky search row with an adjacent filter ArvoDropdownIconButton, an optional global select-all (advanced trees only), corner resize handles, and a Reset / Cancel / Apply footer.

**Variants:** — none (single treatment)

**Sizes:** — none

**States:** default, open, loading, is-resizing

**Anatomy (BEM elements):** sticky, search, search-input, filter, sa, sa__lbl, body, section, section-hdr, divider, tree, empty, empty-action, skeleton, skeleton-row, resize, handle

**Accessibility role:** `dialog`

**Validation Rules:**
- Variant outside {n/a} -> flag High, Custom Component.

## HybridPopover
`hpop` — status: **stable**

**Purpose:** Configurable overlay panel that composes ArvoPopover and renders structured content variants.

**Variants:** multi, single, none, reorder-only

**Sizes:** — none

**States:** default, open, loading, is-dragging, is-resizing

**Anatomy (BEM elements):** sticky, search, search-msg, cond, banner, list, applies-to-all, resize, handle

**Accessibility role:** `dialog`

**Validation Rules:**
- Variant outside {multi, single, none, reorder-only} -> flag High, Custom Component.

## List
`list` — status: **new**

**Purpose:** Canonical vertical list for filter lists, multi-select pickers, navigation panels, master-detail layouts, drag-and-drop libraries, resource browsers, action lists, and inline saved views.

**Variants:** standard, rich

**Sizes:** — none

**States:** row-default, row-hover, row-focus, row-selected, row-disabled, row-dragging, row-drop-target, row-loading, list-loading, list-empty

**Anatomy (BEM elements):** live, sa, group, group-hdr, group-body, divider, empty, skeleton, skeleton-row

**Accessibility role:** `listbox | radiogroup | list`

**Validation Rules:**
- Variant outside {standard, rich} -> flag High, Custom Component.

## ListItem
`list-item` — status: **new**

**Purpose:** Internal list row primitive consumed by ArvoList.

**Variants:** standard, rich

**Sizes:** — none

**States:** default, hover, focus, selected, disabled, dragging, drop-target, loading

**Anatomy (BEM elements):** drag, drag-spacer, check, ico, avt, txt, lbl, secondary, match, exclude, badge, actions, chev, skel

**Accessibility role:** `option | radio | listitem`

**Validation Rules:**
- Variant outside {standard, rich} -> flag High, Custom Component.

## OptionList
`opt-list` — status: **stable**

**Purpose:** Field-agnostic floating option-list overlay built on the internal OverlaySurface engine.

**Variants:** rich

**Sizes:** — none

**States:** default, hover, highlighted, selectedSingle, selectedMultiple, disabled, loading

**Anatomy (BEM elements):** search, scroll, opt, opt__check, opt__avatar, opt__ico, opt__txt, opt__lbl, opt__secondary, grp, grp-hdr, divider, empty, skeleton, skeleton-row, skeleton-icon, skeleton-text

**Accessibility role:** `listbox`

**Validation Rules:**
- Variant outside {rich} -> flag High, Custom Component.

## Popover
`popover` — status: **stable**

**Purpose:** Floating overlay panel anchored to a trigger element for displaying contextual content, forms, or actions.

**Variants:** edge

**Sizes:** — none

**States:** default, open, loading, resizing

**Anatomy (BEM elements):** arrow, header, header-left, header-actions, title, back-btn, alert-ico, lead-ico, status, badge, close-btn, sticky-header, body, footer, footer-left, footer-actions, resize, handle

**Accessibility role:** `dialog`

**Validation Rules:**
- Variant outside {edge} -> flag High, Custom Component.

## RichTooltip
`rtip` — status: **new**

**Purpose:** Mid-weight informational overlay anchored to a trigger element.

**Variants:** — none (single treatment)

**Sizes:** — none

**States:** default, open, loading, disabled

**Anatomy (BEM elements):** hdr, title, hdr-meta, bdy, banner, msg, slot, ftr, pointer

**Accessibility role:** `tooltip`

**Validation Rules:**
- Variant outside {n/a} -> flag High, Custom Component.

## SidePanel
`sp` — status: **deprecated**

**Purpose:** Content-area-scoped pane that docks at the layout level (default) or overlays sibling content via slide-in animation.

**Variants:** layout, overlay

**Sizes:** — none

**States:** default-layout, default-overlay-open, default-overlay-closed, is-pinned, is-unpinned, loading, is-disabled, no-data, no-results

**Anatomy (BEM elements):** splitter, pane, pin

**Accessibility role:** `region`

**Validation Rules:**
- Variant outside {layout, overlay} -> flag High, Custom Component.
- Component is **deprecated** — presence at all -> flag Medium, 'uses a deprecated component, migrate per docs' (not High; it's still a functioning approved component on a migration path).

## Window
`win` — status: **beta**

**Purpose:** Movable, focused floating workspace for temporary complex tasks (heavy forms, configuration, multi-section workflows, mapping/preview, nested task flows, planning tools over a canvas).

**Variants:** — none (single treatment)

**Sizes:** sm, md, lg, xl

**States:** default, open, loading, maximized, dragging

**Anatomy (BEM elements):** panel, header, header-left, header-actions, back-btn, ico, title, status, badge, max-btn, close-btn, body, footer, footer-left, actions, overlay-mask

**Accessibility role:** `dialog`

**Validation Rules:**
- Variant outside {n/a} -> flag High, Custom Component.
- Size outside {sm, md, lg, xl} -> flag Medium, Design System.

---

# Feedback family

## AlertDialog
`alert-dlg` — status: **beta**

**Purpose:** Modal confirmation dialog used for status feedback and destructive-action confirmation.

**Variants:** warning, info, positive, negative, block

**Sizes:** — none

**States:** default, open, loading

**Anatomy (BEM elements):** panel, header, ico, title, close-btn, body, msg, confirm-input, footer, dont-show, actions

**Accessibility role:** `alertdialog`

**Validation Rules:**
- Variant outside {warning, info, positive, negative, block} -> flag High, Custom Component.

## Badge
`bdg` — status: **new**

**Purpose:** Compact, non-interactive visual indicator that communicates semantic meaning, metadata, priority, state, status, counts, and quantities in a lightweight, highly scannable format.

**Variants:** label, counter

**Sizes:** sm, md, lg

**States:** default, count-increasing, count-decreasing, hidden-at-zero

**Anatomy (BEM elements):** ico, msg, count, sep, total

**Accessibility role:** `status`

**Validation Rules:**
- Variant outside {label, counter} -> flag High, Custom Component.
- Size outside {sm, md, lg} -> flag Medium, Design System.

## BannerAlert
`bnr-alert` — status: **new**

**Purpose:** Full-width inline alert banner for persistent contextual feedback.

**Variants:** — none (single treatment)

**Sizes:** — none

**States:** default, close-hover, close-focus, loading

**Anatomy (BEM elements):** ico, content, copy, title, msg, actions, btn, link, close

**Accessibility role:** `status`

**Validation Rules:**
- Variant outside {n/a} -> flag High, Custom Component.

## EmptyState
`empty` — status: **stable**

**Purpose:** Centered figure -- illustration, title, message, and optional primary / secondary action buttons plus a below-buttons link -- shown when a view has no content to display.

**Variants:** — none (single treatment)

**Sizes:** xs, sm, md, lg, xl

**States:** default, horizontal, reduced-motion

**Anatomy (BEM elements):** figure, illus, body, msg, title, message, actions, action-row, link

**Accessibility role:** `status`

**Validation Rules:**
- Variant outside {n/a} -> flag High, Custom Component.
- Size outside {xs, sm, md, lg, xl} -> flag Medium, Design System.

## Loader
`loader` — status: **new**

**Purpose:** Standalone presentational primitive that signals "work is in progress".

**Variants:** dot, circular, square

**Sizes:** sm, md, lg

**States:** default, reduced-motion

**Anatomy (BEM elements):** shape, dot, circle, square, msg

**Accessibility role:** `status`

**Validation Rules:**
- Variant outside {dot, circular, square} -> flag High, Custom Component.
- Size outside {sm, md, lg} -> flag Medium, Design System.

## MessageAlert
`msg-alert` — status: **stable**

**Purpose:** Public atomic message-alert primitive used everywhere a compact icon + (optional) message status row needs to render.

**Variants:** — none (single treatment)

**Sizes:** — none

**States:** — not state-bearing

**Anatomy (BEM elements):** ico, msg, body, close

**Accessibility role:** see descriptor (composite widget)

**Validation Rules:**
- Variant outside {n/a} -> flag High, Custom Component.

## Status
`sts` — status: **new**

**Purpose:** Compact visual status indicator that conveys the state of an entity (online, blocked, loading, priority, etc.

**Variants:** — none (single treatment)

**Sizes:** sm, md, lg

**States:** default, overlay-top-right, overlay-bottom-right, inline

**Anatomy (BEM elements):** ico

**Accessibility role:** `img`

**Validation Rules:**
- Variant outside {n/a} -> flag High, Custom Component.
- Size outside {sm, md, lg} -> flag Medium, Design System.

## Toast
`toast` — status: **stable**

**Purpose:** Lightweight, non-blocking overlay alert for contextual feedback.

**Variants:** — none (single treatment)

**Sizes:** — none

**States:** entering, visible, hover, paused, removing, close-hover, close-focus

**Anatomy (BEM elements):** ico, content, text, title, msg

**Accessibility role:** `status`

**Validation Rules:**
- Variant outside {n/a} -> flag High, Custom Component.

---

# Utilities family

## Avatar
`avt` — status: **new**

**Purpose:** Compact identity surface that represents a person, AI assistant, brand, connector, application, organization, or system identity.

**Variants:** image, initials, icon, logo, o9logo, novai

**Sizes:** xs, sm, md, lg, xl

**States:** default, hover, focus, active, disabled, loading

**Anatomy (BEM elements):** img, text, ico, logo

**Accessibility role:** `img | button | link`

**Validation Rules:**
- Variant outside {image, initials, icon, logo, o9logo, novai} -> flag High, Custom Component.
- Size outside {xs, sm, md, lg, xl} -> flag Medium, Design System.

## AvatarGroup
`avt-grp` — status: **new**

**Purpose:** Composite parent that stacks multiple ArvoAvatar instances in a compact horizontal row to represent collaborators, contributors, reviewers, approvers, assignees, or any participant collection.

**Variants:** — none (single treatment)

**Sizes:** xs, sm, md, lg, xl

**States:** default, hover-item, focus-within-item, hover-overflow, focus-overflow, open-overflow, disabled, loading, reducedMotion

**Anatomy (BEM elements):** item, overflow, list, list-item, list-lbl

**Accessibility role:** `group`

**Validation Rules:**
- Variant outside {n/a} -> flag High, Custom Component.
- Size outside {xs, sm, md, lg, xl} -> flag Medium, Design System.

## ContextHelp
`ctx-help` — status: **stable**

**Purpose:** Small icon-only trigger that exposes contextual help for a nearby UI element.

**Variants:** info, question

**Sizes:** sm, lg

**States:** default, hover, focus, disabled, loading

**Anatomy (BEM elements):** ico

**Accessibility role:** `button`

**Validation Rules:**
- Variant outside {info, question} -> flag High, Custom Component.
- Size outside {sm, lg} -> flag Medium, Design System.

## DisclosureButton
`disc-btn` — status: **new**

**Purpose:** Lightweight, surface-less text control that toggles whether adjacent content is revealed or collapsed in the same page or section.

**Variants:** — none (single treatment)

**Sizes:** sm, md, lg

**States:** default, hover, focus, active, transition

**Anatomy (BEM elements):** lbl, chev

**Accessibility role:** `button`

**Validation Rules:**
- Variant outside {n/a} -> flag High, Custom Component.
- Size outside {sm, md, lg} -> flag Medium, Design System.

## FormLabel
`form-lbl` — status: **stable**

**Purpose:** Public atomic form label primitive shared by every labelled form control in the design system.

**Variants:** — none (single treatment)

**Sizes:** lg

**States:** — not state-bearing

**Anatomy (BEM elements):** req, ctx-help

**Accessibility role:** see descriptor (composite widget)

**Validation Rules:**
- Variant outside {n/a} -> flag High, Custom Component.
- Size outside {lg} -> flag Medium, Design System.

## InlineContent
`inline` — status: **stable**

**Purpose:** Shared inline rich-text content contract used by the `message` (and `description`) slots of the Toast, Banner Alert, Alert Dialog, Message Alert, and Rich Tooltip components.

**Variants:** — none (single treatment)

**Sizes:** — none

**States:** default, invalid-link-protocol

**Anatomy (BEM elements):** em, strong, link, code, kbd, abbr, time, sup, sub

**Accessibility role:** `none`

**Validation Rules:**
- Variant outside {n/a} -> flag High, Custom Component.

## Splitter
`spl` — status: **new**

**Purpose:** Thin separator that visually divides two adjacent regions along one axis, with optional drag-to-resize and full keyboard support.

**Variants:** — none (single treatment)

**Sizes:** — none

**States:** — not state-bearing

**Anatomy (BEM elements):** handle

**Accessibility role:** see descriptor (composite widget)

**Validation Rules:**
- Variant outside {n/a} -> flag High, Custom Component.

## Tooltip
`tip` — status: **stable**

**Purpose:** Contextual text bubble that displays a description for an element on hover or keyboard focus.

**Variants:** — none (single treatment)

**Sizes:** — none

**States:** hidden, visible

**Anatomy (BEM elements):** txt, shortcut

**Accessibility role:** `tooltip`

**Validation Rules:**
- Variant outside {n/a} -> flag High, Custom Component.

---

# Cross-Component Consistency Rules

1. **Variant/size vocabulary is closed per component** — a variant valid on Button (`danger-primary`) is not automatically valid on a visually similar component (ToggleButton has no danger variants at all). Always check against that specific component's descriptor, never assume family-wide inheritance.
2. **Icon-only anywhere = mandatory `aria-label`** — applies identically across IconButton, FabButton, IconButtonLink, DropdownIconButton, SplitIconButton, and any other icon-only surface.
3. **Danger variants are capped at `primary | tertiary | outline`** everywhere they appear (Button, IconButton) — no `danger-secondary` exists on any component in the library.
4. **`open` state is reserved for components that host a disclosure** (DropdownButton, SplitButton, ActionMenu, Popover-triggering buttons) — a plain Button or IconButton with no associated overlay should never carry `.open`.
5. **`loading` always maps to `aria-busy="true"`** and suppresses interaction at the API level — a component showing a shimmer without `aria-busy` is an incomplete implementation, not a valid loading state.
6. **Deprecated components** (Drawer, SidePanel) should not appear in new work — flag Medium with a migration note, distinct from Custom Component (High).
7. **Composite/disclosure components must use the dedicated wrapper** (DropdownButton, ActionMenu, HybridPopover) rather than a manually-wired Button+Popover pair — manual wiring that's missing `aria-haspopup`/`aria-expanded`/`aria-controls` is the most common silent regression across the whole Actions/Overlays boundary.