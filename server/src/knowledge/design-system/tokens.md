# AD01 — Foundations: Tokens, Color, Type, Space, Motion, Theming

This is the reference for the Arvo foundation layer: what a token is, which ones you can actually reach from a prototype, the complete semantic colour system in light and dark, the five brand themes and the cascade that resolves them, the type scale, the spacing and size tokens, the icon font, and the motion vocabulary. It is written for the people who design and build o9 prototypes on Arvo — you should be able to answer "which token do I use here" without opening the design system repo. Every value below was read from `@arvo/*` **v2.2.5** in the vendored Arvo repo at `APEX/16_ArvoDesignSystem/o9.DesignSystem/`; file pointers in backticks are relative to that repo root.

---

## 1. How Arvo tokens work

### 1.1 The split

Arvo deliberately publishes its foundation in **two incompatible shapes**.

| Shape | What is in it | How you consume it | Can it change at runtime? |
|---|---|---|---|
| **CSS custom properties** | all semantic colours (`--arvo-color-*`) + the font family (`--o9-font-family`) | `var(--arvo-color-t-primary)` | **Yes** — they are what `data-theme` / `data-mode` rewrite |
| **SCSS variables** | spacing, font-size, font-weight, border-width, border-radius, shadow, opacity, motion, icon-size, illustration-size, component widths, the global palette | `@use '@arvo/tokens/scss'` then `$arvo-space-12` | **No** — baked into compiled CSS |

The rule is stated verbatim in the source (`packages/tokens/src/scss/_root.scss:11-14`):

> Static tokens (spacing, font-size, font-weight, border-width, border-radius, shadows, opacity, motion, icon-size) are NOT emitted as CSS variables — they are consumed directly via the `$arvo-*` SCSS tokens at compile time.

The rationale is economy: only values that must change at runtime pay for the custom-property indirection. `apps/docs/docs/usage/styling.mdx:44` states the consequence plainly — *"Static SCSS tokens cannot be overridden from your app at runtime."*

### 1.2 The exact runtime surface — 173 names, and that is all

Verified by counting `packages/tokens/dist/arvo-tokens.css`:

| Family | Prefix | Unique names |
|---|---|---|
| Surface | `--arvo-color-s-*` | 75 |
| Border | `--arvo-color-b-*` | 38 |
| Icon | `--arvo-color-i-*` | 30 |
| Text | `--arvo-color-t-*` | 29 |
| Font family | `--o9-font-family` | 1 |
| **Total** | | **173** |

There are **no** `--arvo-space-*`, `--arvo-radius-*`, `--arvo-font-size-*`, `--arvo-duration-*`, `--arvo-shadow-*`, `--arvo-icon-*`, or `--arvo-z-*` custom properties. If you wrote one, it resolves to nothing.

(A second, larger family — the per-component `--arvo-{abbr}-*` override variables such as `--arvo-btn-bg-color` — is declared inside `@arvo/styles` component CSS, not in `@arvo/tokens`. Counted on `packages/styles/dist/arvo.css`: **296 per-component names are actually declared** there; **348** if you also count names that appear only as `var()` references awaiting a consumer value — 348 is the figure AD04 uses. The 468 you get from a naïve grep is the total of *all* declared `--arvo-*` names in that file, 172 of which are `--arvo-color-*`. Those per-component hooks are the legal app-level theming surface; see AD04.)

### 1.3 Which entry point gives you what

`packages/tokens/package.json:11-28`:

| Specifier | You get |
|---|---|
| `@arvo/tokens/css` | compiled `:root` blocks, 18 KB — the only file a plain-CSS prototype needs |
| `@arvo/tokens/css/min` | same, minified, 16 KB |
| `@arvo/tokens/scss` | all `$arvo-*` SCSS vars **and** the `:root` emission |
| `@arvo/tokens/scss/variables` | SCSS vars only, **zero CSS output** — use this in every file but one |
| `@arvo/tokens/scss/root` | the `:root` emission only |
| `@arvo/tokens/scss/{colors,spacing,typography,borders,widths,animation,effects,icon-size,illustration-size}` | one family each |

The `variables` vs `scss` distinction matters: `_all.scss` forwards `./root`, `_variables.scss` does not (`packages/tokens/src/scss/_variables.scss:1-11`). Import `@arvo/tokens/scss` in ten partials and you emit the `:root` block ten times.

### 1.4 The workaround for compile-time-only tokens

No APEX prototype compiles SCSS. All five hand-write plain CSS. Two legal moves:

**A. Hardcode the literal.** The docs bless this (`apps/docs/docs/usage/styling.mdx:60`) — the values are stable and enumerated in §5 and §7 below.

```css
.card { padding: 1rem; }        /* = $arvo-space-16 */
```

**B. Re-declare them under your own namespace.** Preferred for anything used more than twice.

```css
:root {
  --app-space-12: 0.75rem;   /* $arvo-space-12  */
  --app-radius-16: 1rem;     /* $arvo-radius-16 */
  --app-dur-base: 180ms;     /* $arvo-duration-base */
  --app-ease: cubic-bezier(0.4, 0, 0.2, 1);  /* $arvo-ease-standard */
}
```

Do **not** name them `--arvo-*`. That namespace belongs to the system, and a future release that starts emitting `--arvo-space-12` would silently collide with yours.

One family survives the wall intact: **shadows**. The `$arvo-shadow-*` tokens are SCSS, but their colour half is a CSS variable, so a plain-CSS consumer can reproduce them byte-for-byte (`packages/tokens/src/scss/_effects.scss:7-13`):

```css
box-shadow: 0px 10px 20px 0px var(--arvo-color-s-shadow-static-1); /* = $arvo-shadow-down */
```

### 1.5 Three foundation defects to route around

Verified by grep across `packages/`; all three are real in 2.2.5.

| Defect | Effect | Fix in your app |
|---|---|---|
| **`--arvo-font-family` is never defined.** It is referenced as `var(--arvo-font-family)` in 8 style files (`packages/styles/src/mixins/_form-input.scss`, `_rolling-stepper.scss`, `components/navigation/_arvo-tabs.scss`, `components/data-display/_arvo-tree.scss`, `components/inputs/_arvo-radio.scss`, `_arvo-cb.scss`, `_arvo-adv-search.scss`, `_arvo-search.scss`). The real token is `--o9-font-family`. | Those elements silently inherit whatever the page gives them. | `:root { --arvo-font-family: var(--o9-font-family); }` |
| **`--arvo-color-b-default` is never defined.** Used at `packages/styles/src/mixins/_inline-content.scss:64`. | `.arvo-inline__kbd` key-cap underline paints nothing. | Nearest real tokens: `--arvo-color-b-divider`, `--arvo-color-b-dark`. |
| **`.arvo-skeleton` is documented but not shipped.** `apps/docs/docs/usage/styling.mdx:246-254` contracts it; grep across `packages/styles/src` and `packages/react/src` finds no such class — only the `arvo-skeleton-shimmer` keyframes. | `<div class="arvo-skeleton">` renders an unstyled div. | Build your own from `--arvo-color-s-pulse-light` / `-pulse-dark` + the shipped keyframes (§7.5). |

> **Correction to earlier APEX material:** `--arvo-color-b-strong` does **not** exist. The border family has no `-strong` member (full list in §2.3). Use `--arvo-color-b-dark` or `--arvo-color-b-separator`.

---

## 2. Colour

### 2.0 The naming grammar

```
--arvo-color-{s|b|t|i}-{semantic}
```

| Prefix | Family | Use for |
|---|---|---|
| `s-` | Surface | backgrounds, fills |
| `b-` | Border | borders, dividers, outlines, focus rings |
| `t-` | Text | foreground text |
| `i-` | Icon | glyph colour (mirrors `t-` almost exactly) |

Cross-cutting suffix grammar, consistent across families:

| Suffix | Means |
|---|---|
| `-hover` / `-active` / `-disabled` / `-readonly` / `-placeholder` / `-focus` | interaction state |
| `-positive` / `-negative` / `-warning` / `-info` / `-neutral` | status |
| `-subtle` / `-strong` (surface only) | status intensity — tinted fill vs saturated fill |
| `-inverse` | flip against the current mode |
| `-direct` | the current mode's own base (white in light, black in dark) |
| `-static` | deliberately mode-invariant — same hex in light and dark |
| `-theme*` | brand accent — the only tokens `data-theme` rewrites |
| `-util-{purple\|pink\|glacier\|amber\|greenish\|bluish}` | six categorical accents for tags and chips |
| `s-fn-*` | planning-grid functional states (o9-specific) |
| `-nova-static` | the AI brand gradient |

All values below are transcribed from `packages/tokens/src/scss/_root.scss` and confirmed against the compiled `packages/tokens/dist/arvo-tokens.css`. **Light** = `:root, html[data-mode="light"]`. **Dark** = `html[data-mode="dark"]`. Light theme values are the o9 Theme default; brand overrides are in §3.4.

### 2.1 Surface — `--arvo-color-s-*` (75 tokens)

**Base and layers** (`_root.scss:54-64` / `468-478`)

| Token | Meaning | Light | Dark |
|---|---|---|---|
| `--arvo-color-s-base` | app canvas / page background | `#F2F2F2` | `#202020` |
| `--arvo-color-s-layer-01` | card / panel on the canvas | `#FFFFFF` | `#121212` |
| `--arvo-color-s-layer-02` | recessed surface | `#F2F2F2` | `#202020` |
| `--arvo-color-s-layer-03` | raised surface | `#FFFFFF` | `#202020` |
| `--arvo-color-s-layer-04` | recessed / hover track | `#F2F2F2` | `#303030` |
| `--arvo-color-s-layer-05` | recessed | `#F2F2F2` | `#303030` |
| `--arvo-color-s-layer-06` | raised | `#FFFFFF` | `#303030` |
| `--arvo-color-s-layer-07` | strongest fill (scrollbar thumb) | `#CCCCCC` | `#4C4C4C` |
| `--arvo-color-s-placeholder` | empty-slot fill | `#FFFFFF` | `#CCCCCC` |
| `--arvo-color-s-placeholder-2` | secondary empty-slot fill | `#4C4C4C` | `#4C4C4C` |
| `--arvo-color-s-brand` | brand chrome background | `#F2F2F2` | `#202020` |

> The layer scale is **not** a monotonic elevation ramp in light mode — it alternates `#FFFFFF` / `#F2F2F2`. Read `01`/`03`/`06` as "paper on base" and `02`/`04`/`05` as "recessed, matches base".

