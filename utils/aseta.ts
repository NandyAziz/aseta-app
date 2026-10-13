export type MascotExpression = 'idle' | 'tap' | 'celebrate';

export function calculateRoundUp(amount: number): number {
  // Guard terhadap NaN/Infinity/pecahan agar tidak pernah membocorkan
  // nilai tak-terdefinisi ke balance (dibulatkan ke bawah → selalu bilangan bulat).
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const remainder = Math.floor(amount) % 5000;
  return remainder === 0 ? 0 : 5000 - remainder;
}

// ============================================================
// Sistem level eksponensial Aseta — 10 level (multiplier 2x).
// Target XP per level: Lv1 5.000 → Lv10 2.560.000 (MAX).
// Aset gambar yang tersedia: Telur (Lv 1-3), Bayi Naga (Lv 4-6),
// Naga Dewasa (Lv 7-10).
// ============================================================

export const MAX_LEVEL = 10;

// XP yang dibutuhkan untuk MENYELESAIKAN tiap level (indeks 0 = Lv 1).
export const LEVEL_TARGETS = [
  5000, 10000, 20000, 40000, 80000, 160000, 320000, 640000, 1280000, 2560000,
] as const;

export const LEVEL_TITLES = [
  'Penabung Pemula',
  'Pengumpul Koin',
  'Perencana Keuangan',
  'Pemburu Aset',
  'Investor Muda',
  'Ahli Portofolio',
  'Master Finansial',
  'Sultan Investasi',
  'Aseta Legend',
  'Sultan Aseta 🏆',
] as const;

/**
 * Batas tap maskot per hari untuk misi "Sapa Aseta (Tap Maskot 3x)".
 * Setelah batas ini tercapai, tap tetap memberi reaksi visual (getar +
 * balasan lisan) tetapi TIDAK lagi memutar animasi "+50 XP".
 *
 * XP 50 untuk misi ini tetap diberikan satu kali lewat `claimQuest('greet')`
 * di dashboard — bukan tiap tap. Partikel "+50 XP" hanya penanda progres
 * menuju klaim tersebut, bukan penambahan saldo.
 */
export const GREET_TAP_TARGET = 3;

// Ambang kumulatif: total XP agar NAIK dari level tersebut.
// Contoh: butuh 5.000 XP untuk lulus Lv 1, 15.000 total untuk lulus Lv 2.
const LEVEL_CUMULATIVE: number[] = (() => {
  const cum: number[] = [];
  let total = 0;
  for (const target of LEVEL_TARGETS) {
    total += target;
    cum.push(total);
  }
  return cum;
})();

export interface MascotInfo {
  level: number;
  name: string;
  title: string;
  gif: string;
}

function stageForLevel(level: number): { name: string; gif: string } {
  if (level <= 3) return { name: 'Telur Aseta', gif: '/mascot-egg.gif' };
  if (level <= 6) return { name: 'Aseta Muda', gif: '/mascot-baby.gif' };
  return { name: 'Aseta Mandiri', gif: '/mascot-adult.gif' };
}

/**
 * Resolusi `MascotInfo` dari SUATU level — dipakai `getMascotLevel()` di bawah
 * dan halaman panduan (`app/guide/page.tsx`) untuk memamerkan evolusi Lv 1-10.
 *
 * Dipisah agar tidak ada lagi salinan `stageForLevel()` / `LEVEL_TITLES[]` di
 * luar modul ini: GIF, nama tahap, dan rank dijamin berasal dari satu sumber.
 *
 * Level di-clamp ke rentang 1..MAX_LEVEL supaya input di luar jangkauan
 * (mis. slider di halaman panduan atau data localStorage rusak) tidak pernah
 * menyentuh indeks array yang tidak ada.
 */
export function mascotInfoForLevel(level: number): MascotInfo {
  const clamped = Math.min(MAX_LEVEL, Math.max(1, Math.floor(level) || 1));
  const stage = stageForLevel(clamped);
  return {
    level: clamped,
    name: stage.name,
    title: LEVEL_TITLES[clamped - 1],
    gif: stage.gif,
  };
}

/**
 * Total XP kumulatif yang dibutuhkan untuk mencapai `level` (indeks 0 = Lv 1).
 * Untuk level di luar rentang, nilai dikembalikan apa adanya.
 */
export function cumulativeXpForLevel(level: number): number {
  const idx = Math.min(MAX_LEVEL, Math.max(1, Math.floor(level) || 1)) - 1;
  return LEVEL_CUMULATIVE[idx];
}

export function getMascotLevel(balance: number): MascotInfo {
  const safe = Math.max(0, Math.floor(balance) || 0);
  let level = 1;
  while (level < MAX_LEVEL && safe >= LEVEL_CUMULATIVE[level - 1]) {
    level += 1;
  }
  return mascotInfoForLevel(level);
}

export function getXpProgress(balance: number): { current: number; next: number; percent: number } {
  const safe = Math.max(0, Math.floor(balance) || 0);
  const { level } = getMascotLevel(safe);
  if (level >= MAX_LEVEL) {
    return { current: LEVEL_TARGETS[MAX_LEVEL - 1], next: LEVEL_TARGETS[MAX_LEVEL - 1], percent: 100 };
  }
  const prevCum = level === 1 ? 0 : LEVEL_CUMULATIVE[level - 2];
  const target = LEVEL_TARGETS[level - 1];
  const current = Math.min(target, Math.max(0, safe - prevCum));
  return { current, next: target, percent: Math.min(100, Math.max(0, (current / target) * 100)) };
}
