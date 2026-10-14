'use client';

import { Component, useEffect, useState } from 'react';
import type { ErrorInfo, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { playEggChirpSound } from '@/utils/sound';

/**
 * Optional Spline scene. The previously requested URL
 * (prod.spline.design/JbV0nJ0y-Yh6iL4t) returns `403 AccessDenied`,
 * so it cannot be used. The default is deliberately empty so the hero uses the
 * 3D "Telur Aseta" stage (framer-motion) that is guaranteed to render without a
 * black box. Fill in `NEXT_PUBLIC_SPLINE_SCENE_URL` (or the `sceneUrl` prop) to
 * re-enable Spline.
 */
export const DEFAULT_SPLINE_SCENE = process.env.NEXT_PUBLIC_SPLINE_SCENE_URL ?? '';

/**
 * The 3D scene depends on WebGL & browser APIs, so it is loaded lazily on the
 * client only (`ssr: false`) to keep static prerendering safe.
 */
const SplineScene = dynamic(() => import('@splinetool/react-spline'), {
  ssr: false,
  loading: () => null,
});

/** Wait limit (ms) before falling back to the fallback view. */
const LOAD_TIMEOUT_MS = 20000;

type SceneStatus = 'memuat' | 'siap' | 'gagal';

/**
 * Parallax stage: all stage content tilts following the cursor position
 * (springy X/Y rotation) so the egg feels 3D.
 * Values are normalized to the -0.5..0.5 range inside the event handler.
 */
function TiltStage({ children, className }: { children: ReactNode; className?: string }) {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [10, -10]), {
    stiffness: 110,
    damping: 18,
  });
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-12, 12]), {
    stiffness: 110,
    damping: 18,
  });

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    mx.set((event.clientX - rect.left) / rect.width - 0.5);
    my.set((event.clientY - rect.top) / rect.height - 0.5);
  }

  function handlePointerLeave() {
    mx.set(0);
    my.set(0);
  }

  return (
    <div
      className={className}
      style={{ perspective: 900 }}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <motion.div
        className="h-full w-full"
        style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
      >
        {children}
      </motion.div>
    </div>
  );
}

/**
 * Stylized Aseta egg — emerald gradient (#008F68), subtle gold dragon scale
 * contours, geometric accents, and inner-glow for 3D depth.
 *
 * Transform layers are separated so animations do not overwrite each other:
 * outer wrapper = floating (Framer Motion), button = shake when tapped,
 * and the inner `span` = "breathing" (CSS). `shakeId` changes on every tap
 * so remounting the element replays one shake cycle.
 */
function DragonEgg({ shakeId, onPoke }: { shakeId: number; onPoke: () => void }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-3xl">
      {/* Soft background light behind the egg */}
      <div className="absolute h-64 w-64 rounded-full bg-brand/15 blur-3xl sm:h-80 sm:w-80" />

      {/* Egg floats slowly so it does not feel static */}
      <motion.div
        className="relative"
        initial={{ y: 0 }}
        animate={{ y: [0, -12, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
      >
        {/* Soft shadow under the egg */}
        <div className="absolute -bottom-5 left-1/2 h-5 w-36 -translate-x-1/2 rounded-[50%] bg-forest/20 blur-md" />
        <motion.button
          key={shakeId}
          type="button"
          onPointerDown={onPoke}
          aria-label="Sapa telur Aseta"
          className="relative block cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          animate={
            shakeId > 0
              ? { x: [0, -8, 7, -4, 3, 0], rotate: [0, -2.5, 2.5, -1.2, 0] }
              : undefined
          }
          transition={{ duration: 0.45, repeat: 0, ease: 'easeOut' }}
        >
          <span
            className="animate-egg-breathe block h-56 w-44 overflow-hidden sm:h-72 sm:w-56 lg:h-80 lg:w-64"
            style={{
              borderRadius: '50% 50% 50% 50% / 62% 62% 38% 38%',
              background:
                'radial-gradient(circle at 33% 22%, rgba(255,255,255,0.55), transparent 45%),' +
                'radial-gradient(135% 105% at 70% 90%, #34d399 0%, #008F68 44%, #046c4e 74%, #0a3327 100%)',
              boxShadow:
                'inset -16px -24px 42px rgba(3,38,29,0.45), inset 12px 14px 26px rgba(255,255,255,0.15),' +
                '0 32px 60px -22px rgba(5,110,80,0.55)',
            }}
          >
          {/* Inner-glow: mint reflection at the bottom + dark rim on the right (3D depth) */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(120% 70% at 50% 114%, rgba(167,243,208,0.40), transparent 55%),' +
                'radial-gradient(85% 100% at 112% 55%, rgba(11,61,46,0.34), transparent 60%)',
            }}
          />

          {/* Gold dragon scale contours — bottom row brightest, fainter toward the top */}
          <svg
            viewBox="0 0 200 260"
            className="absolute inset-0 h-full w-full"
            fill="none"
            aria-hidden
            preserveAspectRatio="xMidYMid slice"
          >
            <g stroke="#e5b454" strokeLinecap="round">
              <path
                d="M-20 232 Q0 210 20 232 Q40 210 60 232 Q80 210 100 232 Q120 210 140 232 Q160 210 180 232 Q200 210 220 232"
                strokeWidth="1.6"
                opacity="0.5"
              />
              <path
                d="M-40 196 Q-20 174 0 196 Q20 174 40 196 Q60 174 80 196 Q100 174 120 196 Q140 174 160 196 Q180 174 200 196 Q220 174 240 196"
                strokeWidth="1.4"
                opacity="0.34"
              />
              <path
                d="M-20 160 Q0 140 20 160 Q40 140 60 160 Q80 140 100 160 Q120 140 140 160 Q160 140 180 160 Q200 140 220 160"
                strokeWidth="1.2"
                opacity="0.2"
              />
            </g>
            {/* Geometric accents on the egg crown: double curved band + split diamond */}
            <path d="M14 76 Q100 54 186 76" stroke="#e5b454" strokeWidth="2" opacity="0.45" />
            <path d="M24 90 Q100 70 176 90" stroke="#e5b454" strokeWidth="1.2" opacity="0.25" />
            <path
              d="M100 30 L107 40 L100 50 L93 40 Z"
              stroke="#e5b454"
              strokeWidth="1.6"
              fill="rgba(229,180,84,0.18)"
              opacity="0.6"
            />
          </svg>

          {/* Glass specular glint above the contours (main highlight) */}
          <div className="absolute left-6 top-7 h-12 w-8 rotate-[-18deg] rounded-full bg-white/35 blur-md" />
          </span>
        </motion.button>
      </motion.div>
    </div>
  );
}

