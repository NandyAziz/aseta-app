'use client';

import { useId, useState, type KeyboardEvent } from 'react';

/* ============================================================================
 * GrowthChart — SVG line chart of portfolio growth (last 7 snapshots)
 * with clickable/tappable data points.
 *
 * Key properties:
 * 1. PURE PROPS + local interaction state. No `localStorage`, system time,
 *    or randomness during render → SSR-safe & free of hydration mismatch.
 *    `useState` here ONLY stores the currently selected point.
 * 2. FLUID. `viewBox` + `preserveAspectRatio="xMidYMid meet"` + an `aspect`
 *    with exactly the same ratio → uniform scale from 320px up to desktop
 *    width, no squashing (distortion), no letterbox, no horizontal overflow.
 * 3. LABELS OUTSIDE THE SVG. Axes/text live in an HTML row below the chart,
 *    not inside the `viewBox`. If the text were scaled by the viewBox, it
 *    would grow on wide screens and get clipped at 320px.
 * 4. HIT AREA per point is a full-height RECT COLUMN across the plot area
 *    (not a small circle), so the touch target is full width, never
 *    overlapping, and stays ≥ 44px at a 320px viewport for 7 points
 *    (stepX ≈ 50px).
 * 5. The DETAIL CARD uses normal flow (not `absolute` over the chart) so it
 *    can never be clipped on a narrow screen. Its pointer notch is clamped to
 *    the active point, so it still visually "sticks" to its point.
 * ========================================================================== */

/** Virtual canvas. All coordinates are computed relative to this value. */
const W = 320;
const H = 104;
/** Left/right padding of the plot area — the HTML labels use the same ratio (see PAD_RATIO_X). */
const PAD_X = 8;
/** Top space: enough for the peak point's aura ring without leaving the viewBox. */
const PAD_TOP = 18;
/** Bottom space for the X axis labels. */
const PAD_BOTTOM = 18;
const PLOT_H = H - PAD_TOP - PAD_BOTTOM;
const PLOT_BOTTOM = PAD_TOP + PLOT_H;
/** 8 / 320 = 2.5% → used as the label row's padding-x so both align. */
const PAD_RATIO_X = '2.5%';

/** Horizontal grid line ratios (0 = peak, 1 = bottom of the plot area). */
const GRID_STEPS = [0, 0.5, 1];

/** Safe bound for points & curve control points so they stay inside the plot area. */
const clampY = (y: number) => Math.min(PAD_TOP, Math.max(PLOT_BOTTOM, y));
const r2 = (n: number) => n.toFixed(2);

/** Compact Rupiah for axis labels: 1_250_000 → "1,3 jt". */
function formatCompactIDR(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 1 })} M`;
  if (abs >= 1_000_000) return `${(value / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`;
  if (abs >= 1_000) return `${(value / 1e3).toLocaleString('id-ID', { maximumFractionDigits: 0 })} rb`;
  return value.toLocaleString('id-ID');
}

/** Percent with an explicit sign: 1.24 → "+1.24%". */
function formatPercent(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${Math.abs(value).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

/**
 * Catmull-Rom curve → Bezier so the line feels "alive" instead of angular
 * like a polyline. Control points are clamped to the plot area so the curve
 * never spikes outside the box when the data jumps.
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
  /** Label per point (e.g. a date). Optional — see the note below. */
  labels,
}: {
  series: number[];
  labels?: readonly string[];
}) {
  // `useId` may contain non-alphanumeric characters in some React versions;
  // filtered so the id is safe to use as an SVG gradient `url(#...)` reference.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const fillId = `growthFill-${uid}`;

  // Interaction state only: the index of the currently active point, or null.
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // --- Data → points (dynamic, follows whatever `series` comes in) --------
  const values = (series.length >= 2 ? series : [0, 0])
    .map(v => (Number.isFinite(v) ? v : 0))
    .slice(0, 31);
  const span = Math.max(1, values.length - 1);

  /* Domain relative to the data + headroom. Anchoring to 0 (like
     `Math.min(...data, 0)`) makes a trend whose values are far from zero hug
     the top edge and leave 3/4 of the canvas empty. 18% headroom keeps the
     highest & lowest values inside the plot area, and a flat series still
     renders as a line in the middle. */
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

  /* Point labels. `labels` (real dates) are used when the caller passes them.
     Otherwise PERIOD labels are used — not dates. The `growth` series is
     filled per transaction (not per day) and stores no timestamp, so
     inventing dates here would display wrong information. */
  const pointLabels = points.map((_, i) => labels?.[i] ?? `Periode ${i + 1}`);
  const days = values.length;

  const delta = last.value - first.value;
  const trendLabel =
    delta > 0
      ? `naik ${formatCompactIDR(delta)} dalam ${days} periode`
      : delta < 0
        ? `turun ${formatCompactIDR(Math.abs(delta))} dalam ${days} periode`
        : `flat dalam ${days} periode`;

  // --- Active point ------------------------------------------------------------
  const activeIndex = selectedIndex !== null && selectedIndex < points.length ? selectedIndex : null;
  const active = activeIndex !== null ? points[activeIndex] : null;
  const activePrev = activeIndex !== null && activeIndex > 0 ? points[activeIndex - 1] : null;
  const activePercent =
    activePrev && active && activePrev.value !== 0
      ? ((active.value - activePrev.value) / activePrev.value) * 100
      : null;
  const activeDelta = active && activePrev ? active.value - activePrev.value : null;

  /** Move the focused point with the keyboard (one tab stop, not 7). */
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
      {/* ---------- Chart: the viewBox ratio (320:104 = 40:13) is matched with
          `aspect` so `meet` fills the box exactly without a letterbox.

          Deliberately NOT using `role="img"`: that attribute tells screen
          readers to treat the whole SVG as a single image and ignore its
          children — including the clickable points. So the decorative part is
          hidden with `aria-hidden` on its own group, while the hit-area
          columns stay exposed as `role="button"`. ---------- */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        className="block h-auto w-full max-w-full"
        style={{ aspectRatio: '40 / 13' }}
      >
        <defs aria-hidden="true">
          {/* A single, very subtle transparent emerald tone — no layered/mesh
              gradient, so the trend stays readable without standing out. */}
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* --- Decorative layer (hidden from screen readers) --- */}
        <g aria-hidden="true">
          {/* Click backdrop: clears the selection when any other part of the chart is tapped. */}
          <rect
            x={0}
            y={0}
            width={W}
            height={H}
            fill="transparent"
            className="cursor-default"
            onClick={() => setSelectedIndex(null)}
          />

          {/* Horizontal grid: fixed proportions, `non-scaling-stroke` keeps the
            thickness a hairline at any resolution. */}
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

          {/* Area + line: `d` is computed from the data, animated in once
            then transitions smoothly on every `series` change. */}
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

          {/* Vertical pointer line at the active point. */}
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

          {/* Data points: inactive = small core with a white edge, active = large
            core + white ring + pulse. */}
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
