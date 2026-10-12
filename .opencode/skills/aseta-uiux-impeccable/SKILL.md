---
name: aseta-uiux-impeccable
description: Enforces UI/UX Pro Max standards, responsive layout anatomy, clean typography, eye-friendly color harmony, and rigid code quality for ASETA.
---

### 🎨 1. TYPOGRAPHY & COLOR HARMONY (VISUAL COMFORT)
- Clean Typography: Use modern, highly readable sans-serif fonts (e.g., Plus Jakarta Sans, Inter, or Geist). Strictly eliminate any decorative or mismatched fonts.
- Eye-Friendly Palette:
  - Backgrounds: Use soft, subtle mint-krem tinted off-white backgrounds (e.g., `bg-emerald-50/20` or `#F8FAF8`) to prevent screen glare.
  - Text Colors: Use crisp dark slate (`text-slate-900` for titles, `text-slate-600` for body copy). Never use pure black (`#000000`).
  - Primary Accent: Use rich emerald/teal shades (`emerald-600`, `teal-600`) for badges, buttons, and highlights.
- Card Aesthetics: Apply Tailwind v4 syntax (`bg-linear-to-*`), soft borders (`border border-emerald-100/60`), subtle soft shadows (`shadow-sm`), and consistent inner paddings (`p-5` or `p-6`).

### 🏛️ 2. RESPONSIVE LAYOUT ANATOMY & GRID BALANCE
- Mobile (<768px): Single-column stack (`grid-cols-1`) with high-priority elements (Asset Balance & Mascot) at the top. Minimum touch target height of 44px for buttons and sliders.
- Desktop (>=1024px): Balanced 3-column grid (`grid-cols-12` or `lg:grid-cols-3`). Use `col-span-2` for wider widgets like "Proyeksi Tabungan" to balance grid heights and prevent lopsided columns or bottom white gaps.
- Micro-Interactions: Add smooth transition states (`transition-all duration-200`, `active:scale-95`, hover elevation) to interactive cards and buttons.
- Mascot Quote: Keep the quote badge neatly nested inside the main Mascot/Asset card.

### 🛡️ 3. TECHNICAL & DOMAIN SAFETY
- Single Source of Truth: Always reference `docs/architecture.md` for domain logic, level formulas, and state models.
- Hydration Safety: Preserve `isMounted` guards on all client components using `localStorage` to eliminate SSR hydration mismatches.
- Quality Gate (DOD): Always execute `npm run check` as the final step and fix any typecheck, linting, or build errors automatically.