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
 * Combined analytics widget for MOBILE.
 *
 * "Alokasi Portofolio" and "Proyeksi Tabungan" are merged into a single
 * two-tab card so the main dashboard feed does not stretch awkwardly. On
 * desktop both return as two full cards (see the 7/5 column grid), because a
 * mouse wheel does not need to scroll as short as a swipe.
 *
 * Local tab state is initialised from a constant (`'portofolio'`), so the
 * server render and the first client render are always identical.
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
      {/* Tab bar: two equally wide buttons, touch height ≥ 44px. */}
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
          /* `highlight` is deliberately NOT forwarded to the content: the highlight
             ring is already used by this widget card itself, forwarding it would
             produce two stacked rings. */
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