# Arsitektur ASETA

> Dokumen konteks teknis. Semua angka dan nama di bawah ini diverifikasi langsung
> dari kode pada 2026-10-12. Baca file ini sebelum mengubah struktur, state, atau
> konstanta domain. Aturan gaya: `.clinerules` · Progres: `PROJECT_STATE.md`.

---

## 1. Peta Struktur File

```text
aseta-app/
├── app/
│   ├── layout.tsx           # Root layout: font Geist, metadata, lang="id"
│   ├── page.tsx             # Landing page (server component): hero, simulator, cara kerja
│   ├── globals.css          # Tailwind v4 (@import "tailwindcss") + token @theme
│   ├── favicon.ico
│   └── dashboard/page.tsx   # Dashboard penuh ('use client', ±1.930 baris) — MASIH DIPAKAI
├── components/
│   ├── HeroMascot3D.tsx     # Panggung hero 3D: Telur Aseta (fallback) + Spline opsional
│   ├── QrisRoundUpSimulator.tsx  # Simulator round-up interaktif di landing
│   ├── EvolveGuideView.tsx  # Tab "Evolusi & Panduan" (pratinjau Lv 1–10 + slot misi harian)
│   ├── MascotAura.tsx       # Peta aura/glow maskot per level + partikel evolusi
│   └── dashboard/           # Kartu presentasional tab Beranda (murni props)
│       ├── TotalAssetsSummary.tsx   # Blok "Total Aset Saya" + breakdown 3 baris
│       ├── PortfolioAllocation.tsx  # Split bar 60/40, porsi emas/reksa, grafik, Cairkan
│       ├── SavingsProjection.tsx    # Kalkulator bunga majemuk + konstanta proyeksi
│       ├── AnalyticsTabs.tsx         # Widget 2-tab MOBILE (Portofolio | Proyeksi)
│       ├── QuickTransactions.tsx     # Kartu transaksi cepat + QUICK_PRESETS
│       ├── DailyMissions.tsx         # Kartu misi harian + QuestRow
│       ├── DailyLimit.tsx            # Kartu batas harian (akordeon di mobile)
│       └── GrowthChart.tsx           # Grafik garis SVG 7 hari
├── utils/aseta.ts           # Logika murni: calculateRoundUp, getMascotLevel, getXpProgress,
│                            #   formatRupiah, clampDailyCap, MAX_DAILY_CAP
├── utils/sound.ts           # Efek suara sintetis Web Audio API (dipakai dashboard & hero)
├── types/index.ts           # Tipe: Transaction, QuestState, SavingsState
├── public/
│   ├── mascot-egg.gif       # Dipakai — stage Lv 1–3
│   ├── mascot-baby.gif      # Dipakai — stage Lv 4–6
│   ├── mascot-adult.gif     # Dipakai — stage Lv 7–10
│   ├── assets/              # Folder KOSONG (tidak ada isinya)
│   └── file.svg · globe.svg · next.svg · vercel.svg · window.svg
│                           # Sisa template create-next-app — tidak direferensikan
│                           # file mana pun di kode (JANGAN dihapus tanpa izin)
├── docs/architecture.md     # Dokumen ini
├── AGENTS.md                # Ringkasan konteks agent (konten baru DI BAWAH blok nextjs-agent-rules)
├── PROJECT_STATE.md         # Progres fitur & roadmap
├── .clinerules              # Standar pengkodean wajib (jangan dipindah/dihapus/direname)
├── .clineignore             # Daftar abaikan agen (jangan dipindah/dihapus/direname)
├── opencode.json            # Instruksi agent: .clinerules + docs/architecture.md + PROJECT_STATE.md
├── .env.example             # NEXT_PUBLIC_SPLINE_SCENE_URL= (kosong, nonaktif default)
└── package.json             # scripts: dev, build, start, lint, typecheck, check
```

**Catatan penting:**

- `app/dashboard/page.tsx` **bukan sisa awal** — tombol "Masuk ke Dashboard" pada
  landing (`app/page.tsx`) mengarah ke `/dashboard`. File ini memuat semua tab
  (Beranda, Scan, Riwayat, Evolusi), modal reset/pencairan, onboarding tour,
  efek suara Web Audio API, dan seluruh mutasi keuangan.
