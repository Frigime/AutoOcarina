import { bestCombo, comboCost, inRange, MAX_PITCH, MIN_PITCH } from './ocarina';
import type { Note } from './types';

const SAME_ONSET = 0.04;

function byStart(a: Note, b: Note): number {
  return a.start - b.start || b.pitch - a.pitch;
}

function onsetGroups(notes: Note[]): Note[][] {
  const groups: Note[][] = [];
  for (const n of [...notes].sort(byStart)) {
    const g = groups[groups.length - 1];
    if (g && n.start - g[0].start < SAME_ONSET) g.push(n);
    else groups.push([n]);
  }
  return groups;
}

function truncateOverlaps(notes: Note[]): Note[] {
  return notes.map((n, i) => {
    const next = notes[i + 1];
    return next && n.start + n.dur > next.start ? { ...n, dur: Math.max(0.01, next.start - n.start) } : n;
  });
}

export function skyline(notes: Note[]): Note[] {
  const kept = onsetGroups(notes).map((g) => g.reduce((a, b) => (b.pitch > a.pitch ? b : a)));
  const out: Note[] = [];
  for (const n of kept) {
    const prev = out[out.length - 1];
    if (prev && n.start < prev.start + prev.dur - SAME_ONSET && n.pitch < prev.pitch && n.dur < prev.dur) continue;
    out.push(n);
  }
  return truncateOverlaps(out);
}

export interface MelodyChoices {
  pinned: Set<number>;
  banned: Set<number>;
}

export interface MelodyParams {
  register: number;
  jump: number;
  noteCost: number;
}

export const DEFAULT_MELODY_PARAMS: MelodyParams = { register: 0.04, jump: 0.01, noteCost: 0.005 };

export function extractMelody(notes: Note[], params: MelodyParams = DEFAULT_MELODY_PARAMS, choices?: MelodyChoices): Note[] {
  const banned = choices?.banned;
  const list = (banned?.size ? notes.filter((x) => x.src === undefined || !banned.has(x.src)) : [...notes]).sort(byStart);
  const n = list.length;
  if (n === 0) return [];

  const isPinned = (x: Note) => choices !== undefined && x.src !== undefined && choices.pinned.has(x.src);
  const lastPin = new Int32Array(n).fill(-1);
  let finalPin = -1;
  for (let k = 0; k < n; k++) {
    lastPin[k] = finalPin;
    if (isPinned(list[k])) finalPin = k;
  }

  const weight = (x: Note) => (x.vel ?? 0.7) * Math.max(0.2, 1 + params.register * (x.pitch - 60));
  const jump = (a: Note, b: Note) => params.jump * Math.max(0, Math.abs(a.pitch - b.pitch) - 5);
  const contribution = (a: Note, until: number) => weight(a) * Math.max(0, Math.min(a.dur, until - a.start));

  const score = new Float64Array(n);
  const prev = new Int32Array(n).fill(-1);
  let first = 0;
  for (let k = 0; k < n; k++) {
    const pin = lastPin[k];
    score[k] = pin < 0 ? -params.noteCost : -Infinity;
    const cur = list[k];
    while (list[first].start < cur.start - 4) first++;
    const consider = (j: number) => {
      const p = list[j];
      if (cur.start - p.start < SAME_ONSET) return;
      const s = score[j] + contribution(p, cur.start) - jump(p, cur) - params.noteCost;
      if (s > score[k]) {
        score[k] = s;
        prev[k] = j;
      }
    };
    if (pin >= 0 && pin < first) consider(pin);
    for (let j = Math.max(first, pin); j < k; j++) consider(j);
  }

  let end = -1;
  let bestTotal = -Infinity;
  for (let k = Math.max(0, finalPin); k < n; k++) {
    const total = score[k] + contribution(list[k], Infinity);
    if (total > bestTotal) [bestTotal, end] = [total, k];
  }
  if (end < 0) return choices ? extractMelody(notes, params, { pinned: new Set(), banned: choices.banned }) : [];
  const path: Note[] = [];
  for (let k = end; k >= 0; k = prev[k]) path.push(list[k]);
  return truncateOverlaps(dropIsolated(path.reverse(), isPinned));
}

