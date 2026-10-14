# Standar Pengkodean ASETA

Satuan-satunya standar wajib untuk kontribusi kode di proyek **ASETA** — aplikasi
fintech gamified (Auto Round-Up Investment) berbasis Next.js.

> Sumber: `.clinerules` (arsip: `.clinerules.bak`), digabung & dideduplikasi
> terhadap `AGENTS.md` dan `docs/architecture.md`. Referensi dokumentasi:
> `docs/architecture.md`.

---

## 1. Branding

- Nama produk: **ASETA**. Tagline resmi: **"ASETA — Naga Penjelajah Asetmu"**
  (sumber: `metadata.title` di `app/layout.tsx`).
- Maskot adalah **naga** yang berevolusi mengikuti XP — bukan elemen dekoratif.
  Setiap interaksi maskot (tap, evolusi level, partikel "+50 XP", dialog
  `PET_LINES`) adalah bagian dari loop gamifikasi, bukan pelengkap.
- Tahapan evolusi (dari `utils/aseta.ts` → `stageForLevel()`):
  Lv 1–3 "Telur Aseta" (`/mascot-egg.gif`) · Lv 4–6 "Aseta Muda"
  (`/mascot-baby.gif`) · Lv 7–10 "Aseta Mandiri" (`/mascot-adult.gif`).
  Berubahnya tahap berarti mengarang sistem level.
- Gaya produk: ramah dan mobile-friendly; semua dialog, toast, dan komentar
  berbahasa Indonesia yang natural.

## 2. Stack & Versi (WAJIB DIPATUHI)

- **Next.js 16 (App Router)** — konvensi `app/`, `'use client'`.
  Sebelum menulis kode, baca dokumentasi relevan di
  `node_modules/next/dist/docs/`; versi ini punya breaking changes.
- **React 19** — patuhi aturan React Compiler (purity & immutability).
- **TypeScript `strict`** — semua file wajib bertipe. Jangan pakai `any`
  tanpa alasan tertulis.
- **Tailwind CSS v4** — impor via `@import "tailwindcss";` di `app/globals.css`.

## 3. Sistem Warna (Tailwind v4 `@theme`)

Token resmi ada di `app/globals.css` (`@theme`) — **jangan** menulis hex langsung
di komponen:

| Token          | Nilai        | Pemakaian utama                        |
|----------------|--------------|-----------------------------------------|
| `--color-ivory`| `#f8faf8`    | latar off-white lembut (anti-silau)    |
| `--color-sage` | `#a3b58a`    | aksen sekunder                          |
| `--color-brand`| `#047857`    | aksen emerald pekat, teks putih ≥ AA    |
| `--color-forest`| `#0f172a`   | judul / teks utama                     |
| `--color-gold` | `#e5b454`    | aksen pencapaian / evolusi             |
| `--color-muted`| `#475569`    | teks pendukung                         |
| `--color-line` | `#e2e8f0`    | border kartu yang lembut               |

Classes turunan yang dipakai: `border-line`, `text-forest`, `text-muted`,
`text-brand`, `bg-ivory`, `bg-brand`, `text-gold`, `bg-sage`.

- `--color-brand` sengaja emerald-700 (bukan 600) agar teks putih di atasnya
  memenuhi rasio kontras WCAG AA (≥ 4.5:1). Jangan "melorca" ke emerald-600.

## 4. Sintaks Tailwind v4 Modern

| ❌ Lama (v3)        | ✅ Baru (v4)      |
|---------------------|-------------------|
| `bg-gradient-to-r`  | `bg-linear-to-r`  |
| `bg-gradient-to-br` | `bg-linear-to-br` |
| `z-[50]`            | `z-50`            |

- Nilai arbitrary (`max-w-[240px]`) **hanya** bila tidak ada utility bawaan.
  Untuk `z-index` non-standar, pakai token yang sudah ada di `@theme`:
  `--z-index-55` / `--z-index-60` (dipakai ring tour `z-55`, tooltip `z-60`).
- Peta warna: `bg-slate-50` (off-white), `bg-white`, emerald `#059669`,
  `text-slate-900`/`#0f172a`.

## 5. Hydration Safety (PENTING)

Aplikasi membaca `localStorage` yang berbeda antara Server & Client. Semua
render berbasis data tersebut **WAJIB** dibungkus guard `isMounted`.

