'use client';

import { useState, useSyncExternalStore, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { Coffee, ShoppingBasket, Utensils, Wallet, TrendingUp, ShieldCheck, HelpCircle, Home, QrCode, History, X, RotateCcw, Sparkles, Search } from "lucide-react";
import confetti from 'canvas-confetti';
import { calculateRoundUp, getMascotLevel, getXpProgress, MAX_LEVEL, LEVEL_TARGETS, LEVEL_TITLES, GREET_TAP_TARGET } from '@/utils/aseta';
import { playTapSound, playCoinSound, playLevelUpSound, playLimitSound } from '@/utils/sound';
import type { MascotExpression } from '@/utils/aseta';
import type { Transaction, SavingsState } from '@/types';

type TabId = 'home' | 'scan' | 'history' | 'evolve';

const STORAGE_KEY = 'aseta-savings-state';
// Key terpisah untuk melacak tanggal aktif terakhir → pemicu auto-reset harian.
const LAST_ACTIVE_KEY = 'aseta_last_active_date';
const DEFAULT_WALLET_BALANCE = 2500000;
const INITIAL_STATE: SavingsState = {
  balance: 0,
  dailyCap: 20000,
  todaySavings: 0,
  history: [],
  walletBalance: DEFAULT_WALLET_BALANCE,
  streak: 0,
  lastActiveDate: '',
  quests: {
    date: '',
    qrisDone: false,
    qrisClaimed: false,
    depositClaimed: false,
    greetCount: 0,
    greetClaimed: false,
  },
  growth: [],
};

// Preset transaksi cepat. `tone` memberi tiap merchant badge ikon berwarna
// sendiri (kopi amber, ritel biru, kuliner oranye) supaya daftar tidak
// monoton seragam hijau dan mudah dibedakan sekilas.
const QUICK_PRESETS = [
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
] as const;

// Pesan dynamic pet speech bubble — diputar saat maskot di-tap
const PET_LINES = [
  'Uang kembalianmu udah aku putar ke Emas Digital ya! 🐉✨',
  'Semakin rajin nabung, semakin cepat aku evolusi!',
  'Asetmu aman, aku jagain terus 24/7!',
  'Zzz... 🥚',
  'Yuk scan struk lagi, tinggal sedikit lagi ke level berikutnya!',
] as const;

const GOLD_GRAM_PRICE = 1_200_000; // simulasi harga emas Rp/gram

// ============================================================
// Proyeksi tabungan (bunga majemuk harian) — fungsi murni
// ============================================================
const ANNUAL_RETURN = 0.042; // 4,2% p.a — sama dengan label imbal hasil
const DAYS_PER_YEAR = 365;
const PROJECTION_MIN = 5000;
const PROJECTION_MAX = 50000;
const PROJECTION_STEP = 1000;
const PROJECTION_DEFAULT = 10000;
const PROJECTION_HORIZONS = [1, 3, 5] as const;

/**
 * Estimasi total aset setelah `years` tahun bila menyetor `daily` rupiah tiap
 * hari dengan bunga `rate` p.a. Setoran dianggap terjadi di awal setiap hari
 * (annuity due), sehingga hasil sedikit lebih tinggi daripada asumsi sederhana.
 * Fungsi murni: aman dipanggil saat render.
 */
function projectSavings(daily: number, years: number, rate: number = ANNUAL_RETURN): number {
  const safeDaily = Math.max(0, Number.isFinite(daily) ? daily : 0);
  const safeYears = Math.max(0, Number.isFinite(years) ? years : 0);
  const dailyRate = rate / DAYS_PER_YEAR;
  const days = Math.round(safeYears * DAYS_PER_YEAR);
  if (days === 0) return 0;
  const growth = Math.pow(1 + dailyRate, days);
  return Math.round(safeDaily * ((growth - 1) / dailyRate) * (1 + dailyRate));
}

// Balasan maskot saat tap harian sudah melewati batas GREET_TAP_TARGET —
// tetap ramah, tidak menghakimi, dan memberi arahan tastyuk berikutnya.
const PET_LINES_LIMIT = [
  'Aku udah kekenjangan sapa hari ini, deh! 😴',
  'Batas sapa hari ini habis — tapi maskotmu tetap senang kok!',
  'Oke, cukup sapa buat hari ini. Yuk, tabung receh! 🐉',
] as const;

// Konfigurasi stage evolusi maskot (3 fase × 10 level).
// gif mengikuti aset yang sudah ada di proyek (tidak diganti).
const EVOLUTION_STAGES = [
  { stage: 'Telur Aseta', range: 'Lv 1 – 3', gif: '/mascot-egg.gif', emoji: '🥚', tint: 'bg-amber-50 text-amber-600', minLevel: 1, maxLevel: 3 },
  { stage: 'Bayi Naga', range: 'Lv 4 – 6', gif: '/mascot-baby.gif', emoji: '🐣', tint: 'bg-emerald-50 text-brand', minLevel: 4, maxLevel: 6 },
  { stage: 'Naga Dewasa', range: 'Lv 7 – 9', gif: '/mascot-adult.gif', emoji: '🐉', tint: 'bg-sky-50 text-sky-600', minLevel: 7, maxLevel: 9 },
] as const;

function isValidSavingsState(obj: unknown): obj is SavingsState {
  if (typeof obj !== 'object' || obj === null) return false;
  const s = obj as Partial<SavingsState>;
  return (
    typeof s.balance === 'number' &&
    typeof s.dailyCap === 'number' &&
    typeof s.todaySavings === 'number' &&
    Array.isArray(s.history)
  );
}

// Pembuatan transaksi dipindah ke module scope agar bebas dari aturan
// kesucian (purity) React Compiler — hanya dipanggil dari event handler.
function buildTransaction(tx: Omit<Transaction, 'id' | 'timestamp' | 'date'>): Transaction {
  return {
    ...tx,
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    date: new Date().toLocaleDateString('id-ID'),
  };
}

// ============================================================
// Efek suara sintetis (Web Audio API, tanpa file mp3) dipusatkan
// di utils/sound.ts supaya tidak diduplikasi antar halaman.
// ============================================================

// ============================================================
// Utilitas tanggal (YYYY-MM-DD) untuk streak & reset misi harian
// ============================================================
function todayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function daysBetween(aKey: string, bKey: string): number {
  const a = new Date(`${aKey}T00:00:00`);
  const b = new Date(`${bKey}T00:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

// Snapshot pertumbuhan portofolio 7 hari (simulasi deterministik berbasis balance)
function buildGrowthSeries(balance: number): number[] {
  const pts = 7;
  const base = Math.max(0, balance);
  // Kurva naik lembut menuju balance saat ini (gradien ~ +1.1%/hari)
  const series: number[] = [];
  for (let i = 0; i < pts; i++) {
    const factor = 1 - (pts - 1 - i) * 0.011;
    series.push(Math.max(0, Math.round(base * factor)));
  }
  series[pts - 1] = base;
  return series;
}

// Normalisasi state dari localStorage (migrasi field baru dengan aman)
function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

// Bentuk state saat ganti hari: akumulator harian & misi di-reset ke awal,
// sementara data persisten (balance, dompet, riwayat, streak, growth) dipertahankan.
// date quest diset ke hari baru agar checklist akurat.
function applyDailyReset(prev: SavingsState, today: string): SavingsState {
  return {
    ...prev,
    todaySavings: 0,
    quests: { ...INITIAL_STATE.quests, date: today },
  };
}

// Simpan tanggal aktif terakhir ke key terpisah (dipanggil dari event handler,
// bukan saat render → aman dari aturan purity). Abaikan bila localStorage diblokir.
function persistLastActive(today: string) {
  try {
    localStorage.setItem(LAST_ACTIVE_KEY, today);
  } catch {
    /* localStorage tidak tersedia — cukup andalkan state di memori */
  }
}

function normalizeState(parsed: SavingsState): SavingsState {
  return {
    ...INITIAL_STATE,
    ...parsed,
    balance: Math.max(0, num(parsed.balance, 0)),
    dailyCap: Math.max(0, num(parsed.dailyCap, INITIAL_STATE.dailyCap)),
    todaySavings: Math.max(0, num(parsed.todaySavings, 0)),
    walletBalance: Math.max(0, num(parsed.walletBalance, DEFAULT_WALLET_BALANCE)),
    quests: { ...INITIAL_STATE.quests, ...(parsed.quests ?? {}) },
    growth: Array.isArray(parsed.growth)
      ? parsed.growth.map((v) => Math.max(0, num(v, 0))).slice(-7)
      : [],
    history: Array.isArray(parsed.history) ? parsed.history : [],
    streak: Math.max(0, Math.floor(num(parsed.streak, 0))),
    lastActiveDate: typeof parsed.lastActiveDate === 'string' ? parsed.lastActiveDate : '',
  };
}

// Aura progresif panggung maskot berdasarkan level (1-10).
// Bersifat LEMBAB & natural: hanya backlight glow rendah-opacity, ring tipis,
// dan scale sangat halus. Tidak ada garis kasar / stiker — menghormati ilustrasi.
function mascotAura(level: number): {
  glow: string;
  glowAnim: string;
  ring: string;
  scale: string;
  breathe: string;
  imgShadow: string;
} {
  // Lv 10 — Sultan Aseta: aura emas + cyan berlapis, denyut, backlight maksimal.
  if (level >= 10) {
    return {
      glow: 'bg-gold/45 blur-2xl shadow-[0_0_46px_10px_rgba(229,180,84,0.45),0_0_90px_22px_rgba(34,211,238,0.28)]',
      glowAnim: 'animate-aura-breathe',
      ring: 'ring-2 ring-amber-200/70 ring-offset-2 ring-offset-white',
      scale: 'scale-[1.06]',
      breathe: '',
      imgShadow: 'drop-shadow-[0_0_22px_rgba(229,180,84,0.55)] drop-shadow-[0_0_10px_rgba(34,211,238,0.35)]',
    };
  }
  // Lv 9 — Aseta Legend: emas terang + aksen cyan, denyut aktif.
  if (level >= 9) {
    return {
      glow: 'bg-gold/38 blur-2xl shadow-[0_0_38px_8px_rgba(229,180,84,0.38),0_0_72px_16px_rgba(34,211,238,0.22)]',
      glowAnim: 'animate-aura-breathe',
      ring: 'ring-2 ring-amber-200/60 ring-offset-2 ring-offset-white',
      scale: 'scale-[1.05]',
      breathe: '',
      imgShadow: 'drop-shadow-[0_0_18px_rgba(229,180,84,0.45)] drop-shadow-[0_0_8px_rgba(34,211,238,0.28)]',
    };
  }
  // Lv 8 — Naga Dewasa kematangan: emas pekat, backlight kuat berlapis.
  if (level >= 8) {
    return {
      glow: 'bg-gold/32 blur-xl shadow-[0_0_30px_6px_rgba(229,180,84,0.32)]',
      glowAnim: 'animate-aura-breathe',
      ring: 'ring-1 ring-amber-200/55 ring-offset-2 ring-offset-white',
      scale: 'scale-[1.04]',
      breathe: '',
      imgShadow: 'drop-shadow-[0_0_14px_rgba(229,180,84,0.34)]',
    };
  }
  // Lv 7 — Naga Dewasa: emas masuk, multi-layer baru mulai terasa.
  if (level >= 7) {
    return {
      glow: 'bg-amber-400/28 blur-xl shadow-[0_0_22px_4px_rgba(245,158,11,0.28)]',
      glowAnim: '',
      ring: 'ring-1 ring-amber-200/50 ring-offset-2 ring-offset-white',
      scale: 'scale-[1.03]',
      breathe: '',
      imgShadow: 'drop-shadow-[0_0_12px_rgba(245,158,11,0.28)]',
    };
  }
  // Lv 6 — Bayi Naga melanapas: emerald kuat, aura melebar, skala naik.
  if (level >= 6) {
    return {
      glow: 'bg-emerald-400/30 blur-lg shadow-[0_0_20px_4px_rgba(52,211,153,0.26)]',
      glowAnim: '',
      ring: 'ring-1 ring-emerald-200/55 ring-offset-2 ring-offset-white',
      scale: 'scale-[1.03]',
      breathe: '',
      imgShadow: 'drop-shadow-[0_0_10px_rgba(16,185,129,0.28)]',
    };
  }
  // Lv 5 — Bayi Naga: emerald mulai menyala, cincin lebih tegas.
  if (level >= 5) {
    return {
      glow: 'bg-brand/30 blur-lg shadow-[0_0_16px_3px_rgba(4,120,87,0.24)]',
      glowAnim: '',
      ring: 'ring-1 ring-emerald-200/50 ring-offset-2 ring-offset-white',
      scale: '',
      breathe: '',
      imgShadow: 'drop-shadow-[0_0_8px_rgba(4,120,87,0.24)]',
    };
  }
  // Lv 4 — Bayi Naga menetas: backlight emerald pertama yang terasa.
  if (level >= 4) {
    return {
      glow: 'bg-brand/22 blur-lg',
      glowAnim: '',
      ring: 'ring-1 ring-emerald-200/45 ring-offset-2 ring-offset-white',
      scale: '',
      breathe: '',
      imgShadow: 'drop-shadow-md',
    };
  }
  // Lv 3 — Telur siap menetas: aura sage lebih terang + "bernapas".
  if (level >= 3) {
    return {
      glow: 'bg-sage/28 blur-lg',
      glowAnim: '',
      ring: 'ring-1 ring-slate-200/60 ring-offset-2 ring-offset-white',
      scale: '',
      breathe: 'animate-egg-breathe',
      imgShadow: 'drop-shadow-md',
    };
  }
  // Lv 2 — Telur: backlight sage tipis + "bernapas" halus.
  if (level >= 2) {
    return {
      glow: 'bg-sage/18 blur-xl',
      glowAnim: '',
      ring: 'ring-1 ring-line ring-offset-2 ring-offset-white',
      scale: '',
      breathe: 'animate-egg-breathe',
      imgShadow: 'drop-shadow-md',
    };
  }
  // Lv 1 — Telur utuh polos: aura sangat samar, tanpa denyut.
  return {
    glow: 'bg-slate-50/50 blur-xl',
    glowAnim: '',
    ring: 'ring-1 ring-line ring-offset-2 ring-offset-white',
    scale: '',
    breathe: '',
    imgShadow: 'drop-shadow-md',
  };
}

// Konstanta posisi debu atmosferik (module scope → lolos purity React Compiler).
// Titik-titik kecil & sangat samar yang melayang lambat di BELAKANG maskot,
// untuk membangkitkan kesan hidup tanpa menutupi ilustrasi.
const AURA_DUST = [
  { id: 'd1', left: '10%', bottom: '16%', size: 4, delay: 0 },
  { id: 'd2', left: '26%', bottom: '30%', size: 3, delay: 0.9 },
  { id: 'd3', left: '70%', bottom: '22%', size: 4, delay: 1.6 },
  { id: 'd4', left: '86%', bottom: '38%', size: 3, delay: 0.5 },
  { id: 'd5', left: '46%', bottom: '12%', size: 3, delay: 2.1 },
  { id: 'd6', left: '58%', bottom: '44%', size: 3, delay: 1.2 },
] as const;

// Titik "percikan" sangat lembut untuk telur siap menetas (Lv 3).
const EMBER_SPARKS = [
  { id: 's1', left: '18%', bottom: '26%', size: 3, delay: 0 },
  { id: 's2', left: '78%', bottom: '34%', size: 2, delay: 0.7 },
  { id: 's3', left: '52%', bottom: '18%', size: 3, delay: 1.3 },
  { id: 's4', left: '34%', bottom: '52%', size: 2, delay: 1.9 },
] as const;

// Warna debu atmosferik per rentang level.
type DustTone = 'sage' | 'emerald' | 'gold' | 'cyan';
function dustToneForLevel(level: number): DustTone | null {
  if (level >= 9) return 'cyan';   // Lv 9-10 — legend/sultan: debu cyan
  if (level >= 7) return 'gold';   // Lv 7-8 — naga dewasa: debu emas hangat
  if (level >= 4) return 'emerald'; // Lv 4-6 — bayi naga: partikel emerald
  if (level >= 2) return 'sage';   // Lv 2-3 — telur: percikan sage/silver
  return null;                      // Lv 1 — tanpa debu tambahan
}

// Profil intensitas partikel per level: berapa banyak, seberapa cepat, seberapa
// terang, dan seberapa jauh mereka melayang. Level naik → jumlah & kecepatan naik.
interface MoteProfile {
  count: number;   // jumlah partikel aktif (dipotong dari AURA_DUST)
  duration: number; // detik per satu siklus melayang
  peakOpacity: number; // opacity puncak saat partikel paling terang
  rise: number;    // jarak naik (px) — makin tinggi level, makin jauh partikel melayang
  sparks: boolean; // apakah percikan ember aktif
  sizeBoost: number; // pengali ukuran titik
}

const MOTE_PROFILES: Record<number, MoteProfile> = {
  1: { count: 2, duration: 9.0, peakOpacity: 0.14, rise: 10, sparks: false, sizeBoost: 0.8 },
  2: { count: 3, duration: 8.4, peakOpacity: 0.20, rise: 13, sparks: false, sizeBoost: 0.85 },
  3: { count: 4, duration: 7.6, peakOpacity: 0.26, rise: 16, sparks: true, sizeBoost: 0.9 },
  4: { count: 4, duration: 7.0, peakOpacity: 0.30, rise: 19, sparks: false, sizeBoost: 1 },
  5: { count: 5, duration: 6.4, peakOpacity: 0.34, rise: 22, sparks: false, sizeBoost: 1 },
  6: { count: 6, duration: 5.8, peakOpacity: 0.38, rise: 25, sparks: true, sizeBoost: 1.05 },
  7: { count: 6, duration: 5.2, peakOpacity: 0.42, rise: 28, sparks: true, sizeBoost: 1.1 },
  8: { count: 6, duration: 4.6, peakOpacity: 0.46, rise: 31, sparks: true, sizeBoost: 1.15 },
  9: { count: 6, duration: 4.0, peakOpacity: 0.52, rise: 35, sparks: true, sizeBoost: 1.2 },
  10: { count: 6, duration: 3.4, peakOpacity: 0.58, rise: 40, sparks: true, sizeBoost: 1.3 },
};

function moteProfileForLevel(level: number): MoteProfile {
  const clamped = Math.min(MAX_LEVEL, Math.max(1, Math.floor(level) || 1));
  return MOTE_PROFILES[clamped];
}

// Lapisan atmosferik evolusi maskot — komponen presentasional murni.
// HANYA menghasilkan efek lembut di BELAKANG karakter (backlight & debu
// rendah-opacity). TIDAK PERNAH menimpa ilustrasi: tanpa retakan, badge,
// stiker, atau garis kasar. Seluruh opacity dijaga rendah agar natural,
// namun intensitasnya naik monoton mengikuti level.
function MascotEvolutionMotes({ level }: { level: number }) {
  const tone = dustToneForLevel(level);
  const profile = moteProfileForLevel(level);
  // Percikan telur (Lv 3) memakai animasi kedip lembut; sisanya melayang naik.
  if (level === 3) {
    return (
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
        {EMBER_SPARKS.map((s) => (
          <span
            key={s.id}
            className="animate-sparkle-twinkle absolute rounded-full bg-sage"
            style={{
              left: s.left,
              bottom: s.bottom,
              width: s.size,
              height: s.size,
              opacity: 0.3,
              animationDelay: `${s.delay}s`,
              boxShadow: '0 0 5px 1px rgba(163,181,138,0.35)',
            }}
          />
        ))}
      </div>
    );
  }
  if (!tone) return null;
  const dotColor =
    tone === 'cyan' ? 'bg-cyan-300'
    : tone === 'emerald' ? 'bg-emerald-500'
    : tone === 'gold' ? 'bg-amber-400'
    : 'bg-sage';
  const glow =
    tone === 'cyan'
      ? '0 0 6px 2px rgba(34,211,238,0.45)'
      : tone === 'emerald'
        ? '0 0 5px 1px rgba(16,185,129,0.25)'
        : tone === 'gold'
          ? '0 0 5px 1px rgba(251,191,36,0.25)'
          : '0 0 5px 1px rgba(163,181,138,0.25)';

  const dust = AURA_DUST.slice(0, profile.count);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
      {dust.map((p) => (
        <motion.span
          key={p.id}
          className={`absolute rounded-full ${dotColor}`}
          style={{
            left: p.left,
            bottom: p.bottom,
            width: Math.max(2, Math.round(p.size * profile.sizeBoost)),
            height: Math.max(2, Math.round(p.size * profile.sizeBoost)),
            boxShadow: glow,
          }}
          // Melayang ke atas, muncul & menghilang samar. Durasi, jangkauan, dan
          // opacity semuanya diambil dari profil level → makin tinggi level,
          // makin cepat, makin terang, dan makin jauh partikelnya melayang.
          animate={{ y: [0, -profile.rise / 2, -profile.rise], opacity: [0, profile.peakOpacity, 0] }}
          transition={{ duration: profile.duration, repeat: Infinity, delay: p.delay, ease: 'easeInOut' }}
        />
      ))}
      {/* Percikan ember aktif pada level tinggi (Lv 6+) — menambah "densitas"
          tanpa menambah jumlah elemen DOM debu. */}
      {profile.sparks &&
        EMBER_SPARKS.map((s) => (
          <motion.span
            key={`ember-${s.id}`}
            className={`absolute rounded-full ${dotColor}`}
            style={{
              left: s.left,
              bottom: s.bottom,
              width: Math.max(2, Math.round(s.size * profile.sizeBoost)),
              height: Math.max(2, Math.round(s.size * profile.sizeBoost)),
              boxShadow: glow,
            }}
            animate={{ opacity: [0, profile.peakOpacity * 0.9, 0], scale: [0.8, 1.15, 0.9] }}
            transition={{
              duration: profile.duration * 0.8,
              repeat: Infinity,
              delay: s.delay,
              ease: 'easeInOut',
            }}
          />
        ))}
    </div>
  );
}

const TOUR_STORAGE_KEY = 'aseta_tour_completed';

// Langkah onboarding tour: target = selector unik elemen yang di-highlight
const TOUR_STEPS = [
  {
    target: '[data-tour="hero-mascot"]',
    title: 'Halo, aku Aseta!',
    body: 'Halo! Aku Aseta, naga penjelajah asetmu. Setiap kali kamu bayar QRIS, uang kembalian recehmu bakal aku simpan di sini!',
  },
  {
    target: '[data-tour="portfolio"]',
    title: 'Recehmu ikut bekerja',
    body: 'Recehmu nggak cuma diam, tapi otomatis diputar ke Emas Digital (60%) & Reksadana (40%) biar terus tumbuh!',
  },
  {
    target: '[data-tour="xp-bar"]',
    title: 'Evolusi si naga',
    body: 'Semakin sering kamu nabung receh, semakin banyak XP-ku. Aku bakal menetas dan berubah jadi Naga Dewasa Bermahkota!',
  },
  {
    target: '[data-tour="scan-nav"]',
    title: 'Transaksi pertamamu',
    body: 'Yuk coba transaksi pertamamu sekarang! Klik tombol Scan buat simulasi bayar kopi.',
  },
] as const;

function subscribe(callback: () => void) {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

// ============================================================
// Komponen presentasional: GrowthChart & QuestRow
// (murni dari props → aman dari hydration mismatch)
// ============================================================

// Mini grafik garis SVG responsif untuk pertumbuhan portofolio.
function GrowthChart({ series }: { series: number[] }) {
  const W = 280;
  const H = 72;
  const pad = 6;
  const data = series.length >= 2 ? series : [0, 0];
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const stepX = (W - pad * 2) / (data.length - 1);
  const points = data.map((v, i) => {
    const x = pad + i * stepX;
    const y = H - pad - ((v - min) / range) * (H - pad * 2);
    return { x, y };
  });
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(1)},${H - pad} L${points[0].x.toFixed(1)},${H - pad} Z`;
  const last = points[points.length - 1];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-12 w-full sm:h-16"
      role="img"
      aria-label="Grafik pertumbuhan portofolio 7 hari terakhir"
      preserveAspectRatio="none"
    >
      <defs>
        {/* Isian area: satu nada emerald transparan yang sangat halus.
            Tanpa gradien berlapis / mesh agar tren tetap terbaca namun
            tidak mencolok seperti grafik high-contrast. */}
        <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#growthFill)" />
      <path
        d={linePath}
        fill="none"
        stroke="#0d9488"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* Titik akhir sederhana: satu inti kecil, tanpa cincin luar glowing. */}
      <circle cx={last.x} cy={last.y} r="3" fill="#0d9488" />
    </svg>
  );
}

