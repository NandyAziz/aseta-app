# ASETA Architecture

> Technical context document. Every figure and name below was verified
> directly against the code on 2026-10-12. Read this file before changing
> structure, state, or domain constants. Coding standard:
> `.agents/rules/aseta-coding-standards.md` · Progress: `PROJECT_STATE.md`.

---

## 1. File Structure Map

```text
aseta-app/
├── app/
│   ├── layout.tsx           # Root layout: Geist font, metadata, lang="id"
│   ├── page.tsx             # Landing page (server component): hero, simulator, how-it-works
│   ├── globals.css          # Tailwind v4 (@import "tailwindcss") + @theme tokens
│   ├── favicon.ico
│   └── dashboard/page.tsx   # Full dashboard ('use client', ~1,930 lines) — STILL IN USE
├── components/
│   ├── HeroMascot3D.tsx     # 3D hero stage: Aseta Egg (fallback) + optional Spline
│   ├── QrisRoundUpSimulator.tsx  # Interactive round-up simulator on the landing page
│   ├── EvolveGuideView.tsx  # "Evolusi & Panduan" tab (Lv 1–10 preview + daily-quest slot)
│   ├── MascotAura.tsx       # Per-level mascot aura/glow map + evolution particles
│   └── dashboard/           # Presentational cards for the Beranda tab (pure props)
│       ├── TotalAssetsSummary.tsx   # "Total Aset Saya" block + 3-row breakdown
│       ├── PortfolioAllocation.tsx  # 60/40 split bar, gold/mutual-fund shares, chart, liquidate
│       ├── SavingsProjection.tsx    # Compound-interest calculator + projection constants
│       ├── AnalyticsTabs.tsx         # 2-tab MOBILE widget (Portofolio | Proyeksi)
│       ├── QuickTransactions.tsx     # Quick-transaction card + QUICK_PRESETS
│       ├── DailyMissions.tsx         # Daily-quests card + QuestRow
│       ├── DailyLimit.tsx            # Daily-limit card (accordion on mobile)
│       └── GrowthChart.tsx           # 7-day SVG line chart (responsive + animated)
├── utils/aseta.ts           # Pure logic: calculateRoundUp, getMascotLevel, getXpProgress,
│                            #   formatRupiah, clampDailyCap, MAX_DAILY_CAP
├── utils/sound.ts           # Synthetic Web Audio API sound effects (used by dashboard & hero)
├── types/index.ts           # Types: Transaction, QuestState, SavingsState
├── public/
│   ├── mascot-egg.gif       # Used — Lv 1–3 stage
│   ├── mascot-baby.gif      # Used — Lv 4–6 stage
│   ├── mascot-adult.gif     # Used — Lv 7–10 stage
│   ├── assets/              # EMPTY folder (contains nothing)
│   └── file.svg · globe.svg · next.svg · vercel.svg · window.svg
│                           # Leftover create-next-app templates — not referenced by any
│                           # code file (DO NOT delete without permission)
├── docs/architecture.md     # This document
├── AGENTS.md                # Agent context summary (new content BELOW the nextjs-agent-rules block)
├── PROJECT_STATE.md         # Feature progress & roadmap
├── .agents/rules/aseta-coding-standards.md  # MANDATORY coding standard (primary source of truth)
├── skills-lock.json         # Skill registry (source + hash per installed skill)
├── .githooks/pre-commit     # Pre-commit gate: runs `npm run check` (activate via core.hooksPath)
├── opencode.json            # Agent instructions: coding standard + architecture + project state
├── .env.example             # NEXT_PUBLIC_SPLINE_SCENE_URL= (empty, disabled by default)
└── package.json             # scripts: dev, build, start, lint, typecheck, check
```

**Important notes:**

- `app/dashboard/page.tsx` is **not leftover scaffolding** — the "Masuk ke
  Dashboard" button on the landing page (`app/page.tsx`) links to `/dashboard`.
  This file holds every tab (Beranda, Scan, Riwayat, Evolusi), the
  reset/liquidation modals, the onboarding tour, the Web Audio API sound
  effects, and all financial mutations.
- `app/page.tsx` is a *server component* (no `'use client'`) because it only
  renders the self-contained `HeroMascot3D` and `QrisRoundUpSimulator`.

---

## 2. Component Roles & Data Flow

### `app/page.tsx` (Landing)

