// Lightweight Web Audio cue player. Tones are synthesised on the fly so the app
// ships with no audio asset files. A single shared AudioContext is created lazily
// and must be unlocked from a user gesture (see unlockAudio) to satisfy browser
// autoplay policies.

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AudioCtor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return null;
    ctx = new AudioCtor();
  }
  return ctx;
}

/** Resume the audio context. Call from a user gesture (e.g. the GO button). */
export function unlockAudio(): void {
  const c = getCtx();
  if (c && c.state === 'suspended') void c.resume();
}

function beep(freq: number, durationMs: number, type: OscillatorType, gainValue: number, delaySeconds = 0): void {
  const c = getCtx();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();

  const start = c.currentTime + delaySeconds;
  const stop = start + durationMs / 1000;

  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(gainValue, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, stop);

  osc.connect(gain).connect(c.destination);
  osc.start(start);
  osc.stop(stop + 0.02);
}

/** Soft tick used for the pre-launch countdown (3… 2… 1…). */
export function playCountdownTick(): void {
  beep(640, 90, 'square', 0.06);
}

/** Bright rising double-blip when a lead should launch now. */
export function playGoCue(): void {
  beep(880, 110, 'square', 0.12, 0);
  beep(1320, 150, 'square', 0.12, 0.1);
}

/** Deeper impact tone when the rallies land. */
export function playImpact(): void {
  beep(320, 420, 'sawtooth', 0.16, 0);
  beep(160, 520, 'sawtooth', 0.12, 0.04);
}