/**
 * Interactive Spline wrapper: hover slightly scales up and rotates very slowly
 * on its own so it never looks stiff. Cursor tilt is handled once in
 * `TiltStage` so rotation does not stack in two layers.
 */
function InteractiveSpline({
  sceneUrl,
  onLoad,
}: {
  sceneUrl: string;
  onLoad: () => void;
}) {
  return (
    <motion.div
      className="h-full w-full"
      whileHover={{ scale: 1.03 }}
      transition={{ type: 'spring', stiffness: 120, damping: 18 }}
    >
      <motion.div
        className="h-full w-full"
        animate={{ rotate: [-2.5, 2.5, -2.5] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      >
        <SplineScene scene={sceneUrl} className="h-full w-full" onLoad={onLoad} />
      </motion.div>
    </motion.div>
  );
}

/** Small hint that the 3D scene is loading (the egg stays visible behind it). */
function LoadingChip() {
  return (
    <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full border border-line bg-ivory/90 px-3 py-1 text-[11px] font-semibold text-muted backdrop-blur">
      Memuat naga 3D…
    </div>
  );
}

interface SplineErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

interface SplineErrorBoundaryState {
  hasError: boolean;
}

/**
 * Catches Spline runtime errors (dead WebGL, scene fails to parse, etc.) so the
 * landing page still renders with the fallback view instead of a blank screen.
 */
class SplineErrorBoundary extends Component<
  SplineErrorBoundaryProps,
  SplineErrorBoundaryState
> {
  state: SplineErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): SplineErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Intentionally logged to diagnose broken scenes — not a UI error.
    console.warn('Scene Spline gagal dirender:', error.message, info.componentStack);
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

export interface HeroMascot3DProps {
  /** Optional `.splinecode` scene URL; the Aseta egg shows when empty/failed. */
  sceneUrl?: string;
}

/**
 * 3D hero stage. The rich "Telur Aseta" (gradients, swirls, gold embers) is always
 * rendered as the base layer, so there is never a black/empty box.
 * The stage tilts with the cursor (parallax tilt); the egg floats, "breathes",
 * and shakes with a sound on click. When `sceneUrl` is filled in and the scene
 * loads successfully, the Spline canvas fades in above the egg. If the scene
 * fails (403/network/WebGL), the egg stays fully visible.
 */
export default function HeroMascot3D({ sceneUrl = DEFAULT_SPLINE_SCENE }: HeroMascot3DProps) {
  const [status, setStatus] = useState<SceneStatus>('memuat');
  const trimmedSceneUrl = sceneUrl.trim();
  const hasScene = trimmedSceneUrl !== '';
  // Increments on every tap so the shake animation replays (remount via key).
  const [shakeId, setShakeId] = useState<number>(0);

  // If the scene never finishes, hide the Spline layer so the egg that
  // shows — users are not stuck waiting forever.
  useEffect(() => {
    if (!hasScene || status !== 'memuat') return;
    const timer = setTimeout(() => setStatus('gagal'), LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [hasScene, status]);

  // Event handler (not during render) → safe under React Compiler purity rules.
  function handleEggPoke() {
    playEggChirpSound();
    setShakeId(prev => prev + 1);
  }

  // Telur tetap menjadi lapisan dasar, baik scene Spline aktif atau tidak.
  return (
    <TiltStage className="relative h-full w-full overflow-hidden rounded-3xl shadow-xl shadow-forest/10 ring-1 ring-line">
      {/* Lapisan dasar: Telur Aseta — dijamin tidak pernah blank */}
      <DragonEgg shakeId={shakeId} onPoke={handleEggPoke} />

      {/* Lapisan Spline (di atas telur), muncul setelah scene sukses dimuat */}
      {hasScene && status !== 'gagal' && (
        <SplineErrorBoundary fallback={null}>
          <div
            className={`pointer-events-none absolute inset-0 transition-opacity duration-700 ${
              status === 'siap' ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <InteractiveSpline sceneUrl={trimmedSceneUrl} onLoad={() => setStatus('siap')} />
          </div>
        </SplineErrorBoundary>
      )}

      {hasScene && status === 'memuat' && <LoadingChip />}
    </TiltStage>
  );
}
