import { Sparkles, TrendingUp, Wallet } from 'lucide-react';

/**
 * Blok "Total Aset Saya" — nominal utama + breakdown tiga baris.
 *
 * Tetap berada di dalam kartu hero maskot (bukan kartu terpisah) supaya di
 * mobile fokus visual teratas adalah maskot + total aset, sesuai urutan
 * hierarki informasi. Di desktop blok ini mengisi kolom kiri 7 dari 12.
 *
 * Tanpa badge "Diinvestasikan Otomatis" — tipografi saja sudah cukup
 * menjelaskan konteksnya. Baris breakdown diturunkan hierarkinya (label
 * `text-muted` + nominal lebih redup) agar nominal utama tetap satu-satunya
 * yang menonjol.
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
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-line bg-ivory/60 p-2.5">
      <p className="text-center text-xs font-medium text-muted">Total Aset Saya</p>
      <p className="text-center text-xl font-black tabular-nums whitespace-nowrap text-forest sm:text-2xl lg:text-3xl">
        Rp{totalWealth.toLocaleString('id-ID')}
      </p>
      <p className="text-center text-[11px] font-medium text-muted">
        +Rp{monthlyReturn.toLocaleString('id-ID')} (+4,2% p.a) bulan ini
      </p>
      <div className="mt-1.5 flex flex-col gap-1 border-t border-line/70 pt-2">
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-muted">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-emerald-50">
              <TrendingUp className="h-3 w-3 text-brand" aria-hidden />
            </span>
            <span className="truncate">Tabungan</span>
          </span>
          <span className="shrink-0 text-xs font-semibold tabular-nums text-forest">
            +Rp{invested.toLocaleString('id-ID')}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-muted">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-sky-50">
              <Wallet className="h-3 w-3 text-sky-500" aria-hidden />
            </span>
            <span className="truncate">Saldo Dompet</span>
          </span>
          <span className="shrink-0 text-xs font-semibold tabular-nums text-forest">
            Rp{wallet.toLocaleString('id-ID')}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-muted">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-amber-50">
              <Sparkles className="h-3 w-3 text-amber-500" aria-hidden />
            </span>
            <span className="truncate">Hari Ini</span>
          </span>
          <span className="shrink-0 text-xs font-semibold tabular-nums text-brand">
            +Rp{today.toLocaleString('id-ID')}
          </span>
        </div>
      </div>
    </div>
  );
}