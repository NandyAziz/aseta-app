# PROJECT_STATE — ASETA

> Aplikasi **fintech gamified** untuk menabung otomatis dari "receh" pembulatan
> transaksi QRIS (Auto Round-Up Investment). Maskot naga "Aseta" berevolusi
> seiring bertambahnya aset. Stack: **Next.js 16 · React 19 · Tailwind v4 · TypeScript**.

**Status build:** ✅ `tsc` 0 error · `eslint` 0 error/0 warning · `npm run build` sukses (static `/`)

---

## ✅ Fitur yang Sudah Selesai

### Inti Aplikasi
- [x] **Auto Round-Up** — pembulatan transaksi ke ribuan terdekat, selisihnya ditabung.
- [x] **Hero Mascot Stage** — maskot besar (gif per level evolusi) dengan radial glow,
      partikel sparkle, badge level emas, altar + koin emas.
- [x] **3 Fase Evolusi Maskot** — Telur → Aseta Muda → Aseta Mandiri
      (`getMascotLevel` di `utils/aseta.ts`), transisi spring `AnimatePresence`.
- [x] **Pet Speech Bubble** — dialog acak saat maskot di-tap (`PET_LINES`), bounce effect.
- [x] **XP Evolusi Progress Bar** — `h-6` pill gradasi emerald-teal + efek glossy
      (`getXpProgress`), teks "current / next XP" dinamis per level.

### Finansial (Fintech-grade)
- [x] **Card "Total Aset Saya"** — nominal besar emerald + indikator imbal hasil
      "🟢 +Rp… (+4.2% p.a) bulan ini" + badge "Diinvestasikan Otomatis".
      Pada **mobile** nominal utama pindah ke badge header (kanan bar ASETA)
      dan kartu hero hanya menampilkan breakdown Tabungan/Dompet/Hari Ini
      dengan ikon badge lebih besar; desktop (`lg:`) tetap menampilkan
      nominal utama di dalam kartu hero.
- [x] **Alokasi Portofolio Otomatis 60/40** — split bar 🟡 Emas Digital 60% &
      🟢 Reksadana Pasar Uang 40% (proporsional terhadap balance aktual).
- [x] **Widget Statistik** — Hari Ini / Transaksi / Dompet (grid `gap-3`, font aman).
- [x] **Batas Harian (Daily Cap)** — input + tombol Simpan ber-style emerald.
- [x] **Preset Transaksi Cepat** — Kopi Kenangan / Indomaret / Makan Siang (1 tap).
- [x] **Tab Riwayat** — daftar transaksi tersimpan (localStorage).

### Gamifikasi Lanjutan (Jalur 2)
- [x] **Streak Harian** — badge "🔥 N Hari" di header; naik jika aktivitas
      hari-berturut-turut, reset jika bolong.
- [x] **Misi Hari Ini (Daily Quests)** — 3 checklist interaktif
      (☕ QRIS +100 XP · 🪙 Tabung ≥Rp5.000 +200 XP · 🐉 Sapa Aseta 3x +50 XP)
      dengan tombol "Klaim XP" + reset otomatis tiap tanggal. Pada **mobile**
      kartu ini pindah ke **tab "Evolusi"** (di bawah kartu evolusi) dan
      Beranda cukup punya chip pintasan `🎯 Misi Harian (n/3) →` yang melompat
      ke tab tersebut; pada **desktop** kartu misi tetap di kolom kanan Beranda
      dan chip disembunyikan.
- [x] **SFX Web Audio API** — efek suara sintetis tanpa file mp3 (aman dari 404):
      `playTapSound`, `playCoinSound`, `playLevelUpSound` (saat tap/nabung/klaim/level up).

### Finansial Realistis (Jalur 3)
- [x] **Modal Pencairan Aset (Liquidate)** — cairkan Emas/Reksadana/Semua dari
      portofolio kembali ke Saldo Dompet utama (dengan validasi nominal).
- [x] **Grafik Pertumbuhan 7 Hari** — mini SVG line chart (`GrowthChart`) responsif.

