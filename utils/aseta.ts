export type MascotExpression = 'idle' | 'tap' | 'celebrate';

export function calculateRoundUp(amount: number): number {
  // Guard against NaN/Infinity/fractions so undefined values never leak
  // into balance (floored → always an integer).
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const remainder = Math.floor(amount) % 5000;
  return remainder === 0 ? 0 : 5000 - remainder;
}

/**
 * Ceiling for the user-settable daily cap: Rp10,000,000.
 * Anything above this is unrealistic for a daily round-up simulation and
 * pushes the numbers on the "Batas Harian" card past the card edge.
 */
export const MAX_DAILY_CAP = 10_000_000;

/**
 * Formats an amount as Indonesian rupiah text with guards:
 * invalid values (NaN/Infinity/blank) become "0", negative values are
 * clamped to 0, and very large amounts (≥ 1 trillion) are written in
 * compact form (e.g. "Rp1,2 T") so text never overflows the UI.
 *
 * Used by every amount display — including the "Batas Harian" card.
 */
export function formatRupiah(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const safe = Math.max(0, Math.round(value));
  if (safe >= 1_000_000_000_000) {
    return new Intl.NumberFormat('id-ID', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(safe);
  }
  return safe.toLocaleString('id-ID');
}

/**
 * Clamps a daily-cap input to [0, MAX_DAILY_CAP] and rounds it to an
 * integer. The single entry point for `dailyCap` values coming from the
 * UI or from persisted state.
 */
export function clampDailyCap(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(MAX_DAILY_CAP, Math.max(0, Math.floor(value)));
}

// ============================================================
// Aseta's exponential level system — 10 levels (2x multiplier).
// XP target per level: Lv1 5,000 → Lv10 2,560,000 (MAX).
// Available image assets: Egg (Lv 1-3), Baby Dragon (Lv 4-6),
// Adult Dragon (Lv 7-10).
// ============================================================

export const MAX_LEVEL = 10;

// XP required to COMPLETE each level (index 0 = Lv 1).
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
 * Daily mascot tap limit for the "Sapa Aseta (Tap Maskot 3x)" quest.
 * Once this limit is reached, taps still give a visual reaction (shake +
 * spoken reply) but no longer play the "+50 XP" animation.
 *
 * The 50 XP for this quest is still granted once via
 * `claimQuest('greet')` in the dashboard — not on every tap. The "+50 XP"
 * particles only mark progress toward that claim, not a balance increase.
 */
export const GREET_TAP_TARGET = 3;

// Cumulative thresholds: total XP needed to GO UP from that level.
// Example: 5,000 XP to clear Lv 1, 15,000 total to clear Lv 2.
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

const MASCOT_NAMES = [
  'Telur Aseta',
  'Telur Aseta',
  'Telur Aseta',
  'Aseta Muda',
  'Aseta Muda',
  'Aseta Muda',
  'Aseta Dewasa',
  'Aseta Dewasa',
  'Aseta Dewasa',
  'Aseta Legenda',
] as const;

function stageForLevel(level: number): { name: string; gif: string } {
  const clamped = Math.min(MAX_LEVEL, Math.max(1, Math.floor(level) || 1));
  return {
    name: MASCOT_NAMES[clamped - 1],
    gif: `/mascot${clamped}.gif`,
  };
}

/**
 * Resolves `MascotInfo` for a SINGLE level — used by `getMascotLevel()`
 * below and by the dashboard's "Evolusi & Panduan" tab to showcase the
 * Lv 1-10 evolution.
 *
 * Split out so there are no more copies of `stageForLevel()` /
 * `LEVEL_TITLES[]` outside this module: GIF, stage name, and rank are
 * guaranteed to come from one source.
 *
 * The level is clamped to 1..MAX_LEVEL so out-of-range input
 * (e.g. a slider on the guide page or corrupted localStorage data) never
 * touches a non-existent array index.
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
 * Total cumulative XP needed to reach `level` (index 0 = Lv 1).
 * For levels outside the range, the value is returned as-is.
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
