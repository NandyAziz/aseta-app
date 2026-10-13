'use client';

import { useId, useState } from 'react';
import { ChevronDown, ShieldCheck } from 'lucide-react';
import { MAX_DAILY_CAP, clampDailyCap, formatRupiah } from '@/utils/aseta';

/**
 * Jumlah digit maksimum yang boleh diketik pada input batas harian.
 * 8 digit = nilai `MAX_DAILY_CAP` (Rp10.000.000). Dipakai sebagai `maxLength`
 * nyata karena `type="number"` mengabaikan atribut tersebut — input memakai
 * `type="text" inputMode="numeric"` supaya pembatasannya benar-benar bekerja.
 */
const DAILY_CAP_MAX_DIGITS = String(MAX_DAILY_CAP).length;

/**
 * Kartu "Batas Harian".
 *
 * MOBILE (`collapsible`): dirender sebagai akordeon tertutup secara default
 * supaya feed utama dashboard tetap ringkas. Ringkasan (bar progres + nominal
 * terpakai) tetap terlihat di header ketika tertutup.
 * DESKTOP: selalu terbuka penuh, karena tidak ada tekanan ruang vertikal.
 *
 * Validasi input: hanya digit, maksimum 8 digit, lalu dijepit ke
 * `[0, MAX_DAILY_CAP]` oleh `clampDailyCap` — tidak pernah ada nominal yang
 * meluber keluar batas kartu.
 */
export default function DailyLimit({
  today,
  cap,
  remaining,
  percent,
  exhausted,
  draft,
  onDraftChange,
  onSave,
  collapsible = false,
  className = '',
}: {
  today: number;
  cap: number;
  remaining: number;
  percent: number;
  exhausted: boolean;
  draft: number;
  onDraftChange: (value: number) => void;
  onSave: () => void;
  collapsible?: boolean;
  className?: string;
}) {
  // State lokal akordeon di-init dari konstanta (`false`) → aman untuk hydration.
  const [open, setOpen] = useState<boolean>(false);
  const panelId = useId();
  const expanded = !collapsible || open;

  function handleDraftChange(value: string) {
    const digits = value.replace(/\D+/g, '').slice(0, DAILY_CAP_MAX_DIGITS);
    onDraftChange(clampDailyCap(digits === '' ? 0 : Number(digits)));
  }

  return (
    <section
      className={`flex flex-col rounded-2xl border border-line bg-white p-4 sm:p-5 ${className}`}
    >
      {collapsible ? (
        <button
          type="button"
          onClick={() => setOpen(value => !value)}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <span className="min-w-0">
            <span className="block text-base font-bold text-forest">Batas Harian</span>
            <span className="block text-xs text-muted">
              Terpakai Rp{formatRupiah(today)} dari Rp{formatRupiah(cap)}
            </span>
          </span>
          <ChevronDown
            className={`h-5 w-5 shrink-0 text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </button>
      ) : (
        <div className="mb-3">
          <h2 className="text-base font-bold text-forest">Batas Harian</h2>
          <p className="text-xs text-muted">Batas tabungan maksimal per hari</p>
        </div>
      )}

      {/* Bar progres tetap terlihat meski akordeon tertutup, agar status
          pemakaian hari ini terbaca tanpa harus membuka panel. */}
      <div
        className={`h-2 w-full overflow-hidden rounded-full bg-slate-100 ${
          collapsible ? 'mt-3' : ''
        }`}
      >
        <div
          className="h-full rounded-full bg-brand transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>

      {expanded && (
        <div id={panelId} className="mt-4 flex flex-col gap-4">
          <p className="truncate text-xs font-medium text-muted">
            Terpakai Rp{formatRupiah(today)} dari Rp{formatRupiah(cap)}
          </p>

          {/* Sisa kuota yang masih bisa ditabung hari ini. Bukan dekorasi —
              angkanya ikut terisi real-time. `truncate` menjaga agar nominal
              panjang tetap terpotong rapi di dalam kartu, tidak pernah meluber. */}
          <div className="flex max-w-full items-center justify-between gap-2 overflow-hidden rounded-xl border border-emerald-100/60 bg-emerald-50/50 px-3.5 py-3">
            <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-muted">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />
              <span className="max-w-full truncate">Sisa Limit Tabungan</span>
            </span>
            <span
              className={`min-w-0 max-w-full truncate text-sm font-black tabular-nums ${
                exhausted ? 'text-rose-600' : 'text-brand'
              }`}
              title={`Rp${formatRupiah(remaining)}`}
            >
              Rp{formatRupiah(remaining)}
            </span>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={DAILY_CAP_MAX_DIGITS}
              aria-label="Nominal batas harian"
              aria-describedby={`${panelId}-hint`}
              value={draft}
              onChange={event => handleDraftChange(event.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-line bg-white px-3 py-2.5 text-sm tabular-nums text-forest outline-none transition-colors focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
            <button
              type="button"
              onClick={onSave}
              disabled={draft === cap}
              className="min-h-11 shrink-0 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition-all duration-200 active:scale-95 hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-muted sm:min-h-0"
            >
              Simpan
            </button>
          </div>
          <p id={`${panelId}-hint`} className="-mt-2 text-[11px] text-muted">
            Maksimal {formatRupiah(MAX_DAILY_CAP)} per hari.
          </p>
        </div>
      )}
    </section>
  );
}