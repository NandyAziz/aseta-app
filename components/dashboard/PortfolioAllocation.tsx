import { TrendingUp } from 'lucide-react';
import GrowthChart from './GrowthChart';

/**
 * Contents of "Alokasi Portofolio": the 60/40 split bar, the two share cards,
 * the 7-day chart, and the asset-liquidation button.
 *
 * Designed for TWO contexts without duplicating its contents:
 * - as a complete card (desktop, left column) → `bare` unset;
 * - as the body of the "Portofolio" tab inside the analytics widget (mobile) →
 *   `bare` is set so the card chrome is not nested inside another card.
 *
 * The `data-tour="portfolio"` prop is intentionally placed on the outer element
 * in both contexts: the tour uses `querySelectorAll` + visibility measurements
 * so only the visible element is highlighted.
 */
export default function PortfolioAllocation({
  goldValue,
  reksaValue,
  goldGrams,
  growthSeries,
  onLiquidate,
  bare = false,
  highlight = false,
}: {
  goldValue: number;
  reksaValue: number;
  goldGrams: number;
  growthSeries: number[];
  onLiquidate: () => void;
  bare?: boolean;
  highlight?: boolean;
}) {
  const shellClass = bare
    ? ''
    : 'rounded-2xl border border-line bg-white p-5 card-elevate';
  const ringClass = highlight ? 'relative z-50 ring-4 ring-emerald-400 ring-offset-2' : '';

  return (
    <section data-tour="portfolio" className={`flex flex-col ${shellClass} ${ringClass}`}>
      {!bare && (
        <div className="mb-3">
          <h2 className="text-base font-bold text-forest">Alokasi Portofolio</h2>
          <p className="text-xs text-muted">Pembagian otomatis dari total asetmu</p>
        </div>
      )}

      {/* Split bar 60/40 */}
      <div
        className="flex h-3.5 w-full overflow-hidden rounded-full ring-1 ring-inset ring-line touch-target"
        role="img"
        aria-label="Alokasi aset: Emas Digital 60 persen, Reksadana Pasar Uang 40 persen"
      >
        <div className="h-full bg-amber-400" style={{ width: '60%' }} />
        <div className="h-full w-0.5 bg-white" />
        <div className="h-full flex-1 bg-emerald-500" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3 card-elevate transition-all duration-200">
          <p className="text-xs font-bold text-amber-700">Emas Digital · 60%</p>
          <p className="mt-0.5 text-base font-black tabular-nums wrap-break-word text-forest transition-colors duration-300">
            Rp{goldValue.toLocaleString('id-ID')}
          </p>
          <p className="text-xs text-muted">~{goldGrams.toLocaleString('id-ID', { maximumFractionDigits: 4 })} gram</p>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 card-elevate transition-all duration-200">
          <p className="text-xs font-bold text-brand">Reksadana · 40%</p>
          <p className="mt-0.5 text-base font-black tabular-nums wrap-break-word text-forest transition-colors duration-300">
            Rp{reksaValue.toLocaleString('id-ID')}
          </p>
          <p className="text-xs text-muted">Pasar Uang · likuid</p>
        </div>
      </div>

      {/* Grafik pertumbuhan 7 hari */}
      <div className="mt-4 rounded-xl bg-ivory/60 p-3 card-elevate transition-all duration-200">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">
            Pertumbuhan Aset
          </p>
          <TrendingUp className="h-4 w-4 text-brand" aria-hidden />
        </div>
        <GrowthChart series={growthSeries} />
      </div>

      {/* Pencairan aset: tombol disimpan di bawah konten agar posisinya sama
          di kartu utuh maupun di dalam tab (tanpa header terpisah). */}
      <div className={`flex ${bare ? 'mt-3' : 'mt-4'} justify-end`}>
        <button
          type="button"
          onClick={onLiquidate}
          className="min-h-11 shrink-0 rounded-xl border border-line bg-white px-3.5 py-2 text-xs font-semibold text-forest btn-press hover:border-emerald-300 hover:bg-emerald-50/50 hover:text-brand focus-visible-ring"
        >
          Cairkan Aset
        </button>
      </div>
    </section>
  );
}