- `app/page.tsx` adalah *server component* (tanpa `'use client'`) karena hanya
  merender `HeroMascot3D` dan `QrisRoundUpSimulator` yang berdiri sendiri.

---

## 2. Peran Komponen & Alur Data

### `app/page.tsx` (Landing)

- Merender header, hero (judul + tombol ke `/dashboard`), `HeroMascot3D`,
  `QrisRoundUpSimulator`, kartu "Cara kerja", footer.
- Tidak punya state aplikasi — semua state ada di dua komponen anak.

### `components/HeroMascot3D.tsx`

- Menerima opsional `sceneUrl` (default
  `process.env.NEXT_PUBLIC_SPLINE_SCENE_URL ?? ''`).
- URL kosong → hanya render `DragonEgg` (telur CSS/SVG beranimasi framer-motion).
  Lihat bagian 5.
- `TiltStage` membungkus seluruh isi panggung: rotasi X/Y berpegas mengikuti
  posisi kursor (parallax tilt 3D), dengan `perspective: 900`.
- `DragonEgg` menerima `shakeId` (bertambah tiap tap) + `onPoke`. `shakeId`
  dipakai sebagai `key` pada `motion.button` agar keyframe getaran diputar ulang;
  SFX `playEggChirpSound()` dipanggil dari `onPointerDown` (event handler, bukan
  saat render). Lapisan transform dipisah: wrapper = melayang (Framer Motion),
  tombol = getaran, `span` di dalamnya = `animate-egg-breathe` (CSS).

### `components/QrisRoundUpSimulator.tsx`

- State lokal `amountText` (string digit saja). Menghitung turunan murni:
  `roundUp = calculateRoundUp(amount)` dan `xpGain = Math.round(roundUp / XP_PER_RUPIAH)`.
- Di bawah "Total jadi setelah dibulatkan" ada bar alokasi mini 60/40
  (`goldShare = roundUp * 0.6`, `reksaShare = sisanya`) yang ikut berubah real-time.
- **Tidak terhubung ke state dashboard** — angka simulator landing tidak
  memengaruhi saldo apa pun.

### `app/dashboard/page.tsx` (inti aplikasi)

Alur data:

1. **Load** — `useState(() => ...)`: baca `localStorage['aseta-savings-state']`,
   parse JSON → jika lolos `isValidSavingsState()` → `normalizeState()`;
   jika gagal/corrupt → kembali ke `INITIAL_STATE`.
2. **Mutasi** — hanya dari event handler eksplisit: `commitSavings()`
   (preset/manual), `claimQuest()`, `handleLiquidate()`, `handleSaveDailyCap()`,
   `handleReset()`, `handleMascotTap()`. Semua lewat `setState(prev => ...)`.
3. **Persist** — effect `saveState()` menulis ulang `localStorage` setiap `state`
   berubah (dibungkus try/catch bila storage diblokir).
4. **Reset harian** — effect saat mount: bandingkan
   `localStorage['aseta_last_active_date']` dengan hari ini (format `en-CA`
   `YYYY-MM-DD`); bila beda → `applyDailyReset()` + simpan tanggal baru.
5. **Derivasi render** — nilai `display*` (selalu guard `isMounted`) →
   `getMascotLevel()`, `getXpProgress()`, split 60/40, `monthlyReturn`,
   `mascotAura(level)`, filter pencarian & rentang riwayat.

Komponen pendukung dipisah ke `components/dashboard/` (semua presentasional,
murni dari props → aman terhadap hydration mismatch):

