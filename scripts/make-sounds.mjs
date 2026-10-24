// Synthesises the timer sounds as small mono WAV files (no third-party audio).
// Usage: node scripts/make-sounds.mjs   (writes assets/sounds/*.wav)
import { mkdirSync, writeFileSync } from 'node:fs';

const RATE = 44100;

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(Math.max(-1, Math.min(1, s)) * 32767, i * 2));
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(RATE, 24);
  h.writeUInt32LE(RATE * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

// A clean sine with a fast attack and exponential decay, plus a soft octave for presence.
function tone(freq, ms, gain = 0.6) {
  const n = Math.round((RATE * ms) / 1000);
  return Array.from({ length: n }, (_, i) => {
    const t = i / RATE;
    const env = Math.min(1, i / (RATE * 0.004)) * Math.exp((-5 * i) / n);
    return gain * env * (Math.sin(2 * Math.PI * freq * t) + 0.25 * Math.sin(4 * Math.PI * freq * t));
  });
}
const silence = (ms) => new Array(Math.round((RATE * ms) / 1000)).fill(0);

mkdirSync('assets/sounds', { recursive: true });
const tick = tone(1046.5, 90, 0.5);
const end = [...tone(784, 130), ...silence(30), ...tone(1046.5, 130), ...silence(30), ...tone(1568, 320, 0.7)];
const phase = [...tone(1318.5, 120), ...silence(40), ...tone(1318.5, 260, 0.65)];
writeFileSync('assets/sounds/tick.wav', wav(tick));
writeFileSync('assets/sounds/end.wav', wav(end));
writeFileSync('assets/sounds/phase.wav', wav(phase));

// A whole countdown in one file (N ticks a second apart, then the closing tone), so music under
// it is lowered once for the countdown instead of dipping on every tick.
const second = Math.round(RATE);
for (const n of [3, 5, 10, 15]) {
  for (const [name, last] of [['end', end], ['phase', phase]]) {
    const out = [];
    for (let i = 0; i < n; i++) out.push(...tick, ...silence(1000 - 90));
    out.push(...last);
    writeFileSync(`assets/sounds/count${n}-${name}.wav`, wav(out.slice(0, n * second + last.length)));
  }
}
console.log('sounds written');
