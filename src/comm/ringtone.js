/**
 * iThunder AI OS - Âm báo cuộc gọi bằng Web Audio (không cần tệp âm thanh)
 * "ring": chuông cuộc gọi đến; "ringback": tiếng chờ của người gọi.
 */

const PATTERNS = {
  ring: { freqs: [880, 660], on: 0.35, gap: 0.12, periodMs: 2200, volume: 0.18 },
  ringback: { freqs: [425], on: 1.0, gap: 0, periodMs: 4000, volume: 0.08 },
};

let ctx = null;
let timer = null;

export function startTone(kind) {
  stopTone();
  const pattern = PATTERNS[kind];
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!pattern || !AudioCtx) return;
  try { ctx = new AudioCtx(); } catch { ctx = null; return; }
  const beep = () => {
    if (!ctx) return;
    let t = ctx.currentTime;
    for (const freq of pattern.freqs) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(pattern.volume, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + pattern.on);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + pattern.on + 0.05);
      t += pattern.on + pattern.gap;
    }
  };
  beep();
  timer = setInterval(beep, pattern.periodMs);
}

export function stopTone() {
  clearInterval(timer);
  timer = null;
  if (ctx) {
    ctx.close().catch(() => {});
    ctx = null;
  }
}