| Komponen | Isi | Dipakai di |
|---|---|---|
| `TotalAssetsSummary` | nominal utama "Total Aset Saya" (`lg:` saja) + breakdown (Tabungan · Dompet · Hari Ini) + imbal hasil bulanan | dalam kartu hero, kolom kiri |
| `PortfolioAllocation` | split bar 60/40, dua kartu porsi, grafik 7 hari, tombol "Cairkan Aset" | kolom kiri (desktop, kartu penuh) **dan** tab "Portofolio" (`bare`) |
| `SavingsProjection` | slider setoran harian + estimasi 1/3/5 tahun | kolom kanan (desktop, kartu penuh) **dan** tab "Proyeksi" (`bare`) |
| `AnalyticsTabs` | widget 2-tab khusus mobile | hanya mobile (`lg:hidden`) |
| `QuickTransactions` | chip aksi preset + `QUICK_PRESETS` | tab "Scan" saja (label "Bayar") — sudah dihapus dari feed Beranda |
| `DailyMissions` | 3 misi harian + `QuestRow` | kolom kanan Beranda (`hidden lg:block`) **dan** tab "Evolusi" (`lg:hidden`) |
| `DailyLimit` | progres, sisa kuota, input batas harian | kolom kanan (desktop penuh · mobile akordeon) |
| `GrowthChart` | grafik garis SVG 7 hari | dipakai `PortfolioAllocation` |

Properti `bare` dipakai agar isi yang tampil di dalam tab tidak memakai chrome
kartu lagi (tidak ada kartu bersarang). Konfigurasi onboarding tour
(`TOUR_STEPS` dengan 4 langkah: hero-mascot → portfolio → xp-bar → scan-nav)
tetap di `app/dashboard/page.tsx`; `data-tour="portfolio"` muncul di dua
konteks (kartu desktop & widget mobile) dan tour memilih elemen yang terlihat.

### Layout tab Beranda

Grid utama `grid grid-cols-1 items-start gap-6 lg:grid-cols-12` dengan **dua
wrapper kolom** (bukan auto-placement per kartu) agar tinggi tiap kolom
mengikuti isinya sendiri dan tidak ada celah putih menggantung:

| | Mobile (satu kolom) | Desktop `lg:` |
|---|---|---|
| Kolom kiri (`lg:col-span-7`) | kartu hero maskot (panggung maskot → breakdown aset (nominal utama ada di badge header) → XP bar → chip "Misi Harian (n/3)" `lg:hidden`), lalu widget analitik 2-tab | kartu hero maskot (badan kartu dibagi 2 kolom internal: panggung maskot \| ringkasan aset + XP, tanpa chip), lalu Alokasi Portofolio |

Bar mobile (`header` `md:hidden`) memuat logo + "ASETA" di kiri dan badge
**Total Aset** di kanan (label `text-[10px] text-muted` di atas nominal
`text-sm font-semibold tabular-nums text-forest`). Badge ini adalah tempat
nominal utama pada mobile, sehingga `TotalAssetsSummary` menyembunyikan blok
nominalnya di bawah `lg`. Nominal berasal dari `totalWealth` yang sama, jadi
mobile dan desktop tidak pernah menampilkan angka berbeda. Pada `lg:` header
mobile tidak dirender sama sekali (sidebar `md:flex` yang mengambil alih) dan
kartu hero kembali menampilkan nominal utama apa adanya.
| Kolom kanan (`lg:col-span-5`) | Misi Hari Ini (`hidden lg:block`) → Batas Harian (akordeon tertutup) | Misi Hari Ini (`hidden lg:block`) → Proyeksi Tabungan → Batas Harian (terbuka penuh) |

Kartu **Transaksi Cepat** telah dihapus sepenuhnya dari feed Beranda pada
semua ukuran layar (mobile & desktop); kolom kanan kini fokus pada misi,
proyeksi, dan batas harian. Aksi nabung cepat tetap tersedia di tab "Scan",
yang memakai `QuickTransactions` dengan label "Bayar" — jadi `handleQuickSave()`
dan `QUICK_PRESETS` tetap terpakai dan komponen tersebut tidak di-import
yang sia-sia.

Relokasi **Misi Hari Ini** bersifat khusus mobile (`< lg`):

- **Mobile** — kartu misi disembunyikan dari feed Beranda (`hidden lg:block`),
  pindah ke tab "Evolusi", dan diakses lewat chip interaktif
  `🎯 Misi Harian (n/3) →` di bawah XP bar pada kartu hero maskot. Menekan chip
  memanggil `setActiveTab('evolve')` agar pengguna langsung melompat ke daftar
  misi untuk klaim XP. Pembilang `n` menghitung misi yang **sudah diklaim** dari
  status misi ber-guard `isMounted`.
