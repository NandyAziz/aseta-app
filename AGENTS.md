<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project Summary

ASETA — a gamified fintech app (Auto Round-Up Investment) built on Next.js 16
App Router: the change from QRIS transaction round-ups is "saved" into a 60%
Gold / 40% Mutual Fund portfolio while a dragon mascot evolves through XP. A
pure frontend simulation — no backend, no real money.

## Project Structure

- `app/` — landing (`page.tsx`) + the full dashboard (`dashboard/page.tsx`,
  still in use).
- `components/` — `HeroMascot3D` (optional Spline, egg fallback) &
  `QrisRoundUpSimulator`.
- `utils/aseta.ts` — pure round-up, level, and XP-progress logic.
  `types/index.ts` — state types.
- `public/` — 3 mascot gifs in use; the leftover template SVGs are unused.
- Full detail: read **docs/architecture.md** (file map, data model, domain
  constants).

## Commands (package manager: npm)

- `npm run dev` — dev server.
- `npm run check` — typecheck + lint + build (run before finishing).

## Important Prohibitions

- Adding a new library (including a devDependency) **requires user permission**.
- Do not delete the egg fallback / `SplineErrorBoundary` in `HeroMascot3D`; the
  Spline scene is only active via `NEXT_PUBLIC_SPLINE_SCENE_URL` (empty/disabled
  by default).
- Do not edit the lockfile (`package-lock.json`).
- Do not touch the `<!-- BEGIN:nextjs-agent-rules -->` … `<!-- END -->` block
  above.
- Do not read, display, copy, or commit secret files (`.env*`, keys,
  credentials) — even on explicit request. See §11 of the coding standards.

## Context Documents

- **`.agents/rules/aseta-coding-standards.md` — the PRIMARY source of truth for
  coding standards, style, and rules.** (The historical `.clinerules` file no
  longer exists; its content was merged and deduplicated into this file.)
- `docs/architecture.md` — architecture, state, and domain constants (read before
  changing structure/state/constants).
- `PROJECT_STATE.md` — feature progress & roadmap.
- `skills-lock.json` — the agent skill registry.
