import { Sparkles, TrendingUp, Wallet } from 'lucide-react';

/**
 * "Total Aset Saya" block — a three-row breakdown plus the primary figure.
 *
 * Permanently lives inside the mascot hero card (not a separate card) so the
 * information hierarchy stays mascot → assets.
 *
 * **Breakpoint-specific:**
 * - Mobile (`< lg`) — the primary figure is NOT repeated here, because it was
 *   moved to the header badge (see `app/dashboard/page.tsx`). What remains is a
 *   roomier breakdown card: full-row stacked lines with larger badge icons,
 *   heavier figures, and balanced padding. All mobile classes come first and
 *   are overridden by `lg:` so the desktop look stays exactly as before.
 * - Desktop (`lg:`) — the primary figure appears in full above the breakdown
 *   (the original structure); the breakdown style reverts to the old compact
 *   version.
 *
 * The header badge uses the exact same figure (`totalWealth`), so there is
 * no different number source between mobile and desktop.
 */
export default function TotalAssetsSummary({
  totalWealth,
  monthlyReturn,
  invested,
  wallet,
  today,
}: {
  totalWealth: number;
  monthlyReturn: number;
  invested: number;
  wallet: number;
  today: number;
}) {
  // A single formatting pass is used for both the header badge and the hero
  // card so the figures on mobile and desktop can never differ.
  const totalLabel = `Rp${totalWealth.toLocaleString('id-ID')}`;

  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-line bg-ivory/60 p-3 lg:gap-1 lg:rounded-xl lg:p-2.5">
      {/* Nominal utama — desktop saja (mobile: badge header). */}
      <div className="hidden lg:block">
        <p className="text-center text-xs font-medium text-muted">Total Aset Saya</p>
        <p className="text-center text-xl font-black tabular-nums whitespace-nowrap text-forest sm:text-2xl lg:text-3xl">
          {totalLabel}
        </p>
      </div>

      {/* Imbal hasil bulanan — tampil di kedua breakpoint. */}
      <p className="text-center text-[11px] font-medium text-muted lg:text-[11px]">
        +Rp{monthlyReturn.toLocaleString('id-ID')} (+4,2% p.a) bulan ini
      </p>

      {/* Breakdown: Tabungan · Saldo Dompet · Hari Ini. Mobile memakai baris
          kartu putih dengan ikon lebih besar; `lg:` mengembalikan baris
          polos versi desktop. */}
      <ul className="mt-1.5 flex flex-col gap-1.5 border-t border-line/70 pt-2 lg:mt-1.5 lg:gap-1 lg:pt-2">
        <li className="flex items-center justify-between gap-3 rounded-xl bg-white/70 px-2.5 py-2 lg:rounded-none lg:bg-transparent lg:p-0">
          <span className="flex min-w-0 items-center gap-2.5 text-[13px] font-medium text-forest lg:gap-1.5 lg:text-xs lg:text-muted">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 lg:h-5 lg:w-5 lg:rounded-md">
              <TrendingUp className="h-4 w-4 text-brand lg:h-3 lg:w-3" aria-hidden />
            </span>
            <span className="truncate">Tabungan</span>
          </span>
          <span className="shrink-0 text-sm font-bold tabular-nums text-forest lg:text-xs lg:font-semibold">
            +Rp{invested.toLocaleString('id-ID')}
          </span>
        </li>
        <li className="flex items-center justify-between gap-3 rounded-xl bg-white/70 px-2.5 py-2 lg:rounded-none lg:bg-transparent lg:p-0">
          <span className="flex min-w-0 items-center gap-2.5 text-[13px] font-medium text-forest lg:gap-1.5 lg:text-xs lg:text-muted">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 lg:h-5 lg:w-5 lg:rounded-md">
              <Wallet className="h-4 w-4 text-sky-500 lg:h-3 lg:w-3" aria-hidden />
            </span>
            <span className="truncate">Saldo Dompet</span>
          </span>
          <span className="shrink-0 text-sm font-bold tabular-nums text-forest lg:text-xs lg:font-semibold">
            Rp{wallet.toLocaleString('id-ID')}
          </span>
        </li>
        <li className="flex items-center justify-between gap-3 rounded-xl bg-white/70 px-2.5 py-2 lg:rounded-none lg:bg-transparent lg:p-0">
          <span className="flex min-w-0 items-center gap-2.5 text-[13px] font-medium text-forest lg:gap-1.5 lg:text-xs lg:text-muted">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 lg:h-5 lg:w-5 lg:rounded-md">
              <Sparkles className="h-4 w-4 text-amber-500 lg:h-3 lg:w-3" aria-hidden />
            </span>
            <span className="truncate">Hari Ini</span>
          </span>
          <span className="shrink-0 text-sm font-bold tabular-nums text-brand lg:text-xs lg:font-semibold">
            +Rp{today.toLocaleString('id-ID')}
          </span>
        </li>
      </ul>
    </div>
  );
}