- **Desktop `lg:`** — layout asli dipertahankan: kartu misi tetap terlihat di
  kolom kanan Beranda, chip disembunyikan (`lg:hidden`), dan slot misi di tab
  "Evolusi" ikut disembunyikan agar tidak dobel.

### Layout tab Evolusi & Panduan (`components/EvolveGuideView.tsx`)

Grid `grid grid-cols-1 items-start gap-6 lg:grid-cols-12`. Kartu "Misi Hari Ini"
dimasukkan lewat **slot `missions?: ReactNode`** dari `app/dashboard/page.tsx`
dibungkus `lg:hidden`, sehingga view ini tetap presentasional, tidak menyentuh
state, dan hanya menampilkan misinya di mobile:

| | Mobile | Desktop `lg:` |
|---|---|---|
| Kartu evolusi (`LevelShowcase`) | baris 1 | kolom kiri `lg:col-span-5` |
| Kartu Misi Hari Ini (slot `missions`) | baris 2, tepat di bawah kartu evolusi | disembunyikan (`lg:hidden`) |
| Walkthrough "Cara Kerja Aseta" | baris 3 | kolom kanan `lg:col-span-7`, kartu `sm:grid-cols-2` |

Kartu khusus per breakpoint dibungkus `<div className="hidden lg:block">` /
`lg:hidden`, bukan menumpuk `hidden` dengan `flex` pada elemen yang sama.

---

## 3. Data Model

### `SavingsState` (`types/index.ts`)

| Field | Tipe | Default (`INITIAL_STATE`) | Keterangan |
|---|---|---|---|
| `balance` | number | `0` | Total tabungan **sekaligus XP kumulatif** maskot |
| `dailyCap` | number | `20000` | Batas round-up per hari (plafon `MAX_DAILY_CAP` = 10.000.000) |
| `todaySavings` | number | `0` | Akumulasi round-up hari ini |
| `history` | `Transaction[]` | `[]` | Maks **50** entri terbaru (indeks 0 = terbaru) |
| `walletBalance` | number | `2500000` | Saldo dompet simulasi |
| `streak` | number | `0` | Hari beruntun |
| `lastActiveDate` | string | `''` | `YYYY-MM-DD` aktivitas terakhir |
| `quests` | `QuestState` | lihat bawah | Misi harian |
| `growth` | number[] | `[]` | Snapshot `balance`, maks **7** entri |

### `QuestState`

`date` (`YYYY-MM-DD` reset terakhir), `qrisDone`, `qrisClaimed`,
`depositClaimed`, `greetCount`, `greetClaimed` — default `false`/`0`/`''`.
Catatan: `depositDone` **tidak disimpan** — diturunkan saat render dari
`todaySavings >= 5000`; `greetDone` dari `greetCount >= 3`.

### `Transaction`

`id` (string dari `Date.now()`), `merchantName`, `originalAmount`,
`roundedAmount` (= original + roundUp), `savingsAmount` (= roundUp),
`timestamp` (ISO), `date` (`toLocaleDateString('id-ID')`).

### Kunci localStorage

| Key | Nilai | Fungsi |
|---|---|---|
| `aseta-savings-state` | JSON `SavingsState` | State utama aplikasi |
| `aseta_last_active_date` | `YYYY-MM-DD` | Pemicu auto-reset harian saat mount |
| `aseta_tour_completed` | `'1'` | Penanda onboarding tour selesai |

### `normalizeState(parsed)` & aturan migrasi

Dipanggil hanya setelah `isValidSavingsState()` lolos (wajib: `balance`,
`dailyCap`, `todaySavings` bertipe number dan `history` berupa array).
Langkah normalisasi:

1. `{ ...INITIAL_STATE, ...parsed }` — field baru yang belum ada di data lama
   **otomatis mendapat default** dari `INITIAL_STATE` (migrasi aman ke depan).
2. Angka dinormalisasi via `num(v, fallback)` (harus `number` +
   `Number.isFinite`), lalu `Math.max(0, …)` untuk `balance`, `dailyCap`,
   `todaySavings`, `walletBalance`.
