'use client';

import { useState, useSyncExternalStore, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { CameraOff, HelpCircle, Home, QrCode, History, X, RotateCcw, Sparkles, Search } from "lucide-react";
import confetti from 'canvas-confetti';
import jsQR from 'jsqr';
import { calculateRoundUp, getMascotLevel, getXpProgress, formatRupiah, clampDailyCap, MAX_LEVEL, LEVEL_TARGETS, GREET_TAP_TARGET } from '@/utils/aseta';
import { playTapSound, playCoinSound, playLevelUpSound, playLimitSound } from '@/utils/sound';
import { parseQrPayload } from '@/utils/qris';
import type { MascotExpression } from '@/utils/aseta';
import { mascotAura, MascotEvolutionMotes } from '@/components/MascotAura';
import EvolveGuideView from '@/components/EvolveGuideView';
import AnalyticsTabs from '@/components/dashboard/AnalyticsTabs';
import DailyLimit from '@/components/dashboard/DailyLimit';
import DailyMissions from '@/components/dashboard/DailyMissions';
import PortfolioAllocation from '@/components/dashboard/PortfolioAllocation';
import QuickTransactions from '@/components/dashboard/QuickTransactions';
import type { QuickPreset } from '@/components/dashboard/QuickTransactions';
import SavingsProjection from '@/components/dashboard/SavingsProjection';
import TotalAssetsSummary from '@/components/dashboard/TotalAssetsSummary';
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

// Pesan dynamic pet speech bubble — diputar saat maskot di-tap
const PET_LINES = [
  'Uang kembalianmu udah aku putar ke Emas Digital ya! 🐉✨',
  'Semakin rajin nabung, semakin cepat aku evolusi!',
  'Asetmu aman, aku jagain terus 24/7!',
  'Zzz... 🥚',
  'Yuk scan struk lagi, tinggal sedikit lagi ke level berikutnya!',
] as const;

const GOLD_GRAM_PRICE = 1_200_000; // simulasi harga emas Rp/gram

// Jumlah misi harian yang ditampilkan (harus sinkron dengan `DailyMissions`).
// Dipakai untuk pembilang chip "Misi Harian (n/3)".
const QUEST_TOTAL = 3;

// --- Parameter loop pemindaian QR ---
// Decoding dibatasi ~6 fps: cukup untuk menangkap QR yang dipegang statis,
// tapi tidak mengunci CPU saat kamera menyala.
const SCAN_INTERVAL_MS = 160;
// Sisi terpanjang frame yang di-decode. Resolusi penuh kamera (1080p+)
// mahal dan tidak menambah peluang deteksi yang berarti.
const SCAN_MAX_EDGE = 480;

// Balasan maskot saat tap harian sudah melewati batas GREET_TAP_TARGET —
// tetap ramah, tidak menghakimi, dan memberi arahan tastyuk berikutnya.
const PET_LINES_LIMIT = [
  'Aku udah kekenjangan sapa hari ini, deh! 😴',
  'Batas sapa hari ini habis — tapi maskotmu tetap senang kok!',
  'Oke, cukup sapa buat hari ini. Yuk, tabung receh! 🐉',
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
    dailyCap: clampDailyCap(num(parsed.dailyCap, INITIAL_STATE.dailyCap)),
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
  // --- Kamera sungguhan (getUserMedia) ---
  // Siklus hidup: idle → starting → live, atau idle → denied/error (fallback).
  // Demo mode dipisah dari kamera: tidak pernah menyentuh state keuangan,
  // hanya menampilkan toast konfirmasi strut tiruan.
  type CameraState = 'idle' | 'starting' | 'live' | 'denied' | 'unsupported';
  const [cameraState, setCameraState] = useState<CameraState>('idle');
  const [cameraError, setCameraError] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Canvas off-screen khusus grabs frame kamera untuk decoding jsQR.
  const scanCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const scanRafRef = useRef<number | null>(null);
  const lastScanAtRef = useRef<number>(0);
  // Hasil scan terakhir (payload mentah + hasil parse) untuk ditampilkan di modal.
  const [scanResult, setScanResult] = useState<{ amount: number | null; merchantName: string | null } | null>(null);
  const [showScanModal, setShowScanModal] = useState<boolean>(false);
  // Kilatan singkat saat QR berhasil tertangkap.
  const [scanFlash, setScanFlash] = useState<boolean>(false);
  /** Matikan stream kamera, batalkan loop decoding, dan lepaskan resource-nya. */
  const stopCamera = useCallback(() => {
    if (scanRafRef.current !== null) {
      cancelAnimationFrame(scanRafRef.current);
      scanRafRef.current = null;
    }
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);
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

  // Matikan kamera saat komponen di-unmount ATAU pengguna pindah tab —
  // tanpa ini, LED kamera terus menyala setelah tab Scan ditinggalkan.
  useEffect(() => {
    if (activeTab !== 'scan') stopCamera();
  }, [activeTab, stopCamera]);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

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
  // Preset transaksi cepat — hanya dipanggil saat tombol "Tabung" diklik.
  function handleQuickSave(preset: QuickPreset) {
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

  /**
   * QR tertangkap → parse payload → flash + getaran singkat → buka modal.
   *
   * Tidak pernah menyentuh state keuangan: modal hanya menampilkan hasil baca
   * dan meng-prefill input nominal. Penabung tetap harus dikonfirmasi user.
   */
  const handleQrDetected = useCallback((payload: string) => {
    const parsed = parseQrPayload(payload);
    setScanResult({ amount: parsed.amount, merchantName: parsed.merchantName });

    // Flash + haptic: konfirmasi taktil singkat bahwa QR terbaca.
    setScanFlash(true);
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(60);
    }
    playCoinSound();

    // Beri jeda singkat agar kilatan terlihat, lalu buka modal.
    setTimeout(() => {
      setScanFlash(false);
      setShowScanModal(true);
    }, 420);

    // Pre-fill input manual + merchant supaya alur bersambung.
    if (parsed.amount) setAmountInput(String(parsed.amount));
    if (parsed.merchantName) setMerchantInput(parsed.merchantName);
  }, []);

  /**
   * Loop pemindaian: grabs frame dari <video> ke canvas off-screen lalu
   * meneruskannya ke jsQR. Dijalankan via requestAnimationFrame.
   *
   * Mode `attemptBoth` dicoba — sebagian QRIS tercetak terang di atas gelap, sebagian
   * sebaliknya, jadi dua mode diwahyuan agar peluang deteksi tinggi.
   *
   * Pembatasan: decoding dibatasi ~6 fps (lihat SCAN_INTERVAL_MS) supaya CPU
   * tidak terjebak 100% saat kamera aktif. Setelah payload valid tertangkap,
   * loop berhenti supaya satu QR tidak memicu berulang kali.
   *
   * Bergantung pada `handleQrDetected` yang dideklarasikan DI ATAS-nya.
   */
  const startDecodeLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = scanCanvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const tick = () => {
      const now = Date.now();
      if (video.readyState === video.HAVE_ENOUGH_DATA && now - lastScanAtRef.current >= SCAN_INTERVAL_MS) {
        lastScanAtRef.current = now;
        // Batasi resolusi grabs — cukup untuk decode, jauh lebih murah.
        const w = Math.min(video.videoWidth || 0, SCAN_MAX_EDGE);
        const h = Math.min(video.videoHeight || 0, SCAN_MAX_EDGE);
        if (w > 0 && h > 0) {
          canvas.width = w;
          canvas.height = h;
          ctx.drawImage(video, 0, 0, w, h);
          let imageData: ImageData;
          try {
            imageData = ctx.getImageData(0, 0, w, h);
          } catch {
            // Cross-origin / tainted canvas — abaikan frame ini saja.
            imageData = null as unknown as ImageData;
          }
          if (imageData) {
            const found =
              jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' }) ??
              jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' });
            if (found?.data) {
              handleQrDetected(found.data);
              return; // loop berhenti; pengguna yang memutuskan selanjutnya
            }
          }
        }
      }
      scanRafRef.current = requestAnimationFrame(tick);
    };

    scanRafRef.current = requestAnimationFrame(tick);
  }, [handleQrDetected]);

  /**
   * "Mulai Scan" — meminta akses kamera sungguhan lewat `getUserMedia`.
   *
   * Tidak memakai library pihak ketiga (html5-qrcode dsb.) agar tidak menambah
   * dependensi; API ini sudah tersedia di browser modern.
   *
   * Kegagalan ditangani eksplisit: kamera tidak ada / konteks tidak aman /
   * izin ditolak → state `denied` atau `unsupported` → frame menampilkan
   * fallback dengan tombol "Gunakan Mode Demo", sehingga alur uji tidak pernah
   * buntu. Tidak ada mutasi state keuangan di fungsi ini.
   */
  async function handleScan() {
    if (cameraState === 'starting' || cameraState === 'live') return;
    setCameraError('');

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraState('unsupported');
      setCameraError(
        typeof window !== 'undefined' && !window.isSecureContext
          ? 'Kamera hanya bisa diakses lewat HTTPS atau di localhost.'
          : 'Browser ini tidak mendukung akses kamera.'
      );
      return;
    }

    setCameraState('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // play() bisa reject bila belum ada interaksi pengguna — abaikan saja;
        // video tetap menampilkan frame pertama setelah pengguna berinteraksi.
        await videoRef.current.play().catch(() => undefined);
      }
      setCameraState('live');
      startDecodeLoop();
    } catch (err) {
      stopCamera();
      const name = err instanceof DOMException ? err.name : '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setCameraState('denied');
        setCameraError('Izin kamera ditolak. Izinkan akses kamera di pengaturan browser lalu coba lagi.');
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        setCameraState('denied');
        setCameraError('Tidak ada kamera yang bisa diakses di perangkat ini.');
      } else {
        setCameraState('denied');
        setCameraError('Kamera gagal dimuat. Coba lagi atau lanjutkan dengan mode demo.');
      }
    }
  }

  /** Berhenti kamera & kembali ke frame idle. */
  function handleStopCamera() {
    stopCamera();
    setCameraState('idle');
    setCameraError('');
  }

  /**
   * Mode demo — simulasi pemindaian murni yang TIDAK menyentuh kamera maupun
   * state keuangan apa pun. Tetap tersedia saat kamera ditolak agar fitur
   * utama (alur tabung) tetap bisa dicoba.
   */
  function handleDemoScan() {
    stopCamera();
    setCameraState('idle');
    setCameraError('');
    showToast('Mode demo — strut tiruan terbaca. Pilih preset untuk menabung.');
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

  /** Buka modal pencairan dengan nominal kosong — dipakai oleh kartu
   *  "Alokasi Portofolio" baik di desktop maupun di dalam tab mobile. */
  function handleOpenLiquidate() {
    setShowLiquidateModal(true);
    setLiquidateAmount('');
  }

  function handleSaveDailyCap() {
    const value = clampDailyCap(dailyCapDraft);
    setState(prev => ({ ...prev, dailyCap: value }));
    setDailyCapDraft(value);
    showToast(`Batas harian diperbarui: Rp${formatRupiah(value)}`);
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
  // Jumlah misi yang SUDAH diklaim (0..QUEST_TOTAL). Dipakai untuk chip
  // "Misi Harian (n/3)" pada kartu hero maskot di tab Beranda.
  const missionsClaimed =
    [qrisClaimed, depositClaimed, greetClaimed].filter(Boolean).length;
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
    /* `w-full max-w-full overflow-x-hidden` sebagai pagar terakhir: konten
       tab (mis. deretan Preset Belanja) tidak boleh melebarkan layar di HP. */
    <div className="flex min-h-screen w-full max-w-full overflow-x-hidden bg-ivory text-forest antialiased">
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
            { id: 'evolve', label: 'Evolusi & Panduan', Icon: Sparkles },
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

        {/* Tombol bawah sidebar: memutar ulang onboarding tour (overlay modal).
            Panduan lengkap sudah tersedia sebagai tab "Evolusi & Panduan"
            di navigasi utama, jadi tidak ada lagi route /guide terpisah. */}
        <div className="mt-auto p-3">
          <button
            type="button"
            onClick={restartTour}
            title="Ulangi Panduan"
            aria-label="Ulangi panduan onboarding"
            className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-muted transition-colors hover:bg-ivory hover:text-brand"
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

        {/* --- Grid utama: dua kolom pada desktop (kiri 7 dari 12, kanan 5
            dari 12). Pada mobile semuanya menjadi satu kolom dengan urutan:
            hero (berisi chip pintasan Misi Harian) → analitik gabungan →
            transaksi cepat → batas harian (akordeon tertutup). Kartu
            "Misi Hari Ini" penuh tidak lagi ada di sini — sudah pindah ke
            tab "Evolusi". --- */}
      <div className="grid flex-1 grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {/* ===== Kolom kiri (desktop): hero maskot, total aset, alokasi ===== */}
        <div className="flex flex-col gap-6 lg:col-span-7">
        {/* --- Hero Maskot: fokus visual utama aplikasi. Di desktop isinya
            dibagi dua kolom internal (panggung maskot | ringkasan aset + XP)
            supaya kartu selebar 7 kolom tidak menyisakan rongga putih. --- */}
        <section
          data-tour="hero-mascot"
          className={`flex flex-col gap-3 rounded-2xl border border-line bg-white p-4 sm:p-5 ${isTourActive && tourStep === 0 ? 'relative z-50 ring-4 ring-emerald-400 ring-offset-2' : ''}`}
        >
          {/* Header: streak + badge level */}
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/70 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
              🔥 {displayStreak} Hari
            </span>
            {/* Badges level */}
            <span
              className="inline-flex items-center gap-1 rounded-full border border-amber-300/60 bg-gold px-2.5 py-1 text-xs font-black text-forest"
              title={mascot.title}
            >
              Lv. {mascot.level}
            </span>
          </div>

          {/* Badan kartu: dua kolom internal pada desktop. Pada mobile tetap
              satu kolom sehingga maskot → total aset → XP tetap berurutan
              vertikal dan fokus utama ada di paling atas. */}
          <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:items-center lg:gap-6">
            <div className="flex flex-col items-center gap-2">
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
            </div>

            <div className="flex flex-col gap-3">
            {/* Total Aset: nominal utama + breakdown (Tabungan · Dompet · Imbal
              hasil). Blok ini mengisi kolom kanan dari badan kartu hero. */}
          <TotalAssetsSummary
            totalWealth={totalWealth}
            monthlyReturn={monthlyReturn}
            invested={investedPortion}
            wallet={walletPortion}
            today={displayToday}
          />

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

          {/* Chip Misi Harian — KHUSUS MOBILE (`lg:hidden`). Di feed Beranda
              mobile kartu misi penuh disembunyikan (ada di tab "Evolusi"),
              jadi chip inilah pintasannya. Di desktop chip ini disembunyikan
              karena kartu "Misi Hari Ini" tetap tampil di kolom kanan Beranda.
              Angka = misi yang SUDAH diklaim, diturunkan dari status misi
              ber-guard `isMounted` sehingga bebas mismatch hydration. */}
          <div className="lg:hidden">
            <button
              type="button"
              onClick={() => setActiveTab('evolve')}
              aria-label={`Misi Harian: ${missionsClaimed} dari ${QUEST_TOTAL} misi sudah diklaim. Buka tab Evolusi untuk klaim XP`}
              className="flex w-full min-h-11 items-center justify-between gap-2 rounded-xl border border-line bg-ivory/70 px-3 py-2 text-xs font-semibold text-forest transition-colors hover:border-emerald-200 hover:bg-emerald-50 active:scale-[0.99] sm:min-h-0"
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <span aria-hidden>🎯</span>
                <span className="truncate">Misi Harian</span>
                <span className="tabular-nums text-muted">
                  ({missionsClaimed}/{QUEST_TOTAL})
                </span>
              </span>
              <span className="shrink-0 text-brand" aria-hidden>
                →
              </span>
            </button>
          </div>
            </div>
          </div>
        </section>

        {/* --- Alokasi Portofolio sebagai kartu penuh (desktop, kolom kiri).
            Pada mobile kartu ini disembunyikan karena isinya sudah tampil di
            dalam tab "Portofolio" widget analitik gabungan. --- */}
        <div className="hidden lg:block">
          <PortfolioAllocation
            highlight={isTourActive && tourStep === 1}
            goldValue={goldValue}
            reksaValue={reksaValue}
            goldGrams={goldGrams}
            growthSeries={growthSeries}
            onLiquidate={handleOpenLiquidate}
          />
        </div>

        {/* --- Widget analitik gabungan (khusus mobile): "Alokasi Portofolio"
            dan "Proyeksi Tabungan" menjadi satu kartu dua tab supaya feed
            utama tidak perlu digulir lebih dari dua layar. --- */}
        <AnalyticsTabs
          className="lg:hidden"
          highlight={isTourActive && tourStep === 1}
          goldValue={goldValue}
          reksaValue={reksaValue}
          goldGrams={goldGrams}
          growthSeries={growthSeries}
          onLiquidate={handleOpenLiquidate}
        />
        </div>

        {/* ===== Kolom kanan: transaksi cepat, misi harian, proyeksi, dan
            batas harian. Pada mobile kolom ini tampil setelah widget
            analitik gabungan. ===== */}
        <div className="flex flex-col gap-6 lg:col-span-5">
          {/* Deretan chip aksi yang bisa digeser horizontal di mobile. */}
          <QuickTransactions onSave={handleQuickSave} />

          {/* Misi Hari Ini — KHUSUS DESKTOP (`hidden lg:block`), kembali ke kolom
              kanan feed Beranda. Pada mobile disembunyikan supaya feed utama
              tidak memanjang; misinya pindah ke tab "Evolusi"
              (lihat <EvolveGuideView missions={...} />) dan diakses lewat
              chip pintasan di kartu hero maskot. */}
          <div className="hidden lg:block">
            <DailyMissions
              qrisDone={qrisDone}
              qrisClaimed={qrisClaimed}
              depositDone={depositDone}
              depositClaimed={depositClaimed}
              greetDone={greetDone}
              greetClaimed={greetClaimed}
              greetTapsUsed={greetTapsUsed}
              onClaim={claimQuest}
            />
          </div>

          {/* Proyeksi Tabungan sebagai kartu penuh — hanya desktop. */}
          <div className="hidden lg:block">
            <SavingsProjection />
          </div>

          {/* Batas Harian: kartu terbuka penuh di desktop. */}
          <div className="hidden lg:block">
            <DailyLimit
              today={displayToday}
              cap={displayCap}
              remaining={capRemaining}
              percent={capPercent}
              exhausted={capExhausted}
              draft={dailyCapDraft}
              onDraftChange={setDailyCapDraft}
              onSave={handleSaveDailyCap}
            />
          </div>

          {/* Batas Harian versi mobile: akordeon tertutup secara default
              supaya isi feed utama tetap di bawah dua guliran. */}
          <div className="lg:hidden">
            <DailyLimit
              collapsible
              today={displayToday}
              cap={displayCap}
              remaining={capRemaining}
              percent={capPercent}
              exhausted={capExhausted}
              draft={dailyCapDraft}
              onDraftChange={setDailyCapDraft}
              onSave={handleSaveDailyCap}
            />
          </div>
        </div>
      </div>
      </main>
      )}

      {/* ===== Tab Scan (QRIS) — tampilan bersih, tanpa mutasi state ===== */}
      {activeTab === 'scan' && (
        <main className="mx-auto w-full min-w-0 max-w-2xl px-4 py-6 pb-28 sm:px-6 md:pb-10">
          <div className="rounded-2xl border border-line bg-white p-5">
            <h2 className="text-base font-bold text-forest">Scan QRIS</h2>
            <p className="text-xs text-muted">
              Arahkan kamera ke struk QRIS merchant.
            </p>

            {/* Frame scanner: menampilkan feed kamera sungguhan, atau fallback
                yang bersih ketika izin kamera ditolak / tidak didukung. */}
            <div className="relative mt-4 flex aspect-4/3 w-full max-w-full items-center justify-center overflow-hidden rounded-2xl bg-slate-900">
              {/* Canvas off-screen untuk grabs frame → jsQR. Tidak terlihat. */}
              <canvas ref={scanCanvasRef} className="hidden" aria-hidden />
              {/* Feed kamera — selalu di-mount agar ref stabil; visibilitas
                  dikendalikan opacity agar tidak berkedip saat state berubah. */}
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                aria-label="Pratinjau kamera"
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
                  cameraState === 'live' ? 'opacity-100' : 'opacity-0'
                }`}
              />

              {cameraState !== 'live' && (
                <>
                  {/* Fallback kamera ditolak / tidak didukung */}
                  {(cameraState === 'denied' || cameraState === 'unsupported') && (
                    <div className="relative z-10 flex max-w-xs flex-col items-center px-6 text-center">
                      <CameraOff className="h-8 w-8 text-emerald-300/70" aria-hidden />
                      <p className="mt-2 text-xs leading-snug text-emerald-100">{cameraError}</p>
                      <button
                        type="button"
                        onClick={handleDemoScan}
                        className="mt-3 min-h-11 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-600 sm:min-h-0"
                      >
                        Gunakan Mode Demo
                      </button>
                    </div>
                  )}

                  {/* Idle / sedang meminta izin */}
                  {cameraState !== 'denied' && cameraState !== 'unsupported' && (
                    <>
                      <div className="absolute inset-6 rounded-xl border-2 border-dashed border-emerald-400/60" aria-hidden />
                      <QrCode
                        className={`h-16 w-16 text-emerald-300/70 ${cameraState === 'starting' ? 'animate-pulse' : ''}`}
                        aria-hidden
                      />
                      <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-[11px] font-medium text-emerald-200">
                        {cameraState === 'starting' ? 'Meminta izin kamera...' : 'Kamera belum aktif'}
                      </span>
                    </>
                  )}
                </>
              )}

              {/* Bingkai + garis laser pemindaian — tetap tampil di atas feed live. */}
              <div className="pointer-events-none absolute inset-6 rounded-xl border-2 border-dashed border-emerald-400/60" aria-hidden />
              {(cameraState === 'live' || cameraState === 'starting') && (
                <div
                  aria-hidden
                  className="absolute inset-x-6 top-1/2 h-0.5 bg-emerald-400 shadow-[0_0_12px_2px_rgba(16,185,129,0.7)]"
                />
              )}
              {cameraState === 'live' && (
                <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-[11px] font-medium text-emerald-200">
                  Kamera aktif — arahkan ke QRIS
                </span>
              )}
              {/* Kilatan putih singkat saat QR berhasil tertangkap. */}
              {scanFlash && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 z-20 animate-scan-flash bg-white/70"
                />
              )}
            </div>

            <div className="mt-4 flex flex-col gap-2">
              {cameraState === 'live' ? (
                <button
                  type="button"
                  onClick={handleStopCamera}
                  className="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm font-bold text-forest transition-colors hover:bg-ivory"
                >
                  Hentikan Kamera
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleScan}
                  disabled={cameraState === 'starting'}
                  className="w-full rounded-xl bg-brand px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-dark disabled:cursor-wait disabled:bg-slate-300"
                >
                  {cameraState === 'starting' ? 'Meminta izin...' : 'Mulai Scan'}
                </button>
              )}
              <p className="text-center text-[11px] text-muted">
                Kamera hanya dipakai di frame ini. Preset Belanja di bawah langsung menabung
                tanpa membuka kamera.
              </p>
            </div>
          </div>
          {/* Preset belanja — pembayaran instan, tanpa kamera. Komponen yang
              sama dengan tab Beranda, hanya label tombolnya "Bayar". */}
          <div className="mt-4">
            <QuickTransactions
              title="Preset Belanja"
              subtitle="Klik “Bayar” untuk langsung menabung recehnya."
              actionLabel="Bayar"
              onSave={handleQuickSave}
            />
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

      {/* ===== Tab Evolusi & Panduan — pratinjau level 1-10 + walkthrough fitur =====
          Slot `missions` (kartu "Misi Hari Ini") hanya dirender di dalam tab
          ini pada MOBILE — pada desktop misinya tetap di kolom kanan Beranda
          dan slot ini disembunyikan `lg:hidden` di dalam EvolveGuideView agar
          tidak tampil dua kali. */}
      {activeTab === 'evolve' && (
        <EvolveGuideView
          missions={
            <DailyMissions
              qrisDone={qrisDone}
              qrisClaimed={qrisClaimed}
              depositDone={depositDone}
              depositClaimed={depositClaimed}
              greetDone={greetDone}
              greetClaimed={greetClaimed}
              greetTapsUsed={greetTapsUsed}
              onClaim={claimQuest}
            />
          }
        />
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
      {/* ===== Modal Hasil Scan QR =====
          Menampilkan payload yang terbaca dari kamera. Modal INTI read-only:
          tidak pernah menambah tabungan. Penabung tetap lewat tombol
          "Simpan & Tabungkan" di bawahnya (atau preset). */}
      <AnimatePresence>
        {showScanModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setShowScanModal(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Hasil pemindaian QR"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: 'spring', stiffness: 320, damping: 24 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl border border-line bg-white p-6 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-black text-forest">QR terbaca</h2>
                  <p className="mt-0.5 text-xs text-muted">
                    {scanResult?.merchantName ?? 'Merchant tidak terbaca'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowScanModal(false)}
                  aria-label="Tutup"
                  className="rounded-full p-1.5 text-muted transition-colors hover:bg-line"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {scanResult?.amount ? (
                <>
                  <p className="mt-4 text-2xl font-black tabular-nums text-forest">
                    Rp{scanResult.amount.toLocaleString('id-ID')}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Round-up ke atas: +Rp
                    {calculateRoundUp(scanResult.amount).toLocaleString('id-ID')}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowScanModal(false);
                      handleSave();
                    }}
                    className="mt-4 w-full rounded-xl bg-brand px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-dark"
                  >
                    Simpan &amp; Tabungkan
                  </button>
                </>
              ) : (
                <>
                  <p className="mt-4 rounded-xl border border-line bg-ivory p-3 text-xs leading-snug text-muted">
                    QR ini tidak memuat nominal, jadi tidak bisa dihitung otomatis. Isi nominal
                    manual di bawah, atau pilih preset.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowScanModal(false)}
                    className="mt-4 w-full rounded-xl bg-brand px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-dark"
                  >
                    Isi Manual
                  </button>
                </>
              )}
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