### Onboarding & UX
- [x] **Interactive Walkthrough / Onboarding Tour** — 4 langkah (Hero Mascot →
      Portfolio → XP Bar → Tombol Scan), backdrop `bg-black/75 z-40` + spotlight
      tajam (`z-55` ring emerald) + tooltip modal (`z-60`) dengan avatar mini maskot.
      Status disimpan di `localStorage` (`aseta_tour_completed`), bisa diulang via tombol `?`.
- [x] **Hydration Safety** — semua render berbasis localStorage dibungkus guard
      `isMounted` (via `useSyncExternalStore`) → bebas hydration mismatch.
- [x] **Mobile Frame + Bottom Navbar** — container `max-w-md`, navbar fixed
      glassmorphism tunggal (tanpa tab ganda), `pb-28` agar konten tak tertutup.

---

### Polish Visual & Micro-Interactions (Terbaru)
- [x] **Parallax Tilt Panggung Hero** — `TiltStage` di `HeroMascot3D` memiringkan
      seluruh isi panggung mengikuti kursor (`perspective: 900` + spring).
- [x] **Telur Aseta Interaktif** — animasi "bernapas" (CSS), getaran saat diklik,
      dan SFX "ciit" (`playEggChirpSound`) dari `utils/sound.ts`.
- [x] **Bar Alokasi di Simulator** — strip mini Emas Digital 60% / Reksadana 40%
      yang mengikuti nilai round-up secara real-time.
- [x] **Tap Micro-interaksi Maskot** — `whileTap` scale-95, bounce CSS
      `animate-mascot-tap`, dan partikel "+50 XP" melayang tiap tap.
- [x] **Widget Proyeksi Tabungan** — kalkulator bunga majemuk harian
      (Rp5.000–Rp50.000/hari) dengan estimasi 1/3/5 tahun @ +4,2% p.a;
      subteks "hasil" mengurangi setoran kumulatif `daily × 365 × years`.
- [x] **Audio Terpusat** — semua SFX Web Audio API dipindah ke `utils/sound.ts`
      (dipakai bersama oleh landing & dashboard).

### Layout Responsif (Terbaru)
- [x] **Grid desktop 2 kolom** — `lg:grid-cols-12`: kolom kiri 7 (kartu hero
      maskot + total aset + Alokasi Portofolio), kolom kanan 5 (Misi Hari Ini
      → Proyeksi Tabungan → Batas Harian). Misi Hari Ini hanya di kolom
      kanan pada `lg:` (mobile: pindah ke tab "Evolusi" + chip pintasan).
- [x] **Kartu-kartu diekstrak ke `components/dashboard/`** —
      `TotalAssetsSummary`, `PortfolioAllocation`, `SavingsProjection`,
      `AnalyticsTabs`, `QuickTransactions`, `DailyMissions`, `DailyLimit`,
      `GrowthChart`. `app/dashboard/page.tsx` kini hanya memegang state,
      animasi maskot, kamera/QR, modal, dan tour.
- [x] **Widget analitik 2-tab (mobile)** — "Portofolio" dan "Proyeksi" digabung
      ke satu kartu tab agar feed utama tidak perlu digulir jauh.
- [x] **Grafik pertumbuhan responsif & beranimasi** — `GrowthChart` memakai
      `viewBox` 320×104 + `preserveAspectRatio="xMidYMid meet"` dengan `aspect`
      yang sama rasionya (skala seragam, tanpa gepeng/letterbox/overflow di
      320px–desktop). Semua koordinat `d`, tinggi kurva, dan grid dihitung
      dari props `series` (tidak ada angka statis); kurva Catmull-Rom dengan
      headroom 18% supaya tren tidak menempel tepi. Label sumbu dipindah ke
      HTML agar fontsize responsif lewat breakpoint dan tidak ter-clip.
      Animasi: garis digambar masuk (`pathLength=1` → `stroke-dashoffset`),
      area fade-in, aura titik akhir, dan `transition d/cx/cy 500ms` saat
      data berubah — semuanya CSS murni (aman SSR, tanpa hydration mismatch)
      dengan `prefers-reduced-motion` guard. `id` gradient pakai `useId()`
      karena 2 instans aktif bersamaan di DOM.
