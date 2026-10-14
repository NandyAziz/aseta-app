# PROJECT_STATE — ASETA

> A **fintech gamified** app for automatically saving the "change" from QRIS
> transaction round-ups (Auto Round-Up Investment). The dragon mascot "Aseta"
> evolves as assets accumulate. Stack: **Next.js 16 · React 19 · Tailwind v4 ·
> TypeScript**.

**Build status:** ✅ `tsc` 0 errors · `eslint` 0 errors/0 warnings · `npm run
build` succeeds (static `/`)

---

## ✅ Completed Features

### Application Core
- [x] **Auto Round-Up** — rounds transactions up to the nearest thousand and
      saves the difference.
- [x] **Hero Mascot Stage** — a large mascot (gif per evolution level) with
      radial glow, sparkle particles, a golden level badge, and an altar with
      golden coins.
- [x] **3 Mascot Evolution Stages** — Egg → Young Aseta → Independent Aseta
      (`getMascotLevel` in `utils/aseta.ts`), with spring `AnimatePresence`
      transitions.
- [x] **Pet Speech Bubble** — random dialogue when the mascot is tapped
      (`PET_LINES`), with a bounce effect.
- [x] **XP Evolution Progress Bar** — `h-6` emerald-teal gradient pill + glossy
      effect (`getXpProgress`), with dynamic "current / next XP" text per level.

### Financial (Fintech-grade)
- [x] **"Total Aset Saya" card** — large emerald figure + return indicator
      "🟢 +Rp… (+4.2% p.a) bulan ini" + a "Diinvestasikan Otomatis" badge. On
      **mobile** the primary figure moves to the header badge (right of the ASETA
      bar) and the hero card shows only the Tabungan/Dompet/Hari Ini breakdown
      with larger badge icons; on desktop (`lg:`) the primary figure stays inside
      the hero card.
- [x] **Automatic 60/40 Portfolio Allocation** — split bar 🟡 Emas Digital 60% &
      🟢 Reksadana Pasar Uang 40% (proportional to the actual balance).
- [x] **Statistics Widget** — Hari Ini / Transaksi / Dompet (`gap-3` grid, safe
      font sizes).
- [x] **Daily Cap** — input + an emerald-styled save button.
- [x] **Quick Transaction Presets** — Kopi Kenangan / Indomaret / Makan Siang
      (1 tap).
- [x] **History Tab** — a list of stored transactions (localStorage).

### Advanced Gamification (Track 2)
- [x] **Daily Streak** — a "🔥 N Hari" badge in the header; increases with
      consecutive-day activity and resets after a gap.
- [x] **Daily Quests (Misi Hari Ini)** — 3 interactive checklist items
      (☕ QRIS +100 XP · 🪙 Save ≥Rp5,000 +200 XP · 🐉 Greet Aseta 3× +50 XP) with
      a "Klaim XP" button and an automatic reset each new date. On **mobile**
      this card moves to the **"Evolusi" tab** (below the evolution card) and
      Beranda only needs the shortcut chip `🎯 Misi Harian (n/3) →` that jumps to
      that tab; on **desktop** the quest card stays in the Beranda right column
      and the chip is hidden.
- [x] **Web Audio API SFX** — synthetic sound effects with no mp3 files (immune
      to 404s): `playTapSound`, `playCoinSound`, `playLevelUpSound` (on
      tap/deposit/claim/level up).

### Realistic Financial Behaviour (Track 3)
- [x] **Asset Liquidation Modal** — liquidate Gold/Mutual Funds/All from the
      portfolio back into the main Wallet Balance (with amount validation).
- [x] **7-Day Growth Chart** — a responsive mini SVG line chart (`GrowthChart`).

### Onboarding & UX
- [x] **Interactive Walkthrough / Onboarding Tour** — 4 steps (Hero Mascot →
      Portfolio → XP Bar → Scan Button), `bg-black/75 z-40` backdrop + sharp
      spotlight (`z-55` emerald ring) + modal tooltip (`z-60`) with a mini mascot
      avatar. Status is stored in `localStorage` (`aseta_tour_completed`) and can
      be replayed via the `?` button.
- [x] **Hydration Safety** — every localStorage-based render is guarded by
      `isMounted` (via `useSyncExternalStore`) → no hydration mismatches.
- [x] **Mobile Frame + Bottom Navbar** — `max-w-md` container, a single fixed
      glassmorphism navbar (no double tabs), `pb-28` so content is not covered.

---

### Visual Polish & Micro-Interactions (Latest)
- [x] **Hero Stage Parallax Tilt** — `TiltStage` in `HeroMascot3D` tilts the
      entire stage content following the cursor (`perspective: 900` + spring).
- [x] **Interactive Aseta Egg** — a "breathing" animation (CSS), a shake on
      click, and a "chirp" SFX (`playEggChirpSound`) from `utils/sound.ts`.
- [x] **Simulator Allocation Bar** — a mini Emas Digital 60% / Reksadana 40%
      strip that follows the round-up value in real time.
- [x] **Mascot Tap Micro-interaction** — `whileTap` scale-95, CSS bounce
      `animate-mascot-tap`, and a floating "+50 XP" particle on every tap.
- [x] **Savings Projection Widget** — a daily compound-interest calculator
      (Rp5,000–Rp50,000/day) with 1/3/5-year estimates @ +4.2% p.a; the "hasil"
      subtext subtracts cumulative deposits `daily × 365 × years`.
- [x] **Centralised Audio** — all Web Audio API SFX moved to `utils/sound.ts`
      (shared by the landing page and the dashboard).

