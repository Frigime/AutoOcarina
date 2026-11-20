import { quantizeStarts, sustain, sustainGap, type Beats } from './beats';
import { attackStrength, joinByAttack, type Posteriorgram } from './fragments';
import { MAX_PITCH, MIN_PITCH } from './ocarina';
import { DEFAULT_MELODY_PARAMS, extractMelody, makePlayable, type MelodyChoices, type MelodyParams, type MelodyResult } from './simplify';
import type { Note } from './types';

export interface AssistData {
  raw: Note[];
  attack: Float32Array;
  beats: Beats;
  transpose?: number;
}

export type MelodyVersion = 'normal' | 'high' | 'low';
export const MELODY_VERSIONS: Record<MelodyVersion, MelodyParams> = {
  normal: DEFAULT_MELODY_PARAMS,
  high: { ...DEFAULT_MELODY_PARAMS, register: 0.08 },
  low: { register: 0, jump: 0.03, noteCost: 0.005 },
};

export const emptyChoices = (): MelodyChoices => ({ pinned: new Set(), banned: new Set() });
export const copyChoices = (c: MelodyChoices): MelodyChoices => ({ pinned: new Set(c.pinned), banned: new Set(c.banned) });

export function buildAssistData(raw: Note[], model: Posteriorgram, beats: Beats): AssistData {
  const notes = [...raw].sort((a, b) => a.start - b.start).map((n, i) => ({ ...n, src: i }));
  return { raw: notes, attack: Float32Array.from(notes, (n) => attackStrength(model, n.pitch, n.start)), beats };
}

export function assistedMelody(data: AssistData, choices: MelodyChoices, version: MelodyVersion = 'normal'): Note[] {
  return joinByAttack(extractMelody(data.raw, MELODY_VERSIONS[version], choices), (n) => (n.src !== undefined ? data.attack[n.src] : 1));
}

export function solveAssisted(
  data: AssistData,
  choices: MelodyChoices,
  minNoteSec: number,
  version: MelodyVersion = 'normal',
): MelodyResult & { bpm?: number } {
  const melody = assistedMelody(data, choices, version);
  const rhythmic = data.beats.confidence >= 0.5 ? quantizeStarts(melody, data.beats) : melody;
  const res = makePlayable(rhythmic, { kind: 'melody', minNoteSec, transpose: data.transpose });
  data.transpose ??= res.transpose;
  return { ...res, notes: sustain(res.notes, sustainGap(data.beats)), bpm: data.beats.confidence >= 0.5 ? Math.round(60 / data.beats.period) : undefined };
}

export interface Candidate {
  start: number;
  dur: number;
  pitch: number;
  srcs: number[];
  strength: number;
  state: 'free' | 'pinned' | 'banned';
}

const MIN_SHOWN_VEL = 0.25;
const MIN_SHOWN_DUR = 0.05;

function intoRange(p: number): number {
  while (p < MIN_PITCH) p += 12;
  while (p > MAX_PITCH) p -= 12;
  return p;
}

export function displayCandidates(data: AssistData, notes: Note[], choices: MelodyChoices): Candidate[] {
  const transpose = data.transpose ?? 0;
  const inMelody = new Set<number>();
  const anchors: { t: number; shift: number }[] = [];
  for (const n of notes) {
    if (n.src === undefined || !data.raw[n.src]) continue;
    inMelody.add(n.src);
    anchors.push({ t: data.raw[n.src].start, shift: n.pitch - (data.raw[n.src].pitch + transpose) });
  }
  anchors.sort((a, b) => a.t - b.t);
  let a = 0;
  const out: Candidate[] = [];
  const last = new Map<number, Candidate>();
  for (const x of data.raw) {
    const src = x.src!;
    const state = choices.pinned.has(src) ? 'pinned' : choices.banned.has(src) ? 'banned' : 'free';
    if (inMelody.has(src)) continue;
    if (state !== 'pinned' && ((x.vel ?? 0.7) < MIN_SHOWN_VEL || x.dur < MIN_SHOWN_DUR)) continue;
    while (a + 1 < anchors.length && Math.abs(anchors[a + 1].t - x.start) <= Math.abs(anchors[a].t - x.start)) a++;
    const shift = anchors.length && anchors[a].shift % 12 === 0 ? anchors[a].shift : 0;
    const pitch = intoRange(x.pitch + transpose + shift);
    const prev = last.get(pitch);
    if (prev && x.start < prev.start + prev.dur - 0.02 && prev.state === state) {
      prev.dur = Math.max(prev.dur, x.start + x.dur - prev.start);
      prev.srcs.push(src);
      if ((x.vel ?? 0.7) > prev.strength) {
        prev.strength = x.vel ?? 0.7;
        prev.srcs.unshift(prev.srcs.pop()!);
      }
      continue;
    }
    const c: Candidate = { start: x.start, dur: x.dur, pitch, srcs: [src], strength: x.vel ?? 0.7, state };
    out.push(c);
    last.set(pitch, c);
  }
  return out;
}