3. `quests: { ...INITIAL_STATE.quests, ...parsed.quests }` — merge per field.
4. `growth`: bila array → tiap elemen dipaksa ≥ 0 lalu `.slice(-7)`; bila bukan
   array → `[]`.
5. `history`: bila array dipakai apa adanya, selain itu `[]`. `streak`:
   `Math.max(0, Math.floor(...))`. `lastActiveDate`: bila string dipakai,
   selain itu `''`.
6. JSON corrupt / localStorage diblokir → langsung `INITIAL_STATE` tanpa crash.

### Reset harian (`applyDailyReset(prev, today)`)

Reset **hanya** `todaySavings = 0` dan
`quests = { ...INITIAL_STATE.quests, date: today }`. Balance, dompet, riwayat,
streak, dan growth **dipertahankan**.

---

## 4. Konstanta Domain (persis dari kode)

### Level maskot — `utils/aseta.ts`

- `MAX_LEVEL = 10`; target XP per level (`LEVEL_TARGETS`, indeks 0 = Lv 1):
  **5000 · 10000 · 20000 · 40000 · 80000 · 160000 · 320000 · 640000 · 1280000 · 2560000**.
- Ambang kumulatif (`LEVEL_CUMULATIVE`, total XP untuk naik dari level tersebut):
  **5000 · 15000 · 35000 · 75000 · 155000 · 315000 · 635000 · 1275000 · 2555000 · 5115000**.
- `getMascotLevel(balance)`: balance difloor & dipaksa ≥ 0; level mulai dari 1
  lalu naik selama `balance >= LEVEL_CUMULATIVE[level-1]` (maks Lv 10).
- `getXpProgress(balance)`: `current = balance - LEVEL_CUMULATIVE[level-2]`
  (Lv 1 → 0), `next = LEVEL_TARGETS[level-1]`, `percent = current/next*100`
  (dibatasi 0–100); pada Lv 10 → `{ current: 2560000, next: 2560000, percent: 100 }`.
- Judul level (`LEVEL_TITLES`): "Penabung Pemula" → "Pengumpul Koin" →
  "Perencana Keuangan" → "Pemburu Aset" → "Investor Muda" → "Ahli Portofolio" →
  "Master Finansial" → "Sultan Investasi" → "Aseta Legend" → "Sultan Aseta 🏆".
- Stage gif — `stageForLevel()`: Lv 1–3 "Telur Aseta" (`/mascot-egg.gif`);
  Lv 4–6 "Aseta Muda" (`/mascot-baby.gif`); Lv 7–10 "Aseta Mandiri"
  (`/mascot-adult.gif`). Kartu `EVOLUTION_STAGES` di dashboard memakai label
  berbeda ("Bayi Naga", "Naga Dewasa", rentang "Lv 7 – 9") — *fakta apa adanya*;
  `MAX_LEVEL` tetap 10 di kedua tempat.

### XP

- **Di dashboard, `balance` ITU XP** — setiap round-up dan hadiah misi langsung
  menambah `balance`, sehingga level maskot naik dari saldo yang sama.
- Simulator landing: `XP_PER_RUPIAH = 10` →
  `xpGain = Math.round(roundUp / 10)` (10 rupiah pembulatan = 1 XP).
  Simulator ini tidak memengaruhi dashboard.

### Round-up — `calculateRoundUp(amount)`

- Guard: bila `!Number.isFinite(amount) || amount <= 0` → `0`.
- `remainder = Math.floor(amount) % 5000`; `remainder === 0` → `0`,
  selain itu `5000 - remainder` (dibulatkan ke atas ke kelipatan Rp5.000 terdekat).
- Nominal yang sudah kelipatan tepat 5000 → 0 receh (ditolak dengan toast).
- Simulator: `ROUND_UP_BASE = 5000`, slider Rp1.000–Rp100.000 (step 100),
  default Rp18.200 (`DEFAULT_AMOUNT`).

### Split portofolio 60/40 & imbal hasil — dashboard