- [x] **Titik grafik interaktif** — tiap titik `growthSeries` bisa diklik/di-tap
      (state lokal `selectedIndex`). Hit-area berupa **kolom `rect` setinggi
      penuh** (bukan lingkaran kecil): zona ketuk dibagi di batas tengah antar
      titik sehingga tidak tumpang tindih, dan tetap ≥ acuan 44×44 di viewport
      320px (terukur 36.7×75.4px ≈ 2770px² setelah memperhitungkan padding
      `px-4` + `p-5` + `p-3`). Kartu detail menampilkan periode, nominal persis
      (`Rp…`), dan perubahan %/Rp dari periode sebelumnya; memakai alur normal
      (bukan `absolute` di atas grafik) sehingga mustahil ter-clip di layar
      sempit, dengan dentum penunjuk di-clamp ke titik aktif. Dukungan
      keyboard: `←/→/Home/End` pindah titik, `Esc` menutup; grup satu tab stop
      saja dengan `role="status" aria-live="polite"` pada kartunya.
      SVG **tidak** memakai `role="img"` (agar titik interaktif tidak
      disembunyikan pembaca layar); lapisan dekoratif memakai `aria-hidden`.
- [x] **Catatan data `growth`** — `growth` diisi **per transaksi**
      (`page.tsx` `handleQuickSave`/quest/liquidate), bukan per hari, dan
      tidak menyimpan timestamp. Karena itu label titik bawaan memakai
      "Periode N", **bukan tanggal**. `GrowthChart` menerima prop opsional
      `labels?: readonly string[]` untuk memasok tanggal asli di masa depan
      tanpa mengubah komponen. Header "Pertumbuhan Aset · 7 Hari" di
      `PortfolioAllocation` masih memakai kata "Hari" — perlu diselaraskan
      bila mau akurat.
- [x] **Transaksi Cepat dipindah ke tab "Scan"** — kartu ini DIHAPUS dari feed
      **Beranda** di semua breakpoint (mobile & desktop) agar kolom kanan fokus
      pada misi, proyeksi, dan batas harian. Aksi nabung cepat tetap tersedia
      di tab "Scan" (`QuickTransactions`, label "Bayar"), jadi `handleQuickSave`
      dan `QUICK_PRESETS` tetap terpakai.
- [x] **Batas Harian jadi akordeon di mobile** — tertutup secara default,
      ringkasan pemakaian tetap terlihat di header.
- [x] **Input batas harian tervalidasi** — `maxLength={8}`, hanya digit,
      dijepit `clampDailyCap()`; tidak pernah meluber keluar kartu.

## 📋 Daftar Tugas Selanjutnya (Roadmap)

### Prioritas Tinggi
- [ ] **Persistensi Streak saat Mount** — pastikan streak terhitung & tampil benar
      bahkan sebelum transaksi pertama pada hari itu (saat ini naik via `commitSavings`).
- [ ] **Reset Otomatis Daily Quests saat Mount** — panggil reset berbasis tanggal
      saat komponen mount (bukan hanya saat nabung) agar checklist akurat tiap hari.
- [ ] **Notifikasi Streak Putus** — toast/peringatan ramah jika user melewatkan 1 hari.

### Prioritas Sedang
- [ ] **Riwayat Pertumbuhan Real** — simpan snapshot `growth` harian (bukan hanya
      saat transaksi) agar grafik 7 hari lebih akurat.
- [ ] **Animasi Konfeti Level Up** — perluas efek visual saat evolusi maskot (level up).
- [ ] **Aksesibilitas** — pastikan semua interaktif punya label ARIA & fokus keyboard.

### Prioritas Rendah / Eksplorasi
- [ ] **Unit Test** — tambahkan test untuk `utils/aseta.ts` (round-up, level, XP).
- [ ] **Onboarding ulang setelah update fitur** — versioning tour (`aseta_tour_v2`).
- [ ] **Harga emas & return dinamis** — ambil dari data/API simulasi, bukan konstanta.

---

## 🗂️ File Konteks
- `.clinerules` — aturan pengkodean & standar proyek.
- `.clineignore` — daftar file/folder yang diabaikan agen.
- `PROJECT_STATE.md` — dokumen ini (progress & roadmap).
- `docs/architecture.md` — arsitektur, data model, & konstanta domain (terverifikasi dari kode).
- `AGENTS.md` — ringkasan konteks agent (di bawah blok nextjs-agent-rules).
- `opencode.json` — daftar instruksi yang dimuat agent.