**State** (`_root.scss:79-82` / `493-496`)

| Token | Meaning | Light | Dark |
|---|---|---|---|
| `--arvo-color-s-hover` | hover fill | `#B2B2B2` | `#737373` |
| `--arvo-color-s-active` | pressed/selected fill | `#FFFFFF` | `#010101` |
| `--arvo-color-s-disabled` | disabled fill | `#E5E5E5` | `#303030` |
| `--arvo-color-s-readonly` | read-only fill | `#F2F2F2` | `#303030` |

**Status** (`_root.scss:83-95` / `497-509`)

| Token | Meaning | Light | Dark |
|---|---|---|---|
| `--arvo-color-s-positive-subtle` | success banner tint | `#E1F3E4` | `#303030` |
| `--arvo-color-s-negative-subtle` | error banner tint | `#FFE4E0` | `#303030` |
| `--arvo-color-s-warning-subtle` | warning banner tint | `#FFF2D6` | `#303030` |
| `--arvo-color-s-info-subtle` | info banner tint | `#E1E8FF` | `#303030` |
| `--arvo-color-s-positive-strong` | saturated success fill | `#00804F` | `#92E6A7` |
| `--arvo-color-s-negative-strong` | saturated error fill | `#BC1227` | `#F07A62` |
| `--arvo-color-s-warning-strong` | saturated warning fill | `#926200` | `#EFBC5C` |
| `--arvo-color-s-info-strong` | saturated info fill | `#0037FF` | `#B8C7FF` |
| `--arvo-color-s-neutral-strong` | saturated neutral fill | `#4C4C4C` | `#E5E5E5` |
| `--arvo-color-s-negative` | destructive action fill | `#BC1227` | `#F07A62` |
| `--arvo-color-s-negative-hover` | destructive hover | `#931D07` | `#BC1227` |
| `--arvo-color-s-negative-active` | destructive pressed | `#660914` | `#931D07` |
| `--arvo-color-s-negative-static` | mode-invariant error fill | `#D9311B` | `#D9311B` |

> **All four `-subtle` status surfaces collapse to the same flat `#303030` in dark mode.** In dark, status must be carried by text, border, or icon colour — the surface tint is gone. Design status treatments so they survive that.

**Inverse / direct / static** (`_root.scss:96-104` / `510-520`)

| Token | Meaning | Light | Dark |
|---|---|---|---|
| `--arvo-color-s-neutral` | neutral strong fill | `#010101` | `#FFFFFF` |
| `--arvo-color-s-inverse` | inverted surface (dark bar in light mode) | `#010101` | `#FFFFFF` |
| `--arvo-color-s-direct` | the mode's own base | `#FFFFFF` | `#010101` |
| `--arvo-color-s-on-inverse` | surface sitting on an inverse surface | `#303030` | `#F2F2F2` |
| `--arvo-color-s-white-static` | always white | `#FFFFFF` | `#FFFFFF` |
| `--arvo-color-s-black-static` | always near-black | `#121212` | `#121212` |
| `--arvo-color-s-overlay-static` | modal scrim | `rgba(1,1,1,0.6)` | `rgba(1,1,1,0.6)` |
| `--arvo-color-s-shadow-static-1` | shadow tint (up/down/center/fab/low) | `rgba(76,76,76,0.2)` | `rgba(76,76,76,0.2)` |
| `--arvo-color-s-shadow-static-2` | shadow tint (left/right) | `rgba(76,76,76,0.0588)` | `rgba(76,76,76,0.2)` |

> `--arvo-color-s-shadow-static-2` is named `-static` but is **not** mode-invariant (`_root.scss:104` vs `:520`). Side shadows are ~3.4× heavier in dark mode.

**Loading skeleton** (`_root.scss:105-106` / `521-522`)

| Token | Meaning | Light | Dark |
|---|---|---|---|
| `--arvo-color-s-pulse-light` | skeleton base | `#F2F2F2` | `#202020` |
| `--arvo-color-s-pulse-dark` | skeleton shimmer | `#E5E5E5` | `#666666` |

**Functional grid surfaces `s-fn-*`** (`_root.scss:107-112` / `523-528`) — o9-specific, the most planning-relevant family in the system.

| Token | Meaning | Light | Dark |
|---|---|---|---|
| `--arvo-color-s-fn-currenttime` | current-time bucket | `#EFBC5C` | `#926200` |
| `--arvo-color-s-fn-pasttime` | past / locked period | `#F2F2F2` | `#202020` |
| `--arvo-color-s-fn-editable` | editable cell | `#FFF2D6` | `#242000` |
| `--arvo-color-s-fn-ancestorfrozen` | ancestor frozen | `#26A644` | `#073725` |
| `--arvo-color-s-fn-frozen` | frozen | `#6EDE8A` | `#00804F` |
| `--arvo-color-s-fn-frozenleaf` | frozen leaf | `#C0F0CA` | `#015132` |

**Utility accents** (`_root.scss:113-130` / `529-546`) — six hues × three intensities.

| Token | Light | Dark |
|---|---|---|
| `--arvo-color-s-util-purple-dark` | `#7433CC` | `#D8C7F0` |
| `--arvo-color-s-util-purple-static` | `#D8C7F0` | `#D8C7F0` |
| `--arvo-color-s-util-purple-subtle` | `#D8C7F0` | `#303030` |
| `--arvo-color-s-util-pink-dark` | `#B60071` | `#F2B8D9` |
| `--arvo-color-s-util-pink-static` | `#F2B8D9` | `#F2B8D9` |
| `--arvo-color-s-util-pink-subtle` | `#F2B8D9` | `#303030` |
| `--arvo-color-s-util-glacier-dark` | `#0172AA` | `#BAD8EB` |
| `--arvo-color-s-util-glacier-static` | `#BAD8EB` | `#BAD8EB` |
| `--arvo-color-s-util-glacier-subtle` | `#BAD8EB` | `#303030` |
| `--arvo-color-s-util-amber-dark` | `#A44A09` | `#FFBE8F` |
| `--arvo-color-s-util-amber-static` | `#FFBE8F` | `#FFBE8F` |
| `--arvo-color-s-util-amber-subtle` | `#FFBE8F` | `#303030` |
| `--arvo-color-s-util-greenish-dark` | `#00804F` | `#C0F0CA` |
| `--arvo-color-s-util-greenish-static` | `#C0F0CA` | `#C0F0CA` |
| `--arvo-color-s-util-greenish-subtle` | `#C0F0CA` | `#303030` |
| `--arvo-color-s-util-bluish-dark` | `#002ED2` | `#B8C7FF` |
| `--arvo-color-s-util-bluish-static` | `#B8C7FF` | `#B8C7FF` |
| `--arvo-color-s-util-bluish-subtle` | `#B8C7FF` | `#303030` |

Semantics: `-dark` = strong fill that flips light↔dark; `-static` = same tint both modes; `-subtle` = tinted in light, flat grey in dark. **For categorical chips that must keep identity in dark mode, use `-static`.**

**Nova** (`_root.scss:131` / `547`) — the AI brand gradient, identical in both modes:

| Token | Value |
|---|---|
| `--arvo-color-s-nova-static` | `linear-gradient(61deg, #FFDFA5 0.88%, #FF3D00 60.13%)` |

### 2.2 Text — `--arvo-color-t-*` (29 tokens)

(`_root.scss:177-208` / `593-624`)

| Token | Meaning | Light | Dark |
|---|---|---|---|
| `--arvo-color-t-primary` | primary ink — values, headings | `#010101` | `#E5E5E5` |
| `--arvo-color-t-secondary` | secondary ink — labels, titles | `#303030` | `#CCCCCC` |
| `--arvo-color-t-tertiary` | tertiary ink — captions, meta | `#4C4C4C` | `#B2B2B2` |
| `--arvo-color-t-placeholder` | input placeholder | `#666666` | `#B2B2B2` |
| `--arvo-color-t-hover` | hovered text | `#010101` | `#FFFFFF` |
| `--arvo-color-t-active` | active/selected text | `#010101` | `#FFFFFF` |
| `--arvo-color-t-active-inverse` | active text on inverse fill | `#FFFFFF` | `#010101` |
| `--arvo-color-t-inverse` | text on an inverse surface | `#FFFFFF` | `#010101` |
| `--arvo-color-t-white-static` | always white | `#FFFFFF` | `#FFFFFF` |
| `--arvo-color-t-black-static` | always near-black | `#202020` | `#202020` |
| `--arvo-color-t-disabled` | disabled text | `#B2B2B2` | `#666666` |
| `--arvo-color-t-readonly` | read-only text | `#303030` | `#CCCCCC` |
| `--arvo-color-t-positive` | success text | `#00804F` | `#92E6A7` |
| `--arvo-color-t-negative` | error text | `#BC1227` | `#F07A62` |
| `--arvo-color-t-warning` | warning text | `#926200` | `#EFBC5C` |
| `--arvo-color-t-info-light` | info text, lighter | `#0037FF` | `#B8C7FF` |
| `--arvo-color-t-info-dark` | info text, darker | `#002ED2` | `#8AA3FF` |
| `--arvo-color-t-neutral` | maximum-contrast text | `#010101` | `#FFFFFF` |
| `--arvo-color-t-form-label` | form field label | `#303030` | `#E5E5E5` |
| `--arvo-color-t-form-value` | form field value | `#202020` | `#F2F2F2` |
| `--arvo-color-t-theme` | brand text | `#010101` | `#FFFFFF` |
| `--arvo-color-t-theme-hover` | brand text hover | `#010101` | `#FFFFFF` |
| `--arvo-color-t-theme-active` | brand text active | `#010101` | `#FFFFFF` |
| `--arvo-color-t-util-purple` | categorical text | `#7433CC` | `#BFA2E7` |
| `--arvo-color-t-util-pink` | categorical text | `#B60071` | `#F2B8D9` |
| `--arvo-color-t-util-glacier` | categorical text | `#0172AA` | `#BAD8EB` |
| `--arvo-color-t-util-amber` | categorical text | `#A44A09` | `#FFBE8F` |
| `--arvo-color-t-util-greenish` | categorical text | `#00804F` | `#C0F0CA` |
| `--arvo-color-t-util-bluish` | categorical text | `#002ED2` | `#B8C7FF` |

