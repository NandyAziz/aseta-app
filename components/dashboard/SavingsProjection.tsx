'use client';

import { useState } from 'react';
import { TrendingUp } from 'lucide-react';

// ============================================================
// Savings projection (daily compound interest) — constants & pure functions
// ============================================================
export const ANNUAL_RETURN = 0.042; // 4,2% p.a — sama dengan label imbal hasil
export const DAYS_PER_YEAR = 365;
export const PROJECTION_MIN = 5000;
export const PROJECTION_MAX = 50000;
export const PROJECTION_STEP = 1000;
export const PROJECTION_DEFAULT = 10000;
export const PROJECTION_HORIZONS = [1, 3, 5] as const;

/**
 * Estimated total assets after `years` years when depositing `daily` rupiah every
 * day at the given `rate` p.a. Deposits are assumed at the start of each day
 * (annuity due), which makes the result slightly higher than with a simpler
 * assumption. A pure function: safe to call during render.
 */
export function projectSavings(daily: number, years: number, rate: number = ANNUAL_RETURN): number {
  const safeDaily = Math.max(0, Number.isFinite(daily) ? daily : 0);
  const safeYears = Math.max(0, Number.isFinite(years) ? years : 0);
  const dailyRate = rate / DAYS_PER_YEAR;
  const days = Math.round(safeYears * DAYS_PER_YEAR);
  if (days === 0) return 0;
  const growth = Math.pow(1 + dailyRate, days);
  return Math.round(safeDaily * ((growth - 1) / dailyRate) * (1 + dailyRate));
}

/**
 * Full contribution amount for a horizon — `daily × 365 × years`.
 *
 * The `years` factor MUST be included: without it, the "hasil" subtext for the 3-
 * and 5-year horizons would use a 1-year contribution, so `total - contribution`
 * would go negative, be clamped to 0, and the earnings would disappear from the
 * UI.
 */
export function projectContribution(daily: number, years: number): number {
  const safeDaily = Math.max(0, Number.isFinite(daily) ? daily : 0);
  return Math.round(safeDaily * DAYS_PER_YEAR * Math.max(0, years));
}

/**
 * "Proyeksi Tabungan" widget — a simple compound-interest calculator.
 *
 * Local state holds only the slider value (it never touches application
 * finance state); the initial value comes from a constant, so server and
 * client render identically.
 *
 * `bare` is used by the analytics widget (the "Proyeksi" tab) so the card
 * chrome is not nested: the icon header + title are hidden because the tab
 * label already names the widget.
 */
export default function SavingsProjection({
  bare = false,
  className = '',
}: {
  bare?: boolean;
  className?: string;
}) {
  const [daily, setDaily] = useState<number>(PROJECTION_DEFAULT);

  const shellClass = bare
    ? ''
    : 'flex h-full min-w-0 flex-col rounded-2xl border border-line bg-white p-5 card-elevate';

  return (
    <section className={`${shellClass} ${className}`}>
      {!bare && (
        /* Header: emerald→teal gradient icon + return pill. */
        <div className="mb-3 flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-emerald-500 to-teal-600 p-2.5 text-white shadow-sm shadow-emerald-500/20 touch-target">
            <TrendingUp className="h-4.5 w-4.5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-forest">Proyeksi Tabungan</h2>
            <p className="text-xs text-muted">Kalau kamu tabung tiap hari</p>
          </div>
        </div>
      )}

      <div className="mb-1 flex items-baseline justify-between gap-2">
        <label htmlFor="proyeksi-harian" className="text-xs font-bold uppercase tracking-wider text-muted">
          Setoran harian
        </label>
        <span className="flex items-center gap-2">
          {!bare && (
            <span className="rounded-full border border-emerald-200/50 bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 shrink-0">
              +4,2% p.a
            </span>
          )}
          <span className="text-base font-black tabular-nums text-brand shrink-0 transition-colors duration-200">
            Rp{daily.toLocaleString('id-ID')}
          </span>
        </span>
      </div>
      <input
        id="proyeksi-harian"
        type="range"
        min={PROJECTION_MIN}
        max={PROJECTION_MAX}
        step={PROJECTION_STEP}
        value={daily}
        onChange={event => setDaily(Number(event.target.value))}
        aria-label="Geser untuk mengatur setoran harian proyeksi"
        className="h-11 w-full cursor-pointer accent-brand sm:h-5 touch-target"
      />
      <div className="flex justify-between text-[11px] font-medium text-muted">
        <span>Rp{PROJECTION_MIN.toLocaleString('id-ID')}</span>
        <span>Rp{PROJECTION_MAX.toLocaleString('id-ID')}</span>
      </div>

      <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 sm:gap-3">
        {PROJECTION_HORIZONS.map(years => {
          const total = projectSavings(daily, years);
          const gain = Math.max(0, total - projectContribution(daily, years));
          return (
            <li
              key={years}
              className="flex min-w-0 flex-col items-center justify-center overflow-hidden rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-3 sm:px-3 sm:py-4 card-elevate transition-all duration-200"
            >
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted">{years} Tahun</p>
              <p className="mt-0.5 text-[11px] font-extrabold tracking-tight tabular-nums text-emerald-800 leading-tight sm:text-sm lg:text-base min-w-0 break-words overflow-hidden text-ellipsis">
                Rp{total.toLocaleString('id-ID')}
              </p>
              <p className="mt-0.5 text-[10px] font-semibold tabular-nums text-muted sm:text-xs">
                +{gain.toLocaleString('id-ID')} hasil
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}