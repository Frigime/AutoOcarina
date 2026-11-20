import type { Note } from './types';

export interface Posteriorgram {
  frames: ArrayLike<number>[];
  onsets: ArrayLike<number>[];
}

const MIDI_OFFSET = 21;
const FFT_HOP = 256;
const SAMPLE_RATE = 22050;
const ANNOT_N_FRAMES = Math.floor(SAMPLE_RATE / FFT_HOP) * 2;
const AUDIO_N_SAMPLES = SAMPLE_RATE * 2 - FFT_HOP;
const WINDOW_OFFSET = (FFT_HOP / SAMPLE_RATE) * (ANNOT_N_FRAMES - AUDIO_N_SAMPLES / FFT_HOP) + 0.0018;

export const frameToTime = (frame: number) =>
  (frame * FFT_HOP) / SAMPLE_RATE - WINDOW_OFFSET * Math.floor(frame / ANNOT_N_FRAMES);

export function timeToFrame(t: number): number {
  let lo = 0;
  let hi = Math.ceil(t * 90) + 200;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (frameToTime(mid) < t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function attackStrength(pg: Posteriorgram, pitch: number, time: number): number {
  const f = timeToFrame(time);
  const k = pitch - MIDI_OFFSET;
  let best = 0;
  for (let t = Math.max(0, f - 2); t <= Math.min(pg.onsets.length - 1, f + 2); t++) best = Math.max(best, pg.onsets[t][k] ?? 0);
  return best;
}

export function joinFragments(notes: Note[], pg: Posteriorgram, maxGap = 0.06, minAttack = 0.7): Note[] {
  return joinByAttack(notes, (n) => attackStrength(pg, n.pitch, n.start), maxGap, minAttack);
}

export function joinByAttack(notes: Note[], attack: (n: Note) => number, maxGap = 0.06, minAttack = 0.7): Note[] {
  const out: Note[] = [];
  for (const n of [...notes].sort((a, b) => a.start - b.start)) {
    const prev = out[out.length - 1];
    if (prev && n.pitch === prev.pitch && n.start - (prev.start + prev.dur) < maxGap && attack(n) < minAttack) {
      out[out.length - 1] = { ...prev, dur: Math.max(prev.dur, n.start + n.dur - prev.start) };
    } else out.push(n);
  }
  return out;
}
