'use client';

import { useId, useState, type KeyboardEvent } from 'react';

/* ============================================================================
 * GrowthChart — grafik garis SVG pertumbuhan portofolio (7 snapshot terakhir)
 * dengan titik data yang bisa diklik/di-tap.
 *
 * Sifat penting:
 * 1. PURE PROPS + state interaksi lokal. Tidak ada `localStorage`, waktu
 *    sistem, atau acak saat render → aman SSR & bebas hydration mismatch.
 *    `useState` di sini HANYA menyimpan titik yang sedang dipilih.
 * 2. FLUID. `viewBox` + `preserveAspectRatio="xMidYMid meet"` + `aspect` yang
 *    persis sama rasionya → skala seragam di 320px sampai lebar desktop,
 *    tanpa gepeng (distorsi), tanpa letterbox, tanpa overflow horizontal.
 * 3. LABEL DI LUAR SVG. Sumbu/teks diletakkan di baris HTML di bawah grafik,
 *    bukan di dalam `viewBox`. Kalau teks ikut diskalakan viewBox, ukurannya
 *    ikut membesar di layar lebar dan ikut terpotong di 320px.
 * 4. HIT AREA per titik berupa KOLOM RECT setinggi area plot (bukan lingkaran
 *    kecil), sehingga target sentuhnya lebar penuh, tidak saling tumpang tindih,
 *    dan tetap ≥ 44px pada viewport 320px untuk 7 titik (stepX ≈ 50px).
 * 5. KARTU DETAIL memakai alur normal (bukan `absolute` di atas grafik) supaya
 *    mustahil ter-clip di layar sempit. Dentum penunjuknya yang di-clamp ke
 *    titik aktif, jadi secara visual tetap "nempel" ke titiknya.
 * ========================================================================== */

/** Kanvas virtual. Semua koordinat dihitung relatif terhadap nilai ini. */
const W = 320;
const H = 104;
/** Padding kiri/kanan area plot — label HTML memakai rasio yang sama (lihat PAD_RATIO_X). */
const PAD_X = 8;
/** Ruang atas: cukup untuk cincin aura titik puncak tanpa keluar viewBox. */
const PAD_TOP = 18;
/** Ruang bawah untuk label sumbu X. */
const PAD_BOTTOM = 18;
const PLOT_H = H - PAD_TOP - PAD_BOTTOM;
const PLOT_BOTTOM = PAD_TOP + PLOT_H;
/** 8 / 320 = 2.5% → dipakai sebagai padding-x baris label HTML agar rata. */
const PAD_RATIO_X = '2.5%';

/** Rasio garis horizontal grid (0 = puncak, 1 = dasar area plot). */
const GRID_STEPS = [0, 0.5, 1];

/** Batas aman titik & titik kendali kurva agar tidak keluar area plot. */
const clampY = (y: number) => Math.min(PAD_TOP, Math.max(PLOT_BOTTOM, y));
const r2 = (n: number) => n.toFixed(2);