### Responsive Layout (Latest)
- [x] **2-column desktop grid** — `lg:grid-cols-12`: left column 7 (mascot hero
      card + total assets + Portfolio Allocation), right column 5 (Misi Hari Ini
      → Proyeksi Tabungan → Batas Harian). Misi Hari Ini appears in the right
      column only at `lg:` (on mobile it moves to the "Evolusi" tab plus a
      shortcut chip).
- [x] **Cards extracted to `components/dashboard/`** —
      `TotalAssetsSummary`, `PortfolioAllocation`, `SavingsProjection`,
      `AnalyticsTabs`, `QuickTransactions`, `DailyMissions`, `DailyLimit`,
      `GrowthChart`. `app/dashboard/page.tsx` now only holds state, mascot
      animation, camera/QR, modals, and the tour.
- [x] **2-tab analytics widget (mobile)** — "Portofolio" and "Proyeksi" merged
      into a single tab card so the main feed does not require much scrolling.
- [x] **Responsive, animated growth chart** — `GrowthChart` uses
      `viewBox` 320×104 + `preserveAspectRatio="xMidYMid meet"` with an `aspect`
      of the same ratio (uniform scale, no distortion/letterbox/overflow from
      320px to desktop). Every `d` coordinate, curve height, and grid line is
      computed from the `series` prop (no static numbers); a Catmull-Rom curve
      with 18% headroom keeps the trend off the edges. Axis labels moved to HTML
      so font sizes scale via breakpoints and are never clipped. Animation: the
      line draws in (`pathLength=1` → `stroke-dashoffset`), the area fades in, an
      end-point halo, and `transition d/cx/cy 500ms` when data changes — all pure
      CSS (SSR-safe, no hydration mismatch) with a `prefers-reduced-motion` guard.
      The gradient `id` uses `useId()` because 2 instances are live in the DOM at
      once.
- [x] **Interactive chart points** — every `growthSeries` point is clickable/tappable
      (local `selectedIndex` state). Hit areas are **full-height `rect` columns**
      (not small circles): tap zones split at the midpoint between adjacent
      points so they never overlap, and stay ≥ the 44×44 reference at a 320px
      viewport (measured 36.7×75.4px ≈ 2770px² after accounting for the
      `px-4` + `p-5` + `p-3` padding). The detail card shows the period, the exact
      figure (`Rp…`), and the %/Rp change from the previous period; it uses normal
      flow (not `absolute` over the chart) so it cannot possibly be clipped on a
      narrow screen, with a pointer notch clamped to the active point. Keyboard
      support: `←/→/Home/End` move between points, `Esc` closes; a single tab stop
      for the whole group, with `role="status" aria-live="polite"` on the card.
      The SVG deliberately does **not** use `role="img"` (that would hide the
      interactive points from screen readers); decorative layers use `aria-hidden`.
- [x] **`growth` data caveat** — `growth` is appended **per transaction**
      (`page.tsx` `handleQuickSave`/quest/liquidate), not per day, and stores no
      timestamp. That is why the default point labels use "Periode N" rather than
      dates. `GrowthChart` accepts an optional `labels?: readonly string[]` prop so
      real dates can be supplied later without changing the component. The
      "Pertumbuhan Aset · 7 Hari" header in `PortfolioAllocation` still says
      "Hari" — it should be aligned if accuracy matters.
- [x] **Quick Transactions moved to the "Scan" tab** — this card is REMOVED from
      the **Beranda** feed at every breakpoint (mobile & desktop) so the right
      column focuses on missions, projection, and the daily limit. Quick-deposit
      actions remain available in the "Scan" tab (`QuickTransactions`, label
      "Bayar"), so `handleQuickSave` and `QUICK_PRESETS` stay in use.
- [x] **Daily Limit becomes an accordion on mobile** — closed by default, with
      the usage summary still visible in the header.
- [x] **Validated daily-limit input** — `maxLength={8}`, digits only, clamped by
      `clampDailyCap()`; it never overflows the card.

## 📋 Next Tasks (Roadmap)

### High Priority
- [ ] **Persist the streak on mount** — make sure the streak is computed and
      displayed correctly even before the first transaction of the day (it
      currently only increments via `commitSavings`).
- [ ] **Automatic daily quest reset on mount** — call the date-based reset when
      the component mounts (not only on deposit) so the checklist is accurate
      every day.
- [ ] **Broken-streak notification** — a friendly toast/warning if the user
      misses a day.

### Medium Priority
- [ ] **Real growth history** — store daily `growth` snapshots (not just on
      transactions) so the 7-day chart is more accurate.
- [ ] **Level-up confetti animation** — extend the visual effect when the mascot
      evolves (level up).
- [ ] **Accessibility** — ensure every interactive element has an ARIA label and
      keyboard focus.

### Low Priority / Exploration
- [ ] **Unit tests** — add tests for `utils/aseta.ts` (round-up, level, XP).
- [ ] **Re-run onboarding after a feature update** — tour versioning
      (`aseta_tour_v2`).
- [ ] **Dynamic gold price & return** — source it from simulated data/API rather
      than constants.

---

## 🗂️ Context Files
- `.agents/rules/aseta-coding-standards.md` — the mandatory coding standard and
  project rules (primary source of truth).
- `skills-lock.json` — skill registry (source + hash per installed skill).
- `PROJECT_STATE.md` — this document (progress & roadmap).
- `docs/architecture.md` — architecture, data model, and domain constants
  (verified against the code).
- `AGENTS.md` — agent context summary (below the nextjs-agent-rules block).
- `opencode.json` — the list of instructions loaded by the agent.
