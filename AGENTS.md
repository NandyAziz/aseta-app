<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Ringkasan Proyek

ASETA — aplikasi fintech gamified (Auto Round-Up Investment) berbasis Next.js 16
App Router: kembalian pembulatan QRIS "ditabung" ke portofolio Emas 60% /
Reksadana 40% sambil maskot naga berevolusi lewat XP. Simulasi frontend murni —
tanpa backend, tanpa uang asli.

## Struktur Proyek

- `app/` — landing (`page.tsx`) + dashboard penuh (`dashboard/page.tsx`, masih aktif).
- `components/` — `HeroMascot3D` (Spline opsional, fallback telur) & `QrisRoundUpSimulator`.
- `utils/aseta.ts` — logika murni round-up, level, progress XP. `types/index.ts` — tipe state.
- `public/` — 3 gif maskot dipakai; SVG bawaan template tidak terpakai.
- Detail lengkap: baca **docs/architecture.md** (peta file, data model, konstanta domain).

## Perintah (package manager: npm)

- `npm run dev` — server dev.
- `npm run check` — typecheck + lint + build (jalankan sebelum selesai).

## Larangan Penting

- Menambah library baru (termasuk devDependency) **butuh izin user**.
- Jangan hapus fallback telur / `SplineErrorBoundary` di `HeroMascot3D`; scene Spline
  aktif hanya via `NEXT_PUBLIC_SPLINE_SCENE_URL` (default kosong/nonaktif).
- Jangan edit lockfile (`package-lock.json`).
- Jangan sentuh blok `<!-- BEGIN:nextjs-agent-rules -->` … `<!-- END -->` di atas.

## Dokumen Konteks

- `.clinerules` — standar gaya & aturan pengkodean wajib.
- `docs/architecture.md` — arsitektur, state, konstanta domain (baca sebelum
  mengubah struktur/state/konstanta).
- `PROJECT_STATE.md` — progres fitur & roadmap.
