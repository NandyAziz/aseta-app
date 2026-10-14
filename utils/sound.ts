/**
 * ASETA synthetic sound effects — the browser's built-in Web Audio API, with
 * no external mp3 files (avoiding 404 errors) and no extra libraries.
 *
 * This module is pure side effect: every function may only be called from an
 * event handler (click/tap), never during render, so it stays safe under
 * React Compiler purity rules. If `AudioContext` is unavailable or rejected by
 * the browser (e.g. silent mode before user interaction), they become no-ops.
 */

let audioCtx: AudioContext | null = null;

/** Single reused audio context; `null` when unavailable. */
function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) {
    try {
      audioCtx = new Ctor();
    } catch {
      return null;
    }
  }
  if (audioCtx.state === 'suspended') {
    // resume() can be rejected in mobile browsers before any user interaction —
    // catch the rejection so it does not surface as "Uncaught (in promise)".
    audioCtx.resume().catch(() => {
      /* ignore: audio will be retried on the next interaction */
    });
  }
  return audioCtx;
}

/** A single synthetic tone with a soft volume envelope so it is never harsh. */
function tone(
  freq: number,
  start: number,
  duration: number,
  type: OscillatorType = 'sine',
  gain = 0.12
) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const vol = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
  vol.gain.setValueAtTime(0.0001, ctx.currentTime + start);
  vol.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + start + 0.012);
  vol.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration);
  osc.connect(vol);
  vol.connect(ctx.destination);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + duration + 0.02);
}

/** Soft pop when the mascot is tapped. */
export function playTapSound() {
  tone(520, 0, 0.09, 'triangle', 0.1);
}

/**
 * Friendly "squeak" when the Aseta egg is tapped: two short rising tones
 * (low → high) so it sounds like a small egg greeting you.
 */
export function playEggChirpSound() {
  tone(392, 0, 0.08, 'sine', 0.09); // G4
  tone(659.25, 0.07, 0.13, 'sine', 0.09); // E5
}

/** Soft high ringing tone (coin) when a QRIS deposit succeeds. */
export function playCoinSound() {
  tone(988, 0, 0.1, 'sine', 0.12); // B5
  tone(1319, 0.08, 0.16, 'sine', 0.1); // E6
}

/**
 * Gentle descending tone when a tap is rejected (daily greeting limit
 * reached). Not a misleading error tone — still friendly, like a mascot
 * taking a break. Used together with the soft shake animation.
 */
export function playLimitSound() {
  tone(392, 0, 0.1, 'sine', 0.09); // G4
  tone(329.63, 0.09, 0.16, 'sine', 0.08); // E4
}

/** Rising chimes on evolution / level up. */
export function playLevelUpSound() {
  tone(523.25, 0, 0.18, 'sine', 0.12); // C5
  tone(659.25, 0.12, 0.18, 'sine', 0.12); // E5
  tone(783.99, 0.24, 0.22, 'sine', 0.12); // G5
  tone(1046.5, 0.36, 0.3, 'sine', 0.12); // C6
}
