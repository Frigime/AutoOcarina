import { Midi } from '@tonejs/midi';
import type { Note } from '../core/types';

export interface MidiTrack {
  name: string;
  notes: Note[];
  averagePitch: number;
}

export async function readMidi(file: Blob): Promise<MidiTrack[]> {
  const midi = new Midi(await file.arrayBuffer());
  return midi.tracks
    .filter((t) => t.notes.length > 0 && t.channel !== 9)
    .map((t, i) => {
      const notes = t.notes.map((n) => ({ start: n.time, dur: n.duration, pitch: n.midi, vel: n.velocity }));
      return {
        name: t.name || t.instrument.name || `Piste ${i + 1}`,
        notes,
        averagePitch: notes.reduce((s, n) => s + n.pitch, 0) / notes.length,
      };
    });
}

export function guessMelodyTrack(tracks: MidiTrack[]): number {
  let best = 0;
  let bestScore = -Infinity;
  tracks.forEach((t, i) => {
    const starts = new Set(t.notes.map((n) => Math.round(n.start * 50)));
    const monophony = starts.size / t.notes.length;
    const score = Math.log(t.notes.length + 1) * monophony + t.averagePitch / 20;
    if (score > bestScore) [best, bestScore] = [i, score];
  });
  return best;
}

const WINDOW = 4;
const SWITCH_COST = 0.8;
const SILENT = -100;
const REST_SCORE = -0.2;

function topLine(notes: Note[]): Note[] {
  const sorted = [...notes].sort((a, b) => a.start - b.start || b.pitch - a.pitch);
  const out: Note[] = [];
  for (const n of sorted) {
    const prev = out[out.length - 1];
    if (prev && n.start - prev.start < 0.03) continue;
    out.push(n);
  }
  return out;
}

export function melodyLikeness(notes: Note[], span = WINDOW): number {
  const line = topLine(notes);
  if (line.length === 0) return SILENT;
  const p = line.map((n) => n.pitch);
  const avg = p.reduce((s, x) => s + x, 0) / p.length;
  if (avg < 50) return -3;
  if (line.length >= 3 && new Set(p).size < 3) return -2;
  const counts = new Map<number, number>();
  for (const x of p) counts.set(x, (counts.get(x) ?? 0) + 1);
  const pedal = p.length >= 4 ? Math.max(...counts.values()) / p.length : 0;
  let moves = 0;
  let steps = 0;
  for (let i = 1; i < p.length; i++) {
    const d = Math.abs(p[i] - p[i - 1]);
    if (d === 0) continue;
    moves++;
    if (d <= 2) steps++;
  }
  const stepFrac = moves ? steps / moves : 0.3;
  let loop = 0;
  if (p.length >= 8) {
    for (let k = 2; k <= 4; k++) {
      let same = 0;
      for (let i = k; i < p.length; i++) if (p[i] === p[i - k]) same++;
      loop = Math.max(loop, same / (p.length - k));
    }
  }
  const covered = line.reduce((s, n) => s + Math.min(n.dur, span), 0) / span;
  const density = line.length / span;
  const likeness =
    1.2 * stepFrac -
    1.5 * Math.max(0, pedal - 0.3) -
    1.5 * Math.max(0, loop - 0.6) +
    0.03 * Math.max(-12, Math.min(12, avg - 60)) +
    0.3 * Math.min(1, covered) -
    0.5 * Math.max(0, 1.2 - density) -
    0.3 * Math.max(0, density - 6);
  return likeness * Math.min(1, line.length / 6);
}

export interface MidiMelody {
  notes: Note[];
  tracks: number[];
}

export function extractMidiMelody(tracks: MidiTrack[]): MidiMelody {
  if (tracks.length === 0) return { notes: [], tracks: [] };
  if (tracks.length === 1) return { notes: tracks[0].notes, tracks: [0] };
  const end = Math.max(...tracks.flatMap((t) => t.notes.map((n) => n.start)));
  const windows = Math.max(1, Math.ceil((end + 0.001) / WINDOW));
  const T = tracks.length;
  const REST = T;
  const inWindow = (t: number, w: number) => tracks[t].notes.filter((n) => n.start >= w * WINDOW && n.start < (w + 1) * WINDOW);
  const score = Array.from({ length: windows }, (_, w) => [...tracks.map((_, t) => melodyLikeness(inWindow(t, w))), REST_SCORE]);

  const total = score.map((row) => row.map(() => -Infinity));
  const from = score.map((row) => row.map(() => 0));
  for (let t = 0; t <= T; t++) total[0][t] = score[0][t];
  for (let w = 1; w < windows; w++) {
    for (let t = 0; t <= T; t++) {
      for (let u = 0; u <= T; u++) {
        const free = u === t || u === REST || t === REST || score[w][u] === SILENT;
        const v = total[w - 1][u] - (free ? 0 : SWITCH_COST) + score[w][t];
        if (v > total[w][t]) [total[w][t], from[w][t]] = [v, u];
      }
    }
  }
  let t = 0;
  for (let u = 1; u <= T; u++) if (total[windows - 1][u] > total[windows - 1][t]) t = u;
  const chosen = new Array<number>(windows);
  for (let w = windows - 1; w >= 0; w--) {
    chosen[w] = t;
    t = from[w][t];
  }

  const notes: Note[] = [];
  const used: number[] = [];
  chosen.forEach((track, w) => {
    if (track === REST) return;
    const part = inWindow(track, w);
    if (part.length === 0) return;
    notes.push(...part);
    if (!used.includes(track)) used.push(track);
  });
  return { notes, tracks: used };
}