> Three things to know. In dark mode `t-primary` is `#E5E5E5`, **not** pure white — pure white is reserved for `-hover` / `-active`, so a resting screen never hits maximum contrast. There is **no** `--arvo-color-t-info`; pick `-info-light` or `-info-dark`. There is **no** `--arvo-color-t-nova-static` — the gradient exists only on `s-`, `b-`, `i-`.

### 2.3 Border — `--arvo-color-b-*` (38 tokens)

**Structural** (`_root.scss:134-153` / `550-569`)

| Token | Meaning | Light | Dark |
|---|---|---|---|
| `--arvo-color-b-divider` | in-content divider rule | `#E5E5E5` | `#303030` |
| `--arvo-color-b-base` | default container border | `#F2F2F2` | `#202020` |
| `--arvo-color-b-subtle` | faintest border | `#F2F2F2` | `#121212` |
| `--arvo-color-b-dark` | emphasised border | `#B2B2B2` | `#666666` |
| `--arvo-color-b-separator` | structural separator | `#E5E5E5` | `#4C4C4C` |
| `--arvo-color-b-inverse` | border on inverse surface | `#010101` | `#F2F2F2` |
| `--arvo-color-b-direct` | the mode's own base | `#FFFFFF` | `#010101` |
| `--arvo-color-b-hover` | hover border | `#CCCCCC` | `#303030` |
| `--arvo-color-b-active-static` | mode-invariant active border | `#808080` | `#808080` |
| `--arvo-color-b-focus-inverse` | focus ring on inverse surface | `#FFFFFF` | `#010101` |
| `--arvo-color-b-form` | form field border | `#949494` | `#808080` |
| `--arvo-color-b-form-separator` | form group separator | `#949494` | `#808080` |
| `--arvo-color-b-disabled` | disabled border | `#CCCCCC` | `#666666` |
| `--arvo-color-b-readonly` | read-only border | `#808080` | `#666666` |

**Status** (`_root.scss:143-148` / `559-564`)

| Token | Meaning | Light | Dark |
|---|---|---|---|
| `--arvo-color-b-positive` | success border | `#00804F` | `#92E6A7` |
| `--arvo-color-b-negative` | error border | `#BC1227` | `#F07A62` |
| `--arvo-color-b-warning` | warning border | `#926200` | `#EFBC5C` |
| `--arvo-color-b-warning-static` | mode-invariant warning border | `#C7880D` | `#C7880D` |
| `--arvo-color-b-info` | info border | `#0037FF` | `#8AA3FF` |
| `--arvo-color-b-neutral` | maximum-contrast border | `#010101` | `#FFFFFF` |

**Theme** (`_root.scss:156-160` / `572-576`)

| Token | Meaning | Light (o9 Theme) | Dark |
|---|---|---|---|
| `--arvo-color-b-theme` | brand border | `#010101` | `#FFFFFF` |
| `--arvo-color-b-theme-hover` | brand border hover | `#010101` | `#FFFFFF` |
| `--arvo-color-b-theme-hover-2` | secondary brand hover | `#4C4C4C` | `#E5E5E5` |
| `--arvo-color-b-theme-active` | brand border active | `#010101` | `#FFFFFF` |
| `--arvo-color-b-theme-focus` | **the canonical focus ring** | `#010101` | `#FFFFFF` |

The focus-ring recipe, taken from `packages/styles/src/mixins/_inline-content.scss:38`:

```css
outline: 1px solid var(--arvo-color-b-theme-focus);
outline-offset: 2px;
```

**Utility** (`_root.scss:162-173` / `578-589`) — twelve tokens, `-dark` and `-static` for each of the six hues.

| Token | Light | Dark |
|---|---|---|
| `--arvo-color-b-util-purple-dark` | `#7433CC` | `#D8C7F0` |
| `--arvo-color-b-util-purple-static` | `#BFA2E7` | `#BFA2E7` |
| `--arvo-color-b-util-pink-dark` | `#B60071` | `#F2B8D9` |
| `--arvo-color-b-util-pink-static` | `#E38ABF` | `#E38ABF` |
| `--arvo-color-b-util-glacier-dark` | `#0172AA` | `#BAD8EB` |
| `--arvo-color-b-util-glacier-static` | `#8BC0DD` | `#8BC0DD` |
| `--arvo-color-b-util-amber-dark` | `#A44A09` | `#FFBE8F` |
| `--arvo-color-b-util-amber-static` | `#FFA565` | `#FFA565` |
| `--arvo-color-b-util-greenish-dark` | `#00804F` | `#C0F0CA` |
| `--arvo-color-b-util-greenish-static` | `#92E6A7` | `#92E6A7` |
| `--arvo-color-b-util-bluish-dark` | `#002ED2` | `#B8C7FF` |
| `--arvo-color-b-util-bluish-static` | `#8AA3FF` | `#8AA3FF` |

**Nova**: `--arvo-color-b-nova-static` = the same gradient, both modes.

> **Known defect:** `--arvo-color-b-util-{purple|pink|glacier|amber|greenish|bluish}` **without** a `-dark`/`-static` suffix are referenced by `packages/styles/src/components/inputs/_arvo-chip.scss:288-318` but never defined. Accent chip borders resolve to nothing. Every real name carries a suffix.

### 2.4 Icon — `--arvo-color-i-*` (30 tokens)

(`_root.scss:211-243` / `627-659`) The icon family is the text family with three additions and two removals:

- **Adds:** `--arvo-color-i-negative-static` (`#D9311B` both modes), `--arvo-color-i-warning-static` (`#C7880D` both modes), `--arvo-color-i-nova-static` (the gradient).
- **Drops:** `t-form-label`, `t-form-value`.

Every other name and value matches §2.2 one-for-one: `i-primary`, `i-secondary`, `i-tertiary`, `i-placeholder`, `i-hover`, `i-active`, `i-active-inverse`, `i-inverse`, `i-white-static`, `i-black-static`, `i-disabled`, `i-readonly`, `i-positive`, `i-negative`, `i-warning`, `i-info-light`, `i-info-dark`, `i-neutral`, `i-theme`, `i-theme-hover`, `i-theme-active`, `i-util-{purple|pink|glacier|amber|greenish|bluish}`.

**Practical rule:** an icon next to text takes the matching `i-` token, not the `t-` one. They resolve identically today, but the system reserves the right to diverge, and reviewers check for it.

### 2.5 The global palette ramps (SCSS only)

`packages/tokens/src/scss/_colors.scss`. These are compile-time only and never emitted as CSS variables. The docs advise preferring semantic tokens over reaching in here (`apps/docs/docs/usage/styling.mdx:83`) — the ramps are documented so you can recognise a value, not so you can use it.

**Neutral** (`_colors.scss:3-16`)

| Token | Hex | | Token | Hex |
|---|---|---|---|---|
| `$arvo-global-black` | `#010101` | | `$arvo-global-gray-05` | `#808080` |
| `$arvo-global-gray-10` | `#121212` | | `$arvo-global-gray-11` | `#949494` |
| `$arvo-global-gray-09` | `#202020` | | `$arvo-global-gray-04` | `#B2B2B2` |
| `$arvo-global-gray-08` | `#303030` | | `$arvo-global-gray-03` | `#CCCCCC` |
| `$arvo-global-gray-07` | `#4C4C4C` | | `$arvo-global-gray-02` | `#E5E5E5` |
| `$arvo-global-gray-06` | `#666666` | | `$arvo-global-gray-01` | `#F2F2F2` |
| | | | `$arvo-global-white` | `#FFFFFF` |

> The ramp is **not monotonic by number.** `gray-11` (`#949494`) sits between `gray-05` and `gray-04` in luminance while `gray-10`…`gray-06` descend from near-black. `gray-11` is used only for `--arvo-color-b-form` / `-b-form-separator` in light mode.

**Brand ramps** (`_colors.scss:18-71`) — six steps each, `-06` lightest to `-10`/`-11` darkest.

| Step | o9theme | Forest Green | Onyx Black | Midnight Indigo | Sky Blue |
|---|---|---|---|---|---|
| `-11` | `#303030` | `#2A5C44` | `#303030` | `#1E344D` | `#204DA5` |
| `-10` | `#010101` | `#3A684E` | `#111111` | `#041E3A` | `#2758BA` |
| `-09` | `#4C4C4C` | `#2E8B57` | `#424242` | `#2A4058` | `#3D6DCC` |
| `-08` | `#CCCCCC` | `#BFE2CB` | `#CCCCCC` | `#C3D6EB` | `#BBDDFF` |
| `-07` | `#E5E5E5` | `#E5F3EA` | `#E5E5E5` | `#E4EEFF` | `#E3F2FF` |
| `-06` | `#F2F2F2` | `#EEF7F1` | `#F2F2F2` | `#F0F5FF` | `#EFF8FF` |

SCSS names: `$arvo-global-o9theme-*`, `$arvo-global-forestgreen-*`, `$arvo-global-onyxblack-*`, `$arvo-global-midnightindigo-*`, `$arvo-global-skyblue-*`. **The default o9 brand accent is black/greyscale, not a hue.**

**Dark ramp** (`_colors.scss:26-37`): `$arvo-global-dark-13` `#666666`, `-12` `#303030`, `-11` `#010101`, `-10` `#121212`, `-09` `#4C4C4C`, `-08` `#E5E5E5`, `-07` `#FFFFFF` (the dark accent), `-06` `#CCCCCC`, `-05` `#737373`, `-04` `#525252`, `-03` `#B2B2B2`.

**Feedback ramps** (`_colors.scss:73-110`)

| Blue | | Green | | Red | | Orange |
|---|---|---|---|---|---|---|
| `bluish-10` `#002ED2` | | `greenish-10` `#00804F` | | `redish-11` `#660914` | | `orangish-11` `#242000` |
| `bluish-09` `#0037FF` | | `greenish-09` `#92E6A7` | | `redish-10` `#931D07` | | `orangish-10` `#926200` |
| `bluish-08` `#8AA3FF` | | `greenish-08` `#C0F0CA` | | `redish-09` `#BC1227` | | `orangish-09` `#EFBC5C` |
| `bluish-07` `#B8C7FF` | | `greenish-07` `#E1F3E4` | | `redish-08` `#D9311B` | | `orangish-08` `#C7880D` |
| `bluish-06` `#E1E8FF` | | | | `redish-07` `#EB5436` | | `orangish-07` `#FFF2D6` |
| | | | | `redish-06` `#F07A62` | | |
| | | | | `redish-05` `#FFE4E0` | | |

