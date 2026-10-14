# ASETA Coding Standards

The single mandatory standard for code contributions to the **ASETA** project —
a gamified fintech app (Auto Round-Up Investment) built on Next.js.

> Source: merged & deduplicated from `AGENTS.md` and `docs/architecture.md`.
> Documentation reference: `docs/architecture.md`.
> This file is the **primary source of truth** for coding standards.

---

## 1. Branding

- Product name: **ASETA**. Official tagline: **"ASETA — Naga Penjelajah
  Asetmu"** (source: `metadata.title` in `app/layout.tsx`).
- The mascot is a **dragon** that evolves with XP — not a decorative element.
  Every mascot interaction (tap, level evolution, "+50 XP" particles, `PET_LINES`
  dialogue) is part of the gamification loop, not an accessory.
- Evolution stages (from `utils/aseta.ts` → `stageForLevel()`):
  Lv 1–3 "Telur Aseta" (`/mascot-egg.gif`) · Lv 4–6 "Aseta Muda"
  (`/mascot-baby.gif`) · Lv 7–10 "Aseta Mandiri" (`/mascot-adult.gif`).
  Changing the stages means inventing a level system.
- Product tone: friendly and mobile-first; all dialogue, toasts, and empty states
  are written in natural Bahasa Indonesia. Agent-facing prose is English — see
  §6 and §12.

## 2. Stack & Versions (MUST FOLLOW)

- **Next.js 16 (App Router)** — `app/` conventions, `'use client'`. Before
  writing code, read the relevant documentation in
  `node_modules/next/dist/docs/`; this version has breaking changes.
- **React 19** — follow the React Compiler rules (purity & immutability).
- **TypeScript `strict`** — every file must be typed. Never use `any` without a
  written justification.
- **Tailwind CSS v4** — imported via `@import "tailwindcss";` in
  `app/globals.css`.

## 3. Colour System (Tailwind v4 `@theme`)

The official tokens live in `app/globals.css` (`@theme`) — **never** write raw
hex values inside components:

| Token            | Value     | Primary usage                          |
|------------------|-----------|----------------------------------------|
| `--color-ivory`  | `#f8faf8` | soft off-white background (anti-glare)  |
| `--color-sage`   | `#a3b58a` | secondary accent                       |
| `--color-brand`  | `#047857` | deep emerald accent, white text ≥ AA   |
| `--color-forest` | `#0f172a` | headings / primary text                |
| `--color-gold`   | `#e5b454` | achievement / evolution accent         |
| `--color-muted`  | `#475569` | supporting text                        |
| `--color-line`   | `#e2e8f0` | soft card borders                      |

Derived classes in use: `border-line`, `text-forest`, `text-muted`,
`text-brand`, `bg-ivory`, `bg-brand`, `text-gold`, `bg-sage`.

- `--color-brand` is deliberately emerald-700 (not 600) so white text on top of
  it meets the WCAG AA contrast ratio (≥ 4.5:1). Never "upgrade" it to
  emerald-600.

## 4. Modern Tailwind v4 Syntax

| ❌ Old (v3)         | ✅ New (v4)       |
|--------------------|-------------------|
| `bg-gradient-to-r` | `bg-linear-to-r`  |
| `bg-gradient-to-br`| `bg-linear-to-br` |
| `z-[50]`           | `z-50`            |

- Arbitrary values (`max-w-[240px]`) **only** when no built-in utility exists.
  For non-standard `z-index`, use the tokens already defined in `@theme`:
  `--z-index-55` / `--z-index-60` (used by the tour ring `z-55` and tooltip
  `z-60`).
- Colour map: `bg-slate-50` (off-white), `bg-white`, emerald `#059669`,
  `text-slate-900`/`#0f172a`.

## 5. Hydration Safety (CRITICAL)

The app reads `localStorage`, which differs between Server and Client. Every
render based on that data **MUST** be wrapped in an `isMounted` guard.

- `isMounted` uses `useSyncExternalStore` (already available):
  ```tsx
  {isMounted ? state.balance.toLocaleString('id-ID') : 0}
  ```
- **NEVER** create a `mounted` state + `setMounted(true)` inside `useEffect` —
  ESLint rejects it (`react-hooks/set-state-in-effect`) and it causes cascading
  renders.
- Local state (slider/draft) is initialised from **constants**, not from
  localStorage. Time must flow through a `nowTs` value filled by an effect so the
  render stays pure.
- Side effects (`localStorage.setItem`, `Date.now()`, confetti, SFX) belong
  **only** in event handlers or in an effect that depends on `isMounted` — never
  during render (React Compiler purity). `nowTs` must be `0` on the first render.