- `goldValue = Math.round(balance * 0.6)` (Emas Digital),
  `reksaValue = balance - goldValue` (Reksadana Pasar Uang).
  Pencairan (`handleLiquidate`) memakai rumus porsi emas yang sama.
- Imbal hasil bulanan: `monthlyReturn = Math.round((balance * 0.042) / 12)`,
  ditampilkan di UI dengan label **"+4.2% p.a"**.
- `GOLD_GRAM_PRICE = 1_200_000` Rp/gram (angka simulasi) →
  `goldGrams = goldValue / GOLD_GRAM_PRICE` untuk tampilan gram emas.
- Widget **Proyeksi Tabungan** (`SavingsProjection`) adalah kartu penuh di
  **kolom kanan** (5 dari 12 kolom) pada `lg:`, dan menjadi tab "Proyeksi"
  di dalam `AnalyticsTabs` pada mobile:
  slider setoran harian `PROJECTION_MIN/MAX/STEP = 5000 / 50000 / 1000`,
  default `PROJECTION_DEFAULT = 10000`; helper murni `projectSavings(daily, years)`
  memakai bunga harian `0.042 / 365` dan model annuity-due (setoran di awal
  hari). Horizon tampilan: `PROJECTION_HORIZONS = [1, 3, 5]` tahun.
  Subteks "hasil" = `total - projectContribution(daily, years)` dengan
  `projectContribution = daily × 365 × years` — **faktor `years` wajib ikut**,
  kalau tidak maka horizon 3 dan 5 tahun terlihat nol hasil.
  Angka **simulasi**, bukan imbal hasil nyata.

### Misi harian & hadiah XP — `claimQuest()`

| Misi | Syarat selesai | Hadiah |
|---|---|---|
| ☕ QRIS | `quests.qrisDone` (sudah round-up hari ini) | **+100 XP** |
| 🪙 Deposit | `todaySavings >= 5000` (turunan saat render, tidak disimpan) | **+200 XP** |
| 🐉 Sapa | `greetCount >= 3` (tap maskot) | **+50 XP** |

Tiap tap maskot di dashboard juga memunculkan partikel "+50 XP" yang melayang
(`xpBurstId` sebagai `key`, animasi Framer Motion satu kali jalan).

### Target sentuh & micro-interaksi

- Tombol ringkas (preset, "Klaim XP", "Cairkan Aset", "Simpan", "Bayar")
  memakai `min-h-11 sm:min-h-0` → tinggi sentuh ≥ 44px di mobile, kembali
  otomatis di desktop. Label memakai teks saja — **tanpa panah literal**
  (`->` maupun `→`) di mana pun.
- Input "Batas Harian" memakai `type="text" inputMode="numeric"`,
  `maxLength={DAILY_CAP_MAX_DIGITS}` (8 digit = `MAX_DAILY_CAP`) plus
  penyaringan non-digit dan `clampDailyCap()`. `maxLength` diabaikan browser
  pada `type="number"`, jadi tipe `text` memang dipilih agar batasnya benar.
- Slider (`input[type=range]`) memakai `h-11 sm:h-5` agar lua area sentuhnya
  layak di layar sentuh.
- Tombol aksi utama memakai `transition-all duration-200 active:scale-95`; kartu
  memakai `shadow-sm` + `hover:shadow-md`.

Klaim hanya sah bila misi selesai dan belum diklaim; hadiah langsung menambah
`balance` + mendorong `growth`, lalu mengaktifkan flag `*Claimed` yang sesuai.
Semua flag reset otomatis saat `quests.date` ≠ hari ini.

### Streak — dalam `commitSavings()`

- Bila `lastActiveDate === hari ini` → streak tidak berubah.
- Bila beda hari: `daysBetween(lastActiveDate, today) === 1` → `streak + 1`;
  selain itu (bolong / transaksi pertama) → **reset ke 1**.
  `todayKey()` memakai format `YYYY-MM-DD` waktu lokal (`daysBetween` berbasis
  86.400.000 ms).

### Batas & cap lain

