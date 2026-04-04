/**
 * Scan audio + haptic feedback.
 *
 * Uses the Web Audio API to generate short tones — no audio files needed.
 * Haptic patterns are distinct per feedback type so users can tell results
 * apart without looking at their screen.
 */

// ── Haptic patterns ──────────────────────────────────────

function vibrate(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
}

// ── Web Audio API tones ──────────────────────────────────

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  // Resume if suspended (autoplay policy)
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function playTone(frequency: number, duration: number, type: OscillatorType = "sine", gain = 0.15) {
  const ctx = getAudioContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const vol = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, ctx.currentTime);

  // Quick fade-out to avoid click
  vol.gain.setValueAtTime(gain, ctx.currentTime);
  vol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

  osc.connect(vol);
  vol.connect(ctx.destination);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

// ── Combined feedback calls ──────────────────────────────

/** Bright ascending double-beep — scan accepted */
export function scanFeedbackSuccess() {
  vibrate(80);
  playTone(880, 0.08);                // A5
  setTimeout(() => playTone(1320, 0.10), 80); // E6
}

/** Low descending buzz — scan rejected */
export function scanFeedbackError() {
  vibrate([40, 30, 40]); // double-tap
  playTone(330, 0.12, "square", 0.10); // E4 square wave = buzzy
  setTimeout(() => playTone(220, 0.14, "square", 0.08), 120); // A3
}

/** Gentle single tone — informational (duplicate, etc.) */
export function scanFeedbackInfo() {
  vibrate(40);
  playTone(660, 0.08, "sine", 0.08); // E5 soft
}

/** Strong pulse — celebration (all items scanned) */
export function scanFeedbackCelebration() {
  vibrate(200);
  playTone(660, 0.08);
  setTimeout(() => playTone(880, 0.08), 100);
  setTimeout(() => playTone(1100, 0.12), 200);
}
