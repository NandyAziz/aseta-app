import { TrendingUp } from 'lucide-react';
import GrowthChart from './GrowthChart';

/**
 * Isi "Alokasi Portofolio": bilah split 60/40, dua kartu porsi, grafik
 * pertumbuhan 7 hari, dan tombol pencairan aset.
 *
 * Dirancang dipakai dalam DUA konteks tanpa menduplikasi isi:
 * - sebagai kartu utuh (desktop, kolom kiri) → `bare` kosong;
 * - sebagai isi tab "Portofolio" di widget analitik gabungan (mobile) → `bare`
 *   aktif supaya chrome kartu tidak bersarang di dalam kartu.
 *
 * Props `data-tour="portfolio"` sengaja dipasang pada elemen terluar di kedua
 * konteks;tour memakai `querySelectorAll` + pengukuranvisibility sehingga
 * hanya elemen yang terlihat yang disorot.
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
    : 'rounded-2xl border border-line bg-white p-5';
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
        className="flex h-3 w-full overflow-hidden rounded-full ring-1 ring-inset ring-line"
        role="img"
        aria-label="Alokasi aset: Emas Digital 60 persen, Reksadana Pasar Uang 40 persen"
      >
        <div className="h-full bg-amber-400" style={{ width: '60%' }} />
        <div className="h-full w-0.5 bg-white" />
        <div className="h-full flex-1 bg-emerald-500" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3">
          <p className="text-[11px] font-bold text-amber-700">Emas Digital · 60%</p>
          <p className="mt-0.5 text-sm font-black tabular-nums wrap-break-word text-forest">
            Rp{goldValue.toLocaleString('id-ID')}
          </p>
          <p className="text-[11px] text-muted">
            ~{goldGrams.toLocaleString('id-ID', { maximumFractionDigits: 4 })} gram
          </p>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
          <p className="text-[11px] font-bold text-brand">Reksadana · 40%</p>
          <p className="mt-0.5 text-sm font-black tabular-nums wrap-break-word text-forest">
            Rp{reksaValue.toLocaleString('id-ID')}
          </p>
          <p className="text-[11px] text-muted">Pasar Uang · likuid</p>
        </div>
      </div>

      {/* Grafik pertumbuhan 7 hari */}
      <div className="mt-4 rounded-xl bg-ivory p-3">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
            Pertumbuhan Aset · 7 Hari
          </p>
          <TrendingUp className="h-3.5 w-3.5 text-brand" aria-hidden />
        </div>
        <GrowthChart series={growthSeries} />
      </div>

      {/* Pencairan aset: tombol disimpan di bawah konten agar posisinya sama
          di kartu utuh maupun di dalam tab (tanpa header terpisah). */}
      <div className={`flex ${bare ? 'mt-3' : 'mt-4'} justify-end`}>
        <button
          type="button"
          onClick={onLiquidate}
          className="min-h-11 shrink-0 rounded-xl border border-line bg-white px-3.5 py-2 text-xs font-semibold text-forest transition-all duration-200 active:scale-95 hover:border-emerald-300 hover:bg-emerald-50/50 hover:text-brand sm:min-h-0"
        >
          Cairkan Aset
        </button>
      </div>
    </section>
  );
}