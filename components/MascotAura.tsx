'use client';

import { motion } from 'framer-motion';
import { MAX_LEVEL } from '@/utils/aseta';

/**
 * Mascot stage: aura backlight + atmospheric particles.
 *
 * Split out of `app/dashboard/page.tsx` into its own module so the dashboard's
 * "Evolusi & Panduan" tab can use the EXACT SAME effect without duplicating the
 * level table. One source of truth for the visual effect.
 *
 * Rules (maintained from the initial version):
 * - All effects stay BEHIND the illustration — they never cover the artwork.
 * - Opacity is kept low so it looks natural; intensity rises monotonically per level.
 */

/** Progressive mascot stage aura based on level (1-10). */
export function mascotAura(level: number): {
  glow: string;
  glowAnim: string;
  ring: string;
  scale: string;
  breathe: string;
  imgShadow: string;
} {
  // Lv 10 — Sultan Aseta: layered gold + cyan aura, pulse, maximum backlight.
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
  // Lv 9 — Aseta Legend: bright gold + cyan accents, active pulse.
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
  // Lv 8 — matured Naga Dewasa: deep gold, strong layered backlight.
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
  // Lv 7 — Naga Dewasa: gold arrives, the multi-layer effect just starts to show.
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
  // Lv 6 — Bayi Naga emerges: strong emerald, wider aura, higher scale.
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
  // Lv 5 — Bayi Naga: emerald starts glowing, ring gets firmer.
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
  // Lv 4 — Bayi Naga hatches: the first noticeable emerald backlight.
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
  // Lv 3 — Telur about to hatch: brighter sage aura + "breathing".
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
  // Lv 2 — Telur: thin sage backlight + subtle "breathing".
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
  // Lv 1 — plain intact Telur: very faint aura, no pulse.
  return {
    glow: 'bg-slate-50/50 blur-xl',
    glowAnim: '',
    ring: 'ring-1 ring-line ring-offset-2 ring-offset-white',
    scale: '',
    breathe: '',
    imgShadow: 'drop-shadow-md',
  };
}

// Atmospheric dust position constants (module scope → passes React Compiler purity).
const AURA_DUST = [
  { id: 'd1', left: '10%', bottom: '16%', size: 4, delay: 0 },
  { id: 'd2', left: '26%', bottom: '30%', size: 3, delay: 0.9 },
  { id: 'd3', left: '70%', bottom: '22%', size: 4, delay: 1.6 },
  { id: 'd4', left: '86%', bottom: '38%', size: 3, delay: 0.5 },
  { id: 'd5', left: '46%', bottom: '12%', size: 3, delay: 2.1 },
  { id: 'd6', left: '58%', bottom: '44%', size: 3, delay: 1.2 },
] as const;

// Very soft "spark" dots for the egg about to hatch (Lv 3).
const EMBER_SPARKS = [
  { id: 's1', left: '18%', bottom: '26%', size: 3, delay: 0 },
  { id: 's2', left: '78%', bottom: '34%', size: 2, delay: 0.7 },
  { id: 's3', left: '52%', bottom: '18%', size: 3, delay: 1.3 },
  { id: 's4', left: '34%', bottom: '52%', size: 2, delay: 1.9 },
] as const;

// Atmospheric dust colour per level range.
type DustTone = 'sage' | 'emerald' | 'gold' | 'cyan';
function dustToneForLevel(level: number): DustTone | null {
  if (level >= 9) return 'cyan';   // Lv 9-10 — legend/sultan: cyan dust
  if (level >= 7) return 'gold';   // Lv 7-8 — naga dewasa: warm gold dust
  if (level >= 4) return 'emerald'; // Lv 4-6 — bayi naga: emerald particles
  if (level >= 2) return 'sage';   // Lv 2-3 — telur: sage/silver sparks
  return null;                      // Lv 1 — no extra dust
}

/**
 * Particle intensity profile per level: how many, how fast, how bright, and how
 * far they float. Higher level → more particles and faster motion.
 */
interface MoteProfile {
  count: number;
  duration: number;
  peakOpacity: number;
  rise: number;
  sparks: boolean;
  sizeBoost: number;
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

/**
 * Mascot evolution atmospheric layer — a purely presentational component.
 * It ONLY produces soft effects BEHIND the character (backlight & low-opacity
 * dust). It NEVER covers the illustration: no cracks, badges, stickers, or
 * harsh lines.
 */
export function MascotEvolutionMotes({ level }: { level: number }) {
  const tone = dustToneForLevel(level);
  const profile = moteProfileForLevel(level);
  // Egg sparks (Lv 3) use a soft blink animation; the rest float upward.
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
          animate={{ y: [0, -profile.rise / 2, -profile.rise], opacity: [0, profile.peakOpacity, 0] }}
          transition={{ duration: profile.duration, repeat: Infinity, delay: p.delay, ease: 'easeInOut' }}
        />
      ))}
      {/* Ember sparks active on higher levels (Lv 6+) — adds "density"
          without adding more dust DOM elements. */}
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

/**
 * Full mascot stage: aura backlight + illustration + particles.
 * Exposes the image props `gif`, `alt`, and `className` so it can be reused by
 * the dashboard mascot card and the guide page slider preview.
 */
export function MascotStage({
  gif,
  alt,
  level,
  imgClassName = 'h-28 w-28 sm:h-32 sm:w-32',
  children,
}: {
  gif: string;
  alt: string;
  level: number;
  imgClassName?: string;
  children?: React.ReactNode;
}) {
  const aura = mascotAura(level);
  return (
    <div className="relative flex justify-center py-1">
      {/* Backlight aura: blur + pulse, colour & intensity follow the level.
          Smooth transitions between levels via CSS transition on the glow div. */}
      <div
        aria-hidden
        className={`absolute top-1/2 h-28 w-28 -translate-y-1/2 rounded-full sm:h-32 sm:w-32 transition-all duration-500 ease-out ${aura.glow} ${aura.glowAnim}`}
      />
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ type: 'tween', duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        className={`rounded-full transition-all duration-500 ease-out ${aura.ring}`}
      >
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          className="relative rounded-full outline-none focus-visible-ring"
        >
          {/* Soft atmospheric dust — ALWAYS behind the mascot illustration */}
          <MascotEvolutionMotes level={level} />
          {/* The "breathing" wrapper separates the scale animation from the image. */}
          <span className={`relative z-10 block ${aura.breathe}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={gif}
              alt={alt}
              width={144}
              height={144}
              className={`block object-contain ${imgClassName} transition-all duration-500 ease-out ${aura.scale} ${aura.imgShadow}`}
            />
          </span>
        </button>
        {children}
      </motion.div>
    </div>
  );
}