// Satu baris misi harian dengan checkbox & tombol klaim XP.
function QuestRow({
  emoji,
  title,
  xp,
  done,
  claimed,
  onClaim,
}: {
  emoji: string;
  title: string;
  xp: number;
  done: boolean;
  claimed: boolean;
  onClaim: () => void;
}) {
  return (
    <li className="flex items-center gap-3 rounded-lg border border-line bg-ivory/70 p-3">
      <span className="text-lg leading-none" aria-hidden>
        {emoji}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-forest wrap-break-word">{title}</p>
        <p className="text-[11px] font-semibold text-brand">+{xp} XP</p>
      </div>
      {claimed ? (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-brand ring-1 ring-inset ring-emerald-200">
          ✓ Diklaim
        </span>
      ) : (
        <button
          type="button"
          onClick={onClaim}
          disabled={!done}
          className="shrink-0 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white transition-all duration-200 active:scale-95 hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-muted min-h-11 sm:min-h-0"
        >
          Klaim XP
        </button>
      )}
    </li>
  );
}

/**
 * Widget "Proyeksi Tabungan" — kalkulator bunga majemuk sederhana.
 * State lokal slider saja (tidak menyentuh state keuangan aplikasi), nilai
 * awal berasal dari konstanta sehingga render server & klien identik.
 *
 * `className` dipakai pemanggil untuk mengatur lebar kolom di grid 12 kolom
 * (lintang 2 dari 3 kolom visual) sehingga proporsinya seimbang dengan
 * kartu-kartu lain dan tidak menyisakan celah putih.
 */
