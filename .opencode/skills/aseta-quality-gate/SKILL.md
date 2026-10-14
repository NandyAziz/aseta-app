---
name: aseta-quality-gate
description: Quality control and validation rules for ASETA project refactoring - use when editing, refactoring, or reviewing app/dashboard/page.tsx, components/, utils/, Tailwind classes, or anything touching domain logic, the 3-column grid layout, or localStorage/hydration, and always finish by running npm run check.
---

# ASETA Quality Gate

Mandatory validation rules for every refactor or code edit in the ASETA project
(Next.js 16 App Router · React 19 · Tailwind v4 · TypeScript). Pure frontend
simulation — no backend, no real money.

## 1. `docs/architecture.md` is the SINGLE SOURCE OF TRUTH

- Read `docs/architecture.md` (plus `AGENTS.md` and the coding standard
  `.agents/rules/aseta-coding-standards.md`) BEFORE changing structure, state, or
  domain constants.
- Never rewrite a domain formula ad-hoc inside a component. Every tunable value
  must come from an existing constant:
  - `utils/aseta.ts` → `calculateRoundUp`, `getMascotLevel`, `getXpProgress`,
    `MAX_LEVEL`, `LEVEL_TARGETS`, `LEVEL_TITLES`.
  - Dashboard → `LEVEL_CUMULATIVE`, `GOLD_GRAM_PRICE`, `INITIAL_STATE`,
    `normalizeState()`, `applyDailyReset()`, `buildGrowthSeries()`.
- If the code disagrees with the document (or the document is stale), STOP and
  report to the user — never silently pick one. Update `docs/architecture.md`
  after an intentional change.
- Forbidden without explicit user permission: changing
  `SavingsState`/`QuestState`/`Transaction` in `types/index.ts`, the
  localStorage keys (`aseta-savings-state`, `aseta_last_active_date`,
  `aseta_tour_completed`), or daily-reset/streak semantics.

## 2. Beranda tab grid: 2 columns on desktop, compact on mobile

- Main structure in `app/dashboard/page.tsx`: `main` = 12-column grid
  (`lg:grid-cols-12`) with TWO column wrappers — `lg:col-span-7` (left) and
  `lg:col-span-5` (right). Per-card auto-placement (no wrapper) is FORBIDDEN
  because it makes cards straddle row boundaries.
- Column wrappers MUST be `flex flex-col gap-6` — never mix `gap-4` and `gap-6`.
- The grid uses `items-start` so each column's height follows its own content.
- Column contents:
  - Left: mascot hero card (stage + total assets + XP bar), Portfolio
    Allocation.
  - Right: Daily Missions, Savings Projection, Daily Limit. ("Quick
    Transactions" has ALREADY been removed from the Beranda feed at every
    breakpoint — do not restore it; quick-deposit actions live only in the
    "Scan" tab.)
- Uniform cards: `rounded-2xl border border-line bg-white p-4 sm:p-5`.
- FORBIDDEN: elements that "float" outside a card, or dangling whitespace at
  the bottom of a column.
- Content meant for only one breakpoint is wrapped in
  `<div className="hidden lg:block">` or `lg:hidden` — never stack `hidden`
  with `flex` on the same element (CSS utility order is unpredictable).
- Mobile: analytics are merged into a 2-tab widget (`AnalyticsTabs`); the daily
  limit becomes a closed accordion.
- Presentational cards stay in `components/dashboard/` (pure props) rather than
  being moved back into `page.tsx`.

## 3. Hydration safety: `isMounted` is mandatory

- Every render based on `localStorage`/time/random MUST be guarded by
  `isMounted` (from `useSyncExternalStore`):
  ```tsx
  {isMounted ? state.balance.toLocaleString('id-ID') : 0}
  ```
- NEVER use the `useState(false)` + `setMounted(true)` pattern inside
  `useEffect` (ESLint rejects it: `react-hooks/set-state-in-effect`).
- Local slider/draft state is initialised from CONSTANTS, not from localStorage.
- Side effects (`localStorage.setItem`, `Date.now()`, confetti, SFX) belong ONLY
  in event handlers or in a `useEffect` that depends on `isMounted` — never
  during render (React Compiler purity).
- Also add `'use client'` to any component that reads browser APIs.

## 4. Valid Tailwind CSS v4

- Use v4 syntax: `bg-linear-to-r` / `bg-linear-to-br` (NOT `bg-gradient-to-*`),
  `z-50` (arbitrary values only when no standard utility exists — the
  `--z-index-55/60` tokens already exist in `globals.css`).
- Colors: use `@theme` tokens (`brand`, `forest`, `ivory`, `gold`, `sage`,
  `line`, `muted`) or the slate/emerald/amber palettes already in use.
- Indonesian number formatting: `.toLocaleString('id-ID')`.
- Code comments and other agent-facing prose MUST be in **English**; user-facing
  UI text and toasts stay in Bahasa Indonesia (see §12 of
  `.agents/rules/aseta-coding-standards.md`).

## 5. Definition of Done (DoD)

- MANDATORY, run in the terminal:
  ```bash
  npm run check   # = typecheck && lint && build
  ```
- The result must be **0 errors and 0 warnings** for `tsc --noEmit`,
  `eslint app/ components/ utils/ types/`, and `next build`.
- If it fails, fix it until green BEFORE closing the task — never defer with
  "I'll do it later"; get it green before reporting completion.
- Additionally forbidden: adding new dependencies (without user permission),
  touching `package-lock.json`, removing the egg fallback /
  `SplineErrorBoundary` in `HeroMascot3D`, and editing the
  `<!-- BEGIN:nextjs-agent-rules -->` block in `AGENTS.md`.
- Existing micro-interactions (SFX in `utils/sound.ts`, tilt, shake, "+50 XP"
  particles, daily reset, toasts) must remain intact after a refactor.
- Update `docs/architecture.md` / `PROJECT_STATE.md` whenever structure,
  constants, or layout change.
