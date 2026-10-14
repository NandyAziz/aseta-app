'use client';

import { useId } from 'react';

/* ============================================================================
 * GrowthChart — grafik garis SVG pertumbuhan portofolio 7 hari.
 *
 * Sifat penting:
 * 1. PURE PROPS. Tidak ada state/effect; semua titik, tinggi kurva, dan
 *    koordinat `d` dihitung dari `series` setiap render. Komponen ini dipanggil
 *    DUA KALI bersamaan di dashboard (kartu desktop `hidden lg:block` +
 *    widget mobile `AnalyticsTabs` `lg:hidden`), jadi penanda `id` untuk
 *    gradient dibuat unik lewat `useId()` — bukan `id` hardcoded yang bentrok.
 * 2. FLUID. `viewBox` + `preserveAspectRatio="xMidYMid meet"` + `aspect`
 *    yang persis sama rasionya → skala seragam di 320px sampai lebar desktop,
 *    tanpa gepeng (distorsi), tanpa letterbox, tanpa overflow horizontal.
 * 3. LABEL DI LUAR SVG. Sumbu/teks diletakkan di baris HTML di bawah grafik,
 *    bukan di dalam `viewBox`. Kalau teks ikut diskalakan viewBox, ukurannya
 *    ikut membesar di layar lebar dan ikut terpotong di 320px. Dengan begitu
 *    font benar-benar responsif lewat breakpoint Tailwind dan tidak pernah
 *    ter-clip.
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

export default function GrowthChart({ series }: { series: number[] }) {
  // `useId` bisa memuat karakter non-alnum di beberapa versi React; disaring
  // agar id aman dipakai sebagai referensi `url(#...)` gradient SVG.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const fillId = `growthFill-${uid}`;

  // --- Data → titik (dinamis, mengikuti `series` apa pun yang masuk) --------
  const values = (series.length >= 2 ? series : [0, 0])
    .map(v => (Number.isFinite(v) ? v : 0))
    .slice(0, 31);
  const span = Math.max(1, values.length - 1);

  /* Domain relatif terhadap data + headroom. Menjangkarkan ke 0 (seperti
     `Math.min(...data, 0)`) membuat tren 7 hari yang nilainya jauh dari nol
     menempel di tepi atas dan meninggalkan 3/4 kanvas kosong. Headroom 18%
     menjaga nilai tertinggi & terendah tetap di dalam area plot, dan seri
     datar tetap tergambar sebagai garis di tengah (bukan menempel tepi). */
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

  const delta = last.value - first.value;
  const days = values.length;
  const trendLabel =
    delta > 0
      ? `naik ${formatCompactIDR(delta)} dalam ${days} hari`
      : delta < 0
        ? `turun ${formatCompactIDR(Math.abs(delta))} dalam ${days} hari`
        : `flat dalam ${days} hari`;

  return (
    <div className="w-full min-w-0 max-w-full">
      {/* ---------- Grafik: rasio viewBox (320:104 = 40:13) dicocokkan dengan
          `aspect` agar `meet` mengisi kotak persis tanpa letterbox. ---------- */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        className="block h-auto w-full max-w-full"
        style={{ aspectRatio: '40 / 13' }}
        role="img"
        aria-label={`Grafik pertumbuhan portofolio ${days} hari terakhir, ${trendLabel}. Nilai terakhir ${formatCompactIDR(last.value)} rupiah.`}
      >
        <defs>
          {/* Satu nada emerald transparan yang sangat halus — tanpa gradien
              berlapis/mesh agar tren terbaca namun tidak mencolok. */}
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>

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

        {/* Titik akhir: cincin aura sekali jalan + inti kecil (tanpa glow).
            Jari-jari 4 × skala maks aura 1.8 = 7.2, muat di dalam PAD_X=8 /
            PAD_TOP=18 sehingga tidak pernah terpotong tepi viewBox. */}
        <circle cx={last.x} cy={last.y} r="4" fill="#0d9488" opacity="0.25" className="chart-halo" />
        <circle cx={last.x} cy={last.y} r="3.5" fill="#0d9488" className="chart-anim" />

        {/* Area hover per titik: tooltip native SVG (<title>) — tanpa JS,
            tetap jalan di desktop, dan aman diketuk di layar sentuh. */}
        <g>
          {points.map((p, i) => (
            <circle
              key={i}
              cx={r2(p.x)}
              cy={r2(p.y)}
              r={Math.max(10, stepX / 2)}
              fill="transparent"
              className="chart-anim"
            >
              <title>{`Hari ${i + 1}: Rp${p.value.toLocaleString('id-ID')}`}</title>
            </circle>
          ))}
        </g>
      </svg>

      {/* ---------- Sumbu X & nilai: HTML, jadi font-size asli (tidak ikut
          diskalakan viewBox) dan responsif lewat breakpoint. ---------- */}
      <div
        className="mt-1 flex items-center justify-between gap-2 text-[10px] leading-tight text-muted sm:text-[11px]"
        style={{ paddingLeft: PAD_RATIO_X, paddingRight: PAD_RATIO_X }}
      >
        <span className="truncate">{days} hari lalu</span>
        <span className="shrink-0 truncate font-semibold text-brand tabular-nums">
          {formatCompactIDR(last.value)}
        </span>
        <span className="shrink-0 font-semibold text-forest">Hari ini</span>
      </div>
    </div>
  );
}
