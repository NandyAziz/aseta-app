'use client';

import { useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { QrCode, ShieldCheck, Sparkles, Wallet } from 'lucide-react';
import { MAX_LEVEL, mascotInfoForLevel, cumulativeXpForLevel } from '@/utils/aseta';
import { MascotStage } from '@/components/MascotAura';

/**
 * Interactive evolution preview (Level 1 → 10).
 *
 * All mascot data comes from `mascotInfoForLevel()` in `utils/aseta.ts`, so the
 * GIF, stage name, rank, and aura can never drift from the domain logic — the
 * same source the mascot card on the Beranda tab uses.
 *
 * purely read-only: the preview level does NOT touch financial state or
 * localStorage. Moving it will not change real user assets.
 */

/** Level range per stage — for the compact label under the slider. */
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
 * Slider card + mascot stage. `className` is used by the caller to set the
 * column width inside the dashboard grid.
 */
function LevelShowcase({ className = '' }: { className?: string }) {
  const [level, setLevel] = useState(1);

  // One call → GIF + stage name + rank at once, guaranteed consistent.
  const info = mascotInfoForLevel(level);
  const stage = STAGE_RANGES.find((s) => level >= s.min && level <= s.max);
  const xpNeeded = cumulativeXpForLevel(level);
  const isMax = level >= MAX_LEVEL;
  const percent = ((level - 1) / (MAX_LEVEL - 1)) * 100;

  return (
    <section
      className={`flex h-full min-w-0 flex-col rounded-2xl border border-line bg-white p-5 sm:p-6 card-elevate ${className}`}
    >
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 className="text-base font-bold text-forest">Perjalanan Evolusi</h2>
        <span className="shrink-0 text-sm font-bold tabular-nums text-brand transition-colors duration-300">
          Lv. {level} / {MAX_LEVEL}
        </span>
      </div>
      <p className="text-xs text-muted">Geser untuk melihat bentuk maskot di setiap level.</p>

      {/* 1-10 slider with clickable tick marks */}
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
          className="h-11 w-full cursor-pointer accent-brand sm:h-5 touch-target"
        />
        {/* Tick mark — horizontally scrollable on mobile so buttons 1–10
            never overflow the card. On desktop they spread evenly. */}
        <div className="mt-2 flex gap-1.5 overflow-x-auto scrollbar-hide px-1 pb-1 -mx-1">
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
                className={`flex-shrink-0 min-w-[36px] min-h-11 rounded-lg text-[10px] font-semibold tabular-nums transition-all duration-200 btn-press focus-visible-ring sm:min-h-0 ${
                  active
                    ? 'bg-brand/10 text-brand underline decoration-2 underline-offset-4 ring-2 ring-brand/30'
                    : reached
                      ? 'text-forest hover:text-brand hover:bg-emerald-50/50'
                      : 'text-muted hover:text-brand hover:bg-emerald-50/50'
                }`}
              >
                {n}
              </button>
            );
          })}
          {/* Spacer to ensure last button (10) can scroll fully into view without being cut off by card edge */}
          <span className="flex-shrink-0 w-8" aria-hidden />
        </div>
      </div>

      {/* Stage: aura + particles + GIF, all from the selected level. */}
      <div className="relative mt-3 flex flex-1 flex-col items-center justify-center rounded-2xl border border-line bg-ivory/60 py-5">
        <MascotStage
          gif={info.gif}
          alt={`${info.name} pada level ${level}`}
          level={level}
          imgClassName="h-32 w-32 sm:h-40 sm:w-40"
        />

        {/* Name & rank transition smoothly whenever the level changes. */}
        <div className="mt-2 text-center">
          <motion.h3
            key={info.name}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="text-lg font-black tracking-tight text-forest"
          >
            {info.name}
          </motion.h3>
          <motion.p
            key={info.title}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05, ease: 'easeOut' }}
            className="mt-0.5 text-xs font-bold uppercase tracking-wider text-amber-600"
          >
            {info.title}
          </motion.p>
        </div>

        <dl className="mt-4 grid w-full max-w-sm grid-cols-3 gap-2 border-t border-line pt-3 text-center">
          <div className="min-w-0">
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">Tahap</dt>
            <dd className="mt-0.5 truncate text-xs font-bold text-forest transition-colors duration-300">{stage?.label}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">Target</dt>
            <dd className="mt-0.5 text-xs font-bold tabular-nums text-forest transition-colors duration-300">
              {isMax ? 'Maks' : xpNeeded.toLocaleString('id-ID')}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">Status</dt>
            <dd className="mt-0.5 text-xs font-bold text-brand transition-colors duration-300">
              {isMax ? 'Legend' : `Lv. ${level}`}
            </dd>
          </div>
        </dl>

        {/* Thin progress bar as a marker of level position on the 1-10 scale. */}
        <div className="mt-3 h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-brand progress-bar-smooth"
            style={{ width: `${percent}%` }}
            role="progressbar"
            aria-valuenow={Math.round(percent)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Kemajuan evolusi ${Math.round(percent)} persen`}
          />
        </div>
      </div>
    </section>
  );
}

/**
 * "Evolusi & Panduan" view — interactive level preview + daily missions + feature walkthrough.
 * Used as the `evolve` tab inside the dashboard (sidebar & header stay).
 *
 * `missions` is a slot (`ReactNode`) holding the "Misi Hari Ini" card assembled
 * in `app/dashboard/page.tsx`: this view stays presentational and never touches
 * financial state. The slot is only used on MOBILE (`lg:hidden`) — placed
 * right below the evolution card. On desktop missions already show in the right
 * Beranda feed column, so this slot is hidden on purpose to avoid duplication.
 */
export default function EvolveGuideView({ missions }: { missions?: ReactNode }) {
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

      <div className="grid flex-1 grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {/* Left column (desktop): mascot evolution status & progress. */}
        <LevelShowcase className="lg:col-span-5" />

        {/* Daily missions — MOBILE ONLY (`lg:hidden`), right below the evolution
            card per document order. On desktop this card already shows in the
            right Beranda column, so it is hidden here. */}
        {missions && <div className="lg:hidden">{missions}</div>}

        {/* Feature walkthrough — 4 cards in the remaining column (desktop), full
            width below on mobile. */}
        <section className="lg:col-span-7">
          <div className="mb-3">
            <h2 className="text-base font-bold text-forest">Cara Kerja Aseta</h2>
            <p className="text-xs text-muted">Empat konsep inti, singkat dan tanpa jargon.</p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {FEATURES.map(({ Icon, title, body }) => (
              <li
                key={title}
                className="flex min-w-0 flex-col rounded-2xl border border-line bg-white p-4 card-elevate transition-all duration-200 hover:border-emerald-200"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 touch-target">
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