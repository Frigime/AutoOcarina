import { frameToTime, type Posteriorgram } from './fragments';
import type { Note } from './types';

const FPS = 22050 / 256;

export interface Beats {
  period: number;
  times: number[];
  confidence: number;
}

export function noveltyCurve(pg: Posteriorgram): Float64Array {
  const n = pg.onsets.length;
  const out = new Float64Array(n);
  for (let t = 0; t < n; t++) {
    const on = pg.onsets[t];
    const fr = pg.frames[t];
    const before = t > 0 ? pg.frames[t - 1] : null;
    let s = 0;
    for (let k = 0; k < on.length; k++) {
      s += on[k];
      if (before) s += Math.max(0, fr[k] - before[k]);
    }
    out[t] = s;
  }
  const smooth = movingAverage(out, Math.round(FPS));
  let sq = 0;
  for (let t = 0; t < n; t++) {
    out[t] = Math.max(0, out[t] - smooth[t]);
    sq += out[t] * out[t];
  }
  const std = Math.sqrt(sq / Math.max(1, n)) || 1;
  for (let t = 0; t < n; t++) out[t] /= std;
  return out;
}

function movingAverage(x: Float64Array, width: number): Float64Array {
  const out = new Float64Array(x.length);
  let acc = 0;
  const half = width >> 1;
  for (let i = 0; i < x.length + half; i++) {
    if (i < x.length) acc += x[i];
    if (i - width >= 0) acc -= x[i - width];
    const c = i - half;
    if (c >= 0 && c < x.length) out[c] = acc / Math.min(width, i + 1);
  }
  return out;
}

export function estimatePeriod(nov: Float64Array): number {
  const minLag = Math.round((FPS * 60) / 220);
  const maxLag = Math.round((FPS * 60) / 50);
  const ac = new Float64Array(maxLag * 2 + 2);
  for (let lag = 1; lag < ac.length; lag++) {
    let s = 0;
    for (let t = lag; t < nov.length; t++) s += nov[t] * nov[t - lag];
    ac[lag] = s / (nov.length - lag || 1);
  }
  let best = minLag;
  let bestScore = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    const s = ac[lag] + 0.5 * ac[lag * 2] + 0.25 * (ac[Math.round(lag / 2)] ?? 0);
    const bpm = (FPS * 60) / lag;
    const prior = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 110) / 1.0, 2));
    const score = s * prior;
    if (score > bestScore) [bestScore, best] = [score, lag];
  }
  const a = ac[best - 1];
  const b = ac[best];
  const c = ac[best + 1];
  const den = a - 2 * b + c;
  return den < 0 ? best + (0.5 * (a - c)) / den : best;
}

export function trackBeats(pg: Posteriorgram, tightness = 100): Beats {
  const nov = noveltyCurve(pg);
  const n = nov.length;
  if (n < FPS * 2) return { period: 0.5, times: [], confidence: 0 };
  const period = estimatePeriod(nov);

  const score = new Float64Array(n);
  const back = new Int32Array(n).fill(-1);
  const lo = Math.round(period / 2);
  const hi = Math.round(period * 2);
  for (let t = 0; t < n; t++) {
    let best = 0;
    let arg = -1;
    for (let d = lo; d <= hi && t - d >= 0; d++) {
      const s = score[t - d] - tightness * Math.pow(Math.log(d / period), 2);
      if (arg < 0 || s > best) [best, arg] = [s, t - d];
    }
    score[t] = nov[t] + (arg >= 0 ? Math.max(0, best) : 0);
    back[t] = arg >= 0 && best > 0 ? arg : -1;
  }
  let end = n - 1;
  for (let t = Math.max(0, n - Math.round(period)); t < n; t++) if (score[t] > score[end]) end = t;
  const frames: number[] = [];
  for (let t = end; t >= 0; t = back[t]) frames.push(t);
  frames.reverse();

  const tol = Math.max(2, Math.round(period / 8));
  let strong = 0;
  let onGrid = 0;
  const grid = new Uint8Array(n);
  for (let i = 0; i + 1 < frames.length; i++) {
    for (let k = 0; k < 4; k++) {
      const g = Math.round(frames[i] + ((frames[i + 1] - frames[i]) * k) / 4);
      for (let d = -tol; d <= tol; d++) if (g + d >= 0 && g + d < n) grid[g + d] = 1;
    }
  }
  for (let t = 1; t + 1 < n; t++) {
    if (nov[t] > 1.5 && nov[t] >= nov[t - 1] && nov[t] >= nov[t + 1]) {
      strong++;
      onGrid += grid[t];
    }
  }
  return {
    period: period / FPS,
    times: frames.map(frameToTime),
    confidence: strong ? onGrid / strong : 0,
  };
}

function subdivisions(a: number, b: number, parts: number): number[] {
  return Array.from({ length: parts }, (_, k) => a + ((b - a) * k) / parts);
}

export function quantizeStarts(notes: Note[], beats: Beats, maxShift = 0.06): Note[] {
  const times = beats.times;
  if (times.length < 2) return notes;
  const p = beats.period;
  const grid: number[] = [times[0] - p, ...times, times[times.length - 1] + p];
  const sorted = [...notes].sort((x, y) => x.start - y.start);
  const out: Note[] = [];
  let i = 0;
  for (let b = 0; b + 1 < grid.length; b++) {
    const from = grid[b];
    const to = grid[b + 1];
    const inBeat: Note[] = [];
    while (i < sorted.length && sorted[i].start < to - (to - from) / 8) {
      if (sorted[i].start < from - (to - from) / 8) out.push(sorted[i]);
      else inBeat.push(sorted[i]);
      i++;
    }
    if (inBeat.length === 0) continue;
    let best: number[] = [];
    let bestCost = Infinity;
    for (const parts of [1, 2, 4, 3]) {
      const pts = [...subdivisions(from, to, parts), to];
      const cost =
        inBeat.reduce((s, n) => s + Math.min(...pts.map((g) => Math.abs(g - n.start))), 0) +
        0.004 * parts * inBeat.length;
      if (cost < bestCost) [bestCost, best] = [cost, pts];
    }
    for (const n of inBeat) {
      const g = best.reduce((x, y) => (Math.abs(y - n.start) < Math.abs(x - n.start) ? y : x));
      out.push(Math.abs(g - n.start) <= maxShift ? { ...n, start: g, dur: n.dur + (n.start - g) } : n);
    }
  }
  while (i < sorted.length) out.push(sorted[i++]);
  const dedup: Note[] = [];
  for (const n of out.sort((x, y) => x.start - y.start)) {
    const prev = dedup[dedup.length - 1];
    if (prev && Math.abs(prev.start - n.start) < 0.005) {
      if ((n.vel ?? 0.7) * n.dur > (prev.vel ?? 0.7) * prev.dur) dedup[dedup.length - 1] = n;
    } else dedup.push(n);
  }
  return dedup.map((n) => ({ ...n, dur: Math.max(0.02, n.dur) }));
}

export function sustain(notes: Note[], maxGap: number): Note[] {
  const sorted = [...notes].sort((a, b) => a.start - b.start);
  return sorted.map((n, i) => {
    const next = sorted[i + 1];
    if (!next) return n;
    const gap = next.start - (n.start + n.dur);
    return gap > 0 && gap <= maxGap ? { ...n, dur: next.start - n.start } : n;
  });
}

export function sustainGap(beats: Beats | null): number {
  if (!beats || beats.confidence < 0.5) return 0.3;
  return Math.min(0.6, Math.max(0.25, beats.period * 0.9));
}