const SAME_ONSET = 0.04;

export function togglePin(data: AssistData, choices: MelodyChoices, src: number): void {
  if (choices.pinned.delete(src)) return;
  const x = data.raw[src];
  if (!x) return;
  for (const y of data.raw) if (Math.abs(y.start - x.start) < SAME_ONSET) choices.pinned.delete(y.src!);
  choices.banned.delete(src);
  choices.pinned.add(src);
}

export function toggleBan(data: AssistData, choices: MelodyChoices, src: number, dur = 0): void {
  if (choices.banned.delete(src)) return;
  const x = data.raw[src];
  if (!x) return;
  for (const y of data.raw) {
    if (y.pitch === x.pitch && y.start >= x.start - 0.02 && y.start < x.start + Math.max(dur, x.dur)) {
      choices.pinned.delete(y.src!);
      choices.banned.add(y.src!);
    }
  }
}

export function applyStroke(data: AssistData, choices: MelodyChoices, touched: number[], from: number, to: number): void {
  const keep = new Set<number>();
  for (const src of touched) {
    const x = data.raw[src];
    if (!x) continue;
    if ([...keep].some((k) => Math.abs(data.raw[k].start - x.start) < SAME_ONSET)) continue;
    keep.add(src);
  }
  for (const src of keep) {
    choices.banned.delete(src);
    choices.pinned.add(src);
  }
  for (const y of data.raw) {
    if (y.start < from - 0.02 || y.start > to + 0.02 || keep.has(y.src!)) continue;
    choices.pinned.delete(y.src!);
    choices.banned.add(y.src!);
  }
}

export function passageVariants(data: AssistData, choices: MelodyChoices, current: Note[], from: number, to: number, max = 6): number[][] {
  const inPassage = (x: Note) => x.start >= from - 0.02 && x.start <= to + 0.02;
  const base = copyChoices(choices);
  for (const x of data.raw) {
    if (!inPassage(x)) continue;
    base.pinned.delete(x.src!);
    base.banned.delete(x.src!);
  }
  const withFragments = (notes: Note[]): number[] => {
    const srcs = new Set<number>();
    for (const n of notes) {
      if (n.src === undefined || !inPassage(n)) continue;
      const head = data.raw[n.src];
      if (!head) continue;
      for (const x of data.raw) if (x.pitch === head.pitch && x.start >= head.start - 0.01 && x.start < n.start + n.dur - 0.01 && inPassage(x)) srcs.add(x.src!);
      srcs.add(n.src);
    }
    return [...srcs].sort((a, b) => a - b);
  };
  const key = (srcs: number[]) => srcs.join(',');
  const seen = new Set<string>([key(withFragments(current))]);
  const variants: number[][] = [];
  const offer = (srcs: number[]) => {
    if (srcs.length === 0 || seen.has(key(srcs))) return;
    seen.add(key(srcs));
    variants.push(srcs);
  };
  for (const version of ['normal', 'high', 'low'] as const) offer(withFragments(assistedMelody(data, base, version)));

  const peel = copyChoices(base);
  const proposed = [withFragments(current), ...variants];
  for (let round = 0; round < max && variants.length < max; round++) {
    for (const srcs of proposed) for (const s of srcs) peel.banned.add(s);
    const next = withFragments(assistedMelody(data, peel));
    if (next.length === 0) break;
    proposed.push(next);
    offer(next);
  }
  return variants.slice(0, max);
}
