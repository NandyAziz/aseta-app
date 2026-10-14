---
name: nextjs-app-router
description: Use when writing or reviewing any file under app/ or components/ in this Next.js 16 App Router project — adding a page, layout, client component, server action, or route — especially when deciding where the 'use client' boundary belongs or when a hydration mismatch warning appears.
---

# Next.js App Router (ASETA)

## Overview

App Router has two rendering environments with different capabilities. Most
bugs in this codebase come from putting code on the wrong side of the
`'use client'` line, or from rendering values that differ between server and
client.

**Core principle:** push `'use client'` as far down the tree as possible. Every
component above the boundary stays a Server Component and ships zero JS.

## What this version is NOT

This is **Next.js 16** — APIs and conventions differ from training data.

**Read the bundled docs before writing code.** They ship with the repo:

```bash
ls node_modules/next/dist/docs/
```

Do not answer from memory. Check the relevant guide first; heed deprecation
notices.

## The `'use client'` boundary

`'use client'` marks a **module boundary**, not a per-component switch. Once a
file declares it, every component imported *from* that file into another
client module is also client code.

| Put in Server Component (default) | Put in Client Component |
|---|---|
| Static layout, headers, copy | `useState` / `useEffect` / `useRef` |
| Reading `utils/aseta.ts` pure fns | Event handlers (`onClick`, `onChange`) |
| Card shells in `components/dashboard/` that take only props and use no hooks | Anything reading `localStorage`, `window`, camera |
| Data / formatting derived from props | `framer-motion`, canvas-confetti, Web Audio |

A component that needs **none** of the right-hand column must stay a Server
Component. `TotalAssetsSummary`, `SavingsProjection`, `GrowthChart` (before it
gained point selection) are all server-safe by design — keep them that way.

### Prop drilling beats `'use client'`

Reaching for `'use client'` to avoid passing a prop pushes the entire subtree
across the network boundary. Pass the prop instead.

## Hydration mismatches

The server has no `localStorage`, no `window`, no `Date.now()`, no randomness.
Any render path that reads them **will** mismatch.

**The rule:** guard every browser-only read with `isMounted`, from
`useSyncExternalStore` (already available — do not reimplement it).

```tsx
const isMounted = useSyncExternalStore(() => () => {}, () => true, () => false);

{isMounted ? state.balance.toLocaleString('id-ID') : 0}
```

**Forbidden** — ESLint rejects it (`react-hooks/set-state-in-effect`) and it
triggers cascading renders:

```tsx
const [mounted, setMounted] = useState(false);
useEffect(() => setMounted(true), []);   // ❌
```

Also forbidden:

- `Date.now()` / `new Date()` / `Math.random()` **during render**.
- Initialising local state from `localStorage` (init from a constant instead).
- `id` attributes from `Math.random()` — use React's `useId()`. Sanitise it if
  it feeds a URL: `useId().replace(/[^a-zA-Z0-9]/g, '')`.
- Side effects in render (`localStorage.setItem`, confetti, SFX). These belong
  in event handlers or in effects that depend on `isMounted`.

### React Compiler purity

React 19 + React Compiler are enabled. Render must be a pure function of props
and state:

- No mutation of objects/arrays received via props.
- Helpers that compute values belong at **module scope**, outside components.
- Never mutate an array in place — build a new one (`[...prev, x]`).

## Server Actions

ASETA is a **frontend-only simulation** — no backend, no real money. Do not
introduce Server Actions, route handlers, or database calls to make state
"persist"; that state lives in `localStorage` behind `normalizeState()`.

If a Server Action ever becomes necessary:

- **Validate inside the action**, never trust the client payload.
- Return a discriminated result (`{ ok: true, data }` / `{ ok: false, error }`)
  rather than throwing — a thrown error surfaces as an unhandled rejection and
  loses the user-facing message.
- **Always surface failure to the user.** Silently swallowing an error is the
  single worst outcome; ASETA already has a toast pattern for this.
- Authorise before mutating. Never trust a value that came from the client.

## Route & render optimisation

- Route segments: `app/dashboard/page.tsx` holds state, camera/QR, modals, and
  the tour. Presentation lives in `components/dashboard/` as pure props.
- Adding `'use client'` to a page opts the **entire route** into client
  rendering. Keep leaf components as the boundary.
- Dynamic `import()` for heavy, conditionally-shown widgets (e.g. the Spline
  mascot) so they don't enter the initial bundle.
- Images: use `next/image` with explicit `width`/`height` to avoid layout shift.

## Common mistakes

| Mistake | Consequence | Fix |
|---|---|---|
| `'use client'` at the top of a page "to be safe" | Whole route ships as client JS | Push the boundary to the leaf |
| `useState(false)` + `setState(true)` in `useEffect` for mount detection | ESLint error, hydration mismatch | `useSyncExternalStore` |
| `id="growthFill"` hardcoded in an SVG | Duplicate IDs when two instances mount | `useId()` |
| Reading `localStorage` in a Server Component | Runtime crash | Move to a client leaf |
| Prop drilling avoided via `'use client'` | Unnecessary client JS | Pass the prop |
| Silent `catch {}` | User sees nothing happen | Toast the error |

## Quality gate

```bash
npm run check   # typecheck && lint && build — must be 0 errors, 0 warnings
```

`.githooks/pre-commit` runs this automatically; see
`.agents/skills/mobile-ui-checker/SKILL.md` for the layout/UX counterpart.