- `isMounted` memakai `useSyncExternalStore` (sudah tersedia):
  ```tsx
  {isMounted ? state.balance.toLocaleString('id-ID') : 0}
  ```
- **JANGAN** membuat state `mounted` + `setMounted(true)` di dalam `useEffect` —
  ditolak ESLint (`react-hooks/set-state-in-effect`) & menyebabkan cascading render.
- State lokal (slider/draft) di-init dari **konstanta**, bukan dari localStorage.
  Waktu harus lewat `nowTs` yang diisi effect agar render tetap pure.
- Efek samping (`localStorage.setItem`, `Date.now()`, konfeti, SFX) **hanya** di
  event handler atau effect yang bergantung pada `isMounted` — jangan saat render
  (purity React Compiler). `nowTs` harus `0` saat render pertama.

## 6. Bahasa & Format Angka

- Komentar kode, teks UI, dan pesan toast: **Bahasa Indonesia** natural/ramah.
- Nama variabel & fungsi tetap **Inggris** (`handleQuickSave`, `liquidateAmount`).
- Format angka Indonesia: `.toLocaleString('id-ID')`.

## 7. Struktur & Kebersihan Kode

- Logika murni & pembantu (audio, format tanggal, grafik) di **module scope** di
  luar komponen agar lolos aturan purity React Compiler.
- Hindari duplikasi — pakai helper bersama (`commitSavings`) daripada menyalin
  logika di beberapa handler.
- Semua modal/state dari localStorage wajib dibungkus guard `isMounted`.
- Migrasi data localStorage lama harus aman — pakai `normalizeState()`.
- Baca `docs/architecture.md` sebelum mengubah struktur, state, atau konstanta
  domain. Jangan menulis ulang rumus domain ad-hoc di komponen.

## 8. Larangan

- **Jangan** menambah library baru (termasuk devDependency) tanpa izin user.
- **Jangan** mengedit `package-lock.json`.
- **Jangan** menghapus fallback telur / `SplineErrorBoundary` di `HeroMascot3D`.
  Scene Spline hanya aktif bila `NEXT_PUBLIC_SPLINE_SCENE_URL` diisi (default
  kosong/nonaktif).
- **Jangan** menyentuh blok `<!-- BEGIN:nextjs-agent-rules -->` … `<!-- END -->`
  di `AGENTS.md`.
- **Jangan** mengubah kunci localStorage (`aseta-savings-state`,
  `aseta_last_active_date`, `aseta_tour_completed`) atau semantik reset harian
  tanpa izin user.

## 9. Library yang Boleh Dipakai

Hanya yang sudah terpasang di `package.json`: `framer-motion`, `lucide-react`,
`canvas-confetti`. Pengecualian `@splinetool/*` — opsional & nonaktif default.

- `vitest` **boleh** ditambahkan sebagai devDependency untuk unit test `utils/`.
- Audio memakai **Web Audio API** bawaan browser (`utils/sound.ts`) — tanpa file
  mp3 eksternal, agar tidak kena 404.

## 10. Definition of Done — WAJIB

```bash
npm run check   # = typecheck && lint && build
```

Hasil harus **0 error dan 0 warning** untuk `tsc --noEmit`,
`eslint app/ components/ utils/ types/`, dan `next build`. Jika gagal, perbaiki
sampai hijau **sebelum** menutup task.

- Tidak boleh ada hydration mismatch di konsol browser.
- Mikro-interaksi yang sudah ada (SFX `utils/sound.ts`, tilt, shake, partikel
  "+50 XP", daily reset, toast) harus tetap utuh.
- Layout tab Beranda: `main` = grid 12 kolom dengan DUA wrapper kolom —
  `lg:col-span-7` (kiri) dan `lg:col-span-5` (kanan), masing-masing
  `flex flex-col gap-6`, grid memakai `items-start`. Auto-placement per kartu
  tanpa wrapper **dilarang** (bikin kartu melintasi baris). Kartu seragam:
  `rounded-2xl border border-line bg-white p-4 sm:p-5`.
- Guard overflow horizontal pada halaman yang memuat deretan geser:
  `w-full max-w-full overflow-x-hidden` di root, `min-w-0` pada kolom flex,
  dan `w-full min-w-0 overflow-x-auto` pada baris chip.
