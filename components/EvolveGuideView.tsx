'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { QrCode, ShieldCheck, Sparkles, Wallet } from 'lucide-react';
import { MAX_LEVEL, mascotInfoForLevel, cumulativeXpForLevel } from '@/utils/aseta';
import { MascotStage } from '@/components/MascotAura';

/**
 * Pratinjau evolusi interaktif (Level 1 → 10).
 *
 * Semua data maskot berasal dari `mascotInfoForLevel()` di `utils/aseta.ts`,
 * jadi GIF, nama tahap, rank, dan aura tidak mungkin melenceng dari domain
 * logic — sumber yang sama dengan kartu maskot di tab Beranda.
 *
 * purely read-only: level pratinjau TIDAK menyentuh state keuangan maupun
 * localStorage. Memindahkannya tidak akan mengubah aset pengguna sungguhan.
 */

/** Rentang level per tahap — untuk label ringkas di bawah slider. */
const STAGE_RANGES = [
  { min: 1, max: 3, label: 'Telur' },
  { min: 4, max: 6, label: 'Bayi Naga' },
  { min: 7, max: MAX_LEVEL, label: 'Naga Dewasa' },
] as const;

const FEATURES = [
  {
    Icon: QrCode,
    title: 'Round-Up QRIS',
    body: 'Bayar Rp18.200? Aseta memutar sisa Rp1.800 ke portofoliomu. Kamu tidak perlu mengubah apa pun saat checkout.',
  },
  {
    Icon: Wallet,
    title: 'Auto-Invest 60/40',
    body: 'Setiap receh dipecah 60% ke Emas Digital dan 40% ke Reksadana Pasar Uang, lalu tumbuh +/-4,2% per tahun.',
  },
  {
    Icon: Sparkles,
    title: 'XP & Leveling',
    body: 'Transaksi dan misi harian memberi XP. Makin banyak XP, makin terang aura maskot — dari telur samar sampai emas Legend.',
  },
  {
    Icon: ShieldCheck,
    title: 'Misi & Streak',
    body: 'Tiga misi harian yang bisa diklaim, plus streak yang tetap hidup asal kamu nabung setiap hari.',
  },
] as const;

const LEVELS = Array.from({ length: MAX_LEVEL }, (_, i) => i + 1);

/**
 * Kartu slider + panggung maskot. `className` dipakai pemanggil untuk
 * mengatur lebar kolom di dalam grid dashboard.
 */
