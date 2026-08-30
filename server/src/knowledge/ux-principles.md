# UX Principles

> **Source note (read before using this file):** unlike `tokens.md`, `components.md`,
> `patterns.md`, and `accessibility.md`, this file is **not extracted from the Arvo
> design-system repo** — no UX-psychology/heuristics content exists anywhere in that
> source (confirmed: not in `descriptors/`, `architecture/`, or `apps/docs/`). The
> original stub for this file said as much explicitly: *"Phase 2, not active... kept
> for completeness... these are context-dependent and need human judgement."* This
> version expands that same stub's named list into a usable structure using the
> standard, well-established definitions of each named law/heuristic — nothing here
> is invented, but nothing here is Arvo-specific either. **Treat every rule in this
> file as Needs clarification / Phase 2 until a human explicitly wires it into the
> validator** — these require judgement calls a deterministic checker can't safely make.

---

## Visibility of System Status

### Meaning
The system should always keep users informed about what's happening through appropriate feedback within reasonable time.

### Why it matters
Users without status feedback can't tell if an action succeeded, is in progress, or failed — leading to repeated clicks, abandoned flows, or lost trust.

### Good example
A save action shows a brief inline confirmation ("Saved") or a loading spinner during an async operation (Arvo's own `isLoading`/`aria-busy` pattern is a working implementation of this principle).

### Bad example
A button click that silently does something in the background with zero visual acknowledgment — the user can't tell if it worked.

### Validator Signals
Async actions (form submits, deletes, data loads) with no loading/success/error state visible anywhere in the DOM within a reasonable window.

### Severity Heuristic
Major if the action is destructive or high-consequence; Minor if low-stakes and quickly reversible.

---

## Match Between System and the Real World

### Meaning
The system should speak the user's language, with familiar words/phrases/concepts, following real-world conventions.

### Why it matters
Jargon or reversed logic (e.g., a "delete" icon that means "add") forces users to learn the system instead of applying existing mental models.

### Good example
A trash-can icon for delete; a magnifying glass for search.

### Bad example
A custom, unlabeled glyph used for a common action (delete, save, search) with no tooltip and no text fallback.

### Validator Signals
Icon-only controls using non-standard iconography for common actions, with no accessible label to disambiguate.

### Severity Heuristic
Minor to Major depending on how central the action is to the primary task flow.

---

## Consistency and Standards

### Meaning
Users shouldn't have to wonder whether different words, situations, or actions mean the same thing — follow platform and internal conventions.

### Why it matters
Inconsistency multiplies cognitive load — every screen becomes something to relearn instead of a variation on something known.

### Good example
Every destructive action in the product routes through the same AlertDialog confirmation pattern (see `patterns.md`).

### Bad example
One delete flow uses a modal confirmation, another deletes immediately on click, a third uses a custom inline "are you sure" banner.

### Validator Signals
The same logical action (e.g., "delete") implemented with visibly different components/patterns across screens in the same product.

### Severity Heuristic
Major — inconsistency compounds across a product and erodes trust in predictability.

---

## Error Prevention

### Meaning
Good error messages are important, but the best designs prevent problems from occurring in the first place — through careful constraints, confirmations, or design choices that eliminate error-prone conditions.

### Why it matters
Preventing an error is strictly better than a well-worded recovery message after the fact.

### Good example
A disabled "Submit" button until all required fields are valid, rather than allowing submission and then showing errors.

### Bad example
A form that allows submission of an obviously invalid state (empty required field) and only reveals the problem after a round trip.

### Validator Signals
Submit/confirm actions enabled while known-required fields are empty or invalid.

### Severity Heuristic
Major for destructive/irreversible actions; Minor for low-stakes forms.

---

## Recognition Rather Than Recall

### Meaning
Minimize memory load by making objects, actions, and options visible, rather than requiring the user to remember information from one screen to the next.

### Why it matters
Recall is cognitively expensive; recognition (seeing and choosing) is fast and low-effort.

### Good example
A dropdown/select showing all valid options, vs. a free-text field where the user must recall the exact valid value.

### Bad example
A field that requires the user to type an exact ID or code they saw on a previous screen with no lookup/autocomplete assist.

### Validator Signals
Free-text inputs used where a bounded, known option set exists and a Select/Combobox/Listbox would recognize it instead.

### Severity Heuristic
Minor to Major depending on how error-prone recall is in that specific context.

---

## User Control and Freedom

### Meaning
Users often perform actions by mistake and need a clearly marked "emergency exit" — undo/redo, cancel, back — without going through an extended process.

### Why it matters
Without an escape hatch, users become hesitant to explore or act, which increases task abandonment.

### Good example
An AlertDialog's Cancel button and Escape-to-cancel behavior (confirmed in the Arvo AlertDialog contract, see `patterns.md`).

### Bad example
A multi-step flow with no way to go back or cancel once started.

### Validator Signals
Modal/overlay flows with no visible cancel/close affordance and no Escape-key dismissal.

### Severity Heuristic
Major.

---

## Hick's Law

### Meaning
The time it takes to make a decision increases with the number and complexity of choices.

### Why it matters
Overloading a screen with options slows decision-making and increases abandonment, especially for time-sensitive or frequent tasks.

### Good example
A primary action prominent among 1–2 alternatives; overflow options tucked into a secondary menu.

### Bad example
Ten equally-weighted buttons presented simultaneously with no visual hierarchy for the primary path.

### Validator Signals
Action groups (e.g., toolbar, footer) with many same-weight actions and no clear single primary among them.

### Severity Heuristic
Minor — usually a refinement opportunity, not a defect, unless the choice set is extreme (10+ equally-weighted options).

---

## Fitts's Law

### Meaning
The time to acquire a target is a function of the distance to it and its size — bigger, closer targets are faster and easier to hit.

### Why it matters
Small or distant targets increase error rate and slow interaction, especially for users with motor impairments (this overlaps directly with the WCAG 2.5.5 touch-target rule in `accessibility.md`).

### Good example
A 44×44px (or larger) primary action button placed within easy reach of the triggering context.

### Bad example
A tiny (<24px) icon-only control as the only way to perform a frequent, important action.

### Validator Signals
Frequently-used interactive elements with a small bounding box, especially below the 44×44px WCAG threshold.

### Severity Heuristic
Same as the WCAG touch-target rule this overlaps with — Major.

---

## Jakob's Law

### Meaning
Users spend most of their time on other products, so they expect your product to work the same way as the ones they already know.

### Why it matters
Deviating from well-established conventions (hamburger menu = navigation, magnifying glass = search) forces relearning with no upside.

### Good example
A settings gear icon that opens settings.

### Bad example
Reassigning a universally recognized icon (trash can) to a non-delete action.

### Validator Signals
Standard iconography used for a non-standard meaning.

### Severity Heuristic
Major if the mismatch could cause a destructive mistake; Minor otherwise.

---

## Miller's Law

### Meaning
Present information in manageable chunks — the average person can hold roughly 7 (±2) items in working memory at once.

### Why it matters
Long unstructured lists or forms overwhelm working memory and increase error/abandonment.

### Good example
A long form broken into grouped sections/steps (per Arvo spacing guidance: 16px between form elements, grouped with clear section boundaries).

### Bad example
A single unbroken list of 30+ ungrouped fields or options.

### Validator Signals
Long flat lists/forms with no grouping, headers, or pagination.

### Severity Heuristic
Minor to Major depending on list length and task criticality.

---

## Cognitive Load

### Meaning
The UI should not require unnecessary mental effort to understand or operate — minimize extraneous load so users can focus on their actual task.

### Why it matters
High cognitive load slows task completion and increases error rate, particularly under time pressure or for less tech-confident users.

### Good example
Progressive disclosure — advanced options hidden behind an explicit "Advanced" toggle rather than always visible.

### Bad example
Every possible option and setting exposed simultaneously on first load.

### Validator Signals
Dense screens with no visual hierarchy, grouping, or progressive disclosure for advanced/rare options.

### Severity Heuristic
Minor — usually a design-quality signal rather than a hard defect.

---

## Peak-End Rule

### Meaning
People judge an experience largely by how they felt at its most intense point (the peak) and at its end, rather than the average of the whole experience.

### Why it matters
A flow that's fine throughout but ends badly (confusing confirmation, silent failure) is remembered as a bad experience overall.

### Good example
A clear, positive success state at the end of a multi-step flow (e.g., a confirmation screen with a clear next action).

### Bad example
A multi-step flow that ends by just... returning to a list, with no acknowledgment the task completed.

### Validator Signals
Multi-step flows with no distinct completion/success state at the end.

### Severity Heuristic
Minor.

---

## Aesthetic-Usability Effect

### Meaning
Users perceive more aesthetically pleasing designs as easier to use, even when usability is objectively equivalent.

### Why it matters
Visual polish buys goodwill and patience with minor friction — but it can also mask real usability problems, so this cuts both ways for a validator.

### Good example
Consistent use of the design system's type/color/spacing tokens producing a polished, cohesive screen.

### Bad example
Inconsistent, ad-hoc styling that looks unpolished even if the underlying interaction logic is sound.

### Validator Signals
Not independently machine-checkable — this principle mostly emerges as a side effect of the token/component consistency checks in `tokens.md`/`components.md`, not as its own detection rule.

### Severity Heuristic
N/A as a standalone rule — fold into design-system consistency scoring rather than flagging separately.

---

# UX Heuristic Checklist

- [ ] Every async/destructive action gives visible status feedback
- [ ] Icons and terminology match real-world/platform conventions
- [ ] The same logical action uses the same pattern everywhere in the product
- [ ] Invalid/incomplete states are prevented at the point of entry where possible, not just reported after
- [ ] Known/bounded option sets use a selection control, not free text
- [ ] Every flow has a clear cancel/undo/escape path
- [ ] Action groups have a clear single primary among any secondary options
- [ ] Frequent/important controls meet minimum target size
- [ ] Standard iconography is not reassigned to non-standard meanings
- [ ] Long forms/lists are chunked into manageable groups
- [ ] Advanced/rare options are progressively disclosed, not all exposed at once
- [ ] Multi-step flows end with a clear, positive completion state

**Reminder:** every item above requires contextual judgement (is this action actually destructive? is this list actually too long for this audience?) that a deterministic token/component checker can't safely automate. Surface these as suggestions for human review, not hard pass/fail gates, until a human explicitly promotes a specific rule out of Phase 2.