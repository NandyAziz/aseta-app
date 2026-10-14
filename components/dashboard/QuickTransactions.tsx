'use client';

import { Coffee, ShoppingBasket, Utensils } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Quick-transaction presets. `tone` gives each merchant a coloured badge icon of its own
 * (coffee amber, retail blue, food orange) so the list is not a monotonous slab of green
 * and can be told apart instantly.
 */
export interface QuickPreset {
  id: string;
  label: string;
  merchant: string;
  amount: number;
  Icon: LucideIcon;
  tone: string;
}

export const QUICK_PRESETS: readonly QuickPreset[] = [
  {
    id: 'kopi',
    label: 'Kopi Kenangan',
    merchant: 'Kopi Kenangan',
    amount: 18200,
    Icon: Coffee,
    tone: 'bg-amber-100 text-amber-800 border border-amber-200/60 shadow-2xs',
  },
  {
    id: 'indomaret',
    label: 'Indomaret',
    merchant: 'Indomaret',
    amount: 43500,
    Icon: ShoppingBasket,
    tone: 'bg-blue-100 text-blue-700 border border-blue-200/60 shadow-2xs',
  },
  {
    id: 'makan',
    label: 'Makan Siang',
    merchant: 'Makan Siang',
    amount: 12100,
    Icon: Utensils,
    tone: 'bg-orange-100 text-orange-700 border border-orange-200/60 shadow-2xs',
  },
];

/**
 * "Transaksi Cepat" card.
 *
 * MOBILE: a horizontally scrollable row of action chips — the row height stays
 * compact so it does not lengthen the main feed.
 * DESKTOP: a vertical list, because its column is only 5 of the 12 columns,
 * so the chips stack downwards instead of becoming three narrow columns.
 *
 * The button label comes from `actionLabel` ('Tabung' on the Beranda tab,
 * 'Bayar' on the Scan tab) — text only, with neither a literal `->` nor `→`
 * arrow.
 */
export default function QuickTransactions({
  title = 'Transaksi Cepat',
  subtitle = 'Simulasi bayar & recehnya langsung ditabung',
  actionLabel = 'Tabung',
  onSave,
  className = '',
}: {
  title?: string;
  subtitle?: string;
  actionLabel?: string;
  onSave: (preset: QuickPreset) => void;
  className?: string;
}) {
  return (
    <section
      className={`flex w-full min-w-0 max-w-full flex-col rounded-2xl border border-line bg-white p-4 sm:p-5 ${className}`}
    >
      <div className="mb-3">
        <h2 className="text-base font-bold text-forest">{title}</h2>
        <p className="text-xs text-muted">{subtitle}</p>
      </div>

      <ul className="custom-scrollbar flex w-full min-w-0 max-w-full gap-3 overflow-x-auto overscroll-x-contain pb-2 lg:flex-col lg:gap-2 lg:overflow-visible lg:pb-0">
        {QUICK_PRESETS.map(preset => (
          <li
            key={preset.id}
            className="flex w-52 max-w-full shrink-0 snap-start flex-col gap-2 rounded-xl border border-line bg-ivory/70 p-3 transition-colors hover:border-emerald-200 hover:bg-emerald-50/40 lg:w-auto lg:shrink lg:flex-row lg:items-center lg:gap-3 lg:p-2.5"
          >
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              {/* Badge ikon berwarna per merchant — non-monochrome,
                  dengan hover scale halus agar terasa hidup. */}
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 hover:scale-105 ${preset.tone}`}
              >
                <preset.Icon className="h-4.5 w-4.5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-forest">{preset.label}</p>
                <p className="text-xs tabular-nums text-muted">
                  Rp{preset.amount.toLocaleString('id-ID')}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onSave(preset)}
              aria-label={`${actionLabel} di ${preset.label}`}
              className="inline-flex min-h-11 w-full shrink-0 items-center justify-center whitespace-nowrap rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white transition-colors duration-150 hover:bg-brand-dark active:scale-95 lg:min-h-0 lg:w-auto"
            >
              {actionLabel}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}