function dropIsolated(path: Note[], keep: (n: Note) => boolean = () => false): Note[] {
  const far = (a: Note, b: Note | undefined) => !b || Math.abs(b.start - a.start) > 1.5 || Math.abs(a.pitch - b.pitch) > 12;
  return path.filter((n, i) => {
    const before = path[i - 1];
    const after = path[i + 1];
    if ((!before && !after) || keep(n)) return true;
    return !(n.dur < 0.4 && far(n, before) && far(n, after));
  });
}

export function bestTranspose(notes: Note[]): number {
  let best = { t: 0, score: -Infinity };
  for (let t = -36; t <= 36; t++) {
    let inside = 0;
    let cost = 0;
    for (const n of notes) {
      const p = n.pitch + t;
      if (inRange(p)) {
        inside += n.dur;
        cost += comboCost(bestCombo(p)!);
      }
    }
    const score = inside * 1000 - cost - Math.abs(t) * 0.01;
    if (score > best.score) best = { t, score };
  }
  return best.t;
}

export function foldByPhrases(notes: Note[]): { notes: Note[]; folded: number } {
  const phrases: Note[][] = [];
  for (const n of notes) {
    const phrase = phrases[phrases.length - 1];
    const last = phrase?.[phrase.length - 1];
    if (last && n.start - (last.start + last.dur) < 0.35) phrase.push(n);
    else phrases.push([n]);
  }
  let folded = 0;
  const out: Note[] = [];
  for (const phrase of phrases) {
    let shift = 0;
    let best = Infinity;
    for (const k of [0, -12, 12, -24, 24]) {
      const outside = phrase.filter((n) => !inRange(n.pitch + k)).length;
      if (outside < best) [best, shift] = [outside, k];
    }
    for (const n of phrase) {
      let p = n.pitch + shift;
      while (p < MIN_PITCH) p += 12;
      while (p > MAX_PITCH) p -= 12;
      if (p !== n.pitch) folded++;
      out.push(p === n.pitch ? n : { ...n, pitch: p, combo: undefined });
    }
  }
  return { notes: out, folded };
}

const FOLD_SHIFTS = [-36, -24, -12, 0, 12, 24, 36];

export function foldIntoRange(notes: Note[]): { notes: Note[]; folded: number } {
  const n = notes.length;
  if (n === 0) return { notes: [], folded: 0 };
  const S = FOLD_SHIFTS.length;
  const OUTSIDE = 10;
  const noteCost = (i: number, k: number) => (inRange(notes[i].pitch + FOLD_SHIFTS[k]) ? 0 : OUTSIDE) + Math.abs(FOLD_SHIFTS[k]) * 0.001;
  const switchCost = (i: number) => {
    const gap = notes[i].start - (notes[i - 1].start + notes[i - 1].dur);
    if (gap >= 0.35) return 1;
    if (Math.abs(notes[i].pitch - notes[i - 1].pitch) >= 7) return 2.5;
    return 4;
  };
  const cost = new Float64Array(n * S);
  const from = new Int8Array(n * S);
  for (let k = 0; k < S; k++) cost[k] = noteCost(0, k);
  for (let i = 1; i < n; i++) {
    const sw = switchCost(i);
    for (let k = 0; k < S; k++) {
      let best = Infinity;
      let arg = 0;
      for (let j = 0; j < S; j++) {
        const c = cost[(i - 1) * S + j] + (j === k ? 0 : sw);
        if (c < best) [best, arg] = [c, j];
      }
      cost[i * S + k] = best + noteCost(i, k);
      from[i * S + k] = arg;
    }
  }
  let k = 0;
  for (let j = 1; j < S; j++) if (cost[(n - 1) * S + j] < cost[(n - 1) * S + k]) k = j;
  const shifts = new Array<number>(n);
  for (let i = n - 1; i >= 0; i--) {
    shifts[i] = FOLD_SHIFTS[k];
    k = from[i * S + k];
  }

  let folded = 0;
  const out = notes.map((note, i) => {
    let p = note.pitch + shifts[i];
    while (p < MIN_PITCH) p += 12;
    while (p > MAX_PITCH) p -= 12;
    if (p === note.pitch) return note;
    folded++;
    return { ...note, pitch: p, combo: undefined };
  });
  return { notes: out, folded };
}