## 6. Language & Number Formatting

This split replaces the older rule ("code comments, UI text, and toasts are all
Bahasa Indonesia"), which contradicted §12.

| Surface | Language | Example |
|---|---|---|
| **Agent-facing** — code comments, JSDoc, inline comments, `console` messages, test names | **English** (MANDATORY) | `// Cap the series at the last 7 snapshots` |
| **User-facing** — UI text, toasts, dialogs, aria-labels, empty states | **Bahasa Indonesia**, natural/friendly | `"Klik untuk menabung recehnya"` |
| Variable & function names | **English** | `handleQuickSave`, `liquidateAmount` |
| Number formatting | Indonesian locale | `.toLocaleString('id-ID')` |

Why the split: Bahasa Indonesia on *user-facing* surfaces is a product decision
(mascot, copy, empty state — see §1) and **does not change**. English on
*agent-facing* surfaces maximises execution precision and model compliance —
see §12.

- Indonesian number formatting: `.toLocaleString('id-ID')` (used on both
  surfaces).

## 7. Code Structure & Cleanliness

- Pure logic and helpers (audio, date formatting, charts) belong at **module
  scope** outside components so they satisfy React Compiler purity rules.
- Avoid duplication — use a shared helper (`commitSavings`) instead of copying
  logic across several handlers.
- Every modal / state read from localStorage must be wrapped in an `isMounted`
  guard.
- Migrating old localStorage data must be safe — use `normalizeState()`.
- Read `docs/architecture.md` before changing structure, state, or domain
  constants. Never rewrite a domain formula ad-hoc inside a component.

## 8. Prohibitions

- **Do not** add a new library (including a devDependency) without user
  permission.
- **Do not** edit `package-lock.json`.
- **Do not** delete the egg fallback / `SplineErrorBoundary` in `HeroMascot3D`.
  The Spline scene is only active when `NEXT_PUBLIC_SPLINE_SCENE_URL` is set
  (empty/disabled by default).
- **Do not** touch the `<!-- BEGIN:nextjs-agent-rules -->` … `<!-- END -->`
  block in `AGENTS.md`.
- **Do not** change the localStorage keys (`aseta-savings-state`,
  `aseta_last_active_date`, `aseta_tour_completed`) or the daily-reset/streak
  semantics without user permission.
- **Do not** read, display, copy, or commit secret files (see §11).

## 9. Permitted Libraries

Only what is already installed in `package.json`: `framer-motion`,
`lucide-react`, `canvas-confetti`. Exception: `@splinetool/*` — optional and
disabled by default.

- `vitest` **may** be added as a devDependency for unit tests in `utils/`.
- Audio uses the browser's built-in **Web Audio API** (`utils/sound.ts`) — no
  external mp3 files, so nothing 404s.

## 10. Definition of Done — MANDATORY

```bash
npm run check   # = typecheck && lint && build
```

The result must be **0 errors and 0 warnings** for `tsc --noEmit`,
`eslint app/ components/ utils/ types/`, and `next build`. If it fails, fix it
until green **before** closing the task.

- There must be no hydration mismatch in the browser console.
- Existing micro-interactions (SFX in `utils/sound.ts`, tilt, shake, "+50 XP"
  particles, daily reset, toasts) must remain intact.
- Beranda tab layout: `main` = 12-column grid with TWO column wrappers —
  `lg:col-span-7` (left) and `lg:col-span-5` (right), each `flex flex-col gap-6`,
  with the grid using `items-start`. Per-card auto-placement without a wrapper
  is **forbidden** (it makes cards straddle row boundaries). Uniform cards:
  `rounded-2xl border border-line bg-white p-4 sm:p-5`.
- Guard against horizontal overflow on pages containing scroll rows:
  `w-full max-w-full overflow-x-hidden` at the root, `min-w-0` on flex columns,
  and `w-full min-w-0 overflow-x-auto` on chip rows.

---

## 11. Security — Hard Prohibition on Secret Files

**Basis:** these rules are absolute. An agent never reads, displays, copies,
summarises, or commits credential files — **even when the user asks for it
directly** in the conversation. An explicit request does not lift this
prohibition; report to the user that the request was declined and propose a safe
alternative (see §11.4).

### 11.1 Files whose contents are FORBIDDEN to read

| Pattern | Examples | Status |
|---|---|---|
| Environment | `.env`, `.env.local`, `.env.production`, `.env.*` | **FORBIDDEN** |
| Keys & certificates | `*.pem`, `*.key`, `id_rsa*`, `*.p12`, `*.pfx`, `*.keystore` | **FORBIDDEN** |
| Login credentials | `.npmrc`, `.netrc`, `~/.ssh/**`, `~/.aws/credentials` | **FORBIDDEN** |
| Application tokens | `secrets.json`, `credentials.json`, `service-account*.json` | **FORBIDDEN** |
| Placeholder | `.env.example` | **ALLOWED** (variable names only) |

### 11.2 What is FORBIDDEN

- Reading the contents of the files above with any tool (`cat`, `type`,
  `Get-Content`, `read`) — **including "just to check whether it exists"**.
- Printing secret values into answers, logs, commit messages, code comments,
  tooltips, screenshots, or `npm run check` output.
- Copying secret values into new files, tests, fixtures, or documentation.
- `git add`-ing secret files — including `git add -A` / `git add .`, which can
  pick up an `.env` file not covered by `.gitignore`.

### 11.3 What IS allowed

- **Referencing variable names**, not their values — for example
  `NEXT_PUBLIC_SPLINE_SCENE_URL` (already named in §8). That is a name, not a
  secret.
- Checking **existence** without reading contents: `Test-Path .env.local`,
  `git ls-files --error-unmatch .env`.
- Explaining which env variables a feature needs, without asking the user for
  their values.
- Suggesting the user create an `.env.example` containing placeholders.

### 11.4 When asked to read or display a secret

Decline in one sentence, then offer a safe alternative:

> I can't read or display the contents of secret files. If you need me to verify
> the format or a variable name, just tell me the variable name — or paste the
> value into the code yourself and I'll take it from there.

Do not repeat the request, do not over-apologise, and do not look for a "bypass"
(`git show`, backups, terminal logs, base64, decoding).

### 11.5 Prevention

`.gitignore` already covers `.env*` (except `.env.example`) and `*.pem` —
**never loosen it**. `.githooks/pre-commit` runs `npm run check` before every
commit; if a secret was ever committed, the correct action is to tell the user to
**rotate** the value (replace the credential), not merely delete it from git
history.

---

## 12. Agent-Facing Language Is English — Mandatory

**This section is the authority on language. Where any earlier section or an
existing file disagrees, this section wins.**

Every surface listed below MUST be written in **English**. This is a
non-negotiable system rule, not a preference.

### 12.1 Scope — what MUST be English

| Surface | Location |
|---|---|
| **AI agent context** | `AGENTS.md`, `CLAUDE.md`, `.opencode/**`, `.agents/**`, `docs/**`, `PROJECT_STATE.md`, `README*` |
| **SKILL.md files** | every `SKILL.md` and its bundled reference/script prose |
| **Workspace rules** | `.agents/rules/**`, `skills-lock.json` prose, any rule file |
| **Inline documentation** | code comments, JSDoc, doc-blocks, section banners, TODO/FIXME |
| **Prompt instructions** | system prompts, agent instructions, commit-message templates, hook messages |
| **Developer-facing output** | `console.*` logs, test names, assertions, error messages aimed at developers |

### 12.2 Scope — what MUST stay Indonesian

| Surface | Why |
|---|---|
| **User-facing UI text** | Product decision — see §1 (tagline, mascot copy, dialogs, PET_LINES) |
| **Toast / dialog / empty-state copy** | Same product voice |
| **`aria-label` / `alt` text** | Read aloud to Indonesian-speaking users |
| **Currency & number formatting** | `.toLocaleString('id-ID')` |

**The line:** if a human end-user reads it, it is Indonesian. If an AI agent
reads it, it is English. Text in a string literal rendered to the screen is
Indonesian; text in a comment above it is English.

```tsx
// Cap the series at the last 7 snapshots — growth is append-only.
const series = state.growth.slice(-7);

// UI copy stays Indonesian for the end user.
<button>Tabung recehnya</button>
```

### 12.3 Rationale

Mixed-language instruction sets measurably degrade instruction-following:
models resolve ambiguous directives inconsistently when the governing rules are
not in a single, predictable language. A single language for the entire
agent-facing surface removes that variance. User-facing text is excluded because
its language is a product requirement, not an agent-efficiency one.

### 12.4 Compliance

- New agent-facing files MUST be authored in English.
- Existing Indonesian agent-facing files MUST be translated when next touched;
  do not add new Indonesian prose to them.
- When editing a file that mixes languages, bring the whole file to English —
  do not leave a partially-translated rules file, because a contradictory rules
  file is worse than either language alone.
