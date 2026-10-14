'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Coffee,
  QrCode,
  ShoppingBasket,
  Sparkles,
  TrendingUp,
  Utensils,
  Wallet,
} from 'lucide-react';
import { calculateRoundUp } from '@/utils/aseta';

/** Indonesian-style rupiah formatter — pure, safe to call during render. */
function formatRp(value: number): string {
  return `Rp${value.toLocaleString('id-ID')}`;
}

interface QrisPreset {
  id: string;
  label: string;
  amount: number;
  Icon: typeof Coffee;
}

/** Fast shopping presets — mirroring typical daily QRIS transactions. */
const QRIS_PRESETS: QrisPreset[] = [
  { id: 'kopi', label: 'Kopi Rp18.200', amount: 18200, Icon: Coffee },
  { id: 'indomaret', label: 'Indomaret Rp43.500', amount: 43500, Icon: ShoppingBasket },
  { id: 'makan', label: 'Makan Siang Rp12.100', amount: 12100, Icon: Utensils },
];

const DEFAULT_AMOUNT = 18200;
const MIN_AMOUNT = 1000;
const MAX_AMOUNT = 100000;
const STEP_AMOUNT = 100;
/** Mascot XP rate: 10 rupiah of round-up = 1 XP. */
const XP_PER_RUPIAH = 10;
/** QRIS round-up always lands on a multiple of this. */
const ROUND_UP_BASE = 5000;
/** Emas Digital share of total savings (the remainder = Reksadana Pasar Uang). */
const GOLD_RATIO = 0.6;