- Renders the header, hero (headline + link to `/dashboard`), `HeroMascot3D`,
  `QrisRoundUpSimulator`, the "Cara kerja" card, and the footer.
- Holds no application state — all state lives in the two child components.

### `components/HeroMascot3D.tsx`

- Accepts an optional `sceneUrl` (default
  `process.env.NEXT_PUBLIC_SPLINE_SCENE_URL ?? ''`).
- Empty URL → renders only `DragonEgg` (CSS/SVG egg animated with framer-motion).
  See section 5.
- `TiltStage` wraps the entire stage content: springy X/Y rotation following the
  cursor (3D parallax tilt), with `perspective: 900`.
- `DragonEgg` accepts `shakeId` (increments on every tap) plus `onPoke`.
  `shakeId` is used as the `key` on the `motion.button` so the shake keyframes
  replay; the `playEggChirpSound()` SFX fires from `onPointerDown` (an event
  handler, not during render). Transform layers are separated: the wrapper
  handles floating (Framer Motion), the button handles shaking, and the inner
  `span` runs `animate-egg-breathe` (CSS).

### `components/QrisRoundUpSimulator.tsx`

- Local state `amountText` (digits-only string). Computes pure derivations:
  `roundUp = calculateRoundUp(amount)` and `xpGain = Math.round(roundUp /
  XP_PER_RUPIAH)`.
- Below "Total jadi setelah dibulatkan" there is a mini 60/40 allocation bar
  (`goldShare = roundUp * 0.6`, `reksaShare` = the remainder) that updates in
  real time.
- **Not connected to dashboard state** — landing simulator figures never affect
  any balance.

### `app/dashboard/page.tsx` (application core)

Data flow:

1. **Load** — `useState(() => ...)`: read
   `localStorage['aseta-savings-state']`, parse JSON → if it passes
   `isValidSavingsState()` → `normalizeState()`; if parsing fails or the data
   is corrupt → fall back to `INITIAL_STATE`.
2. **Mutation** — only from explicit event handlers: `commitSavings()`
   (preset/manual), `claimQuest()`, `handleLiquidate()`, `handleSaveDailyCap()`,
   `handleReset()`, `handleMascotTap()`. All go through `setState(prev => ...)`.
3. **Persistence** — the `saveState()` effect rewrites `localStorage` on every
   `state` change (wrapped in try/catch in case storage is blocked).
4. **Daily reset** — an effect on mount: compare
   `localStorage['aseta_last_active_date']` with today (`en-CA` `YYYY-MM-DD`
   format); if different → `applyDailyReset()` + persist the new date.
5. **Render derivation** — `display*` values (always guarded by `isMounted`) →
   `getMascotLevel()`, `getXpProgress()`, the 60/40 split, `monthlyReturn`,
   `mascotAura(level)`, search filtering, and history range.

Supporting components are split into `components/dashboard/` (all
presentational, pure from props → safe against hydration mismatches):

| Component | Contents | Used in |
|---|---|---|
| `TotalAssetsSummary` | primary "Total Aset Saya" figure (`lg:` only) + breakdown (Tabungan · Dompet · Hari Ini) + monthly return | inside the hero card, left column |
| `PortfolioAllocation` | 60/40 split bar, two share cards, 7-day chart, "Cairkan Aset" button | left column (desktop, full card) **and** the "Portofolio" tab (`bare`) |
| `SavingsProjection` | daily-deposit slider + 1/3/5-year estimate | right column (desktop, full card) **and** the "Proyeksi" tab (`bare`) |
| `AnalyticsTabs` | 2-tab mobile-only widget | mobile only (`lg:hidden`) |
| `QuickTransactions` | preset action chips + `QUICK_PRESETS` | "Scan" tab only (label "Bayar") — already removed from the Beranda feed |
| `DailyMissions` | 3 daily quests + `QuestRow` | Beranda right column (`hidden lg:block`) **and** the "Evolusi" tab (`lg:hidden`) |
| `DailyLimit` | progress, remaining quota, daily-limit input | right column (full on desktop · accordion on mobile) |
| `GrowthChart` | SVG line chart (Catmull-Rom curve, relative domain + 18% headroom, `viewBox` 320×104 + `preserveAspectRatio="xMidYMid meet"`, axis labels in HTML, **data points are tappable** → detail card with amount + change %) | used by `PortfolioAllocation` (desktop + mobile "Portofolio" tab, so 2 instances are live at once → gradient `id` via `useId()`) |