/** Rupiah ringkas untuk label sumbu: 1_250_000 → "1,3 jt". */
function formatCompactIDR(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 1 })} M`;
  if (abs >= 1_000_000) return `${(value / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`;
  if (abs >= 1_000) return `${(value / 1e3).toLocaleString('id-ID', { maximumFractionDigits: 0 })} rb`;
  return value.toLocaleString('id-ID');
}

/** Persen dengan tanda eksplisit: 1,24 → "+1,24%". */
function formatPercent(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${Math.abs(value).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

/**
 * Kurva Catmull-Rom → Bezier agar garis terasa "hidup" dan tidak bersudut
 * seperti polyline. Titik kendali dijepit ke area plot supaya kurva tidak
 * pernah menanjak keluar kotak saat data melonjak.
 */
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M${r2(pts[0].x)},${r2(pts[0].y)}`;

  let d = `M${r2(pts[0].x)},${r2(pts[0].y)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c1y = clampY(p1.y + (p2.y - p0.y) / 6);
    const c2y = clampY(p2.y - (p3.y - p1.y) / 6);
    d += ` C${r2(c1x)},${r2(c1y)} ${r2(c2x)},${r2(c2y)} ${r2(p2.x)},${r2(p2.y)}`;
  }
  return d;
}

export default function GrowthChart({
  series,
  /** Label per titik (mis. tanggal). Opsional — lihat catatan di bawah. */
  labels,
}: {
  series: number[];
  labels?: readonly string[];
}) {
  // `useId` bisa memuat karakter non-alnum di beberapa versi React; disaring
  // agar id aman dipakai sebagai referensi `url(#...)` gradient SVG.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const fillId = `growthFill-${uid}`;

  // Hanya state interaksi: indeks titik yang sedang aktif, atau null.
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // --- Data → titik (dinamis, mengikuti `series` apa pun yang masuk) --------
  const values = (series.length >= 2 ? series : [0, 0])
    .map(v => (Number.isFinite(v) ? v : 0))
    .slice(0, 31);
  const span = Math.max(1, values.length - 1);

  /* Domain relatif terhadap data + headroom. Menjangkarkan ke 0 (seperti
     `Math.min(...data, 0)`) membuat tren yang nilainya jauh dari nol menempel
     di tepi atas dan meninggalkan 3/4 kanvas kosong. Headroom 18% menjaga
     nilai tertinggi & terendah tetap di dalam area plot, dan seri datar tetap
     tergambar sebagai garis di tengah. */
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const rawRange = hi - lo;
  const headroom = rawRange === 0 ? Math.max(Math.abs(hi) * 0.02, 1) : rawRange * 0.18;
  const min = lo - headroom;
  const max = hi + headroom;
  const range = max - min || 1;
  const stepX = (W - PAD_X * 2) / span;

  const points = values.map((v, i) => ({
    x: PAD_X + i * stepX,
    y: PAD_TOP + PLOT_H - ((v - min) / range) * PLOT_H,
    value: v,
  }));

  const linePath = smoothPath(points);
  const first = points[0];
  const last = points[points.length - 1];
  const areaPath = `${linePath} L${r2(last.x)},${r2(PLOT_BOTTOM)} L${r2(first.x)},${r2(PLOT_BOTTOM)} Z`;

  /* Label titik. `labels` (tanggal asli) dipakai bila diteruskan pemanggil.
     Kalau tidak, pakai label PERIODE — bukan tanggal. Series `growth` diisi
     per-transaksi (bukan per hari) dan tidak menyimpan timestamp, jadi
     mengarang tanggal di sini akan menampilkan informasi yang salah. */
  const pointLabels = points.map((_, i) => labels?.[i] ?? `Periode ${i + 1}`);
  const days = values.length;

  const delta = last.value - first.value;
  const trendLabel =
    delta > 0
      ? `naik ${formatCompactIDR(delta)} dalam ${days} periode`
      : delta < 0
        ? `turun ${formatCompactIDR(Math.abs(delta))} dalam ${days} periode`
        : `flat dalam ${days} periode`;

  // --- Titik aktif ----------------------------------------------------------
  const activeIndex = selectedIndex !== null && selectedIndex < points.length ? selectedIndex : null;
  const active = activeIndex !== null ? points[activeIndex] : null;
  const activePrev = activeIndex !== null && activeIndex > 0 ? points[activeIndex - 1] : null;
  const activePercent =
    activePrev && active && activePrev.value !== 0
      ? ((active.value - activePrev.value) / activePrev.value) * 100
      : null;
  const activeDelta = active && activePrev ? active.value - activePrev.value : null;

  /** Geser fokus titik dengan keyboard (satu tab stop, bukan 7). */
  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (points.length === 0) return;
    const move = (next: number) => {
      e.preventDefault();
      setSelectedIndex(Math.min(points.length - 1, Math.max(0, next)));
    };
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        move(activeIndex === null ? 0 : activeIndex + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        move(activeIndex === null ? points.length - 1 : activeIndex - 1);
        break;
      case 'Home':
        move(0);
        break;
      case 'End':
        move(points.length - 1);
        break;
      case 'Escape':
        if (activeIndex !== null) {
          e.preventDefault();
          setSelectedIndex(null);
        }
        break;
      default:
        break;
    }
  }

  return (
    <div
      className="w-full min-w-0 max-w-full outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 rounded-lg"
      tabIndex={0}
      role="group"
      aria-label={`Grafik pertumbuhan portofolio, ${days} periode terakhir, ${trendLabel}. Nilai terakhir ${formatCompactIDR(last.value)} rupiah. Tekan panah kiri atau kanan untuk memilih titik, Escape untuk menutup.`}
      onKeyDown={handleKeyDown}
    >
      {/* ---------- Grafik: rasio viewBox (320:104 = 40:13) dicocokkan dengan
          `aspect` agar `meet` mengisi kotak persis tanpa letterbox.

          Sengaja TIDAK memakai `role="img"`: atribut itu menyuruh pembaca
          layar memperlakukan seluruh SVG sebagai satu gambar dan
          mengabaikan keturunannya — termasuk titik-titik yang bisa diklik.
          Karena itu bagian dekoratif disembunyikan dengan `aria-hidden` di
          grupnya masing-masing, sementara kolom hit-area tetap terekspos
          sebagai `role="button"`. ---------- */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        className="block h-auto w-full max-w-full"
        style={{ aspectRatio: '40 / 13' }}
      >
        <defs aria-hidden="true">
          {/* Satu nada emerald transparan yang sangat halus — tanpa gradien
              berlapis/mesh agar tren terbaca namun tidak mencolok. */}
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* --- Lapisan dekoratif (sembunyi dari pembaca layar) --- */}
        <g aria-hidden="true">
          {/* Latar klik: mengosongkan pilihan saat area grafik lain diketuk. */}
          <rect
            x={0}
            y={0}
            width={W}
            height={H}
            fill="transparent"
            className="cursor-default"
            onClick={() => setSelectedIndex(null)}
          />

          {/* Grid horizontal: proporsi tetap, `non-scaling-stroke` menjaga
            ketebalan tetap hairline di resolusi apa pun. */}
          <g stroke="#cbd5e1" strokeLinecap="round" vectorEffect="non-scaling-stroke">
            {GRID_STEPS.map(step => {
              const y = PLOT_BOTTOM - step * PLOT_H;
              return (
                <line
                  key={step}
                  x1={PAD_X}
                  x2={W - PAD_X}
                  y1={r2(y)}
                  y2={r2(y)}
                  strokeWidth={step === 1 ? 1.25 : 1}
                  strokeDasharray={step === 1 ? undefined : '3 5'}
                  opacity={step === 1 ? 0.9 : 0.55}
                  className="chart-anim"
                />
              );
            })}
          </g>

          {/* Area + garis: `d` dihitung dari data, dianimasikan masuk sekali
            lalu bertransisi mulus setiap `series` berubah. */}
          <path d={areaPath} fill={`url(#${fillId})`} className="chart-area chart-anim" />
          <path
            d={linePath}
            fill="none"
            stroke="#0d9488"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            pathLength={1}
            className="chart-line chart-anim"
          />

          {/* Garis penunjuk vertikal di titik aktif. */}
          {active && (
            <line
              x1={r2(active.x)}
              x2={r2(active.x)}
              y1={r2(active.y)}
              y2={r2(PLOT_BOTTOM)}
              stroke="#047857"
              strokeWidth="1.5"
              strokeDasharray="3 4"
              opacity="0.6"
              vectorEffect="non-scaling-stroke"
              className="chart-anim"
            />
          )}

          {/* Titik data: pasif = inti kecil bertepi putih, aktif = inti besar
            + cincin putih + denyut. */}
          {points.map((p, i) => {
            const isActive = i === activeIndex;
            const isLast = i === points.length - 1;
            return (
              <g key={i}>
                {isActive && (
                  <circle
                    key={`pulse-${i}`}
                    cx={r2(p.x)}
                    cy={r2(p.y)}
                    r="5"
                    fill="#047857"
                    opacity="0.5"
                    className="chart-point-pulse"
                  />
                )}
                <circle
                  cx={r2(p.x)}
                  cy={r2(p.y)}
                  r={isActive ? 5 : isLast ? 3.5 : 2.75}
                  fill={isActive || isLast ? '#0d9488' : '#ffffff'}
                  stroke={isActive ? '#ffffff' : '#0d9488'}
                  strokeWidth={isActive ? 2 : 1.5}
                  vectorEffect="non-scaling-stroke"
                  className="chart-anim"
                />
              </g>
            );
          })}
        </g>

        {/* --- Hit-area interaktif (tetap terekspos ke pembaca layar) --- */}
        {/* Hit-area kolom: SETINGGI PENUH kanvas (0 → H), bukan hanya area
            plot. Padding `px-4` (main) + `p-5` (kartu) + `p-3` (kotak ivory)
            menyisakan hanya ~224px untuk grafik pada viewport 320px, sehingga
            satu kolom 7 titik hanya ~35px. Tinggi penuh menjadikannya
            ~35 × 73px ≈ 2585px² — di atas acuan 44 × 44 = 1936px². Lebar
            kolom tetap = jarak antar titik (batas tengah), jadi zona
            ketuk tidak saling tumpang tindih dan titik terdekat selalu
            menang. Ditumpuk paling atas agar mudah diposisi jarinya. */}
        <g>
          {points.map((p, i) => {
            const colW = Math.min(stepX, W);
            return (
              <rect
                key={`hit-${i}`}
                x={r2(p.x - colW / 2)}
                y={0}
                width={r2(colW)}
                height={H}
                fill="transparent"
                role="button"
                tabIndex={-1}
                aria-pressed={i === activeIndex}
                aria-label={`${pointLabels[i]}: Rp${p.value.toLocaleString('id-ID')}`}
                className="cursor-pointer"
                onClick={() => setSelectedIndex(i === activeIndex ? null : i)}
              />
            );
          })}
        </g>
      </svg>

      {/* ---------- Sumbu X & nilai: HTML, jadi font-size asli (tidak ikut
          diskalakan viewBox) dan responsif lewat breakpoint. ---------- */}
      <div
        className="mt-1 flex items-center justify-between gap-2 text-[10px] leading-tight text-muted sm:text-[11px]"
        style={{ paddingLeft: PAD_RATIO_X, paddingRight: PAD_RATIO_X }}
      >
        <span className={`truncate transition-colors ${activeIndex === 0 ? 'font-semibold text-forest' : ''}`}>
          {pointLabels[0]}
        </span>
        <span className="shrink-0 truncate font-semibold text-brand tabular-nums">
          {formatCompactIDR(last.value)}
        </span>
        <span className={`shrink-0 transition-colors ${activeIndex === days - 1 ? 'font-semibold text-forest' : ''}`}>
          {pointLabels[days - 1]}
        </span>
      </div>

      {/* ---------- Kartu detail: ALUR NORMAL (bukan absolut di atas grafik)
          sehingga mustahil ter-clip di layar sempit. `key` memutar ulang
          animasi masuk setiap kali pindah titik. ---------- */}
      {active && activeIndex !== null && (
        <div
          key={activeIndex}
          role="status"
          aria-live="polite"
          className="chart-card relative mt-2 w-full max-w-full rounded-xl border border-line bg-white px-3 py-2.5 shadow-xs"
        >
          {/* Dentum penunjuk ke titik aktif, di-clamp agar tidak keluar kartu. */}
          <span
            aria-hidden
            className="absolute -top-1.5 h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-line bg-white"
            style={{ left: `clamp(10px, ${(active.x / W) * 100}%, calc(100% - 10px))` }}
          />
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 truncate text-[11px] font-bold text-forest sm:text-xs">
              {pointLabels[activeIndex]}
              {activeIndex === 0 && <span className="ml-1 font-medium text-muted">(awal)</span>}
            </p>
            {activePercent !== null && (
              <span
                className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums sm:text-[11px] ${
                  activePercent > 0
                    ? 'bg-emerald-50 text-brand'
                    : activePercent < 0
                      ? 'bg-rose-50 text-rose-600'
                      : 'bg-slate-100 text-muted'
                }`}
              >
                {formatPercent(activePercent)}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm font-black text-forest tabular-nums sm:text-base">
            Rp{active.value.toLocaleString('id-ID')}
          </p>
          <p className="mt-0.5 text-[10px] text-muted sm:text-[11px]">
            {activeDelta === null || activeDelta === 0
              ? 'Titik awal deret'
              : `${activeDelta > 0 ? '+' : '−'}Rp${Math.abs(activeDelta).toLocaleString('id-ID')} dari periode sebelumnya`}
          </p>
        </div>
      )}

      {/* Petunjuk kecil hanya saat belum ada titik yang dipilih. */}
      {activeIndex === null && (
        <p className="mt-1.5 text-center text-[10px] text-muted sm:text-[11px]">
          Ketuk titik grafik untuk melihat rincian nominal
        </p>
      )}
    </div>
  );
}
