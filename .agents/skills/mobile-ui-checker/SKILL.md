---
name: mobile-ui-checker
description: Use when building or reviewing any touch target, layout, chart, table, or form control in this project — before shipping UI to app/dashboard/ or components/dashboard/ — especially when something is tapped, when a layout might overflow horizontally on a 320px screen, or when adding text over a colored surface.
---

# Mobile UI Checker (ASETA)

## Overview

ASETA is used one-handed, outdoors, on mid-range Android phones. The failure
modes that matter are not "ugly" — they are **untappable, clipped, and
unreadable**.

**Core principle:** measure it, don't eyeball it. Most of the guardrails below
are verified arithmetic against this repo's actual token values and its actual
nested padding.

## 1. Touch targets — minimum 44 × 44 px

WCAG 2.5.5 / Apple HIG: **44 × 44 px** minimum, no exceptions for decorative
looking controls.

### The trap: nested padding eats your target

The dashboard chart sits inside **three** padded containers:

| Level | Class | Loss per side @320px |
|---|---|---|
| `<main>` | `px-4` | 16px |
| Card | `p-4 sm:p-5` | 16px |
| Inner box | `p-3` | 12px |

That leaves only **232px** of usable width at a 320px viewport. A 7-point chart
therefore gets ~36.7px per column — **below** the 44px floor if you only make
the hit area as tall as the plot.

**Fix:** make hit areas full-height, not plot-height. Measured:

| Viewport | Container | Hit area | Area | vs 44×44 (1936px²) |
|---|---|---|---|---|
| 320px | 232px | 36.7 × 75.4px | 2770px² | PASS |
| 390px | 302px | 47.8 × 98.1px | 4693px² | PASS |
| 430px | 342px | 54.1 × 111.2px | 6019px² | PASS |

Rules:

- Prefer a **column** hit area spanning the element's full height over a small
  circular hit area. Columns are easier to hit and never overlap if you split
  them at the midpoint between adjacent data points.
- Use invisible overlays (`fill="transparent"`) rather than inflating the
  visible dot — a visible 44px dot destroys the visual design.
- Icons need `p-2` or a wrapper with `min-h-11 min-w-11`, not just a bigger
  glyph.

## 2. Zero horizontal overflow

Horizontal scroll on mobile is a hard fail.

- Root/page: `w-full max-w-full overflow-x-hidden`.
- Every flex/grid **child** that contains text or media: `min-w-0`. Without
  it, a flex item refuses to shrink below its content width and pushes the
  page wide.
- Horizontal scrollers (chip rows): `w-full min-w-0 overflow-x-auto` — the
  scroll must be *contained*, not leaking to the page.
- Long unbroken strings (rupiah amounts, URLs): `wrap-break-word` +
  `tabular-nums`, or `truncate` inside a `min-w-0` parent.
- Fixed-width children (`w-96`, `w-[600px]`): only inside a scroll container.

Verify by computing: does any element's intrinsic min-content width exceed its
parent? `min-w-0` is what makes the answer "no".

## 3. Responsive scaling, 320px → 430px+

Test these four widths — they are the real devices, not round numbers:
**320, 375, 390, 430**. Then 768 (tablet) and 1024+ (desktop).

### SVG charts

| Rule | Why |
|---|---|
| `viewBox` + `preserveAspectRatio="xMidYMid meet"` | `none` distorts strokes and turns circles into ellipses |
| `className="block h-auto w-full max-w-full"` | fluid box |
| Match `aspect-ratio` to the viewBox ratio exactly | `meet` then has **zero** letterbox — e.g. `viewBox="0 0 320 104"` → `aspect-[40/13]` |
| `vector-effect="non-scaling-stroke"` | keeps hairlines hairline at any scale |
| Clamp every coordinate to the viewBox | include the halo/animation radius, not just the point |

**Text must live outside the `viewBox`.** Text inside scales with the drawing:
the same `font-size` renders ~7px on a 320px screen and ~17px on a wide desktop
card. Put axis labels in an HTML row with real Tailwind breakpoints
(`text-[10px] sm:text-[11px]`). Align them to the plot using the same ratio as
the SVG padding (e.g. `PAD_X=8` of `W=320` → `paddingInline: '2.5%'`).