The `bare` prop lets content shown inside a tab skip the card chrome (no nested
cards). The onboarding tour configuration (`TOUR_STEPS`, 4 steps: hero-mascot →
portfolio → xp-bar → scan-nav) stays in `app/dashboard/page.tsx`;
`data-tour="portfolio"` appears in two contexts (desktop card & mobile widget)
and the tour picks whichever element is visible.

### Beranda tab layout

Main grid `grid grid-cols-1 items-start gap-6 lg:grid-cols-12` with **two column
wrappers** (not per-card auto-placement) so each column's height follows its own
content and no dangling whitespace appears:

| | Mobile (single column) | Desktop `lg:` |
|---|---|---|
| Left column (`lg:col-span-7`) | mascot hero card (mascot stage → asset breakdown (the primary figure lives in the header badge) → XP bar → "Misi Harian (n/3)" chip `lg:hidden`), then the 2-tab analytics widget | mascot hero card (card body split into 2 inner columns: mascot stage \| asset summary + XP, no chip), then Portfolio Allocation |

The mobile bar (`header` `md:hidden`) carries the logo + "ASETA" on the left
and the **Total Aset** badge on the right (`text-[10px] text-muted` label above
a `text-sm font-semibold tabular-nums text-forest` figure). That badge is where
the primary figure lives on mobile, so `TotalAssetsSummary` hides its own figure
block below `lg`. Both read from the same `totalWealth`, so mobile and desktop
can never display different numbers. At `lg:` the mobile header is not rendered
at all (the `md:flex` sidebar takes over) and the hero card shows the primary
figure again as normal.

| Right column (`lg:col-span-5`) | Misi Hari Ini (`hidden lg:block`) → Batas Harian (closed accordion) | Misi Hari Ini (`hidden lg:block`) → Proyeksi Tabungan → Batas Harian (fully open) |

The **Transaksi Cepat** card has been removed entirely from the Beranda feed at
every screen size (mobile & desktop); the right column now focuses on missions,
projection, and the daily limit. Quick-deposit actions remain available in the
"Scan" tab, which uses `QuickTransactions` with the "Bayar" label — so
`handleQuickSave()` and `QUICK_PRESETS` stay in use and the component is not
imported needlessly.

The **Misi Hari Ini** relocation is mobile-specific (`< lg`):

- **Mobile** — the quest card is hidden from the Beranda feed
  (`hidden lg:block`), moves to the "Evolusi" tab, and is reached via the
  interactive chip `🎯 Misi Harian (n/3) →` below the XP bar in the mascot hero
  card. Pressing the chip calls `setActiveTab('evolve')` so the user jumps
  straight to the quest list to claim XP. The `n` counter counts quests that are
  **already claimed**, derived from quest status guarded by `isMounted`.
- **Desktop `lg:`** — the original layout is preserved: the quest card stays
  visible in the Beranda right column, the chip is hidden (`lg:hidden`), and the
  quest slot in the "Evolusi" tab is hidden too so nothing is duplicated.

### "Evolusi & Panduan" tab layout (`components/EvolveGuideView.tsx`)

Grid `grid grid-cols-1 items-start gap-6 lg:grid-cols-12`. The "Misi Hari Ini"
card is injected through a **`missions?: ReactNode` slot** from
`app/dashboard/page.tsx` wrapped in `lg:hidden`, which keeps this view purely
presentational — it never touches state and only shows quests on mobile:

| | Mobile | Desktop `lg:` |
|---|---|---|
| Evolution card (`LevelShowcase`) | row 1 | left column `lg:col-span-5` |
| Misi Hari Ini card (`missions` slot) | row 2, directly below the evolution card | hidden (`lg:hidden`) |
| "Cara Kerja Aseta" walkthrough | row 3 | right column `lg:col-span-7`, card `sm:grid-cols-2` |

Breakpoint-specific cards are wrapped in `<div className="hidden lg:block">` /
`lg:hidden` rather than stacking `hidden` with `flex` on the same element.

---

## 3. Data Model

### `SavingsState` (`types/index.ts`)