/** Figure that transitions smoothly every time its value changes. */
function AnimatedNumber({ value, className }: { value: string; className?: string }) {
  return (
    <span className={`relative inline-block overflow-hidden align-bottom ${className ?? ''}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ y: '0.7em', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '-0.7em', opacity: 0 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
          className="inline-block whitespace-nowrap tabular-nums"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/**
 * QRIS round-up simulation: the amount can be changed through the input or the
 * slider, then the round-up result and mascot XP update in real time.
 */
export default function QrisRoundUpSimulator() {
  // Stored as a digit-only string → undefined amounts never leak into
  // calculations.
  const [amountText, setAmountText] = useState(String(DEFAULT_AMOUNT));

  const amount = amountText.length > 0 ? Number(amountText) : 0;
  const roundUp = calculateRoundUp(amount);
  const xpGain = Math.round(roundUp / XP_PER_RUPIAH);
  const totalTarget = amount + roundUp;
  // Automatic allocation of the round-up result (identical to the dashboard portfolio split).
  const goldShare = Math.round(roundUp * GOLD_RATIO);
  const reksaShare = roundUp - goldShare;
  const sliderValue = Math.min(MAX_AMOUNT, Math.max(MIN_AMOUNT, amount));
  const displayAmount = amountText.length > 0 ? amount.toLocaleString('id-ID') : '';
  const activePresetId = QRIS_PRESETS.find((preset) => preset.amount === amount)?.id ?? '';

  function handleAmountChange(raw: string) {
    setAmountText(raw.replace(/\D/g, '').slice(0, 7));
  }

  return (
    <section
      aria-labelledby="judul-simulator"
      className="overflow-hidden rounded-3xl border border-line bg-white shadow-xl shadow-forest/5 card-elevate"
    >
      {/* Kepala kartu */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-brand/5 px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-brand text-white touch-target">
            <QrCode className="h-5 w-5" />
          </span>
          <div>
            <h2 id="judul-simulator" className="text-base font-black text-forest sm:text-lg">
              Kalkulator Round-Up QRIS
            </h2>
            <p className="text-xs text-muted">Nominal berubah → tabungan &amp; XP ikut berubah</p>
          </div>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-brand ring-1 ring-brand/20 shrink-0">
          Otomatis tiap transaksi
        </span>
      </div>

      <div className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">
        {/* Preset cepat */}
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Preset cepat</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {QRIS_PRESETS.map(({ id, label, amount: presetAmount, Icon }) => {
              const isActive = activePresetId === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setAmountText(String(presetAmount))}
                  aria-pressed={isActive}
                  className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition-all duration-200 btn-press focus-visible-ring sm:min-h-0 sm:text-sm ${
                    isActive
                      ? 'bg-brand text-white shadow-md shadow-brand/30'
                      : 'bg-ivory text-forest ring-1 ring-line hover:text-brand hover:ring-brand/40'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Nominal belanja */}
        <div>
          <label
            htmlFor="nominal-qris"
            className="text-xs font-bold uppercase tracking-wider text-muted"
          >
            Nominal belanja
          </label>
          <div className="mt-2 flex items-center gap-2 rounded-2xl border border-line bg-ivory px-4 py-3 transition-colors duration-200 focus-within:border-brand focus-within:ring-2 focus-within:ring-emerald-100">
            <span className="text-sm font-black text-muted">Rp</span>
            <input
              id="nominal-qris"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={displayAmount}
              onChange={(event) => handleAmountChange(event.target.value)}
              placeholder="0"
              className="w-full min-w-0 bg-transparent text-xl font-black tabular-nums text-forest input-focus min-h-11"
            />
          </div>
          <input
            type="range"
            min={MIN_AMOUNT}
            max={MAX_AMOUNT}
            step={STEP_AMOUNT}
            value={sliderValue}
            onChange={(event) => setAmountText(event.target.value)}
            aria-label="Geser untuk mengubah nominal belanja"
            className="mt-3 h-11 w-full cursor-pointer accent-brand sm:h-5 touch-target"
          />
          <div className="mt-1 flex justify-between text-[11px] font-medium text-muted">
            <span>Rp1.000</span>
            <span>Rp100.000</span>
          </div>
        </div>

        {/* Hasil real-time */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-brand/20 bg-brand/5 p-4 card-elevate transition-all duration-200">
            <p className="flex items-center gap-1.5 text-xs font-bold text-brand">
              <TrendingUp className="h-4 w-4" />
              Nabung Round-Up
            </p>
            <p className="mt-1.5 text-3xl font-black text-forest transition-colors duration-300">
              <AnimatedNumber value={`+${formatRp(roundUp)}`} />
            </p>
            <p className="mt-1 text-[11px] text-muted">
              Sisa pembulatan ke kelipatan {formatRp(ROUND_UP_BASE)}
            </p>
          </div>
          <div className="rounded-2xl border border-gold/40 bg-gold/10 p-4 card-elevate transition-all duration-200">
            <p className="flex items-center gap-1.5 text-xs font-bold text-amber-700">
              <Sparkles className="h-4 w-4" />
              Maskot XP
            </p>
            <p className="mt-1.5 text-3xl font-black text-forest transition-colors duration-300">
              <AnimatedNumber value={`+${xpGain.toLocaleString('id-ID')} XP`} />
            </p>
            <p className="mt-1 text-[11px] text-muted">{XP_PER_RUPIAH} rupiah = 1 XP untuk Aseta</p>
          </div>
        </div>

        {/* Total yang benar-benar ditabung */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-forest px-4 py-3 text-ivory card-elevate transition-all duration-200">
          <span className="flex items-center gap-2 text-xs font-semibold text-ivory/70">
            <Wallet className="h-4 w-4" />
            Total jadi setelah dibulatkan
          </span>
          <span className="text-xl font-black tabular-nums text-ivory">
            <AnimatedNumber value={formatRp(totalTarget)} />
          </span>
        </div>

        {/* Automatic allocation of the round-up result: 60% Emas Digital · 40% Reksadana */}
        <div className="rounded-2xl border border-line bg-ivory/60 p-4 card-elevate transition-all duration-200">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">
              Alokasi otomatis
            </p>
            <p className="text-[11px] font-semibold text-muted">Emas 60% · Reksadana 40%</p>
          </div>
          <div
            className="mt-2 flex h-2.5 w-full overflow-hidden rounded-full bg-white ring-1 ring-inset ring-line"
            role="img"
            aria-label={`Alokasi tabungan: Emas Digital ${formatRp(goldShare)}, Reksadana Pasar Uang ${formatRp(reksaShare)}`}
          >
            <motion.div
              className="h-full bg-amber-400"
              animate={{ width: '60%' }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
            <div className="h-full w-0.5 bg-white" />
            <motion.div
              className="h-full bg-emerald-500"
              animate={{ width: '40%' }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 text-[11px] font-semibold">
            <span className="flex items-center gap-1 text-amber-700">
              <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" aria-hidden />
              <AnimatedNumber value={formatRp(goldShare)} className="tabular-nums" />
            </span>
            <span className="flex items-center gap-1 text-brand">
              <AnimatedNumber value={formatRp(reksaShare)} className="tabular-nums" />
              <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden />
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
