import { Sparkles, TrendingUp, Wallet } from 'lucide-react';

/**
 * Blok "Total Aset Saya" — breakdown tiga baris + nominal utama.
 *
 * Permanen berada di dalam kartu hero maskot (bukan kartu terpisah) supaya
 * urutan hierarki informasi tetap maskot → aset.
 *
 * **Spesifik per breakpoint:**
 * - Mobile (`< lg`) — nominal utama TIDAK diulang di sini karena sudah
 *   dipindahkan ke badge header (lihat `app/dashboard/page.tsx`). Yang
 *   tersisa adalah kartu breakdown yang lebih lega: baris bertumpuk
 *   penuh dengan ikon badge lebih besar, nominal lebih tebal, dan padding
 *   seimbang. Semua class mobile ditulis lebih dulu lalu di-override oleh
 *   `lg:` sehingga tampilan desktop tetap persis seperti semula.
 * - Desktop (`lg:`) — nominal utama tampil penuh di atas breakdown
 *   (struktur asli), gaya breakdown kembali ke versi ringkas yang lama.
 *
 * Badge header memakai nominal yang sama persis (`totalWealth`), jadi
 * tidak ada sumber angka yang berbeda antara mobile dan desktop.
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
  // Satu pemformatan dipakai badge header & kartu hero supaya angka di
  // mobile dan desktop tidak pernah berbeda.
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