| Field | Type | Default (`INITIAL_STATE`) | Notes |
|---|---|---|---|
| `balance` | number | `0` | Total savings **and the mascot's cumulative XP** |
| `dailyCap` | number | `20000` | Daily round-up ceiling (`MAX_DAILY_CAP` = 10,000,000) |
| `todaySavings` | number | `0` | Today's accumulated round-up |
| `history` | `Transaction[]` | `[]` | Max **50** most recent entries (index 0 = newest) |
| `walletBalance` | number | `2500000` | Simulated wallet balance |
| `streak` | number | `0` | Consecutive days |
| `lastActiveDate` | string | `''` | `YYYY-MM-DD` of last activity |
| `quests` | `QuestState` | see below | Daily quests |
| `growth` | number[] | `[]` | `balance` snapshots, max **7** entries |

### `QuestState`

`date` (`YYYY-MM-DD` of the last reset), `qrisDone`, `qrisClaimed`,
`depositClaimed`, `greetCount`, `greetClaimed` — default `false`/`0`/`''`.
Note: `depositDone` is **not stored** — it is derived at render time from
`todaySavings >= 5000`; `greetDone` from `greetCount >= 3`.

### `Transaction`

`id` (string from `Date.now()`), `merchantName`, `originalAmount`,
`roundedAmount` (= original + roundUp), `savingsAmount` (= roundUp),
`timestamp` (ISO), `date` (`toLocaleDateString('id-ID')`).

### localStorage keys

| Key | Value | Purpose |
|---|---|---|
| `aseta-savings-state` | JSON `SavingsState` | Main application state |
| `aseta_last_active_date` | `YYYY-MM-DD` | Triggers the automatic daily reset on mount |
| `aseta_tour_completed` | `'1'` | Marks the onboarding tour as finished |

### `normalizeState(parsed)` & migration rules

Called only after `isValidSavingsState()` passes (required: `balance`,
`dailyCap`, `todaySavings` are numbers and `history` is an array).
Normalization steps:

1. `{ ...INITIAL_STATE, ...parsed }` — new fields absent from old data
   **automatically get their default** from `INITIAL_STATE` (safe forward
   migration).
2. Numbers normalized via `num(v, fallback)` (must be `number` +
   `Number.isFinite`), then `Math.max(0, …)` for `balance`, `dailyCap`,
   `todaySavings`, `walletBalance`.
3. `quests: { ...INITIAL_STATE.quests, ...parsed.quests }` — merged field by
   field.
4. `growth`: if an array → each element forced ≥ 0 then `.slice(-7)`; if not an
   array → `[]`.
5. `history`: if an array, used as-is, otherwise `[]`. `streak`:
   `Math.max(0, Math.floor(...))`. `lastActiveDate`: if a string it is used,
   otherwise `''`.
6. Corrupt JSON / blocked localStorage → straight to `INITIAL_STATE` without
   crashing.

### Daily reset (`applyDailyReset(prev, today)`)

Resets **only** `todaySavings = 0` and
`quests = { ...INITIAL_STATE.quests, date: today }`. Balance, wallet, history,
streak, and growth are **preserved**.

---

## 4. Domain Constants (exactly as in the code)

### Mascot levels — `utils/aseta.ts`

- `MAX_LEVEL = 10`; XP target per level (`LEVEL_TARGETS`, index 0 = Lv 1):
  **5000 · 10000 · 20000 · 40000 · 80000 · 160000 · 320000 · 640000 · 1280000 · 2560000**.
- Cumulative thresholds (`LEVEL_CUMULATIVE`, total XP needed to advance *from*
  that level): **5000 · 15000 · 35000 · 75000 · 155000 · 315000 · 635000 · 1275000 · 2555000 · 5115000**.
- `getMascotLevel(balance)`: balance is floored and forced ≥ 0; the level
  starts at 1 and rises while `balance >= LEVEL_CUMULATIVE[level-1]` (max Lv
  10).
- `getXpProgress(balance)`: `current = balance - LEVEL_CUMULATIVE[level-2]`
  (Lv 1 → 0), `next = LEVEL_TARGETS[level-1]`, `percent = current/next*100`
  (clamped 0–100); at Lv 10 → `{ current: 2560000, next: 2560000, percent: 100 }`.
- Level titles (`LEVEL_TITLES`): "Penabung Pemula" → "Pengumpul Koin" →
  "Perencana Keuangan" → "Pemburu Aset" → "Investor Muda" → "Ahli Portofolio" →
  "Master Finansial" → "Sultan Investasi" → "Aseta Legend" → "Sultan Aseta 🏆".
