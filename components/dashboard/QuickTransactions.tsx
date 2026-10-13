'use client';

import { Coffee, ShoppingBasket, Utensils } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Preset transaksi cepat. `tone` memberi tiap merchant badge ikon berwarna
 * sendiri (kopi amber, ritel biru, kuliner oranye) supaya daftar tidak
 * monoton seragam hijau dan mudah dibedakan sekilas.
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
 * Kartu "Transaksi Cepat".
 *
 * MOBILE: deretan chip aksi yang bisa digeser horizontal — tinggi baris tetap
 * ringkas sehingga tidak menambah panjang feed utama.
 * DESKTOP: daftar vertikal karena kolom kanannya hanya 5 dari 12 kolom,
 * sehingga chip tersusun ke bawah, bukan tiga kolom sempit.
 *
 * Label tombol Coming dari `actionLabel` ('Tabung' di Beranda, 'Bayar' di tab
 * Scan) — memakai teks saja, tanpa panah literal `->` maupun `→`.
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
      className={`flex flex-col rounded-2xl border border-line bg-white p-4 sm:p-5 ${className}`}
    >
      <div className="mb-3">
        <h2 className="text-base font-bold text-forest">{title}</h2>
        <p className="text-xs text-muted">{subtitle}</p>
      </div>

      <ul className="custom-scrollbar flex gap-3 overflow-x-auto pb-1 lg:flex-col lg:gap-2 lg:overflow-visible lg:pb-0">
        {QUICK_PRESETS.map(preset => (
          <li
            key={preset.id}
            className="flex w-52 shrink-0 snap-start flex-col gap-2 rounded-xl border border-line bg-ivory/70 p-3 transition-colors hover:border-emerald-200 hover:bg-emerald-50/40 lg:w-auto lg:shrink lg:flex-row lg:items-center lg:gap-3 lg:p-2.5"
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