Aliases with no distinct hue: `positive-10` = `greenish-10`, `positive-08` = `greenish-08`, `warning-10` = `orangish-10`, `warning-06` = `orangish-07`.

**Utility accents** (`_colors.scss:112-132`)

| Token | Hex | | Token | Hex |
|---|---|---|---|---|
| `$arvo-global-purple-10` | `#7433CC` | | `$arvo-global-amber-10` | `#A44A09` |
| `$arvo-global-purple-09` | `#BFA2E7` | | `$arvo-global-amber-09` | `#FFA565` |
| `$arvo-global-purple-08` | `#D8C7F0` | | `$arvo-global-amber-08` | `#FFBE8F` |
| `$arvo-global-pink-10` | `#B60071` | | `$arvo-global-green-10` | `#073725` |
| `$arvo-global-pink-09` | `#E38ABF` | | `$arvo-global-green-09` | `#015132` |
| `$arvo-global-pink-08` | `#F2B8D9` | | `$arvo-global-green-08` | `#26A644` |
| `$arvo-global-glacier-10` | `#0172AA` | | `$arvo-global-green-07` | `#6EDE8A` |
| `$arvo-global-glacier-09` | `#8BC0DD` | | `$arvo-global-green-05` | `#E1F3E4` |
| `$arvo-global-glacier-08` | `#BAD8EB` | | | |

**Alpha** (`_colors.scss:112-132`) — Dart Sass converts 8-digit hex to `rgba()` in the compiled output:

| Token | SCSS | Compiled |
|---|---|---|
| `$arvo-global-opacity-1` | `#01010199` | `rgba(1, 1, 1, 0.6)` |
| `$arvo-global-opacity-2` | `#4C4C4C33` | `rgba(76, 76, 76, 0.2)` |
| `$arvo-global-opacity-3` | `#4C4C4C0F` | `rgba(76, 76, 76, 0.0588235294)` |

**Nova** (`_colors.scss:134-136`): `$arvo-global-nova-start` `#FFDFA5`, `$arvo-global-nova-end` `#FF3D00`.

**Dead palette tokens** — defined but never referenced by `_root.scss`: `$arvo-global-dark-04`, `-10`, `-11`, `$arvo-global-green-05`, `$arvo-global-positive-08`, `$arvo-global-redish-07`.

### 2.6 Picking a colour — decision guide

| Situation | Reach for |
|---|---|
| Page / app background | `--arvo-color-s-base` |
| A card, widget, or panel sitting on the page | `--arvo-color-s-layer-01` |
| A recessed strip inside a card (table header, footer) | `--arvo-color-s-layer-02` |
| A hairline between rows inside a card | `--arvo-color-b-divider` |
| A structural separator between regions | `--arvo-color-b-separator` |
| A KPI value, a heading, a table number | `--arvo-color-t-primary` |
| A label above a value, a widget title | `--arvo-color-t-secondary` |
| A caption, timestamp, provenance note | `--arvo-color-t-tertiary` |
| An icon beside text | the `i-` twin of the text token, never the `t-` token |
| "Good" / "on plan" / "improving" | `--arvo-color-t-positive` (+ `--arvo-color-s-positive-subtle` if a fill is needed **in light mode only**) |
| "At risk" / "shortfall" / "breach" | `--arvo-color-t-negative`, `--arvo-color-b-negative` |
| "Watch" / "approaching threshold" | `--arvo-color-t-warning` |
| "Informational" / "note" | `--arvo-color-t-info-dark` on light, `-info-light` reads better on dark |
| A destructive button | `--arvo-color-s-negative` + `-hover` + `-active` |
| Brand accent — primary CTA, selected nav, active tab | the `*-theme` tokens (§3) |
| Focus ring | `--arvo-color-b-theme-focus` |
| Categorical series, tags, chips that must not read as status | `--arvo-color-{s\|b\|t\|i}-util-{hue}-static` |
| Editable planning cell | `--arvo-color-s-fn-editable` |
| Frozen / locked planning cell | `--arvo-color-s-fn-frozen` / `-frozenleaf` / `-ancestorfrozen` |
| Current-period column | `--arvo-color-s-fn-currenttime` |
| Past / read-only period | `--arvo-color-s-fn-pasttime` |
| Anything AI-authored | `--arvo-color-{s\|b\|i}-nova-static` — and nothing else |
| A modal scrim you are hand-rolling | `--arvo-color-s-overlay-static` |
| A loading skeleton | `--arvo-color-s-pulse-light` / `-pulse-dark` |

**Do / Don't**

- **Do** use a semantic token before a palette token. `var(--arvo-color-t-primary)` survives an upgrade; `$arvo-global-gray-08` does not.
- **Do** pick the family that matches the property. Surface tokens on `background`, border tokens on `border-color`, text tokens on `color`, icon tokens on icon glyphs.
- **Do** reach for `-static` when a colour must mean the same thing in both modes — categorical series above all.
- **Don't** rely on `-subtle` status surfaces to carry meaning: they are all the same grey in dark mode.
- **Don't** reassign `--arvo-color-*` from app code. `apps/docs/docs/usage/styling.mdx:221` is explicit: *"Don't reassign the semantic `--arvo-color-{s|b|t|i}-*` variables from app code."* Theme through the per-component `--arvo-{abbr}-*` surface instead.
- **Don't** use `--arvo-color-t-neutral` as your body ink. It is maximum contrast (pure black / pure white) and is reserved for emphasis.

---

## 3. Theming

### 3.1 The two axes

| Attribute | Element | Values | Effect |
|---|---|---|---|
| `data-theme` | `<html>` | `o9theme` · `o9default` · `o9black` · `o9green` · `o9indigo` | rewrites **22 theme tokens** only |
| `data-mode` | `<html>` | `light` (default) · `dark` | rewrites the **whole** semantic palette |
| `data-user-theme` | `<html>` | `on` | **nothing** — declared but empty in 2.2.5 |

Selectors in the compiled sheet are `html[...]`-qualified (`packages/tokens/dist/arvo-tokens.css:181, 206, 231, 256, 281, 306`). **The attributes must sit on `<html>`, not on a wrapper `<div>`** — overlays portal to `<body>`, so a wrapper-scoped theme leaves every Popover, Dialog, and Panel with the wrong palette.

### 3.2 Brand values

| `data-theme` | Brand name | Light accent (`s-theme`) |
|---|---|---|
| *(absent)* or `o9theme` | o9 Theme — the default | `#010101` |
| `o9default` | **Sky Blue** | `#3D6DCC` |
| `o9black` | **Onyx Black** | `#111111` |
| `o9green` | **Forest Green** | `#2E8B57` |
| `o9indigo` | **Midnight Indigo** | `#041E3A` |

> **Naming trap:** `o9default` is **Sky Blue**, not the default theme. The actual default is `o9theme` (black/greyscale). `_root.scss:316-318` explains why `o9theme` is emitted redundantly: so an explicit `data-theme="o9theme"` still resolves when brands are toggled at runtime.

### 3.3 The cascade, and the dark-mode-wins gotcha

`_root.scss:16-30` documents the emission order verbatim:

| # | Section | Selector | Lines |
|---|---|---|---|
| 1 | Foundation | `:root` (font family only) | `36-38` |
| 2 | Default light | `:root, html[data-mode="light"]` | `51-244` |
| 3 | Brand overrides | `html[data-theme="o9theme"]` … `"o9indigo"` | `319-456` |
| 4 | **Dark mode** | `html[data-mode="dark"]` | `466-660` |
| 5 | User signal (empty) | `html[data-user-theme="on"]` | `662-668` |

Every `html[data-*]` selector has specificity **(0,0,1,1)**. CSS breaks ties by source order, and dark mode is written **last**. Therefore:

```
<html>                                       -> light + o9 Theme
<html data-theme="o9default">                -> light + Sky Blue accents
<html data-mode="dark">                      -> dark palette + dark accents
<html data-theme="o9green" data-mode="dark"> -> DARK WINS. The green accent is gone.
```

`_root.scss:461-464` states it directly:

> Single dark palette applied to ALL brand themes -- there is no per-brand dark variant. Declared AFTER section 3 so the dark theme tokens override any brand theme override when `data-mode="dark"` is present.

**Practical consequence:** in dark mode all five brands render an identical white/greyscale accent (`--arvo-color-s-theme: #FFFFFF`). Never design a dark screen whose meaning depends on brand hue.

> **Docs tension worth knowing.** `apps/docs/docs/usage/styling.mdx:176` calls the two axes "independent" and combinable. Technically true — both attributes apply — but visually misleading, because the brand accent is invisible in dark. Trust `_root.scss`.

### 3.4 Full brand override matrix (light mode)

Each brand block calls `o9-light-theme-vars(...)` (`_root.scss:265-314`), which writes exactly **22 tokens**: 11 surface + 5 border + 3 text + 3 icon. Nothing else changes per brand.

