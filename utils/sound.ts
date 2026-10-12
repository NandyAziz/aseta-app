/**
 * Efek suara sintetis ASETA — Web Audio API bawaan browser, tanpa file mp3
 * eksternal (menghindari error 404) dan tanpa library tambahan.
 *
 * Modul ini murni efek samping: semua fungsi hanya boleh dipanggil dari
 * event handler (klik/tap), bukan saat render, agar aman dari aturan purity
 * React Compiler. Bila `AudioContext` tidak tersedia atau ditolak browser
 * (mis. mode senyap sebelum interaksi pengguna), fungsi menjadi no-op.
 */

let audioCtx: AudioContext | null = null;

/** Konteks audio tunggal yang dipakai ulang; `null` bila tidak tersedia. */
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
    // resume() bisa ditolak di browser mobile sebelum ada interaksi user —
    // tangkap penolakan agar tidak memicu "Uncaught (in promise)".
    audioCtx.resume().catch(() => {
      /* abaikan: audio akan dicoba lagi pada interaksi berikutnya */
    });
  }
  return audioCtx;
}

/** Satu nada sintetis dengan amplop volume halus agar tidak keras di telinga. */
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

/** Pop halus saat maskot di-tap. */
export function playTapSound() {
  tone(520, 0, 0.09, 'triangle', 0.1);
}

/**
 * "Ciit" lucu saat telur Aseta di-tap: dua nada menaik singkat (kecil → tinggi)
 * supaya terdengar seperti telur kecil yang menyapa dengan ramah.
 */
export function playEggChirpSound() {
  tone(392, 0, 0.08, 'sine', 0.09); // G4
  tone(659.25, 0.07, 0.13, 'sine', 0.09); // E5
}

/** Nada tinggi berdenting lembut (koin) saat nabung QRIS sukses. */
export function playCoinSound() {
  tone(988, 0, 0.1, 'sine', 0.12); // B5
  tone(1319, 0.08, 0.16, 'sine', 0.1); // E6
}

/**
 * Nada menurun lembut saat tap ditolak (batas sapa harian tercapai).
 * Bukan nada error yang menyesatkan — tetap ramah, seperti maskot yang
 * sedang istirahat. Dipakai bersama animasi getar halus.
 */
export function playLimitSound() {
  tone(392, 0, 0.1, 'sine', 0.09); // G4
  tone(329.63, 0.09, 0.16, 'sine', 0.08); // E4
}

/** Chimes naik saat evolusi / naik level. */
export function playLevelUpSound() {
  tone(523.25, 0, 0.18, 'sine', 0.12); // C5
  tone(659.25, 0.12, 0.18, 'sine', 0.12); // E5
  tone(783.99, 0.24, 0.22, 'sine', 0.12); // G5
  tone(1046.5, 0.36, 0.3, 'sine', 0.12); // C6
}