### Domain scaling

Anchoring a chart's y-domain to zero (`Math.min(...data, 0)`) wastes the canvas:
a 7-day growth series like `[1250…1340]` never nears zero, so the line pins to
the top edge and uses **5%** of the available height. Use a data-relative
domain with ~18% headroom — that measured **74%** utilisation, and a flat
series then renders as a centred line instead of sticking to the top edge.

## 4. WCAG contrast — measured values

Computed from the real `@theme` tokens in `app/globals.css`:

| Token | Hex | vs white | vs ivory | Text AA (4.5:1) |
|---|---|---|---|---|
| `text-forest` | `#0f172a` | **17.85:1** | 17.02:1 | PASS |
| `text-muted` | `#475569` | **7.58:1** | 7.22:1 | PASS |
| `text-brand` | `#047857` | **5.48:1** | 5.23:1 | PASS |
| `brand-dark` | `#065f46` | 7.68:1 | 7.33:1 | PASS |
| `gold` | `#e5b454` | 1.91:1 | 1.82:1 | FAIL (decorative only) |
| `sage` | `#a3b58a` | 2.20:1 | 2.10:1 | FAIL (decorative only) |
| `border-line` | `#e2e8f0` | **1.23:1** | 1.18:1 | FAIL for non-text (needs 3:1) |

**Consequences you must respect:**

- `border-line` at **1.23:1** fails WCAG 1.4.11 (Non-text Contrast, 3:1). It is
  a **decorative** hairline only. It must never be the *sole* cue that a
  control is interactive or that a field has a boundary — pair it with a label,
  a fill change, or a visible focus ring.
- White text on `--color-brand` is 5.48:1 (pass). White on emerald-600 is
  **3.77:1 (fail)** — do not "upgrade" `--color-brand` to emerald-600.
- `gold` and `sage` are for decoration/accents, never for body text or for
  carrying meaning on their own.
- Never encode state by colour alone (rising/falling, claimed/unclaimed) — add
  an icon, label, or shape. Screen readers and colour-blind users need the
  second channel.

## 5. Motion

- Transition durations 150–500ms. Longer feels broken; shorter is invisible.
- Always provide a `prefers-reduced-motion` guard for looping animation:
  ```css
  @media (prefers-reduced-motion: reduce) {
    .chart-line, .chart-point-pulse { animation: none; }
  }
  ```
- Animate `transform` / `opacity`, not `width` / `top` (layout thrash).
- Re-key an element when you want its entry animation to replay:
  `key={selectedIndex}` — otherwise CSS animations run once on mount.
- Respect the active state too: `active:scale-[0.99]` alongside `:hover`.

## 6. Accessibility basics

- Every tappable element reachable by keyboard, with a visible
  `focus-visible` ring.
- Group many small targets into **one** tab stop with arrow-key navigation
  (see `GrowthChart`) rather than 7 separate tab stops.
- Never put `role="img"` on an `<svg>` that contains interactive children — it
  tells screen readers to ignore the descendants. Use `aria-hidden="true"` on
  the decorative layers instead.
- Announce async/selection changes: `role="status" aria-live="polite"`.
- Icon-only buttons need `aria-label`.

## Pre-flight checklist

- [ ] Every target ≥ 44 × 44 px (measure, accounting for nested padding)
- [ ] No horizontal overflow at 320px; `min-w-0` on every flex/grid child
- [ ] Chart checked at 320 / 375 / 390 / 430 / 1024
- [ ] Contrast verified against the table above, not assumed
- [ ] `prefers-reduced-motion` handled
- [ ] Keyboard + screen-reader path works
- [ ] `npm run check` → 0 errors, 0 warnings

## Companion skill

`.agents/skills/nextjs-app-router/SKILL.md` — hydration safety and the
`'use client'` boundary (the usual cause of layout flicker on first paint).