| Token | o9theme | o9default | o9black | o9green | o9indigo |
|---|---|---|---|---|---|
| `--arvo-color-s-theme` | `#010101` | `#3D6DCC` | `#111111` | `#2E8B57` | `#041E3A` |
| `--arvo-color-s-theme-2` | `#010101` | `#3D6DCC` | `#111111` | `#2E8B57` | `#041E3A` |
| `--arvo-color-s-theme-hover-1` | `#4C4C4C` | `#2758BA` | `#424242` | `#3A684E` | `#2A4058` |
| `--arvo-color-s-theme-hover-2` | `#CCCCCC` | `#BBDDFF` | `#CCCCCC` | `#BFE2CB` | `#C3D6EB` |
| `--arvo-color-s-theme-hover-3` | `#E5E5E5` | `#E3F2FF` | `#E5E5E5` | `#E5F3EA` | `#E4EEFF` |
| `--arvo-color-s-theme-hover-4` | `#E5E5E5` | `#E3F2FF` | `#E5E5E5` | `#E5F3EA` | `#E4EEFF` |
| `--arvo-color-s-theme-active-1` | `#010101` | `#3D6DCC` | `#111111` | `#2E8B57` | `#2A4058` ⚠ |
| `--arvo-color-s-theme-active-2` | `#E5E5E5` | `#E3F2FF` | `#E5E5E5` | `#E5F3EA` | `#E4EEFF` |
| `--arvo-color-s-theme-active-3` | `#F2F2F2` | `#EFF8FF` | `#F2F2F2` | `#EEF7F1` | `#F0F5FF` |
| `--arvo-color-s-theme-active-4` | `#F2F2F2` | `#EFF8FF` | `#F2F2F2` | `#EEF7F1` | `#F0F5FF` |
| `--arvo-color-s-theme-active-5` | `#303030` | `#204DA5` | `#303030` | `#2A5C44` | `#1E344D` |
| `--arvo-color-b-theme` | `#010101` | `#3D6DCC` | `#111111` | `#2E8B57` | `#041E3A` |
| `--arvo-color-b-theme-hover` | `#010101` | `#3D6DCC` | `#111111` | `#2E8B57` | `#041E3A` |
| `--arvo-color-b-theme-hover-2` | `#4C4C4C` | `#2758BA` | `#111111` ⚠ | `#3A684E` | `#2A4058` |
| `--arvo-color-b-theme-active` | `#010101` | `#3D6DCC` | `#111111` | `#2E8B57` | `#041E3A` |
| `--arvo-color-b-theme-focus` | `#010101` | `#3D6DCC` | `#111111` | `#2E8B57` | `#041E3A` |
| `--arvo-color-t-theme` | `#010101` | `#3D6DCC` | `#111111` | `#2E8B57` | `#041E3A` |
| `--arvo-color-t-theme-hover` | `#010101` | `#2758BA` | `#111111` | `#3A684E` | `#041E3A` |
| `--arvo-color-t-theme-active` | `#010101` | `#2758BA` | `#111111` | `#3A684E` | `#041E3A` |
| `--arvo-color-i-theme` | `#010101` | `#3D6DCC` | `#111111` | `#2E8B57` | `#041E3A` |
| `--arvo-color-i-theme-hover` | `#010101` | `#2758BA` | `#111111` | `#3A684E` | `#041E3A` |
| `--arvo-color-i-theme-active` | `#010101` | `#2758BA` | `#111111` | `#3A684E` | `#041E3A` |

⚠ The two places the brands are **not** structurally parallel: `o9indigo` maps `s-theme-active-1` to its `-09` step (`_root.scss:439`); `o9black` maps `b-theme-hover-2` to its `-10` step (`_root.scss:390`). Every other brand maps both to the same value as `s-theme` / its `-09` step respectively.

**Dark theme tokens (identical for all five brands):** `s-theme` `#FFFFFF`, `s-theme-2` `#303030`, `s-theme-hover-1` `#B2B2B2`, `-hover-2` `#666666`, `-hover-3` `#303030`, `-hover-4` `#4C4C4C`, `s-theme-active-1` `#FFFFFF`, `-active-2` `#303030`, `-active-3` `#4C4C4C`, `-active-4` `#303030`, `-active-5` `#CCCCCC`; `b-theme`/`-hover`/`-active`/`-focus` `#FFFFFF`, `b-theme-hover-2` `#E5E5E5`; `t-theme`/`-hover`/`-active` `#FFFFFF`; `i-theme`/`-hover`/`-active` `#FFFFFF`.

### 3.5 `data-user-theme`

`_root.scss:662-668` reserves it:

> **USER OVERRIDE SIGNAL** — Reserved for `html[data-user-theme="on"]` -- signals a user-applied theme override without changing the `data-theme` base.

It emits nothing in 2.2.5 (grep across `packages/` and `apps/` finds no other occurrence). Treat it as a documented hook with zero visual effect. Do not build on it.

### 3.6 The wiring a prototype needs

Put the attributes in the **served HTML**, before first paint. This is what avoids the flash of unthemed content:

```html
<html lang="en" data-mode="light" data-theme="o9theme">
```

Toggle at runtime on `document.documentElement`, never on a wrapper:

```js
document.documentElement.dataset.mode  = 'dark';      // light | dark  — wins over theme
document.documentElement.dataset.theme = 'o9green';   // o9theme|o9default|o9black|o9green|o9indigo
```

If your prototype reads token values into JS (charts, canvas, SVG), re-read them on a mode flip — the house pattern is a `MutationObserver` on the same two attributes:

```js
const cs = getComputedStyle(document.documentElement);
new MutationObserver(rebuildPalette).observe(document.documentElement, {
  attributes: true, attributeFilter: ['data-mode', 'data-theme'],
});
```

Illustrations follow `data-mode` for free — `packages/assets/o9illus/o9illus.css:35-48` switches art via `:not([data-mode="dark"])` / `[data-mode="dark"]` selectors.

**One more document-level attribute:** `body[data-scroll-pref]` (`packages/styles/src/base/_scrollbar.scss:2-6`) takes `always` | `onScroll` | `onHover`. The latter two require the scrolling element to carry `.is-active-scrollbar`. Default (no attribute): thumb always painted with `--arvo-color-s-layer-07`.

---

## 4. Typography

### 4.1 Font stack

```css
:root { --o9-font-family: o9Sans, NotoSans, Arial, sans-serif; }
```

`packages/tokens/src/scss/_root.scss:36-38`. **This is the only non-colour CSS custom property in the entire token layer.**

**Arvo never applies it to `<body>`.** Individual components set `font-family: var(--o9-font-family)` on their own roots; your page chrome inherits nothing. Every prototype must do this itself:

```css
body { font-family: var(--o9-font-family, 'o9Sans', system-ui, sans-serif); }
```

Faces are declared in `packages/assets/fonts/fonts.css`, loaded via `@arvo/assets/fonts/css`:

| Family | Weights | Italics |
|---|---|---|
| `o9Sans` | 300, 400, 500, 700 | yes, all four |
| `NotoSans` | 400, 500, 700 (21 CJK/script sub-families) | yes |
| `o9Roboto` | 400, 500, 700 | yes |
| `o9Helvetica` | 400, 700 | yes |

> **There is no weight 600 anywhere.** `font-weight: 600` synthesises or snaps to 700. Design at 400 / 500 / 700.

> The `fonts.css` header warns that URL paths are root-absolute and *"the actual .woff/.woff2 binaries are hosted by the platform."* In this checkout the binaries do ship (`packages/assets/fonts/o9Sans/*.woff2`), which is why `@arvo/assets` is 73 MB and why a naive `vite build` emits every NotoSans file. See AD04 for the latin-only alias workaround.

Other SCSS font constants (`_typography.scss:1-4, 24, 27-28`):

| Token | Value | Use |
|---|---|---|
| `$o9-mono` / `$mono-font` | `monospace` | inline code, `kbd` |
| `$o9con` | `"o9con"` | the icon font |
| `$o9-icon-old` | `"FontAwesome"` | legacy |
| `$o9con-reg-em-1` | `normal normal normal 1em/1 $o9con` | icon-font shorthand |

### 4.2 Weight and size tokens

`packages/tokens/src/scss/_typography.scss:6-21`

| Weight token | Value | | Size token | rem | px |
|---|---|---|---|---|---|
| `$arvo-regular` | `400` | | `$arvo-font-size-64` | `4rem` | 64 |
| `$arvo-medium` | `500` | | `$arvo-font-size-40` | `2.5rem` | 40 |
| `$arvo-bold` | `700` | | `$arvo-font-size-32` | `2rem` | 32 |
| | | | `$arvo-font-size-24` | `1.5rem` | 24 |
| | | | `$arvo-font-size-20` | `1.25rem` | 20 |
| | | | `$arvo-font-size-18` | `1.125rem` | 18 |
| | | | `$arvo-font-size-16` | `1rem` | 16 |
| | | | `$arvo-font-size-14` | `0.875rem` | 14 |
| | | | `$arvo-font-size-12` | `0.75rem` | 12 |
| | | | `$arvo-font-size-10` | `0.625rem` | 10 |

### 4.3 The named scale (mixins)

`packages/styles/src/mixins/_typography.scss`. Suffixes: `r` = 400, `m` = 500, `b` = 700, `c` = uppercase, `u` = underline. Each mixin sets **only** `font-size` and `font-weight` (plus `text-transform` / `text-decoration` where the name says so).

| Heading | Paragraph | Label | Size / weight |
|---|---|---|---|
| `arvo-font-h32-r` | — | — | 32 / 400 |
| `arvo-font-h20-r` | — | — | 20 / 400 |
| `arvo-font-h18-r` | — | — | 18 / 400 |
| `arvo-font-h16-m` | `arvo-font-p16-m` | — | 16 / 500 |
| — | `arvo-font-p16-r` | `arvo-font-l16-r` | 16 / 400 |
| `arvo-font-h14-r` | `arvo-font-p14-r` | `arvo-font-l14-r` | 14 / 400 |
| `arvo-font-h14-m` | `arvo-font-p14-m` | `arvo-font-l14-m` | 14 / 500 |
| — | `arvo-font-p14-b` | — | 14 / 700 |
| `arvo-font-h14-rc` | — | — | 14 / 400 uppercase |
| `arvo-font-h12-r` | `arvo-font-p12-r` | `arvo-font-l12-r` | 12 / 400 |
| `arvo-font-h12-m` | `arvo-font-p12-m` | `arvo-font-l12-m` | 12 / 500 |
| `arvo-font-h12-rc` | — | — | 12 / 400 uppercase |
| `arvo-font-h12-mc` | — | — | 12 / 500 uppercase |
| — | `arvo-font-p12-ru` | `arvo-font-l12-ru` | 12 underline (see ⚠) |
| — | — | `arvo-font-l14-ru` | 14 / 400 underline |
| — | `arvo-font-p10-r` | `arvo-font-l10-r` | 10 / 400 |

`h`, `p`, `l` at the same size and weight are **byte-identical** — the prefixes are semantic naming, not distinct styling. The real scale is **10 / 12 / 14 / 16 / 18 / 20 / 32 px × 400 / 500 / 700**. `$arvo-font-size-24`, `-40`, `-64` exist as tokens but have no named mixin.

⚠ `arvo-font-p12-ru` is named `-r` (regular) but sets `font-weight: $arvo-medium` (`_typography.scss:98-102`). If you are reproducing the scale by hand, decide deliberately which one you want.

**Legacy — do not use.** `_typography.scss:153-190` carries `o9-font-reg-12/13/14/15` and `$o9-font-reg-16/17/18` under a header that reads *"DO NOT USE BELOW -- legacy leftovers, not part of the design system."*

### 4.4 There are no line-height tokens

