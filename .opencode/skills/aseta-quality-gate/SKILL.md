---
name: aseta-quality-gate
description: Quality control and validation rules for ASETA project refactoring - use when editing, refactoring, or reviewing app/dashboard/page.tsx, components/, utils/, Tailwind classes, or anything touching domain logic, the 3-column grid layout, or localStorage/hydration, and always finish by running npm run check.
---

# ASETA Quality Gate

Aturan validasi yang WAJIB dijalankan pada setiap refactor/penyuntingan kode
proyek ASETA (Next.js 16 App Router · React 19 · Tailwind v4 · TypeScript).
Simulasi frontend murni — tanpa backend, tanpa uang asli.

## 1. `docs/architecture.md` adalah SATU-SUMBER KEBENARAN

- Baca `docs/architecture.md` (dan `AGENTS.md` / `.clinerules`) SEBELUM mengubah
  struktur, state, atau konstanta domain.
- Jangan pernah menulis ulang rumus domain secara ad-hoc di komponen. Semua
  nilai tuner harus diambil dari konstanta yang sudah ada:
  - `utils/aseta.ts` → `calculateRoundUp`, `getMascotLevel`, `getXpProgress`,
    `MAX_LEVEL`, `LEVEL_TARGETS`, `LEVEL_TITLES`.
  - Dashboard → `LEVEL_CUMULATIVE`, `GOLD_GRAM_PRICE`, `INITIAL_STATE`,
    `normalizeState()`, `applyDailyReset()`, `buildGrowthSeries()`.
- Kalau implementasi kode berbeda dari dokumen (atau dokumen basi), STOP dan
  laporkan ke user - jangan diam-diam memilih salah satu. Perbarui
  `docs/architecture.md` setelah perubahan yang disengaja.
- Dilarang: mengubah `SavingsState`/`QuestState`/`Transaction` di `types/index.ts`,
  kunci localStorage (`aseta-savings-state`, `aseta_last_active_date`,
  `aseta_tour_completed`), atau semantik reset harian/streak tanpa izin user.

## 2. Grid 3 kolom tetap seimbang (hanya relevan untuk tab Beranda)

- Struktur utama `app/dashboard/page.tsx`: `main` = grid 12 kolom
  (`lg:grid-cols-12`), tiga wrapper kolom `lg:col-span-3` / `lg:col-span-6` /
  `lg:col-span-3`.
- Wrapper kolom WAJIB `flex flex-col space-y-6` (atau `gap-6` yang konsisten di
  seluruh kolom) — jangan campur `gap-4` dan `gap-6`.
- Kartu seragam: `rounded-2xl border border-line bg-white p-4 ... sm:p-5`.
- DILARANG ada elemen yang "melayang" di luar kartu (mis. badge kutipan di bawah
  kartu) atau whitespace putih menggantung di dasar kolom.
- Widget baru yang tergolong tinggi (kalkulator, grafik, tabel) TIDAK boleh
  memanjangkan kolom tengah — jadikan modal atau tab tersendiri, atau letakkan
  di kolom yang memang paling kosong.
- Setelah edit, cek mental: 3 kolom tetap sejajar dan tidak ada celah putih
  menggantung di dasar kolom.

## 3. Hydration safety: `isMounted` wajib ada

- Semua render berbasis `localStorage`/waktu/acak WAJIB di-guard `isMounted`
  (dari `useSyncExternalStore`):
  ```tsx
  {isMounted ? state.balance.toLocaleString('id-ID') : 0}
  ```
- JANGAN gunakan pola `useState(false)` + `setMounted(true)` di dalam
  `useEffect` (ditolak ESLint `react-hooks/set-state-in-effect`).
- State lokal slider/draft di-init dari KONSTANTA, bukan dari localStorage.
- Efek samping (`localStorage.setItem`, `Date.now()`, konfeti, SFX) HANYA di
  event handler atau `useEffect` yang bergantung pada `isMounted` — jangan saat
  render (purity React Compiler).
- Perhatikan juga `'use client'` pada komponen yang membaca browser API.

## 4. Tailwind CSS v4 yang valid

- Pakai sintaks v4: `bg-linear-to-r` / `bg-linear-to-br` (BUKAN
  `bg-gradient-to-*`), `z-50` (nilai arbitrer hanya bila memang tidak ada
  utility standar — token `--z-index-55/60` sudah ada di `globals.css`).
- Warna: pakai token `@theme` (`brand`, `forest`, `ivory`, `gold`, `sage`,
  `line`, `muted`) atau palet slate/emerald/amber yang sudah dipakai.
- Angka format Indonesia: `.toLocaleString('id-ID')`.
- Komentar kode, teks UI, dan toast dalam Bahasa Indonesia.

## 5. Definisi Selesai (DoD)

- WAJIB jalankan di terminal:
  ```bash
  npm run check   # = typecheck && lint && build
  ```
- Hasil harus **0 error dan 0 warning** untuk `tsc --noEmit`,
  `eslint app/ components/ utils/ types/`, dan `next build`.
- Kalau gagal, perbaiki sampai hijau SEBELUM menutup task —
  melapor "nanti saja" - perbaiki sampai hijau sebelum menutup task.
- Tambahan: tidak boleh menambah dependency baru (kecuali izin user),
  tidak boleh menyentuh `package-lock.json`, tidak boleh menghapus fallback
  telur / `SplineErrorBoundary` di `HeroMascot3D`, dan tidak boleh menyentuh
  blok `<!-- BEGIN:nextjs-agent-rules -->` di `AGENTS.md`.
- Mikro-interaksi yang sudah ada (SFX `utils/sound.ts`, tilt, shake, partikel
  "+50 XP", daily reset, toast) harus tetap utuh setelah refactor.
- Perbarui `docs/architecture.md` / `PROJECT_STATE.md` bila struktur, konstanta,
  atau layout berubah.