- Stage gifs — `stageForLevel()`: Lv 1–3 "Telur Aseta" (`/mascot-egg.gif`);
  Lv 4–6 "Aseta Muda" (`/mascot-baby.gif`); Lv 7–10 "Aseta Mandiri"
  (`/mascot-adult.gif`). The dashboard's `EVOLUTION_STAGES` card uses different
  labels ("Bayi Naga", "Naga Dewasa", range "Lv 7 – 9") — *a fact as-is*;
  `MAX_LEVEL` is still 10 in both places.

### XP

- **In the dashboard, `balance` IS the XP** — every round-up and quest reward
  increases `balance` directly, so the mascot level rises from that same
  balance.
- Landing simulator: `XP_PER_RUPIAH = 10` →
  `xpGain = Math.round(roundUp / 10)` (10 rupiah of round-up = 1 XP). This
  simulator does not affect the dashboard.

### Round-up — `calculateRoundUp(amount)`

- Guard: if `!Number.isFinite(amount) || amount <= 0` → `0`.
- `remainder = Math.floor(amount) % 5000`; `remainder === 0` → `0`, otherwise
  `5000 - remainder` (rounded up to the nearest Rp5,000 multiple).
- Amounts already an exact 5000 multiple → 0 round-up (rejected with a toast).
- Simulator: `ROUND_UP_BASE = 5000`, slider Rp1,000–Rp100,000 (step 100),
  default Rp18,200 (`DEFAULT_AMOUNT`).

### 60/40 portfolio split & returns — dashboard

- `goldValue = Math.round(balance * 0.6)` (Emas Digital),
  `reksaValue = balance - goldValue` (Reksadana Pasar Uang). Liquidation
  (`handleLiquidate`) uses the same gold-share formula.
- Monthly return: `monthlyReturn = Math.round((balance * 0.042) / 12)`, shown in
  the UI with the label **"+4.2% p.a"**.
- `GOLD_GRAM_PRICE = 1_200_000` Rp/gram (a simulated figure) →
  `goldGrams = goldValue / GOLD_GRAM_PRICE` for the gram display.
- The **Proyeksi Tabungan** widget (`SavingsProjection`) is a full card in the
  **right column** (5 of 12 columns) at `lg:`, and becomes the "Proyeksi" tab
  inside `AnalyticsTabs` on mobile: daily-deposit slider
  `PROJECTION_MIN/MAX/STEP = 5000 / 50000 / 1000`, default
  `PROJECTION_DEFAULT = 10000`; the pure helper `projectSavings(daily, years)`
  uses a daily rate of `0.042 / 365` and an annuity-due model (deposits at the
  start of the day). Display horizons: `PROJECTION_HORIZONS = [1, 3, 5]` years.
  The "hasil" subtext = `total - projectContribution(daily, years)` where
  `projectContribution = daily × 365 × years` — **the `years` factor must be
  included**, otherwise the 3- and 5-year horizons show zero earnings.
  Figures are **simulated**, not real returns.

### Daily quests & XP rewards — `claimQuest()`

| Quest | Completion condition | Reward |
|---|---|---|
| ☕ QRIS | `quests.qrisDone` (already rounded up today) | **+100 XP** |
| 🪙 Deposit | `todaySavings >= 5000` (derived at render, not stored) | **+200 XP** |
| 🐉 Greet | `greetCount >= 3` (mascot taps) | **+50 XP** |

Every mascot tap in the dashboard also spawns a floating "+50 XP" particle
(`xpBurstId` used as the `key`, one-shot Framer Motion animation).

### Touch targets & micro-interactions

- Compact buttons (presets, "Klaim XP", "Cairkan Aset", "Simpan", "Bayar") use
  `min-h-11 sm:min-h-0` → touch height ≥ 44px on mobile, restored automatically
  on desktop. Labels use text only — **never a literal arrow** (neither `->`
  nor `→`) anywhere.
- The "Batas Harian" input uses `type="text" inputMode="numeric"`,
  `maxLength={DAILY_CAP_MAX_DIGITS}` (8 digits = `MAX_DAILY_CAP`) plus non-digit
  filtering and `clampDailyCap()`. Browsers ignore `maxLength` on
  `type="number"`, which is exactly why `text` was chosen so the limit actually
  holds.
- Sliders (`input[type=range]`) use `h-11 sm:h-5` so their hit area is
  adequate on touch screens.
- Primary action buttons use `transition-all duration-200 active:scale-95`; cards
  use `shadow-sm` + `hover:shadow-md`.