`_typography.scss` defines none, and the type mixins set none. Line-height falls back to the browser's `normal` except where a component hardcodes `line-height: 1`. **If you want vertical rhythm, you must supply it.** A workable default for a planning UI: `1.45` on body copy, `1.2` on headings and numeric values, `1` on single-line chrome.

### 4.5 UI role → type mapping

Arvo does not publish this mapping; it is the o9 house reading of the scale, consistent with AD07 §1 rule 3.

| Role | Size / weight | Ink |
|---|---|---|
| Page title | 20 / 500 (`arvo-font-h20-r` at 400 if a lighter voice is wanted) | `--arvo-color-t-primary` |
| Section / widget title | 14 / 500 (`arvo-font-h14-m`) | `--arvo-color-t-secondary` |
| Body copy, narrative | 14 / 400 (`arvo-font-p14-r`) | `--arvo-color-t-primary` |
| Dense body / table cell | 12 / 400 (`arvo-font-p12-r`) | `--arvo-color-t-primary` |
| Form label, KPI label | 12–14 / 400–500 (`arvo-font-l12-m` / `l14-r`) | `--arvo-color-t-secondary` |
| Caption, timestamp, provenance | 10–12 / 400 (`arvo-font-p10-r` / `p12-r`) | `--arvo-color-t-tertiary` |
| Numeric — KPI headline | 20–32 / 500–700 + `font-variant-numeric: tabular-nums` | `--arvo-color-t-primary` |
| Numeric — in-table | 12–14 / 400 + `tabular-nums` | `--arvo-color-t-primary` |
| Overline / eyebrow | 12 / 500 uppercase (`arvo-font-h12-mc`) | `--arvo-color-t-tertiary` |

**Rules of thumb**

- **The number is always visually louder than its label.** If a widget title sits in the same size band as its data, the title wins and the screen fails.
- **`tabular-nums` on every column of figures.** Arvo applies it only to `.arvo-inline__time`; everywhere else it is on you.
- **Two rungs beat three.** Label in secondary ink, value in primary. A third caption line is usually the thing to cut.
- **Uppercase is for eyebrows only.** The scale offers four uppercase mixins; using them on labels costs legibility at 10–12px.

---

## 5. Space, size, radius, border, elevation

All SCSS-only. Literal values given so a plain-CSS prototype can use them.

### 5.1 Spacing — `packages/tokens/src/scss/_spacing.scss`

| Token | rem | px | | Token | rem | px |
|---|---|---|---|---|---|---|
| `$arvo-space-1` | `0.0625rem` | 1 | | `$arvo-space-16` | `1rem` | 16 |
| `$arvo-space-2` | `0.125rem` | 2 | | `$arvo-space-20` | `1.25rem` | 20 |
| `$arvo-space-4` | `0.25rem` | 4 | | `$arvo-space-24` | `1.5rem` | 24 |
| `$arvo-space-6` | `0.375rem` | 6 | | `$arvo-space-32` | `2rem` | 32 |
| `$arvo-space-8` | `0.5rem` | 8 | | `$arvo-space-40` | `2.5rem` | 40 |
| `$arvo-space-10` | `0.625rem` | 10 | | `$arvo-space-48` | `3rem` | 48 |
| `$arvo-space-12` | `0.75rem` | 12 | | `$arvo-space-64` | `4rem` | 64 |
| | | | | `$arvo-space-80` | `5rem` | 80 |

The token name is the px value. The ramp is fine-grained at the low end (1/2/4/6/8/10/12), then steps by 4, then 8, then 16.

**Spacing rhythm**

| Distance | Value | Where |
|---|---|---|
| Hairline / optical nudge | 1–2 | icon-to-text micro-alignment |
| Tight intra-element | 4 | icon gap in a chip, badge inset |
| Element internal | 6–8 | chip padding, dense table cell |
| Control internal | 10–12 | button padding-inline, input padding |
| Between related elements | 12–16 | label→field, row→row in a form |
| Card padding | 16 | the default widget inset |
| Between cards / widgets | 16–24 | grid gap |
| Between page sections | 32–40 | section→section |
| Page top / bottom margin | 40–48 | above the first section |
| Empty-state and hero breathing | 64–80 | rare |

Pick **one** step per relationship type and reuse it across the screen. The single most visible density failure is using 12 in one card and 16 in the next.

### 5.2 Border radius — `_borders.scss:1-4`

| Token | Value | px |
|---|---|---|
| `$arvo-radius-none` | `0rem` | 0 |
| `$arvo-radius-16` | `1rem` | 16 |
| `$arvo-radius-circle` | `62.438rem` | ≈999 |

**Only three radii exist.** There is no `$arvo-radius-2/4/8`. The system's visual language is square by default, 16px for pills and large surfaces, `circle` for fully round. Components needing a small radius hardcode it (e.g. `border-radius: 2px` in `packages/styles/src/mixins/_inline-content.scss:47,59`). The o9 house language (AD07) is flat and radius-0 — that is congruent with the token set, not a deviation from it.

### 5.3 Border width — `_borders.scss:6-9`

| Token | Value | Actual |
|---|---|---|
| `$arvo-border-1` | `1px` | 1px |
| `$arvo-border-2` | `0.125rem` | 2px |
| `$arvo-border-3` | `0.094rem` | **1.5px** ⚠ |

⚠ `$arvo-border-3` is 1.5px, not 3px. For this one token the number is an index, not a value.

### 5.4 Elevation — `_effects.scss:1-16`

There is **no numbered elevation scale**. Elevation is directional and semantic.

| Token | Value |
|---|---|
| `$arvo-shadow-low` | `0px 2px 6px -1px var(--arvo-color-s-shadow-static-1)` |
| `$arvo-shadow-down` | `0px 10px 20px 0px var(--arvo-color-s-shadow-static-1)` |
| `$arvo-shadow-up` | `0px -10px 20px 0px var(--arvo-color-s-shadow-static-1)` |
| `$arvo-shadow-left` | `-10px 0px 10px 0px var(--arvo-color-s-shadow-static-2)` |
| `$arvo-shadow-right` | `10px 0px 10px 0px var(--arvo-color-s-shadow-static-2)` |
| `$arvo-shadow-center` | `0px 4px 40px 0px var(--arvo-color-s-shadow-static-1)` |
| `$arvo-shadow-fab` | `0px 4px 7px 2px var(--arvo-color-s-shadow-static-1)` |
| `$arvo-shadow-blur` | `blur(4px)` — a `filter` value, not a `box-shadow` |

Because the colour half is a CSS variable, all seven are usable verbatim from plain CSS. Guidance: `low` for a resting card that must lift, `down`/`up` for a panel docked to an edge, `left`/`right` for a side panel, `center` for a modal, `fab` for a floating action button.

Two more live in `_animation.scss:273-274`: `$arvo-shadow-avatar-uplift-hover: 0 0 0 2px #fff, 0 0 10px 2px rgb(0 0 0 / 16%)` and `$arvo-shadow-avatar-uplift-rest: none`. ⚠ The hover ring hardcodes `#fff` and is wrong in dark mode.

### 5.5 Opacity — `_effects.scss:18-22`

| Token | Value |
|---|---|
| `$arvo-opacity-80` | `0.8` |
| `$arvo-opacity-60` | `0.6` |
| `$arvo-opacity-40` | `0.4` |
| `$arvo-opacity-20` | `0.2` |

### 5.6 z-index — no tokens

There are no z-index tokens in `packages/tokens/src/`. The only global value is hardcoded: `.arvo-overlay__mask { z-index: 999; }` (`packages/styles/src/base/_overlay.scss:18`). If your prototype introduces floating chrome, decide deliberately whether it belongs **below** 999 (under Arvo modals) or **above** — there is no scale to align with.

### 5.7 Component geometry — `_widths.scss` (selected)

Useful when you are hand-rolling something Arvo also ships, and want the same proportions.

| Token | Value | px |
|---|---|---|
| `$arvo-btn-wmax` | `10.25rem` | 164 |
| `$arvo-window-btn-wmin` | `7rem` | 112 |
| `$arvo-tooltip-wmax` | `20rem` | 320 |
| `$arvo-popover-wmin` / `-wmax` / `-hmax` | `16.875rem` / `43.75rem` / `43.75rem` | 270 / 700 / 700 |
| `$arvo-opt-list-hmax` | `20rem` | 320 |
| `$arvo-window-sm-wmax` … `xl-wmax` | `27.5` / `43.75` / `60` / `71.25rem` | 440 / 700 / 960 / 1140 |
| `$arvo-window-sm-hmax` … `xl-hmax` | `52%` / `70%` / `84%` / `96%` | viewport-relative |
| `$arvo-panel-default-w` / `-default-h` | `25rem` | 400 |
| `$arvo-panel-wmin` / `-hmin` | `10rem` / `15rem` | 160 / 240 |
| `$arvo-panel-wmax-px` / `-hmax-px` | `50rem` | 800 (combined with `80vw`/`80vh` via `min()`) |
| `$arvo-panel-header-h` | `2.5rem` | 40 |
| `$arvo-tab-wmin` / `-wmax` | `4.5rem` / `18.125rem` | 72 / 290 |
| `$arvo-chip-wmin` / `-wmax` | `1.75rem` / `13.75rem` | 28 / 220 |
| `$arvo-toast-width` | `18.75rem` | 300 |
| `$arvo-scroll-width` | `0.5rem` | 8 |
| `$arvo-checkbox-small` / `-large` | `1rem` / `1.125rem` | 16 / 18 |
| `$arvo-radio-small` / `-large` | `1rem` / `1.125rem` | 16 / 18 |
| `$arvo-badge-small` / `-medium` / `-large` | `1rem` / `1.25rem` / `1.5rem` | 16 / 20 / 24 |
| `$arvo-image-{14,16,20,24,32,40,60}` | `0.875` / `1` / `1.25` / `1.5` / `2` / `2.5` / `3.75rem` | 14 / 16 / 20 / 24 / 32 / 40 / 60 |
| `$arvo-symbol-size-24` / `-32` | `1.5rem` / `2rem` | 24 / 32 |

**`$arvo-image-*` is the avatar / thumbnail ramp** (`_widths.scss:93-100`) — seven square sizes, and the answer to the avatar-sizing question AD02 leaves open. Use `-24` for an inline byline avatar, `-32` for a list row, `-40` for a header, `-60` for a profile block. Note it starts at 14 and skips 48, so it is not the icon scale (§6.2) with a different prefix.

