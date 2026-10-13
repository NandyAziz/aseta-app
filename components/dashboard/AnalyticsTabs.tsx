'use client';

import { useState } from 'react';
import PortfolioAllocation from './PortfolioAllocation';
import SavingsProjection from './SavingsProjection';

type AnalyticsTab = 'portofolio' | 'proyeksi';

const ANALYTICS_TABS: ReadonlyArray<{ id: AnalyticsTab; label: string }> = [
  { id: 'portofolio', label: 'Portofolio' },
  { id: 'proyeksi', label: 'Proyeksi' },
];

/**
 * Widget analitik gabungan untuk MOBILE.
 *
 * "Alokasi Portofolio" dan "Proyeksi Tabungan" digabung ke dalam satu kartu
 * dua tab sehingga feed utama dashboard tidak grewuh memanjang. Di desktop
 * keduanya kembali tampil sebagai dua kartu penuh (lihat grid 7/5 kolom),
 * karena wheel mouse tidak perlu menggulir sesingkat swipe.
 *
 * State tab lokal di-init dari konstan (`'portofolio'`), jadi render server
 * dan render pertama klien selalu identik.
 */
export default function AnalyticsTabs({
  goldValue,
  reksaValue,
  goldGrams,
  growthSeries,
  onLiquidate,
  highlight = false,
  className = '',
}: {
  goldValue: number;
  reksaValue: number;
  goldGrams: number;
  growthSeries: number[];
  onLiquidate: () => void;
  highlight?: boolean;
  className?: string;
}) {
  const [tab, setTab] = useState<AnalyticsTab>('portofolio');

  return (
    <section
      className={`rounded-2xl border border-line bg-white p-4 sm:p-5 ${
        highlight ? 'relative z-50 ring-4 ring-emerald-400 ring-offset-2' : ''
      } ${className}`}
    >
      {/* Bilah tab: dua tombol sama lebar, tinggi sentuh ≥ 44px. */}
      <div
        role="tablist"
        aria-label="Analitik aset"
        className="grid grid-cols-2 gap-1 rounded-xl bg-ivory p-1"
      >
        {ANALYTICS_TABS.map(item => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`analytics-tab-${item.id}`}
              aria-selected={active}
              aria-controls={`analytics-panel-${item.id}`}
              onClick={() => setTab(item.id)}
              className={`min-h-11 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                active
                  ? 'bg-white text-brand shadow-xs ring-1 ring-line'
                  : 'text-muted hover:text-forest'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`analytics-panel-${tab}`}
        aria-labelledby={`analytics-tab-${tab}`}
        className="mt-4"
      >
        {tab === 'portofolio' ? (
          /* `highlight` sengaja TIDAK diteruskan ke isi: cincin sorot sudah
             dipakai oleh kartu widget ini sendiri, meneruskanya akan membuat
             dua cincin bertumpuk. */
          <PortfolioAllocation
            bare
            goldValue={goldValue}
            reksaValue={reksaValue}
            goldGrams={goldGrams}
            growthSeries={growthSeries}
            onLiquidate={onLiquidate}
          />
        ) : (
          <SavingsProjection bare />
        )}
      </div>
    </section>
  );
}