function LevelShowcase({ className = '' }: { className?: string }) {
  const [level, setLevel] = useState(1);

  // Satu panggilan → GIF + nama tahap + rank sekaligus, dijamin konsisten.
  const info = mascotInfoForLevel(level);
  const stage = STAGE_RANGES.find((s) => level >= s.min && level <= s.max);
  const xpNeeded = cumulativeXpForLevel(level);
  const isMax = level >= MAX_LEVEL;
  const percent = ((level - 1) / (MAX_LEVEL - 1)) * 100;

  return (
    <section
      className={`flex h-full min-w-0 flex-col rounded-2xl border border-line bg-white p-5 sm:p-6 ${className}`}
    >
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 className="text-base font-bold text-forest">Perjalanan Evolusi</h2>
        <span className="shrink-0 text-sm font-bold tabular-nums text-brand">
          Lv. {level} / {MAX_LEVEL}
        </span>
      </div>
      <p className="text-xs text-muted">Geser untuk melihat bentuk maskot di setiap level.</p>

      {/* Slider 1-10 dengan tick mark yang bisa diklik */}
      <div className="mt-4">
        <input
          id="evolve-level-slider"
          type="range"
          min={1}
          max={MAX_LEVEL}
          step={1}
          value={level}
          onChange={e => setLevel(Number(e.target.value))}
          aria-label="Geser untuk melihat evolusi maskot"
          aria-valuetext={`Level ${level}, ${info.name}, ${info.title}`}
          className="h-11 w-full cursor-pointer accent-brand sm:h-5"
        />
        {/* Tick mark — posisinya evenly sejajar dengan thumb slider. */}
        <div className="flex justify-between px-0.5">
          {LEVELS.map(n => {
            const active = n === level;
            const reached = n <= level;
            return (
              <button
                key={n}
                type="button"
                onClick={() => setLevel(n)}
                aria-label={`Lihat level ${n}`}
                aria-current={active}
                className={`min-w-6 min-h-11 rounded text-[10px] font-semibold tabular-nums transition-colors sm:min-h-0 ${
                  active
                    ? 'text-brand underline decoration-2 underline-offset-4'
                    : reached
                      ? 'text-forest hover:text-brand'
                      : 'text-muted hover:text-brand'
                }`}
              >
                {n}
              </button>
            );
          })}
        </div>
      </div>

      {/* Panggung: aura + partikel + GIF, semua dari level yang dipilih. */}
      <div className="relative mt-3 flex flex-1 flex-col items-center justify-center rounded-2xl border border-line bg-ivory/60 py-5">
        <MascotStage
          gif={info.gif}
          alt={`${info.name} pada level ${level}`}
          level={level}
          imgClassName="h-32 w-32 sm:h-40 sm:w-40"
        />

        {/* Nama & rank berganti halus tiap level berubah. */}
        <div className="mt-2 text-center">
          <motion.h3
            key={info.name}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="text-lg font-black tracking-tight text-forest"
          >
            {info.name}
          </motion.h3>
          <motion.p
            key={info.title}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25, delay: 0.05 }}
            className="mt-0.5 text-xs font-bold uppercase tracking-wider text-amber-600"
          >
            {info.title}
          </motion.p>
        </div>

        <dl className="mt-4 grid w-full max-w-sm grid-cols-3 gap-2 border-t border-line pt-3 text-center">
          <div className="min-w-0">
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">Tahap</dt>
            <dd className="mt-0.5 truncate text-xs font-bold text-forest">{stage?.label}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">Target</dt>
            <dd className="mt-0.5 text-xs font-bold tabular-nums text-forest">
              {isMax ? 'Maks' : xpNeeded.toLocaleString('id-ID')}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">Status</dt>
            <dd className="mt-0.5 text-xs font-bold text-brand">
              {isMax ? 'Legend' : `Lv. ${level}`}
            </dd>
          </div>
        </dl>

        {/* Progress tipis sebagai penanda posisi level pada 1-10. */}
        <div className="mt-3 h-1 w-full max-w-sm overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-brand transition-all duration-300 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </section>
  );
}

/**
 * View "Evolusi & Panduan" — pratinjau level interaktif + walkthrough fitur.
 * Dipakai sebagai tab `evolve` di dalam dashboard (sidebar & header tetap).
 */
export default function EvolveGuideView() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-28 pt-6 sm:px-6 md:pb-10 lg:px-8">
      <div className="mb-5">
        <h1 className="text-lg font-black tracking-tight text-forest sm:text-2xl">
          Evolusi &amp; Panduan
        </h1>
        <p className="mt-0.5 text-xs text-muted sm:text-sm">
          Pahami cara kerja Aseta, lalu intip seperti apa maskotmu di setiap level.
        </p>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-12">
        <LevelShowcase className="lg:col-span-5" />

        {/* Walkthrough fitur — 4 kartu di kolom sisa. */}
        <section className="lg:col-span-7">
          <div className="mb-3">
            <h2 className="text-base font-bold text-forest">Cara Kerja Aseta</h2>
            <p className="text-xs text-muted">Empat konsep inti, singkat dan tanpa jargon.</p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {FEATURES.map(({ Icon, title, body }) => (
              <li
                key={title}
                className="flex min-w-0 flex-col rounded-2xl border border-line bg-white p-4 transition-colors hover:border-emerald-200"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                  <Icon className="h-4 w-4 text-brand" aria-hidden />
                </span>
                <h3 className="mt-2.5 text-sm font-bold text-forest">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}