export function mergeDrift(notes: Note[]): { notes: Note[]; merged: number } {
  const out: Note[] = [];
  let merged = 0;
  for (const n of [...notes].sort(byStart)) {
    const prev = out[out.length - 1];
    const continues = prev && n.start - (prev.start + prev.dur) < 0.03;
    const near = prev && Math.abs(n.pitch - prev.pitch) <= 2;
    const weak = prev && (n.vel ?? 0.7) < 0.7 * (prev.vel ?? 0.7);
    if (prev && continues && near && weak) {
      out[out.length - 1] = { ...prev, dur: Math.max(prev.dur, n.start + n.dur - prev.start) };
      merged++;
    } else out.push(n);
  }
  return { notes: out, merged };
}

export interface CleanupStats {
  joined: number;
  ghosts: number;
  tooFast: number;
}

export function cleanup(notes: Note[], minNoteSec: number, mergeSameGap = 0, stats?: CleanupStats): Note[] {
  const s = stats ?? { joined: 0, ghosts: 0, tooFast: 0 };
  const sorted = [...notes].sort(byStart);
  const merged: Note[] = [];
  for (const n of sorted) {
    const prev = merged[merged.length - 1];
    if (prev && mergeSameGap > 0 && n.pitch === prev.pitch && n.start - (prev.start + prev.dur) < mergeSameGap) {
      merged[merged.length - 1] = { ...prev, dur: Math.max(prev.dur, n.start + n.dur - prev.start) };
      s.joined++;
    } else merged.push(n);
  }

  const out: Note[] = [];
  for (const n of merged) {
    if (n.dur < minNoteSec * 0.5) {
      s.ghosts++;
      continue;
    }
    const prev = out[out.length - 1];
    if (prev && n.start - prev.start < minNoteSec) {
      const weight = (x: Note) => x.dur * (x.vel ?? 0.7);
      if (weight(n) > weight(prev)) out[out.length - 1] = n;
      s.tooFast++;
      continue;
    }
    out.push(n);
  }
  return truncateOverlaps(out);
}

export interface MelodyResult {
  notes: Note[];
  transpose: number;
  folded: number;
  fidelity: number;
  tooFast: number;
  fixedArtifacts: number;
  melodyCount: number;
}

const totalDur = (notes: Note[]) => notes.reduce((s, n) => s + n.dur, 0);

export function makePlayable(
  raw: Note[],
  opts: { kind: 'audio' | 'melody' | 'midi' | 'tab'; minNoteSec: number; transpose?: number },
): MelodyResult {
  let mono = opts.kind === 'audio' ? extractMelody(raw) : opts.kind === 'midi' ? skyline(raw) : raw;
  let drift = 0;
  if (opts.kind === 'audio') ({ notes: mono, merged: drift } = mergeDrift(mono));
  const transpose = opts.transpose ?? bestTranspose(mono);
  const shifted = transpose ? mono.map((n) => ({ ...n, pitch: n.pitch + transpose, combo: undefined })) : mono;
  const { notes, folded } = foldIntoRange(shifted);
  const stats: CleanupStats = { joined: 0, ghosts: 0, tooFast: 0 };
  const clean = cleanup(notes, opts.minNoteSec, opts.kind === 'audio' ? 0.06 : 0, stats);
  const fidelity = Math.min(1, totalDur(clean) / Math.max(1e-6, totalDur(mono)));
  return {
    notes: clean,
    transpose,
    folded,
    fidelity,
    tooFast: stats.tooFast,
    fixedArtifacts: drift + stats.joined + stats.ghosts,
    melodyCount: mono.length,
  };
}