function SavingsProjection({ className = '' }: { className?: string }) {
  const [daily, setDaily] = useState<number>(PROJECTION_DEFAULT);
  const contribution = daily * DAYS_PER_YEAR;

  return (
    <section
      className={`flex h-full min-w-0 flex-col rounded-2xl border border-line bg-white p-4 sm:p-6 ${className}`}
    >
      {/* Header: ikon gradien emerald→teal + pill imbal hasil, sejajar dengan
          badge ikon berwarna di "Transaksi Cepat" agar ritme visual sama. */}
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-emerald-500 to-teal-600 p-2.5 text-white shadow-sm shadow-emerald-500/20">
          <TrendingUp className="h-4.5 w-4.5" aria-hidden />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-bold text-forest">Proyeksi Tabungan</h2>
            <span className="rounded-full border border-emerald-200/50 bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
              +4,2% p.a
            </span>
          </div>
          <p className="text-xs text-muted">Kalau kamu tabung tiap hari</p>
        </div>
      </div>

      <div className="mb-1 flex items-baseline justify-between gap-2">
        <label htmlFor="proyeksi-harian" className="text-xs font-bold uppercase tracking-wider text-muted">
          Setoran harian
        </label>
        <span className="text-sm font-black tabular-nums text-brand">
          Rp{daily.toLocaleString('id-ID')}
        </span>
      </div>
      <input
        id="proyeksi-harian"
        type="range"
        min={PROJECTION_MIN}
        max={PROJECTION_MAX}
        step={PROJECTION_STEP}
        value={daily}
        onChange={event => setDaily(Number(event.target.value))}
        aria-label="Geser untuk mengatur setoran harian proyeksi"
        className="h-11 w-full cursor-pointer accent-brand sm:h-5"
      />
      <div className="flex justify-between text-[11px] font-medium text-muted">
        <span>Rp{PROJECTION_MIN.toLocaleString('id-ID')}</span>
        <span>Rp{PROJECTION_MAX.toLocaleString('id-ID')}</span>
      </div>

      <ul className="mt-3 grid grid-cols-3 gap-1 sm:gap-3">
        {PROJECTION_HORIZONS.map(years => {
          const total = projectSavings(daily, years);
          const gain = Math.max(0, total - contribution);
          return (
            <li
              key={years}
              className="min-w-0 flex flex-col items-center justify-center overflow-hidden rounded-xl border border-emerald-100 bg-emerald-50/60 px-1 py-2 text-center sm:px-3 sm:py-3"
            >
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted">{years} Tahun</p>
              <p className="mt-0.5 text-[9px] min-[380px]:text-[10px] sm:text-xs lg:text-sm font-extrabold tracking-tighter tabular-nums text-emerald-800 whitespace-nowrap leading-tight">
                Rp{total.toLocaleString('id-ID')}
              </p>
              <p className="mt-0.5 text-[8px] min-[380px]:text-[9px] sm:text-[10px] font-semibold tabular-nums text-muted whitespace-nowrap">
                +{gain.toLocaleString('id-ID')} hasil
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function AsetaApp() {
  const isMounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );

  const [state, setState] = useState<SavingsState>(() => {
    if (typeof window === 'undefined') return INITIAL_STATE;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return INITIAL_STATE;
      const parsed = JSON.parse(raw);
      if (isValidSavingsState(parsed)) {
        return normalizeState(parsed);
      }
      return INITIAL_STATE;
    } catch {
      // localStorage diblokir / JSON corrupt → fallback mulus ke default (tanpa crash)
      return INITIAL_STATE;
    }
  });

  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [historySearch, setHistorySearch] = useState<string>('');
  const [historyRange, setHistoryRange] = useState<number>(0); // 0 = semua hari
  const [nowTs, setNowTs] = useState<number>(0); // "waktu sekarang" untuk filter riwayat (diisi via effect)
  const [amountInput, setAmountInput] = useState<string>('');
  const [merchantInput, setMerchantInput] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [dailyCapDraft, setDailyCapDraft] = useState<number>(INITIAL_STATE.dailyCap);
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const [mascotMood, setMascotMood] = useState<MascotExpression>('idle');
  const [mascotSpeech, setMascotSpeech] = useState<string | null>(null);
  const moodTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const scanTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const petLineIndex = useRef<number>(0);
  // Bertambah tiap tap → dipakai sebagai `key` untuk memutar ulang animasi
  // partikel "+50 XP" yang melayang keluar dari maskot.
  const [xpBurstId, setXpBurstId] = useState<number>(0);
  // Bertambah tiap tap yang ditolak (batas harian tercapai) → dipakai
  // sebagai `key` untuk memutar ulang animasi getar halus pada maskot.
  const [mascotShakeId, setMascotShakeId] = useState<number>(0);

  // --- Onboarding Tour ---
  const [isTourActive, setIsTourActive] = useState<boolean>(false);
  const [tourStep, setTourStep] = useState<number>(0);
  const [tourRect, setTourRect] = useState<DOMRect | null>(null);

  // --- Efek 3D Mouse Tilt pada maskot (Framer Motion) ---
  // Nilai -0.5..0.5 dinormalisasi dari posisi kursor di atas panggung,
  // dihaluskan dengan spring agar gerakan terasa lembut dan premium.
  const tiltX = useMotionValue(0);
  const tiltY = useMotionValue(0);
  const tiltRotateX = useSpring(useTransform(tiltY, [-0.5, 0.5], [12, -12]), {
    stiffness: 180,
    damping: 18,
  });
  const tiltRotateY = useSpring(useTransform(tiltX, [-0.5, 0.5], [-14, 14]), {
    stiffness: 180,
    damping: 18,
  });

  function handleTiltMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    tiltX.set((e.clientX - rect.left) / rect.width - 0.5);
    tiltY.set((e.clientY - rect.top) / rect.height - 0.5);
  }

  function handleTiltLeave() {
    tiltX.set(0);
    tiltY.set(0);
  }

  // --- Pencairan Aset (Liquidate Portfolio) ---
  const [showLiquidateModal, setShowLiquidateModal] = useState<boolean>(false);
  const [liquidateTarget, setLiquidateTarget] = useState<'gold' | 'reksadana' | 'all'>('gold');
  const [liquidateAmount, setLiquidateAmount] = useState<string>('');

  /**
   * Tap maskot — interaksi mikro "Sapa Aseta".
   *
   * Batas harian: maksimal `GREET_TAP_TARGET` (3) tap per hari. Selama
   * belum tercapai → SFX + animasi partikel "+50 XP" + penghitung
   * `greetCount` naik. Setelah tercapai → TIDAK ada partikel & SFX;
   * maskot hanya "menolak" halus lewat getaran kecil + balasan lisan
   * agar tetap terasa hidup tanpa mengajari pengguna.
   *
   * Catatan domain: XP 50 misi ini diberikan satu kali lewat
   * `claimQuest('greet')`, BUKAN tiap tap — partikel hanya penanda progres.
   */
  function handleMascotTap() {
    const today = todayKey();
    // Reset dulu bila tanggal sudah berganti agar batas harian akurat.
    const questsToday =
      state.quests.date === today ? state.quests : { ...INITIAL_STATE.quests, date: today };
    const tapsUsed = Math.min(questsToday.greetCount, GREET_TAP_TARGET);
    const limitReached = tapsUsed >= GREET_TAP_TARGET;

    setMascotMood('tap');
    setMascotSpeech(
      limitReached
        ? PET_LINES_LIMIT[petLineIndex.current % PET_LINES_LIMIT.length]
        : PET_LINES[petLineIndex.current % PET_LINES.length]
    );
    petLineIndex.current += 1;

    // Batas tercapai → tolak halus: tanpa SFX, tanpa partikel "+50 XP".
    if (limitReached) {
      setMascotShakeId(prev => prev + 1);
      playLimitSound();
      showToast(`Batas sapa harian sudah tercapai! (${GREET_TAP_TARGET}/${GREET_TAP_TARGET})`);
      return;
    }

    playTapSound();
    setXpBurstId(prev => prev + 1);
    setState(prev => {
      const quests = prev.quests.date === today ? prev.quests : { ...INITIAL_STATE.quests, date: today };
      return {
        ...prev,
        quests: { ...quests, greetCount: Math.min(quests.greetCount + 1, GREET_TAP_TARGET) },
      };
    });
  }

  function finishTour() {
    setIsTourActive(false);
    setTourStep(0);
    setTourRect(null);
    try {
      localStorage.setItem(TOUR_STORAGE_KEY, '1');
    } catch {
      /* localStorage tidak tersedia — abaikan */
    }
  }

  function restartTour() {
    setActiveTab('home');
    setTourStep(0);
    setIsTourActive(true);
  }

  const saveState = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Failed to save state', e);
    }
  }, [state]);

  // Effects
  useEffect(() => {
    saveState();
  }, [state, saveState]);

  // Auto-reset harian berbasis key localStorage `aseta_last_active_date`.
  // Saat mount: bila tidak ada tanggal tersimpan ATAU tanggal tersimpan ≠ hari ini,
  // reset akumulator harian (todaySavings) & status misi, lalu simpan tanggal hari ini.
  // Bila tanggal sama → pertahankan state harian yang ada. Aman dari hydration
  // (hanya jalan di klien setelah isMounted) & tidak crash bila localStorage diblokir.
  useEffect(() => {
    if (!isMounted) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      // en-CA menghasilkan format ISO YYYY-MM-DD berbasis waktu lokal.
      const todayStr = new Date().toLocaleDateString('en-CA');
      let storedDate: string | null = null;
      try {
        storedDate = localStorage.getItem(LAST_ACTIVE_KEY);
      } catch {
        storedDate = null; // localStorage bermasalah → perlakukan seperti hari baru
      }
      if (storedDate === null || storedDate !== todayStr) {
        setState(prev => applyDailyReset(prev, todayStr));
        try {
          localStorage.setItem(LAST_ACTIVE_KEY, todayStr);
        } catch {
          /* localStorage tidak tersedia — state tetap ter-reset di memori */
        }
      }
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isMounted]);

  useEffect(() => {
    if (isMounted) {
      // Defer setState to avoid sync setState in effect
      const timer = setTimeout(() => setDailyCapDraft(state.dailyCap), 0);
      return () => clearTimeout(timer);
    }
  }, [isMounted, state.dailyCap]);

  // Handle mascot mood and speech
  useEffect(() => {
    if (mascotMood !== 'idle' && mascotSpeech) {
      moodTimer.current = setTimeout(() => {
        setMascotMood('idle');
        setMascotSpeech(null);
      }, 2200);
    }
    return () => {
      if (moodTimer.current) clearTimeout(moodTimer.current);
    };
  }, [mascotMood, mascotSpeech]);

  // Onboarding tour: jalankan sekali saat first visit
  useEffect(() => {
    if (!isMounted) return;
    let cancelled = false;
    let completed = true;
    try {
      completed = localStorage.getItem(TOUR_STORAGE_KEY) === '1';
    } catch {
      completed = true; // localStorage bermasalah → jangan ganggu user
    }
    if (!completed) {
      // Tunda setState agar tidak sinkron di dalam effect (hindari cascading render)
      const timer = setTimeout(() => {
        if (!cancelled) {
          setIsTourActive(true);
          setTourStep(0);
        }
      }, 0);
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }
    return;
  }, [isMounted]);

  // Onboarding tour: hitung posisi spotlight untuk langkah aktif
  useEffect(() => {
    if (!isTourActive) return;

    function measure() {
      const step = TOUR_STEPS[tourStep];
      if (!step) {
        setTourRect(null);
        return;
      }
      const candidates = document.querySelectorAll(step.target);
      let visible: Element | null = null;
      for (const candidate of candidates) {
        const rect = candidate.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          visible = candidate;
          break;
        }
      }
      if (visible) {
        setTourRect(visible.getBoundingClientRect());
      } else {
        setTourRect(null);
      }
    }

    measure();
    window.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, [isTourActive, tourStep]);

  // Catatan: pemindaian/demo otomatis yang menambah tabungan saat tab Scan
  // dibuka telah DIHAPUS — semua penambahan aset hanya terjadi saat user
  // secara eksplisit menekan tombol (preset / Simpan & Tabungkan).

  // Cleanup timer scan saat unmount
  useEffect(() => {
    return () => {
      if (scanTimer.current) clearTimeout(scanTimer.current);
    };
  }, []);

  // Perbarui "waktu sekarang" untuk filter Riwayat. setState ditunda via setTimeout
  // agar tidak sinkron di dalam effect (hindari cascading render), sesuai pola lint.
  useEffect(() => {
    if (!isMounted) return;
    const timer = setTimeout(() => setNowTs(Date.now()), 0);
    return () => clearTimeout(timer);
  }, [isMounted, activeTab, state.history.length]);

  // Handlers
  // ============================================================
  // Semua mutasi keuangan HANYA dipanggil dari event handler
  // eksplisit user (tombol preset / simpan / klaim / pencairan) —
  // tidak pernah saat render atau tab dibuka.
  // ============================================================
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(message: string) {
    setToastMessage(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMessage(null), 3000);
  }

  // Inti transaksi round-up: tambah aset, potong dompet, streak, quest & growth.
  function commitSavings(merchant: string, originalAmount: number): boolean {
    const roundUp = calculateRoundUp(originalAmount);
    if (roundUp <= 0) {
      showToast('Nominal sudah kelipatan Rp5.000 — tidak ada receh untuk ditabung.');
      return false;
    }
    if (state.todaySavings + roundUp > state.dailyCap) {
      showToast(`Batas harian Rp${state.dailyCap.toLocaleString('id-ID')} terlampaui. Besok lagi ya!`);
      return false;
    }
    // Jaga agar saldo dompet tidak pernah negatif (anti-bocor) — round-up
    // hanya dipotong bila dompet masih sanggup menutupinya.
    if (roundUp > state.walletBalance) {
      showToast('Saldo dompet tidak cukup untuk menutup round-up ini.');
      return false;
    }
    const today = todayKey();
    // Transaksi = aktivitas hari ini → pastikan key tanggal aktif tersimpan.
    persistLastActive(today);
    const prevLevel = getMascotLevel(state.balance).level;
    const nextBalance = state.balance + roundUp;
    const nextLevel = getMascotLevel(nextBalance).level;
    const tx = buildTransaction({
      merchantName: merchant,
      originalAmount,
      roundedAmount: originalAmount + roundUp,
      savingsAmount: roundUp,
    });

    setState(prev => {
      const freshDay = prev.quests.date !== today;
      const quests = freshDay ? { ...INITIAL_STATE.quests, date: today } : prev.quests;
      let streak = prev.streak;
      if (prev.lastActiveDate !== today) {
        streak = prev.lastActiveDate && daysBetween(prev.lastActiveDate, today) === 1 ? prev.streak + 1 : 1;
      }
      return {
        ...prev,
        balance: prev.balance + roundUp,
        todaySavings: (freshDay ? 0 : prev.todaySavings) + roundUp,
        walletBalance: prev.walletBalance - roundUp,
        streak,
        lastActiveDate: today,
        quests: { ...quests, date: today, qrisDone: true },
        growth: [...prev.growth, prev.balance + roundUp].slice(-7),
        history: [tx, ...prev.history].slice(0, 50),
      };
    });

    playCoinSound();
    if (nextLevel > prevLevel) {
      playLevelUpSound();
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
      setMascotMood('celebrate');
      setMascotSpeech('Yeay! Aku berevolusi! 🐉✨');
      showToast(`Level ${nextLevel}! ${getMascotLevel(nextBalance).name} menetas!`);
    } else {
      showToast(`Berhasil! Tabungan +Rp${roundUp.toLocaleString('id-ID')}`);
    }
    return true;
  }
  // Preset transaksi cepat — hanya dipanggil saat tombol "Tabung →" diklik.
  function handleQuickSave(preset: { merchant: string; amount: number }) {
    commitSavings(preset.merchant, preset.amount);
  }

  // Input manual (tab Scan) — hanya dipanggil tombol "Simpan & Tabungkan".
  function handleSave() {
    const amount = parseInt(amountInput, 10) || 0;
    if (amount <= 0) {
      showToast('Masukkan nominal transaksi yang valid.');
      return;
    }
    const merchant = merchantInput.trim() || 'Transaksi Manual';
    if (commitSavings(merchant, amount)) {
      setAmountInput('');
      setMerchantInput('');
    }
  }

  // Simulasi pemindaian AMAN: TIDAK menyentuh state keuangan apa pun.
  function handleScan() {
    if (isScanning) return;
    setIsScanning(true);
    if (scanTimer.current) clearTimeout(scanTimer.current);
    scanTimer.current = setTimeout(() => {
      setIsScanning(false);
      showToast('Struk tidak terdeteksi — pakai preset di bawah ya!');
    }, 1800);
  }

  // Klaim hadiah misi harian → tambah XP ke balance (maskot).
  function claimQuest(kind: 'qris' | 'deposit' | 'greet') {
    const today = todayKey();
    const xpReward = kind === 'qris' ? 100 : kind === 'deposit' ? 200 : 50;
    setState(prev => {
      const freshDay = prev.quests.date !== today;
      const quests = freshDay ? { ...INITIAL_STATE.quests, date: today } : prev.quests;
      const done =
        kind === 'qris' ? quests.qrisDone
        : kind === 'deposit' ? prev.todaySavings >= 5000
        : quests.greetCount >= GREET_TAP_TARGET;
      const claimed =
        kind === 'qris' ? quests.qrisClaimed
        : kind === 'deposit' ? quests.depositClaimed
        : quests.greetClaimed;
      if (!done || claimed) return prev;
      return {
        ...prev,
        balance: prev.balance + xpReward,
        growth: [...prev.growth, prev.balance + xpReward].slice(-7),
        quests: {
          ...quests,
          date: today,
          qrisClaimed: kind === 'qris' ? true : quests.qrisClaimed,
          depositClaimed: kind === 'deposit' ? true : quests.depositClaimed,
          greetClaimed: kind === 'greet' ? true : quests.greetClaimed,
        },
      };
    });
    playCoinSound();
    confetti({ particleCount: 70, spread: 65, origin: { y: 0.7 } });
    showToast(`Misi selesai! +${xpReward} XP untuk Aseta 🎉`);
  }

  // Pencairan aset: kurangi portofolio → tambah saldo dompet utama.
  function handleLiquidate() {
    const amount = parseInt(liquidateAmount, 10) || 0;
    const goldPart = Math.round(state.balance * 0.6);
    const reksaPart = state.balance - goldPart;
    const available =
      liquidateTarget === 'gold' ? goldPart
      : liquidateTarget === 'reksadana' ? reksaPart
      : state.balance;
    if (amount <= 0) {
      showToast('Masukkan nominal pencairan yang valid.');
      return;
    }
    if (amount > available) {
      showToast(`Maksimal Rp${available.toLocaleString('id-ID')} untuk pilihan ini.`);
      return;
    }
    setState(prev => ({
      ...prev,
      balance: prev.balance - amount,
      walletBalance: prev.walletBalance + amount,
      growth: [...prev.growth, prev.balance - amount].slice(-7),
    }));
    playCoinSound();
    showToast(`Berhasil cairkan Rp${amount.toLocaleString('id-ID')} ke Dompet.`);
    setShowLiquidateModal(false);
    setLiquidateAmount('');
  }

  function handleSaveDailyCap() {
    const value = Math.max(0, Math.floor(Number(dailyCapDraft) || 0));
    setState(prev => ({ ...prev, dailyCap: value }));
    setDailyCapDraft(value);
    showToast(`Batas harian diperbarui: Rp${value.toLocaleString('id-ID')}`);
  }

  function handleReset() {
    // Reset penuh: state kembali ke awal & tanggal aktif diset ke hari ini
    // agar effect auto-reset harian tidak langsung menimpa pada mount berikutnya.
    const today = todayKey();
    persistLastActive(today);
    setState({ ...INITIAL_STATE, quests: { ...INITIAL_STATE.quests, date: today } });
    setDailyCapDraft(INITIAL_STATE.dailyCap);
    setShowResetModal(false);
    showToast('Semua data berhasil direset.');
  }
  // ============================================================
  // Nilai turunan — SEMUA di-guard isMounted agar aman hydration
  // (server & render pertama klien selalu pakai nilai default).
  // ============================================================
  const displayBalance = isMounted ? state.balance : 0;
  const displayToday = isMounted ? state.todaySavings : 0;
  const displayWallet = isMounted ? state.walletBalance : DEFAULT_WALLET_BALANCE;
  const displayStreak = isMounted ? state.streak : 0;
  const displayHistory = isMounted ? state.history : [];
  const displayCap = isMounted ? state.dailyCap : INITIAL_STATE.dailyCap;
  const mascot = getMascotLevel(displayBalance);
  const xp = getXpProgress(displayBalance);
  const xpPercent = Math.min(100, Math.max(0, xp.percent));
  const capPercent = displayCap > 0 ? Math.min(100, (displayToday / displayCap) * 100) : 0;
  // Sisa kuota tabungan hari ini (tidak pernah negatif). Dipakai sebagai
  // ringkasan tengah kartu "Batas Harian".
  const capRemaining = Math.max(0, displayCap - displayToday);
  const capExhausted = capRemaining <= 0;
  const goldValue = Math.round(displayBalance * 0.6);
  const reksaValue = displayBalance - goldValue;
  const goldGrams = goldValue / GOLD_GRAM_PRICE;
  const monthlyReturn = Math.round((displayBalance * 0.042) / 12);
  const growthSeries = isMounted && state.growth.length >= 2 ? state.growth : buildGrowthSeries(displayBalance);
  const qrisDone = isMounted && state.quests.qrisDone;
  const depositDone = isMounted && state.todaySavings >= 5000;
  const greetDone = isMounted && state.quests.greetCount >= GREET_TAP_TARGET;
  const qrisClaimed = isMounted && state.quests.qrisClaimed;
  const depositClaimed = isMounted && state.quests.depositClaimed;
  const greetClaimed = isMounted && state.quests.greetClaimed;
  // Progress tap hari ini (dibatasi batas harian) — ditampilkan di judul misi.
  const greetTapsUsed = isMounted ? Math.min(state.quests.greetCount, GREET_TAP_TARGET) : 0;
  const xpLabel = mascot.level >= MAX_LEVEL
    ? 'Level Maksimal 🏆'
    : `${xp.current.toLocaleString('id-ID')} / ${xp.next.toLocaleString('id-ID')} XP`;
  // Rank sudah tampil di bawah ilustrasi maskot, jadi baris petunjuk XP
  // menampilkan target level BERIKUTNYA — bukan mengulang rank yang sama.
  const xpHint = mascot.level >= MAX_LEVEL
    ? 'Aseta telah mencapai evolusi terakhir'
    : `${LEVEL_TARGETS[mascot.level].toLocaleString('id-ID')} XP lagi ke Lv. ${mascot.level + 1}`;
  const aura = mascotAura(mascot.level);

  // --- Breakdown "Total Aset": Tabungan (portofolio) + Saldo Dompet + imbal hasil bulan ini ---
  const walletPortion = displayWallet;                       // saldo dompet (belum diinvestasikan)
  const investedPortion = displayBalance;                    // sudah diputar ke portofolio
  const totalWealth = walletPortion + investedPortion;       // total kekayaan tampil

  // --- Riwayat: filter pencarian & rentang hari ---
  // "Sekarang" (nowTs) diisi via effect agar render tetap pure (lolos React Compiler).
  const historySearchQuery = historySearch.trim().toLowerCase();
  const filteredHistory = displayHistory.filter(tx => {
    const matchQuery =
      historySearchQuery === '' || tx.merchantName.toLowerCase().includes(historySearchQuery);
    if (historyRange <= 0 || nowTs === 0) return matchQuery;
    const ts = Date.parse(tx.timestamp);
    return matchQuery && !Number.isNaN(ts) && ts >= nowTs - historyRange * 86_400_000;
  });

  return (
    <div className="flex min-h-screen bg-ivory text-forest antialiased">
      {/* ===== Sidebar — Desktop (md+) ===== */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-white md:flex">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-sm font-black text-white">A</span>
          <span className="text-lg font-black tracking-tight text-forest">ASETA</span>
        </div>

        {/* Navigasi utama */}
        <nav className="flex flex-col gap-1 px-3" aria-label="Navigasi utama">
          {([
            { id: 'home', label: 'Beranda', Icon: Home },
            { id: 'scan', label: 'Scan', Icon: QrCode },
            { id: 'history', label: 'Riwayat', Icon: History },
            { id: 'evolve', label: 'Evolusi', Icon: Sparkles },
          ] as const).map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              data-tour={item.id === 'scan' ? 'scan-nav' : undefined}
              aria-current={activeTab === item.id ? 'page' : undefined}
              className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors ${isTourActive && tourStep === 3 && item.id === 'scan' ? 'relative z-50 ring-4 ring-emerald-400 ring-offset-2 rounded-2xl bg-white' : ''} ${activeTab === item.id ? 'bg-emerald-50 text-brand' : 'text-muted hover:bg-ivory hover:text-forest'}`}
            >
              <item.Icon className="h-4.5 w-4.5" aria-hidden /> {item.label}
            </button>
          ))}
        </nav>

        {/* Tombol ulangi panduan di bawah sidebar — kartu mini maskot DIHAPUS
            karena Hero Mascot sudah tampil menonjol di Kolom 1 */}
        <div className="mt-auto p-3">
          <button
            type="button"
            onClick={restartTour}
            title="Ulangi Panduan"
            aria-label="Ulangi panduan tour"
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-muted transition-colors hover:bg-ivory hover:text-brand"
          >
            <HelpCircle className="h-4 w-4" /> Ulangi Panduan
          </button>
        </div>
      </aside>

      {/* ===== Kolom Konten (mobile: satu kolom, desktop: di kanan sidebar) ===== */}
      <div className="relative flex min-h-screen w-full min-w-0 flex-col">
        {/* Bar mobile tipis: hanya logo + nama brand. Badge streak & level
            sengaja dihapus agar bar tetap ringan dan tidak berdesakan
            dengan judul salam di bawahnya. */}
        <header className="sticky top-0 z-40 flex items-center border-b border-line bg-ivory/90 px-4 py-2.5 backdrop-blur-md md:hidden">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand text-xs font-black text-white">A</span>
            <span className="text-base font-black tracking-tight text-forest">ASETA</span>
          </div>
        </header>

      {/* ===== Konten Utama: Dashboard Grid (tab Beranda) =====
          Grid 12 kolom yang diratakan langsung (tanpa wrapper kolom terpisah)
          agar tinggi tiap baris ikut menyesuaikan isinya dan tidak
          menyisakan celah putih di bawah. Hero Maskot menempati 2 baris
          (4 dari 12 kolom), sementara Alokasi + Proyeksi memakai 2 dari 3
          kolom visual (8 dari 12 kolom). */}
      {activeTab === 'home' && (
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-28 pt-6 sm:px-6 md:pb-10 lg:px-8">
        {/* --- Kepala dashboard: salam + utilitas (Reset Data dipindah ke
            sini dari bar bawah agar tidak lagi terbaca sebagai tombol
            giants yang "terlempar" sendirian di dasar halaman). --- */}
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-bold tracking-tight text-forest">
              Halo, Aseta menunggumu 👋
            </h1>
            <p className="text-xs sm:text-sm text-muted">
              Putar receh hari ini jadi aset.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowResetModal(true)}
            title="Reset Data"
            aria-label="Reset semua data"
            className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-xs font-semibold text-slate-500 shadow-xs transition-all duration-200 active:scale-95 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 sm:min-h-0"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">Reset Data</span>
          </button>
        </div>

        {/* --- Grid kartu: 3 kolom visual pada desktop (12 kolom dasar).
            Semua kartu memakai `h-full` + `p-6` seragam sehingga batas
            bawah tiap baris sejajar rapi tanpa celah putih. --- */}
      <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-12">
        {/* --- Hero Mascot: kartu utama, mengisi 2 baris (4 dari 12 kolom).
            Padding & jarak internal sengaja lebih rapat dibanding kartu lain
            (p-5, space-y-2.5, maskot h-28 / sm:h-32) karena kolom ini
            menampung paling banyak blok: nama + tag status, Total Aset +
            sub-metrik, XP Evolusi, dan kutipan. Badge kutipan (mt-auto)
            menempel snug di dasar kartu tanpa mendorong layout meluber. --- */}
        <section
          data-tour="hero-mascot"
          className={`flex h-full flex-col space-y-2.5 rounded-2xl border border-line bg-white p-5 lg:col-span-4 lg:row-span-2 ${isTourActive && tourStep === 0 ? 'relative z-50 ring-4 ring-emerald-400 ring-offset-2' : ''}`}
        >
          {/* Header: streak + badge level */}
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/70 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
              🔥 {displayStreak} Hari
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-full border border-amber-300/60 bg-gold px-2.5 py-1 text-xs font-black text-forest"
              title={mascot.title}
            >
              Lv. {mascot.level}
            </span>
          </div>

          {/* Panggung maskot 3D interaktif: tilt mengikuti kursor + melayang
              lembut. Aura glow & ring berubah progresif sesuai level. */}
          <div
            className="relative flex justify-center py-1"
            style={{ perspective: 800 }}
            onMouseMove={handleTiltMove}
            onMouseLeave={handleTiltLeave}
          >
            {/* Backlight aura: blur + denyut, warna & intensitas mengikuti level. */}
            <div
              aria-hidden
              className={`absolute top-1/2 h-28 w-28 -translate-y-1/2 rounded-full sm:h-32 sm:w-32 ${aura.glow} ${aura.glowAnim}`}
            />
            <AnimatePresence>
              {mascotSpeech && (
                <motion.div
                  key={mascotSpeech}
                  initial={{ opacity: 0, y: 8, scale: 0.85 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 22 }}
                  className="absolute -top-1 left-1/2 z-10 max-w-[85%] -translate-x-1/2 rounded-2xl rounded-b-sm border border-line bg-white px-3.5 py-2 text-center text-xs font-medium leading-snug text-forest shadow-md"
                  role="status"
                >
                  {mascotSpeech}
                </motion.div>
              )}
            </AnimatePresence>
            {/* Pembungkus terpisah untuk animasi getar (CSS `transform`) —
                sengaja DI LUAR motion.div agar tidak menimpa transform
                tilt/hover milik Framer Motion. `key` memutar ulang animasi. */}
            <div
              key={mascotShakeId}
              className={`rounded-full ${mascotShakeId > 0 ? 'animate-mascot-shake' : ''}`}
            >
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ type: 'tween', duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
              style={{ rotateX: tiltRotateX, rotateY: tiltRotateY, transformStyle: 'preserve-3d' }}
              className={`rounded-full ${aura.ring}`}
            >
              <motion.button
                type="button"
                onClick={handleMascotTap}
                whileTap={{ scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                aria-label={`Sapa ${mascot.name}`}
                className="relative rounded-full outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                {/* Debu atmosferik lembut — SELALU di belakang ilustrasi maskot */}
                <MascotEvolutionMotes level={mascot.level} />
                {/* Pembungkus "bernapas" (Lv 2-3) memisahkan animasi scale dari
                    animasi ketuk pada gambar agar tidak saling bentrok. */}
                <span className={`relative z-10 block ${aura.breathe}`}>
                  <Image
                    src={mascot.gif}
                    alt={mascot.name}
                    width={144}
                    height={144}
                    unoptimized
                    priority
                    className={`relative block h-28 w-28 object-contain sm:h-32 sm:w-32 ${aura.scale} ${aura.imgShadow} ${mascotMood !== 'idle' ? 'animate-mascot-tap' : ''}`}
                  />
                </span>
              </motion.button>
            </motion.div>
            </div>
            {/* Partikel "+50 XP" — hanya muncul selama tap masih di bawah
                batas harian (`GREET_TAP_TARGET`), sebagai penanda progres
                menuju klaim XP misi "Sapa Aseta". Bukan penambahan saldo. */}
            {xpBurstId > 0 && (
              <motion.span
                key={xpBurstId}
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-6 z-20 -translate-x-1/2 rounded-full bg-gold px-2.5 py-1 text-[11px] font-black whitespace-nowrap text-forest shadow-md"
                initial={{ opacity: 0, y: 0, scale: 0.6 }}
                animate={{ opacity: [0, 1, 1, 0], y: [0, -18, -46, -60], scale: [0.6, 1.1, 1, 0.9] }}
                transition={{ duration: 1.15, repeat: 0, ease: 'easeOut' }}
              >
                +50 XP
              </motion.span>
            )}
          </div>

          {/* Nama tahap + gelar rank — keduanya berasal dari `getMascotLevel()`
              sehingga ikut berubah mengikuti level: Lv 1-3 "Telur Aseta",
              Lv 4-6 "Aseta Muda", Lv 7-10 "Aseta Mandiri", dengan rank
              per-level ("Penabung Pemula" … "Sultan Aseta"). */}
          <div className="text-center">
            <h2 className="text-lg font-black tracking-tight text-forest">
              {mascot.name}
            </h2>
            <p className="text-xs font-bold tracking-wider text-amber-600 uppercase mt-0.5">
              {mascot.title}
            </p>
            {/* Level Maksimal Lv 10 — label teks polos, bukan pill bergradien. */}
            {mascot.level >= 10 && (
              <p className="mt-1.5 text-[11px] font-medium text-muted">
                Level maksimal tercapai
              </p>
            )}
          </div>

          {/* Total Aset: nominal utama + breakdown (Tabungan · Dompet · Imbal hasil).
              Tanpa badge "Diinvestasikan Otomatis" — tipografi saja sudah
              cukup menjelaskan konteksnya. */}
          <div className="flex flex-col gap-1 rounded-xl border border-line bg-ivory/60 p-2.5">
            <p className="text-center text-xs font-medium text-muted">Total Aset Saya</p>
            <p className="text-center text-xl font-black tabular-nums whitespace-nowrap text-forest sm:text-2xl lg:text-3xl">
              Rp{totalWealth.toLocaleString('id-ID')}
            </p>
            <p className="text-center text-[11px] font-medium text-muted">
              +Rp{monthlyReturn.toLocaleString('id-ID')} (+4,2% p.a) bulan ini
            </p>
            {/* Breakdown 3 baris — sengaja diturunkan hierarkinya (label
                slate-500 + nominal lebih redup) agar nominal utama
                "Total Aset" tetap satu-satunya yang menonjol. */}
            <div className="mt-1.5 flex flex-col gap-1 border-t border-line/70 pt-2">
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-muted">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-emerald-50">
                    <TrendingUp className="h-3 w-3 text-brand" aria-hidden />
                  </span>
                  <span className="truncate">Tabungan</span>
                </span>
                <span className="shrink-0 text-xs font-semibold tabular-nums text-forest">
                  +Rp{investedPortion.toLocaleString('id-ID')}
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
                  Rp{walletPortion.toLocaleString('id-ID')}
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
                  +Rp{displayToday.toLocaleString('id-ID')}
                </span>
              </div>
            </div>
          </div>

          {/* XP Progress Bar */}
          <div
            data-tour="xp-bar"
            className={`${isTourActive && tourStep === 2 ? 'relative z-50 rounded-2xl bg-white p-2 ring-4 ring-emerald-400 ring-offset-2' : ''}`}
          >
            <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-muted">
              <span>XP Evolusi</span>
              <span className="tabular-nums text-forest">{xpLabel}</span>
            </div>
            {/* Rel XP: isi emerald solid di atas rel abu-abu. Tanpa sapuan kilau,
                tanpa lapisan gloss, tanpa bayangan berwarna. */}
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-brand transition-all duration-700 ease-out"
                style={{ width: `${xpPercent}%` }}
              />
            </div>
            <p className="mt-1 text-center text-[11px] font-medium text-muted">
              {xpHint}
            </p>
          </div>
        </section>

        {/* --- Alokasi Portofolio: 2 dari 3 kolom visual (8 dari 12) --- */}
        <section
          data-tour="portfolio"
          className={`flex h-full flex-col rounded-2xl border border-line bg-white p-6 lg:col-span-8 ${isTourActive && tourStep === 1 ? 'relative z-50 ring-4 ring-emerald-400 ring-offset-2' : ''}`}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-forest">Alokasi Portofolio</h2>
              <p className="text-xs text-muted">Pembagian otomatis dari total asetmu</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowLiquidateModal(true);
                setLiquidateAmount('');
              }}
              className="shrink-0 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-700 transition-all duration-200 active:scale-95 hover:border-emerald-300 hover:bg-emerald-50/50 hover:text-brand min-h-11 sm:min-h-0"
            >
              Cairkan Aset
            </button>
          </div>

          {/* Split bar 60/40 */}
          <div
            className="flex h-3 w-full overflow-hidden rounded-full ring-1 ring-inset ring-line"
            role="img"
            aria-label="Alokasi aset: Emas Digital 60 persen, Reksadana Pasar Uang 40 persen"
          >
            <div className="h-full bg-amber-400" style={{ width: '60%' }} />
            <div className="h-full w-0.5 bg-white" />
            <div className="h-full flex-1 bg-emerald-500" />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3">
              <p className="text-[11px] font-bold text-amber-700">🟡 Emas Digital (60%)</p>
              <p className="mt-0.5 text-sm font-black tabular-nums wrap-break-word text-forest">
                Rp{goldValue.toLocaleString('id-ID')}
              </p>
              <p className="text-[11px] text-muted">~{goldGrams.toLocaleString('id-ID', { maximumFractionDigits: 4 })} gram</p>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
              <p className="text-[11px] font-bold text-brand">🟢 Reksadana (40%)</p>
              <p className="mt-0.5 text-sm font-black tabular-nums wrap-break-word text-forest">
                Rp{reksaValue.toLocaleString('id-ID')}
              </p>
              <p className="text-[11px] text-muted">Pasar Uang · likuid</p>
            </div>
          </div>

          {/* Grafik pertumbuhan 7 hari */}
          <div className="mt-4 rounded-xl bg-ivory p-3">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
                Pertumbuhan Aset · 7 Hari
              </p>
              <TrendingUp className="h-3.5 w-3.5 text-brand" aria-hidden />
            </div>
            <GrowthChart series={growthSeries} />
          </div>
        </section>

        {/* --- Proyeksi Tabungan: melintasi 2 dari 3 kolom visual
            (8 dari 12 kolom), tepat di bawah Alokasi Portofolio --- */}
        <SavingsProjection className="lg:col-span-8" />

        {/* --- Misi Hari Ini --- */}
        <section className="flex h-full flex-col rounded-2xl border border-line bg-white p-6 lg:col-span-4">
          <div className="mb-3">
            <h2 className="text-base font-bold text-forest">Misi Hari Ini</h2>
            <p className="text-xs text-muted">Selesaikan misi, klaim XP untuk maskotmu</p>
          </div>
          <ul className="space-y-2">
            <QuestRow
              emoji="☕"
              title="Lakukan 1x Pembulatan QRIS"
              xp={100}
              done={qrisDone}
              claimed={qrisClaimed}
              onClaim={() => claimQuest('qris')}
            />
            <QuestRow
              emoji="🪙"
              title="Tabung minimal Rp5.000 hari ini"
              xp={200}
              done={depositDone}
              claimed={depositClaimed}
              onClaim={() => claimQuest('deposit')}
            />
            <QuestRow
              emoji="🐉"
              title={`Sapa Aseta (Tap Maskot ${greetTapsUsed}/${GREET_TAP_TARGET})`}
              xp={50}
              done={greetDone}
              claimed={greetClaimed}
              onClaim={() => claimQuest('greet')}
            />
          </ul>
          {/* Spacer fleksibel agar baris misi tetap menempel ke bawah kartu,
              menyamakan garis basal dengan kartu tetangganya. */}
          <div aria-hidden className="flex-1" />
        </section>

        {/* --- Transaksi Cepat --- */}
        <section className="flex h-full flex-col rounded-2xl border border-line bg-white p-6 lg:col-span-4">
          <div className="mb-3">
            <h2 className="text-base font-bold text-forest">Transaksi Cepat</h2>
            <p className="text-xs text-muted">Simulasi bayar & recehnya langsung ditabung</p>
          </div>
          <ul className="space-y-2">
            {QUICK_PRESETS.map(preset => (
              <li
                key={preset.id}
                className="flex items-center gap-3 rounded-xl border border-line bg-ivory/70 p-2.5 transition-colors hover:border-emerald-200 hover:bg-emerald-50/40"
              >
                {/* Badge ikon berwarna per merchant — non-monochrome,
                    dengan hover scale halus agar terasa hidup. */}
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 hover:scale-105 ${preset.tone}`}
                >
                  <preset.Icon className="h-4.5 w-4.5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-forest truncate">{preset.label}</p>
                  <p className="text-xs tabular-nums text-muted">
                    Rp{preset.amount.toLocaleString('id-ID')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleQuickSave(preset)}
                  className="shrink-0 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-white transition-all duration-200 active:scale-95 hover:bg-emerald-700 min-h-11 sm:min-h-0"
                >
                  Tabung →
                </button>
              </li>
            ))}
          </ul>
          {/* Spacer fleksibel — menyamakan garis basal kartu ini dengan
              "Misi Hari Ini" dan "Batas Harian". */}
          <div aria-hidden className="flex-1" />
        </section>

        {/* --- Batas Harian ---
            `justify-between` distribute 3 blok (header · ringkasan ·
            input) ke atas/tengah/bawah, sehingga bagian tengah kartu tidak
            terlihat seperti rongga putih dibanding kartu tetangganya. */}
        <section className="flex h-full flex-col justify-between gap-4 rounded-2xl border border-line bg-white p-6 lg:col-span-4">
          <div>
            <h2 className="text-base font-bold text-forest">Batas Harian</h2>
            <p className="text-xs text-muted">Batas tabungan maksimal per hari</p>
          </div>

          <div>
            <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-brand transition-all duration-500"
                style={{ width: `${capPercent}%` }}
              />
            </div>
            <p className="text-xs font-medium text-muted">
              Terpakai Rp{displayToday.toLocaleString('id-ID')} dari{' '}
              Rp{displayCap.toLocaleString('id-ID')}
            </p>

            {/* Ringkasan tengah: sisa kuota yang masih bisa ditabung hari
                ini. Bukan dekorasi — angkanya ikut terisi real-time. */}
            <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-emerald-100/60 bg-emerald-50/50 px-3.5 py-3">
              <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-slate-600">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />
                <span className="truncate">Sisa Limit Tabungan</span>
              </span>
              <span
                className={`shrink-0 text-sm font-black tabular-nums ${capExhausted ? 'text-rose-600' : 'text-brand'}`}
              >
                Rp{capRemaining.toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="number"
              min={0}
              inputMode="numeric"
              aria-label="Nominal batas harian"
              value={dailyCapDraft}
              onChange={e => setDailyCapDraft(Math.max(0, Number(e.target.value) || 0))}
              className="min-w-0 flex-1 rounded-xl border border-line bg-white px-3 py-2.5 text-sm tabular-nums text-forest outline-none transition-colors focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
            <button
              type="button"
              onClick={handleSaveDailyCap}
              disabled={dailyCapDraft === displayCap}
              className="shrink-0 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition-all duration-200 active:scale-95 hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-muted min-h-11 sm:min-h-0"
            >
              Simpan
            </button>
          </div>
        </section>
      </div>
      </main>
      )}

      {/* ===== Tab Scan (QRIS) — tampilan bersih, tanpa mutasi state ===== */}
      {activeTab === 'scan' && (
        <main className="mx-auto max-w-2xl px-4 py-6 pb-28 sm:px-6 md:pb-10">
          <div className="rounded-2xl border border-line bg-white p-5">
            <h2 className="text-base font-bold text-forest">Scan QRIS</h2>
            <p className="text-xs text-muted">
              Arahkan kamera ke struk QRIS merchant, atau pakai preset di bawah.
            </p>

            {/* Kamera mockup — murni visual, tidak mengubah state keuangan */}
            <div className="relative mt-4 flex aspect-4/3 w-full items-center justify-center overflow-hidden rounded-2xl bg-slate-900">
              <div className="absolute inset-6 rounded-xl border-2 border-dashed border-emerald-400/60" aria-hidden />
              <QrCode className="h-16 w-16 text-emerald-300/70" aria-hidden />
              {isScanning && (
                <div
                  aria-hidden
                  className="absolute inset-x-6 top-1/2 h-0.5 bg-emerald-400 shadow-[0_0_12px_2px_rgba(16,185,129,0.7)]"
                />
              )}
              <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-[11px] font-medium text-emerald-200">
                {isScanning ? 'Memindai...' : 'Mode demo — tidak memakai kamera asli'}
              </span>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleScan}
                disabled={isScanning}
                className="w-full rounded-xl bg-brand px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-dark disabled:cursor-wait disabled:bg-emerald-400"
              >
                {isScanning ? 'Memindai...' : 'Mulai Scan'}
              </button>
              <p className="text-center text-[11px] text-muted">
              </p>
            </div>
          </div>
          {/* Preset belanja */}
          <div className="mt-4 rounded-2xl border border-line bg-white p-5">
            <h3 className="mb-3 text-base font-bold text-forest">Preset Belanja</h3>
            <ul className="space-y-2">
              {QUICK_PRESETS.map(preset => (
                <li
                  key={preset.id}
                  className="flex items-center gap-3 rounded-xl border border-line bg-ivory/70 p-3"
                >
                  {/* Badge warna per merchant — konsisten dengan tab Beranda */}
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 hover:scale-105 ${preset.tone}`}
                  >
                    <preset.Icon className="h-4.5 w-4.5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-forest">{preset.label}</p>
                    <p className="text-xs tabular-nums text-muted">
                      Rp{preset.amount.toLocaleString('id-ID')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleQuickSave(preset)}
                    className="ml-auto w-24 shrink-0 rounded-lg bg-brand px-3 py-2 text-center text-xs font-bold text-white transition-all duration-200 active:scale-95 hover:bg-brand-dark min-h-11 sm:min-h-0"
                  >
                    Bayar →
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Input manual */}
          <div className="mt-4 rounded-2xl border border-line bg-white p-5">
            <h3 className="mb-3 text-base font-bold text-forest">Input Manual</h3>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                placeholder="Nama merchant"
                aria-label="Nama merchant"
                value={merchantInput}
                onChange={e => setMerchantInput(e.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-forest outline-none transition-colors focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
              <input
                type="number"
                min={0}
                inputMode="numeric"
                placeholder="Nominal (Rp)"
                aria-label="Nominal transaksi"
                value={amountInput}
                onChange={e => setAmountInput(e.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-line bg-white px-3 py-2.5 text-sm tabular-nums text-forest outline-none transition-colors focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
              <button
                type="button"
                onClick={handleSave}
                className="shrink-0 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-dark"
              >
                Simpan & Tabungkan
              </button>
            </div>
          </div>
        </main>
      )}

      {/* ===== Tab Riwayat — filter pencarian & rentang hari ===== */}
      {activeTab === 'history' && (
        <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-6 pb-28 sm:px-6 md:pb-10">
          <div className="rounded-2xl border border-line bg-white p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-bold text-forest">Riwayat Transaksi</h2>
                <p className="text-xs text-muted">
                  {filteredHistory.length} dari {displayHistory.length} transaksi
                </p>
              </div>
              {/* Filter rentang hari */}
              <div className="flex gap-1.5" role="group" aria-label="Filter rentang hari">
                {([
                  { v: 0, label: 'Semua' },
                  { v: 7, label: '7 Hari' },
                  { v: 30, label: '30 Hari' },
                ] as const).map(opt => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setHistoryRange(opt.v)}
                    aria-pressed={historyRange === opt.v}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${historyRange === opt.v ? 'bg-brand text-white' : 'bg-ivory text-muted hover:bg-line'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Kotak pencarian */}
            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
              <input
                type="text"
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                placeholder="Cari nama merchant..."
                aria-label="Cari transaksi"
                className="w-full rounded-xl border border-line bg-white py-2.5 pl-9 pr-3 text-sm text-forest outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            {filteredHistory.length === 0 ? (
              <div className="py-10 text-center">
                <History className="mx-auto h-10 w-10 text-line" aria-hidden />
                <p className="mt-2 text-sm text-muted">
                  {displayHistory.length === 0
                    ? 'Belum ada transaksi. Yuk, mulai dari tab Scan!'
                    : 'Tidak ada transaksi yang cocok dengan filter.'}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {filteredHistory.map(tx => (
                  <li key={tx.id} className="flex items-center justify-between gap-3 py-3 transition-colors hover:bg-ivory/60">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ivory text-base">
                      🧾
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-forest">
                        {tx.merchantName}
                      </p>
                      <p className="text-xs text-muted">
                        {tx.date} · Rp{tx.originalAmount.toLocaleString('id-ID')}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="hidden rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-brand sm:inline">
                        Berhasil
                      </span>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold tabular-nums text-brand">
                        +Rp{tx.savingsAmount.toLocaleString('id-ID')}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </main>
      )}
      {/* ===== Tab Evolusi — perjalanan Level 1 → 10 ===== */}
      {activeTab === 'evolve' && (
        <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-6 pb-28 sm:px-6 md:pb-10">
          <div className="mb-4">
            <h2 className="text-lg font-black tracking-tight text-forest">Perjalanan Evolusi Aseta</h2>
            <p className="text-xs text-muted">
           
            </p>
          </div>

          {/* Tiga fase evolusi (stage) */}
          <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {EVOLUTION_STAGES.map(stage => {
              const reached = mascot.level >= stage.minLevel;
              return (
                <div
                  key={stage.stage}
                  className={`flex items-center gap-3 rounded-2xl border p-4 transition-shadow ${reached ? 'border-line bg-white shadow-sm' : 'border-dashed border-line bg-ivory/60 opacity-60'}`}
                >
                  <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${stage.tint}`}>
                    <Image
                      src={stage.gif}
                      alt={stage.stage}
                      width={48}
                      height={48}
                      unoptimized
                      className={`h-11 w-11 object-contain ${reached ? '' : 'grayscale'}`}
                    />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-forest">{stage.stage}</p>
                    <p className="text-[11px] font-semibold text-muted">{stage.range}</p>
                    {reached && (
                      <p className="mt-0.5 text-[10px] font-bold text-brand">✓ Tercapai</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Daftar 10 level */}
          <div className="rounded-2xl border border-line bg-white p-5">
            <h3 className="mb-3 text-sm font-bold text-forest">Rincian 10 Level</h3>
            <ul className="space-y-2">
              {LEVEL_TITLES.map((title, idx) => {
                const lv = idx + 1;
                const reached = mascot.level >= lv;
                const current = mascot.level === lv;
                const needXp = LEVEL_TARGETS[idx];
                const stageEmoji =
                  lv <= 3 ? '🥚' : lv <= 6 ? '🐣' : lv === 10 ? '🏆' : '🐉';
                return (
                  <li
                    key={lv}
                    className={`flex items-center gap-3 rounded-xl border p-3 ${
                      current
                        ? 'border-emerald-300 bg-emerald-50/60 ring-1 ring-inset ring-emerald-200'
                        : reached
                        ? 'border-line bg-ivory/60'
                        : 'border-line bg-white'
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                        current ? 'bg-brand text-white' : reached ? 'bg-sage/30 text-forest' : 'bg-line text-muted'
                      }`}
                    >
                      {lv}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-forest">
                        {stageEmoji} {title}
                      </p>
                      <p className="text-[11px] tabular-nums text-muted">
                        Butuh {needXp.toLocaleString('id-ID')} XP · {lv === 10 ? 'Level Maksimal' : `Lulus di ${LEVEL_TARGETS[idx].toLocaleString('id-ID')} XP level ini`}
                      </p>
                    </div>
                    {current && (
                      <span className="shrink-0 rounded-full bg-brand px-2.5 py-1 text-[10px] font-bold text-white">
                        Sekarang
                      </span>
                    )}
                    {reached && !current && (
                      <span className="shrink-0 text-brand" aria-label="Tercapai">
                        ✓
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </main>
      )}

      {/* ===== Bottom Navigation — Mobile (md:hidden) ===== */}
      <nav
        aria-label="Navigasi bawah"
        className="fixed bottom-0 left-1/2 z-50 w-full max-w-md -translate-x-1/2 border-t border-line bg-white/95 backdrop-blur-md md:hidden"
      >
        <div className="flex items-stretch justify-around px-2 py-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            aria-current={activeTab === 'home' ? 'page' : undefined}
            className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-semibold transition-colors ${activeTab === 'home' ? 'bg-emerald-50 text-brand' : 'text-muted'}`}
          >
            <Home className="h-5 w-5" aria-hidden />
            Beranda
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('scan')}
            data-tour="scan-nav"
            aria-current={activeTab === 'scan' ? 'page' : undefined}
            className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-semibold transition-colors ${isTourActive && tourStep === 3 ? 'relative z-50 ring-4 ring-emerald-400 ring-offset-2 bg-white' : ''} ${activeTab === 'scan' ? 'bg-emerald-50 text-brand' : 'text-muted'}`}
          >
            <QrCode className="h-5 w-5" aria-hidden />
            Scan
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            aria-current={activeTab === 'history' ? 'page' : undefined}
            className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-semibold transition-colors ${activeTab === 'history' ? 'bg-emerald-50 text-brand' : 'text-muted'}`}
          >
            <History className="h-5 w-5" aria-hidden />
            Riwayat
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('evolve')}
            aria-current={activeTab === 'evolve' ? 'page' : undefined}
            className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-semibold transition-colors ${activeTab === 'evolve' ? 'bg-emerald-50 text-brand' : 'text-muted'}`}
          >
            <Sparkles className="h-5 w-5" aria-hidden />
            Evolusi
          </button>
        </div>
      </nav>

      {/* ===== Toast — fixed di atas layar, hilang otomatis 3 detik ===== */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            key={toastMessage}
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className="fixed left-1/2 top-5 z-50 flex max-w-[90vw] -translate-x-1/2 items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm"
          >
            <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" aria-hidden />
            <span className="truncate">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
      {/* ===== Modal Reset Data ===== */}
      <AnimatePresence>
        {showResetModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setShowResetModal(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Konfirmasi reset data"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: 'spring', stiffness: 320, damping: 24 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl border border-line bg-white p-6 shadow-sm"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-50">
                <RotateCcw className="h-6 w-6 text-rose-500" aria-hidden />
              </span>
              <h2 className="mt-4 text-lg font-black text-forest">Reset semua data?</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                Tabungan, XP, streak, misi, dan riwayat akan dihapus permanen. Saldo dompet
                kembali ke Rp2.500.000.
              </p>
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="flex-1 rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-muted transition-colors hover:bg-ivory"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex-1 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-rose-700"
                >
                  Ya, Reset
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* ===== Modal Pencairan Aset ===== */}
      <AnimatePresence>
        {showLiquidateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setShowLiquidateModal(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Pencairan aset portofolio"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: 'spring', stiffness: 320, damping: 24 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl border border-line bg-white p-6 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-forest">Cairkan Aset</h2>
                  <p className="text-xs text-muted">
                    Dana masuk kembali ke Saldo Dompet utama
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLiquidateModal(false)}
                  aria-label="Tutup"
                  className="rounded-full p-1.5 text-muted transition-colors hover:bg-line hover:text-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Pilihan sumber pencairan */}
              <div className="mt-4 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Pilih sumber pencairan">
                {(
                  [
                    { id: 'gold', label: 'Emas' },
                    { id: 'reksadana', label: 'Reksadana' },
                    { id: 'all', label: 'Semua' },
                  ] as const
                ).map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={liquidateTarget === opt.id}
                    onClick={() => setLiquidateTarget(opt.id)}
                    className={`rounded-xl border px-2 py-2.5 text-xs font-bold transition-colors ${
                      liquidateTarget === opt.id
                        ? 'border-emerald-500 bg-emerald-50 text-brand'
                        : 'border-line text-muted hover:border-slate-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <label htmlFor="liquidateAmount" className="mt-4 block text-xs font-semibold text-muted">
                Nominal pencairan (Rp)
              </label>
              <input
                id="liquidateAmount"
                type="number"
                min={0}
                inputMode="numeric"
                placeholder="0"
                value={liquidateAmount}
                onChange={e => setLiquidateAmount(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm tabular-nums text-forest outline-none transition-colors focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />

              <button
                type="button"
                onClick={handleLiquidate}
                className="mt-4 w-full rounded-xl bg-brand px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-dark"
              >
                Konfirmasi Pencairan
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* ===== Onboarding Tour Overlay ===== */}
      {isMounted && isTourActive && (
        <>
          {/* Backdrop gelap polos — TANPA blur agar spotlight tampil tajam */}
          <div
            aria-hidden
            className="fixed inset-0 z-40 bg-black/75 transition-opacity"
            onClick={finishTour}
          />

          {/* Ring spotlight pada elemen yang disorot (z-50 sudah di elemen tsb) */}
          {tourRect && (
            <div
              aria-hidden
              className="pointer-events-none fixed z-55 rounded-2xl ring-4 ring-emerald-400 ring-offset-2 ring-offset-slate-900 transition-all duration-300 ease-out"
              style={{
                left: tourRect.left - 6,
                top: tourRect.top - 6,
                width: tourRect.width + 12,
                height: tourRect.height + 12,
              }}
            />
          )}

          {/* Tooltip card melayang di tengah-bawah */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Panduan langkah ${tourStep + 1} dari ${TOUR_STEPS.length}`}
            className="fixed bottom-12 left-1/2 z-60 w-[90%] max-w-sm -translate-x-1/2 rounded-2xl border border-line bg-white p-5 shadow-sm"
          >
            <div className="flex items-start gap-3">
              {/* Pakai `mascot.gif` yang sama persis dengan kartu utama — sebelumnya
                  hardcode `level >= 2 ? baby : egg` sehingga maskot Lv 7+
                  (Aseta Mandiri / naga dewasa) tetap tampil sebagai bayi
                  di tooltip tour. */}
              <Image
                src={mascot.gif}
                alt=""
                width={48}
                height={48}
                unoptimized
                className="h-12 w-12 shrink-0 rounded-full bg-emerald-50 object-contain"
              />
              <div className="min-w-0">
                <p className="text-xs font-bold text-brand">
                  Langkah {tourStep + 1} / {TOUR_STEPS.length}
                </p>
                <h2 className="text-base font-black leading-tight text-forest">
                  {TOUR_STEPS[tourStep].title}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  {TOUR_STEPS[tourStep].body}
                </p>
              </div>
            </div>

            {/* Indikator langkah */}
            <div className="mt-4 flex justify-center gap-1.5" aria-hidden>
              {TOUR_STEPS.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${i === tourStep ? 'w-6 bg-emerald-500' : 'w-1.5 bg-slate-200'}`}
                />
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={finishTour}
                className="rounded-xl px-3 py-2 text-sm font-semibold text-muted transition-colors hover:text-muted"
              >
                Lewati
              </button>
              {tourStep < TOUR_STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setTourStep(s => s + 1)}
                  className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-dark"
                >
                  Lanjut
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    finishTour();
                    setActiveTab('scan');
                  }}
                  className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-dark"
                >
                  Coba Transaksi
                </button>
              )}
            </div>
          </div>
        </>
      )}
      </div>
    </div>
  );
}