- `dailyCap` default **20000**: round-up ditolak bila
  `todaySavings + roundUp > dailyCap` (ubah via input + "Simpan").
  Dijepit ke rentang `[0, MAX_DAILY_CAP]` = **10.000.000** oleh
  `clampDailyCap()` — dipakai pada `onChange` input, `handleSaveDailyCap()`,
  dan `normalizeState()` (agar state lama di localStorage ikut heals).
- Round-up ditolak bila `roundUp > walletBalance` (dompet tidak boleh negatif).
- Preset transaksi cepat: Kopi Kenangan **18200**, Indomaret **43500**,
  Makan Siang **12100** (ketiganya juga dipakai sebagai preset simulator).
- `history` dipangkas `.slice(0, 50)`; `growth` dipangkas `.slice(-7)` per mutasi.
- Fallback grafik `buildGrowthSeries(balance)`: 7 titik, gradien ~+1,1%/hari
  menuju balance saat ini; dipakai bila `growth.length < 2`.

---

## 5. HeroMascot3D — Spline Opsional (Nonaktif Default)

- Sumber URL: `DEFAULT_SPLINE_SCENE = process.env.NEXT_PUBLIC_SPLINE_SCENE_URL ?? ''`
  → **default kosong**, sehingga `HeroMascot3D` hanya merender "Telur Aseta"
  (gradien CSS + SVG sulur & bara emas, animasi framer-motion). `.env.example`
  memuat `NEXT_PUBLIC_SPLINE_SCENE_URL=` (kosong) sebagai acuan resmi.
- **Jangan mengisi URL scene** tanpa izin user. Catatan: URL yang pernah dicoba
  (`prod.spline.design/...`) mengembalikan **403 AccessDenied**, itulah alasan
  default dikosongkan (lihat komentar di baris 8–16 `HeroMascot3D.tsx`).
- **Jangan menghapus** fallback telur (`DragonEgg`) maupun `SplineErrorBoundary` —
  keduanya menjamin tidak pernah ada kotak hitam/halaman blank.
- Mekanisme saat URL diisi: `dynamic(() => import('@splinetool/react-spline'),
  { ssr: false })` memuat scene lazy di klien; timeout `LOAD_TIMEOUT_MS = 20000`
  ms → status `gagal` → layer Spline disembunyikan (telur tetap tampil);
  error runtime (WebGL mati, scene rusak) ditangkap `SplineErrorBoundary`
  (fallback `null`, dicatat via `console.warn`).
- Status scene: `'memuat' | 'siap' | 'gagal'`; chip "Memuat naga 3D…" hanya
  tampil saat `memuat`; canvas Spline fade-in di atas telur saat `siap`.
- Parallax tilt ditangani **satu kali** di `TiltStage` (rotasi X/Y berpegas
  mengikuti kursor) sehingga `InteractiveSpline` tidak lagi menumpuk rotasi
  sendiri; ia tetap punya hover-scale + rotasi otomatis sangat pelan.

---

## 5b. Audio — `utils/sound.ts`

- Semua efek suara sintetis (Web Audio API, tanpa file mp3) dipusatkan di
  `utils/sound.ts`: `playTapSound` (tap maskot), `playEggChirpSound` (tap telur
  di hero), `playCoinSound` (nabung), `playLevelUpSound` (naik level).
- Hanya dipanggil dari event handler; `AudioContext` tunggal di-reuse, dan
  kegagalan (`resume()` ditolak, API tidak ada) ditelan agar tidak crash.

---

## 6. Batasan Proyek

- **Simulasi frontend murni**: tidak ada backend, API, database, maupun koneksi
  pembayaran. Semua angka disimpan di `localStorage` browser.
- **Tanpa uang asli**: "Emas Digital", "Reksadana", saldo dompet, harga emas
  (Rp1.200.000/gram), dan imbal hasil 4,2% p.a adalah angka simulasi untuk
  demo/edukasi — bukan produk investasi nyata.
- Transaksi QRIS hanyalah matematika pembulatan di UI (input angka, preset,
  slider); tidak ada pemindaian atau transaksi QRIS sungguhan.
- Karena state per-browser, data tidak sinkron antar perangkat dan hilang bila
  storage dibersihkan (lalu kembali ke `INITIAL_STATE` via `normalizeState`).
