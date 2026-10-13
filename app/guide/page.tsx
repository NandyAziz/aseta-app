'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, QrCode, ShieldCheck, Sparkles, Wallet } from 'lucide-react';
import { MAX_LEVEL, mascotInfoForLevel, cumulativeXpForLevel } from '@/utils/aseta';
import { MascotStage } from '@/components/MascotAura';

/**
 * Halaman panduan interaktif.
 *
 * Pratinjau maskot memakai komponen `MascotStage` yang SAMA dengan kartu
 * maskot di dashboard — bukan salinan. Jadi slider di sini menampilkan aura,
 * partikel, dan GIF yang persis identik dengan yang dilihat pengguna.
 *
 * GIF, nama tahap, dan rank SEMUA berasal dari `mascotInfoForLevel()` —
 * tidak ada lagi salinan `stageForLevel()` / `LEVEL_TITLES` di file ini,
 * jadi tidak mungkin melenceng dari domain logic.
 *
 * Catatan: level untuk pratinjau TIDAK disimpan ke localStorage. Panduan
 * purely read-only sehingga tidak pernah mengganggu state keuangan asli.
 */

/** Tahapan evolusi untuk label ringkas rentang level. */
const STAGES = [
  { min: 1, max: 3, label: 'Telur' },
  { min: 4, max: 6, label: 'Bayi Naga' },
  { min: 7, max: 10, label: 'Naga Dewasa' },
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
    body: 'Setiap receh otomatis dipecah 60% ke Emas Digital dan 40% ke Reksadana Pasar Uang, lalu tumbuh +/-4,2% per tahun.',
  },
  {
    Icon: Sparkles,
    title: 'XP & Evolusi',
    body: 'Transaksi dan misi harian memberi XP. Makin banyak XP, makin terang aura maskot — dari telur samar sampai emas Legend.',
  },
  {
    Icon: ShieldCheck,
    title: 'Misi Harian & Streak',
    body: 'Tiga misi harian yang bisa diklaim, plus streak yang tetap hidup asal kamu nabung setiap hari.',
  },
] as const;

export default function GuidePage() {
  // Default pratinjau di Lv 1 — kondisi awal yang dilihat pengguna baru.
  const [level, setLevel] = useState(1);

  const stage = STAGES.find((s) => level >= s.min && level <= s.max);
  // Satu panggilan menghasilkan GIF + nama tahap + rank sekaligus, sehingga
  // ketiganya dijamin berasal dari level yang sama.
  const info = mascotInfoForLevel(level);
  const targetXp = cumulativeXpForLevel(level);
  const isMax = level >= MAX_LEVEL;

  return (
    <div className="min-h-screen bg-ivory text-forest antialiased">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link
            href="/dashboard"
            className="flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-muted transition-colors hover:text-forest sm:min-h-0"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Dashboard
          </Link>
          <span className="text-base font-black tracking-tight text-forest">PANDUAN</span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 pb-16 sm:px-6 sm:py-8">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-forest sm:text-2xl">
            Cara kerja Aseta
          </h1>
          <p className="mt-1 text-sm text-muted">
            Geser slider untuk melihat maskot berevolusi dari level 1 sampai 10.
          </p>
        </div>

        {/* ===== Slider Progresi Level ===== */}
        <section className="rounded-2xl border border-line bg-white p-5 sm:p-6">
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <label
              htmlFor="guide-level"
              className="text-xs font-bold uppercase tracking-wider text-muted"
            >
              Level Aseta
            </label>
            <span className="text-sm font-bold tabular-nums text-forest">
              Lv. {level} / {MAX_LEVEL}
            </span>
          </div>

          <input
            id="guide-level"
            type="range"
            min={1}
            max={MAX_LEVEL}
            step={1}
            value={level}
            onChange={e => setLevel(Number(e.target.value))}
            aria-label="Geser untuk melihat evolusi maskot"
            aria-valuetext={`Level ${level}, ${info.name}`}
            className="h-11 w-full cursor-pointer accent-brand sm:h-5"
          />

          {/* Penanda tiap level, sejajar dengan posisi thumb slider. */}
          <div className="flex justify-between px-0.5 text-[10px] font-medium tabular-nums text-muted">
            {Array.from({ length: MAX_LEVEL }, (_, i) => i + 1).map(n => (
              <button
                key={n}
                type="button"
                onClick={() => setLevel(n)}
                aria-label={`Lihat level ${n}`}
                className={`min-w-6 min-h-11 sm:min-h-0 ${level === n ? 'text-forest font-bold' : 'hover:text-brand'}`}
              >
                {n}
              </button>
            ))}
          </div>

          {/* Pratinjau maskot — komponen yang sama dengan dashboard. */}
          <div className="mt-4 rounded-xl border border-line bg-ivory/60 p-4">
            <MascotStage
              gif={info.gif}
              alt={`${info.name} level ${level}`}
              level={level}
              imgClassName="h-32 w-32 sm:h-40 sm:w-40"
            />
            <div className="mt-2 text-center">
              <h2 className="text-lg font-black tracking-tight text-forest">
                {info.name}
              </h2>
              <p className="mt-0.5 text-xs font-bold uppercase tracking-wider text-amber-600">
                {info.title}
              </p>
              <p className="mt-1.5 text-xs text-muted">
                {stage?.label} · {isMax
                  ? 'Evolusi terakhir tercapai'
                  : `${targetXp.toLocaleString('id-ID')} XP kumulatif untuk mencapai level ini`}
              </p>
            </div>
          </div>
        </section>

        {/* ===== Walkthrough Fitur ===== */}
        <section>
          <h2 className="mb-3 text-base font-bold text-forest">Fitur Utama</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {FEATURES.map(({ Icon, title, body }) => (
              <li
                key={title}
                className="flex min-w-0 flex-col rounded-2xl border border-line bg-white p-4"
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

        {/* ===== Navigasi ===== */}
        <section className="flex flex-col gap-2 sm:flex-row">
          <Link
            href="/dashboard"
            className="flex min-h-11 flex-1 items-center justify-center rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-forest transition-colors hover:bg-ivory"
          >
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
            Kembali ke Dashboard
          </Link>
          <Link
            href="/dashboard"
            className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
          >
            <QrCode className="mr-2 h-4 w-4" aria-hidden />
            Coba Scan QRIS
          </Link>
        </section>
      </main>
    </div>
  );
}