A claim is only valid when the quest is complete and not yet claimed; the reward
directly increases `balance` and pushes to `growth`, then sets the matching
`*Claimed` flag. All flags reset automatically when `quests.date` ≠ today.

### Streak — inside `commitSavings()`

- If `lastActiveDate === today` → the streak does not change.
- If the day differs: `daysBetween(lastActiveDate, today) === 1` → `streak + 1`;
  otherwise (a gap / the first transaction) → **reset to 1**. `todayKey()` uses
  local-time `YYYY-MM-DD` format (`daysBetween` based on 86,400,000 ms).

### Other limits & caps

- `dailyCap` default **20000**: a round-up is rejected when
  `todaySavings + roundUp > dailyCap` (changeable via the input + "Simpan").
  Clamped to the range `[0, MAX_DAILY_CAP]` = **10,000,000** by
  `clampDailyCap()` — used in the input `onChange`, in `handleSaveDailyCap()`,
  and in `normalizeState()` (so old state in localStorage heals too).
- A round-up is rejected when `roundUp > walletBalance` (the wallet must never
  go negative).
- Quick-transaction presets: Kopi Kenangan **18200**, Indomaret **43500**,
  Makan Siang **12100** (all three are also used as simulator presets).
- `history` is trimmed with `.slice(0, 50)`; `growth` is trimmed with
  `.slice(-7)` on every mutation.
- Chart fallback `buildGrowthSeries(balance)`: 7 points, ~+1.1%/day gradient
  toward the current balance; used when `growth.length < 2`.

---

## 5. HeroMascot3D — Optional Spline (Disabled by Default)

- URL source: `DEFAULT_SPLINE_SCENE = process.env.NEXT_PUBLIC_SPLINE_SCENE_URL ?? ''`
  → **empty by default**, so `HeroMascot3D` renders only "Telur Aseta" (CSS
  gradient + SVG vines and golden embers, framer-motion animated).
  `.env.example` contains `NEXT_PUBLIC_SPLINE_SCENE_URL=` (empty) as the
  official reference.
- **Do not fill in a scene URL** without user permission. Note: a URL that was
  tried previously (`prod.spline.design/...`) returns **403 AccessDenied** —
  that is why the default is empty (see the comment on lines 8–16 of
  `HeroMascot3D.tsx`).
- **Do not delete** the egg fallback (`DragonEgg`) or `SplineErrorBoundary` —
  both guarantee there is never a black box or blank page.
- Mechanism when the URL is set: `dynamic(() => import('@splinetool/react-spline'),
  { ssr: false })` lazy-loads the scene on the client; timeout
  `LOAD_TIMEOUT_MS = 20000` ms → status `gagal` → the Spline layer is hidden
  (the egg stays visible); runtime errors (dead WebGL, broken scene) are caught
  by `SplineErrorBoundary` (fallback `null`, logged via `console.warn`).
- Scene status: `'memuat' | 'siap' | 'gagal'`; the "Memuat naga 3D…" chip shows
  only while `memuat`; the Spline canvas fades in over the egg once `siap`.
- Parallax tilt is handled **once** in `TiltStage` (springy X/Y rotation
  following the cursor), so `InteractiveSpline` no longer stacks its own
  rotation; it still has a hover-scale plus a very slow automatic rotation.

---

## 5b. Audio — `utils/sound.ts`

- All sound effects are synthetic (Web Audio API, no mp3 files) and centralised
  in `utils/sound.ts`: `playTapSound` (mascot tap), `playEggChirpSound` (egg
  tap in the hero), `playCoinSound` (deposit), `playLevelUpSound` (level up).
- Called only from event handlers; a single `AudioContext` is reused, and
  failures (`resume()` rejected, API absent) are swallowed so nothing crashes.

---

## 6. Project Constraints

- **Pure frontend simulation**: no backend, API, database, or payment
  connection. Everything is stored in the browser's `localStorage`.
- **No real money**: "Emas Digital", "Reksadana", wallet balance, gold price
  (Rp1,200,000/gram), and the 4.2% p.a. return are simulated figures for
  demo/education — not a real investment product.
- QRIS transactions are nothing more than rounding maths in the UI (numeric
  input, presets, slider); there is no real QRIS scanning or transaction.
- Because state is per-browser, data does not sync across devices and is lost
  if storage is cleared (falling back to `INITIAL_STATE` via `normalizeState`).
