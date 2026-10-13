'use client';

import { useState } from 'react';
import { TrendingUp } from 'lucide-react';

// ============================================================
// Proyeksi tabungan (bunga majemuk harian) — konstanta & fungsi murni
// ============================================================
export const ANNUAL_RETURN = 0.042; // 4,2% p.a — sama dengan label imbal hasil
export const DAYS_PER_YEAR = 365;
export const PROJECTION_MIN = 5000;
export const PROJECTION_MAX = 50000;
export const PROJECTION_STEP = 1000;
export const PROJECTION_DEFAULT = 10000;
export const PROJECTION_HORIZONS = [1, 3, 5] as const;

/**
 * Estimasi total aset setelah `years` tahun bila menyetor `daily` rupiah tiap
 * hari dengan bunga `rate` p.a. Setoran dianggap terjadi di awal setiap hari
 * (annuity due), sehingga hasil sedikit lebih tinggi daripada asumsi sederhana.
 * Fungsi murni: aman dipanggil saat render.
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
 * Total setoran penuh untuk sebuah horizon — `daily × 365 × years`.
 *
 * Faktor `years` wajib ikut: tanpa itu, subteks "hasil" untuk horizon 3 dan 5
 * tahun akan menghitung setoran 1 tahun saja sehingga `total - contribution`
 * negatif lalu di-clamp ke 0 dan hasil bunga lenyap dari tampilan.
 */
export function projectContribution(daily: number, years: number): number {
  const safeDaily = Math.max(0, Number.isFinite(daily) ? daily : 0);
  return Math.round(safeDaily * DAYS_PER_YEAR * Math.max(0, years));
}

/**
 * Widget "Proyeksi Tabungan" — kalkulator bunga majemuk sederhana.
 *
 * State lokal slider saja (tidak menyentuh state keuangan aplikasi), nilai
 * awal berasal dari konstanta sehingga render server & klien identik.
 *
 * `bare` dipakai widget analitik gabungan (tab "Proyeksi") agar chrome kartu
 * tidak bersarang: header ikon + judul disembunyikan karena label tab sudah
 * menyebut nama widgetnya.
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
    : 'flex h-full min-w-0 flex-col rounded-2xl border border-line bg-white p-5';

  return (
    <section className={`${shellClass} ${className}`}>
      {!bare && (
        /* Header: ikon gradien emerald→teal + pill imbal hasil. */
        <div className="mb-3 flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-emerald-500 to-teal-600 p-2.5 text-white shadow-sm shadow-emerald-500/20">
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
            <span className="rounded-full border border-emerald-200/50 bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
              +4,2% p.a
            </span>
          )}
          <span className="text-sm font-black tabular-nums text-brand">
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
        className="h-11 w-full cursor-pointer accent-brand sm:h-5"
      />
      <div className="flex justify-between text-[11px] font-medium text-muted">
        <span>Rp{PROJECTION_MIN.toLocaleString('id-ID')}</span>
        <span>Rp{PROJECTION_MAX.toLocaleString('id-ID')}</span>
      </div>

      <ul className="mt-3 grid grid-cols-3 gap-1 sm:gap-3">
        {PROJECTION_HORIZONS.map(years => {
          const total = projectSavings(daily, years);
          const gain = Math.max(0, total - projectContribution(daily, years));
          return (
            <li
              key={years}
              className="flex min-w-0 flex-col items-center justify-center overflow-hidden rounded-xl border border-emerald-100 bg-emerald-50/60 px-1 py-2 text-center sm:px-3 sm:py-3"
            >
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted">{years} Tahun</p>
              <p className="mt-0.5 text-[13px] font-extrabold tracking-tighter tabular-nums whitespace-nowrap text-emerald-800 leading-tight sm:text-sm">
                Rp{total.toLocaleString('id-ID')}
              </p>
              <p className="mt-0.5 text-[9px] font-semibold tabular-nums text-muted whitespace-nowrap sm:text-[10px]">
                +{gain.toLocaleString('id-ID')} hasil
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}