⚠ Three px comments in `_widths.scss` are wrong (lines 86, 87, 95). The **rem value is authoritative**: `$arvo-badge-medium` = 20px (comment says 24), `$arvo-badge-large` = 24px (comment says 32), `$arvo-image-16` = 16px (comment says 24).

Form-input default width is not a token — it is a convention: inputs default to `width: 300px` and expose a `width` prop that sets `--arvo-form-input-width`; `isFullWidth` is shorthand for `width: "100%"`.

### 5.8 Illustration sizes — `_illustration-size.scss`

Note the `$o9illus-` prefix, **not** `$arvo-`.

| Token | rem | px |
|---|---|---|
| `$o9illus-64` | `4rem` | 64 |
| `$o9illus-96` | `6rem` | 96 |
| `$o9illus-124` | `7.75rem` | 124 |
| `$o9illus-224` | `14rem` | 224 |
| `$o9illus-300` | `18.75rem` | 300 |

Matching CSS classes ship in `packages/assets/o9illus/o9illus.css`: `.o9illus .o9illus-{name} .o9illus-{64|96|124|224|300}`.

---

## 6. Icons — the o9con system

Arvo icons are an **icon font**, not SVG components. There is no `ArvoIcon` component.

### 6.1 Rendering an icon

**Plain HTML / CSS** — the contracted markup (`apps/docs/docs/usage/styling.mdx:264-276`):

```html
<i class="o9con o9con-search" aria-hidden="true"></i>
```

`o9con` is the base class (sets `font-family: "o9con"`, `display: inline-block`, `line-height: 1`, `font-weight: normal`, antialiasing — `packages/assets/o9con/css/o9con.css:44-57`). `o9con-{name}` supplies the glyph via a `::before` rule. Colour comes from `color`, size from `font-size`.

**React** — two paths, and they are not interchangeable:

```tsx
// 1. Through a component's icon prop — name WITHOUT the o9con- prefix.
<ArvoButton label="Confirm" icon="check" />
// renders <span class="arvo-btn__ico o9con o9con-check">
```

```tsx
// 2. Standalone, in your own markup — full class string.
<i className="o9con o9con-search" aria-hidden="true" />
```

Never reference the font file URL directly. Load the CSS once, from `@arvo/assets/o9con/css`.

### 6.2 Sizing

Two mechanisms. Prefer setting `font-size` from a token value; use the helper classes only for quick work.

| SCSS token | Value | px |
|---|---|---|
| `$arvo-icon-8` | `0.5rem` | 8 |
| `$arvo-icon-12` | `0.75rem` | 12 |
| `$arvo-icon-14` | `0.875rem` | 14 |
| `$arvo-icon-16` | `1rem` | 16 |
| `$arvo-icon-20` | `1.25rem` | 20 |
| `$arvo-icon-24` | `1.5rem` | 24 |
| `$arvo-icon-32` | `2rem` | 32 |
| `$arvo-icon-40` | `2.5rem` | 40 |

Shipped helper classes (`packages/assets/o9con/css/o9con.css:62-83`) — note the values do **not** all line up with the token scale:

| Relative | Absolute |
|---|---|
| `.o9con-sz-xs` `0.75em`, `.o9con-sz-sm` `0.875em`, `.o9con-sz-lg` `1.33em`, `.o9con-sz-2x` … `.o9con-sz-10x` | `.o9con-16`, `.o9con-20`, `.o9con-24`, `.o9con-32`, `.o9con-40`, `.o9con-48` |

There is **no** `.o9con-8`, `.o9con-12`, or `.o9con-14` helper — for those sizes set `font-size` yourself. Also shipped: rotate/flip transforms (`.o9con-rotate-45/90/135/180/225/270/315`, `.o9con-flip-x`, `.o9con-flip-y`), stacking, and colour passthrough (`.o9con-bg-color`, `.o9con-text-color`).

**Stacking** (`packages/assets/o9con/css/o9con.css:177-197`) — the container class is **`.o9con-icons-stack`**, with `.o9con-stack-1x` (the foreground glyph, inherited size) and `.o9con-stack-2x` (the background glyph, `2em`) inside it:

```html
<span class="o9con-icons-stack">
  <i class="o9con o9con-circle o9con-stack-2x" aria-hidden="true"></i>
  <i class="o9con o9con-check o9con-stack-1x" aria-hidden="true"></i>
</span>
```

⚠ **`.o9con-stack` is not the stacking container** — it is an ordinary glyph class (`o9con.css:1101`, `content: "\eb7d"`). Using it where `.o9con-icons-stack` belongs paints a stray icon instead of stacking anything.

**Colour icons with the `i-` family**, never the `t-` family: `color: var(--arvo-color-i-secondary)`.

### 6.3 Finding a valid icon name

**An icon name that does not exist renders nothing** — no glyph, no placeholder box, no console warning. This is the single most common silent failure in Arvo prototypes.

2.2.5 ships **1,158 glyph classes** (generated from a 1,067-icon UX map plus aliases — `packages/assets/o9con/css/o9con.css:1-9`). Grep the real inventory before using a name:

```bash
grep -oE '^\.o9con-[a-zA-Z0-9_-]+' \
  node_modules/@arvo/assets/o9con/css/o9con.css | sort -u
```

There is also a browsable cheatsheet at `packages/assets/o9con/cheatsheet/index.html`.

Verified absences that people reach for by habit:

| You want | Does not exist | Use instead |
|---|---|---|
| close × | `o9con-times` | `o9con-close` |
| refresh | `o9con-sync` | `o9con-refresh` |
| dark mode | `o9con-moon` | `o9con-moon-o`, `o9con-moon-star` |
| light mode | `o9con-sun` | `o9con-sun-o` |

Confirmed present and used across the APEX prototypes: `o9con-close`, `o9con-genai`, `o9con-genai-filled`, `o9con-sparkle`, `o9con-send`, `o9con-send-o`, `o9con-arrow-left`, `o9con-arrow-right`, `o9con-chevron-down`, `o9con-filter`, `o9con-search`, `o9con-plus`, `o9con-check`, `o9con-refresh`.

**Accessibility:** an icon that decorates text takes `aria-hidden="true"`. An icon that *is* the control needs an accessible name on the control — `aria-label` on the button, not on the `<i>`.

---

## 7. Motion

All motion tokens are SCSS-only. **Not one is a CSS custom property.** A plain-CSS prototype inlines the literal values below.

### 7.1 Durations — `_animation.scss:7-12`

| Token | Value | Use |
|---|---|---|
| `$arvo-duration-instant` | `120ms` | ⚠ declared but referenced by no composed token |
| `$arvo-duration-fast` | `150ms` | micro-state: focus ring, input border, link underline, thumb slide |
| `$arvo-duration-base` | `180ms` | colour/opacity state changes: chips, nav, steppers, progress |
| `$arvo-duration-medium` | `220ms` | layout-affecting: tabs, toasts, panels-in-place, FLIP reflow |
| `$arvo-duration-moderate` | `280ms` | dialogs and their backdrop |
| `$arvo-duration-slow` | `300ms` | expand/collapse, popups, sliding panes |

### 7.2 Easings — `_animation.scss:18-21`

| Token | Value | Use |
|---|---|---|
| `$arvo-ease-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` | the default — most property transitions |
| `$arvo-ease-emphasized` | `cubic-bezier(0.2, 0, 0, 1)` | layout, reflow, uplift, drawer open |
| `$arvo-ease-simple` | `ease` | pure opacity / colour fades |
| `$arvo-ease-in-out` | `ease-in-out` | looping animations |

### 7.3 Composed transitions — the ones worth copying

`_animation.scss` declares **63** composed `$arvo-motion-*` / `$arvo-transition-*` tokens. These are the ones a prototype actually re-derives:

| Token | Literal value | Applies to |
|---|---|---|
| `$arvo-motion-transition-expand` | `height 300ms cubic-bezier(0.4,0,0.2,1), transform 300ms cubic-bezier(0.4,0,0.2,1)` | accordion, tree, show more/less, disclosure |
| `$arvo-transition-popup` | `opacity 300ms ease, transform 300ms ease` | menu, popover, tooltip, context menu |
| `$arvo-transition-dialog` | `opacity 280ms cubic-bezier(0.4,0,0.2,1), transform 280ms cubic-bezier(0.4,0,0.2,1)` | window, dialog, modal, alert dialog |
| `$arvo-transition-dialog-backdrop` | `background-color 280ms ease` | the scrim |
| `$arvo-motion-feedback` | `opacity 220ms ease, transform 220ms ease` | toast, banner alert, inline message |
| `$arvo-motion-layout-shift` | `transform 220ms cubic-bezier(0.2,0,0,1)` | FLIP reflow (toast stack, chip list) |
| `$arvo-motion-pane` | `transform 300ms cubic-bezier(0.4,0,0.2,1)` | side panel, drawer |
| `$arvo-motion-tab` | `transform 220ms std, width 220ms std` | tabs, scrollspy, segmented control |
| `$arvo-motion-focus-ring` | `opacity 150ms ease, border-color 150ms ease` | the inset focus frame |
| `$arvo-motion-card-uplift` | `transform 150ms std, box-shadow 150ms std, border-color 150ms std` | hoverable cards |
| `$arvo-motion-split-layout` | `flex-basis 220ms cubic-bezier(0.2,0,0,1)` | list → inline split view |

**Renamed in v2.2.0 — the old names are gone.** Four of the tokens above changed name, and the sortable-list contract moved with them (`apps/docs/docs/changelog/v2-2-0.mdx:228-246`). These are exactly what you copy off an older prototype branch and then spend an hour debugging, because a missing SCSS variable is a build error but a stale class name or enum value fails silently.

| Old (removed) | New (2.2.x) |
|---|---|
| `$arvo-motion-expand` | `$arvo-motion-transition-expand` |
| `$arvo-motion-popup` | `$arvo-transition-popup` |
| `$arvo-motion-dialog` | `$arvo-transition-dialog` |
| `$arvo-motion-dialog-backdrop` | `$arvo-transition-dialog-backdrop` |
| sortable state class `is-dragging` | `arvo-sortable--dragging` |
| sortable state class `is-drop-target` | `arvo-sortable--ghost` |
| `position: 'above' \| 'below'` | `position: 'before' \| 'after'` |

**Paired enter/exit transforms** — the system's distance vocabulary:

| Surface | Enter | Exit |
|---|---|---|
| Popup (menu, popover, tooltip) | `translateY(0) scale(1)` | `translateY(-4px) scale(0.98)` |
| Dialog / window | `translateY(0) scale(1)` | `translateY(-8px) scale(0.98)` |
| Feedback (toast, banner) | `translateY(0) translateX(0)` | `translateY(-12px) translateX(8px)` |
| Nested view, forward | `translateX(12px)` → `translateX(0)` | `translateX(0)` → `translateX(-12px)` |
| Pane (side panel, drawer) | `translate(0,0)` | `translateX(±100%)` / `translateY(±100%)` |

Scale vocabulary: `0.98` exit · `0.96` chip remove · `1.03` card hover · `1.1` avatar hover · `1.12` toggle active · `0.6` status hidden.

### 7.4 Looping / delay / dwell tokens

Animation shorthand fragments — you supply the `@keyframes` name.

| Token | Value |
|---|---|
| `$arvo-motion-status-pulse` | `2s ease-out infinite` |
| `$arvo-motion-empty-state` | `2.8s ease-in-out infinite` |
| `$arvo-motion-nova-fill` | `1.6s ease-out` |
| `$arvo-motion-nova-breathe` | `4.2s ease-in-out infinite alternate` |
| `$arvo-motion-nova-gradient` | `5.5s ease-in-out infinite alternate` |
| `$arvo-motion-nova-border` | `3.5s linear infinite` |
| `$arvo-motion-progress-linear-indeterminate` | `1.4s ease-in-out infinite` |
| `$arvo-motion-progress-circular-indeterminate` | `1.4s ease-in-out infinite` |
| `$arvo-motion-loader-dot` | `1s ease-in-out infinite` |
| `$arvo-motion-loader-circle` | `0.8s linear infinite` |
| `$arvo-motion-loader-square` | `2s linear infinite alternate` |
| `$arvo-motion-loader-skeleton` | `1.5s ease-in-out infinite` |

Delays (`_animation.scss:368-370`) — all three carry the full `launchbar` segment; `$arvo-delay-open` / `-switch` / `-close` do not exist:

| Token | Value |
|---|---|
| `$arvo-delay-launchbar-open` | `300ms` |
| `$arvo-delay-launchbar-switch` | `150ms` |
| `$arvo-delay-launchbar-close` | `250ms` |

Toast dwell (`_animation.scss:71-76`) — **severity buys time, and it is a real design rule worth carrying into prototypes:**

| Token | Value |
|---|---|
| `$arvo-toast-duration-positive` | `4000ms` |
| `$arvo-toast-duration-neutral` | `4000ms` |
| `$arvo-toast-duration-info` | `5000ms` |
| `$arvo-toast-duration-warning` | `6000ms` |
| `$arvo-toast-duration-negative` | `8000ms` |
| `$arvo-toast-duration-block` | `persistent` ⚠ a JS sentinel, not a CSS time — never interpolate it into CSS |

### 7.5 Named keyframes

`@arvo/tokens` declares **no** `@keyframes`. The only globally-emitted keyframe in the base layer is (`packages/styles/src/base/_global.scss:9-16`):

```css
@keyframes arvo-skeleton-shimmer {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
```

Pair it with the pulse tokens and the loader timing:

```css
animation: arvo-skeleton-shimmer 1.5s ease-in-out infinite;  /* = $arvo-motion-loader-skeleton */
background: var(--arvo-color-s-pulse-light);
```

All other keyframes (nova, loaders, progress) live inside their component SCSS, not in the token or base layer, and are not part of the contract.

### 7.6 Reduced motion

The **only** global rule is (`packages/styles/src/base/_global.scss:32-39`):

```css
@media (prefers-reduced-motion: reduce) {
  .loading::before, .loading::after,
  [data-arvo-loading="true"] *::before,
  [data-arvo-loading="true"] *::after { animation: none !important; }
}
```

That kills loading shimmers and nothing else. Thirty-two files across `packages/styles/src` carry their own per-component `prefers-reduced-motion` blocks. **There is no reduced-motion token and no blanket `* { transition: none }`.**

Consequence: **every animation you author carries its own guard.**

```css
@media (prefers-reduced-motion: reduce) {
  .my-stream, .my-counter { animation: none; transition: none; }
}
```

For JS-driven motion (typing effects, count-ups), read the preference and skip:

```js
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
```

### 7.7 When motion is appropriate in a planning UI

Planners read numbers. Motion that moves a number is a defect, not a delight.

**Do**

- Animate **state**, not content: focus rings, hover lifts, chip toggles, tab indicators. 150–220 ms.
- Animate **arrival and departure** of surfaces: popovers, dialogs, panels, toasts. Use the shipped enter/exit pairs so your hand-rolled surface matches Arvo's.
- Animate **expand/collapse** so the reader can follow where content came from. 300 ms.
- Animate **AI authorship** — streaming text, the nova breathe — because it communicates that a machine is speaking. This is the one place motion carries meaning rather than polish.
- Match duration to distance: 150 ms for a 2px focus ring, 300 ms for a panel crossing the viewport.

**Don't**

- Don't animate a value the user is trying to read. A count-up on a KPI delays comprehension and, worse, implies live data that isn't.
- Don't animate anything on initial page load beyond a single fade. A planning screen should be readable at first paint.
- Don't move a table row, chart bar, or grid cell for decoration. Layout shift under a cursor causes misclicks.
- Don't exceed 300 ms. Nothing in Arvo's vocabulary is slower, and a planner opens the same panel forty times a day.
- Don't ship motion without a `prefers-reduced-motion` guard.

---

## 8. Foundations quick card

The tokens you will use on almost every screen. Everything here is a CSS custom property except the five marked *(literal)*, which are SCSS-only values you type by hand.

| Need | Token / value |
|---|---|
| Page background | `var(--arvo-color-s-base)` |
| Card / widget surface | `var(--arvo-color-s-layer-01)` |
| Recessed strip inside a card | `var(--arvo-color-s-layer-02)` |
| Hairline between rows | `var(--arvo-color-b-divider)` |
| Structural separator | `var(--arvo-color-b-separator)` |
| Primary ink — values, headings | `var(--arvo-color-t-primary)` |
| Secondary ink — labels, titles | `var(--arvo-color-t-secondary)` |
| Tertiary ink — captions, provenance | `var(--arvo-color-t-tertiary)` |
| Icon beside text | `var(--arvo-color-i-secondary)` |
| Brand accent — primary CTA, active nav | `var(--arvo-color-s-theme)` |
| Text on the brand accent | `var(--arvo-color-t-inverse)` |
| Focus ring | `1px solid var(--arvo-color-b-theme-focus)` + `outline-offset: 2px` |
| Good / on plan | `var(--arvo-color-t-positive)` |
| At risk / breach | `var(--arvo-color-t-negative)` |
| Watch / threshold | `var(--arvo-color-t-warning)` |
| Categorical accent that survives dark mode | `var(--arvo-color-s-util-{hue}-static)` |
| Editable planning cell | `var(--arvo-color-s-fn-editable)` |
| AI authorship | `var(--arvo-color-s-nova-static)` |
| Modal scrim | `var(--arvo-color-s-overlay-static)` |
| Font stack | `var(--o9-font-family)` — set it on `body` yourself |
| Card padding *(literal)* | `1rem` — `$arvo-space-16` |
| Control padding *(literal)* | `0.75rem` — `$arvo-space-12` |
| Gap between widgets *(literal)* | `1rem`–`1.5rem` — `$arvo-space-16`/`-24` |
| Body type *(literal)* | `0.875rem` / `400` — `$arvo-font-size-14` / `$arvo-regular` |
| Section title *(literal)* | `0.875rem` / `500` — `$arvo-font-size-14` / `$arvo-medium` |
| Card lift | `box-shadow: 0px 2px 6px -1px var(--arvo-color-s-shadow-static-1)` — `$arvo-shadow-low` |
| Default transition | `180ms cubic-bezier(0.4, 0, 0.2, 1)` — `$arvo-duration-base` / `$arvo-ease-standard` |

**The three lines every prototype needs**

```html
<html lang="en" data-mode="light" data-theme="o9theme">
```

```css
:root { --arvo-font-family: var(--o9-font-family); }   /* works around the missing token */
body  { font-family: var(--o9-font-family); background: var(--arvo-color-s-base);
        color: var(--arvo-color-t-primary); margin: 0; }
```

---

## Appendix — verification notes

Everything above was read from `@arvo/*` 2.2.5 source in `o9.DesignSystem/` (vendored beside this document), and colour values were cross-checked against the compiled `packages/tokens/dist/arvo-tokens.css`.

**Corrections to prior APEX material found while writing this:**

| Claim elsewhere | Reality |
|---|---|
| `--arvo-color-b-strong` is the token for an emphasised border | **No such token.** The border family has no `-strong` member. Use `--arvo-color-b-dark` or `--arvo-color-b-separator`. |
| `o9Sans` ships weights 400/500/700 | It ships **300/400/500/700**, each with an italic (`packages/assets/fonts/fonts.css`; files in `packages/assets/fonts/o9Sans/`). The token layer only *names* 400/500/700. There is no 600. |
| `.arvo-skeleton` is a contracted utility class | Documented at `apps/docs/docs/usage/styling.mdx:246-254`, **not shipped**. Only the `arvo-skeleton-shimmer` keyframes exist. |
| `data-theme` and `data-mode` are independent, combinable axes | Both attributes apply, but `html[data-mode="dark"]` is declared last and overwrites every brand accent. In dark mode all five brands look identical. |

**Not verified in this pass:**

- **Reduced-motion coverage per component.** 32 files under `packages/styles/src` contain a `prefers-reduced-motion` block; whether that covers every animated component was not audited. Unverified — check `packages/styles/src/components/`.
- **Whether the `$arvo-global-*` dead tokens are dead across the whole repo.** They are unreferenced by `packages/tokens/src/scss/_root.scss`; component SCSS was not exhaustively searched. Unverified — check `packages/styles/src/components/`.
- **The `.o9con-*` alias set.** The generated header says 1,067 icons from the UX map plus `config/aliases.json`; 1,158 glyph classes are emitted. Which of the extra 91 are aliases versus additions was not resolved. Unverified — check `packages/assets/o9con/config/aliases.json`.
- **The o9illus icon name inventory.** Only the size classes and the light/dark switching mechanism were verified. Unverified — check `packages/assets/o9illus/o9illus.css`.
