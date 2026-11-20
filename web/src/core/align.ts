import type { Note } from './types';

const MATCH = 2;
const OCTAVE = 1;
const NEAR = -0.5;
const MISMATCH = -1.2;
const TAB_GAP = -1;
const AUDIO_GAP = -0.25;

function similarity(tabPitch: number, audioPitch: number): number {
  const d = Math.abs(tabPitch - audioPitch);
  if (d === 0) return MATCH;
  if (d % 12 === 0) return OCTAVE;
  if (d === 1) return NEAR;
  return MISMATCH;
}

interface Alignment {
  score: number;
  pairs: (number | null)[];
}

function align(tab: number[], audio: number[], shift: number): Alignment {
  const n = tab.length;
  const m = audio.length;
  const W = m + 1;
  const score = new Float64Array((n + 1) * W);
  const move = new Uint8Array((n + 1) * W);

  for (let i = 1; i <= n; i++) {
    score[i * W] = i * TAB_GAP;
    move[i * W] = 2;
  }
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const diag = score[(i - 1) * W + j - 1] + similarity(tab[i - 1] + shift, audio[j - 1]);
      const up = score[(i - 1) * W + j] + TAB_GAP;
      const left = score[i * W + j - 1] + (i === n ? 0 : AUDIO_GAP);
      let best = diag;
      let mv = 1;
      if (up > best) [best, mv] = [up, 2];
      if (left > best) [best, mv] = [left, 3];
      score[i * W + j] = best;
      move[i * W + j] = mv;
    }
  }

  let j = 0;
  for (let k = 0; k <= m; k++) if (score[n * W + k] > score[n * W + j]) j = k;
  const total = score[n * W + j];

  const pairs: (number | null)[] = new Array(n).fill(null);
  let i = n;
  while (i > 0) {
    const mv = j > 0 ? move[i * W + j] : 2;
    if (mv === 1) {
      if (similarity(tab[i - 1] + shift, audio[j - 1]) > 0) pairs[i - 1] = j - 1;
      i--;
      j--;
    } else if (mv === 2) i--;
    else j--;
  }
  return { score: total, pairs };
}

export interface AlignResult {
  starts: number[];
  matched: number;
  shift: number;
  pairs: (number | null)[];
}

export function alignTabToAudio(tabPitches: number[], audioNotes: Note[]): AlignResult {
  const audio = audioNotes.map((n) => n.pitch);
  let best: Alignment & { shift: number } = { score: -Infinity, pairs: [], shift: 0 };
  for (let shift = -24; shift <= 24; shift++) {
    const a = align(tabPitches, audio, shift);
    if (a.score > best.score) best = { ...a, shift };
  }

  const starts: number[] = best.pairs.map((p) => (p === null ? NaN : audioNotes[p].start));
  const known = starts.map((s, i) => (Number.isNaN(s) ? -1 : i)).filter((i) => i >= 0);
  const matched = known.length;
  const step = 0.4;

  if (known.length === 0) return { starts: tabPitches.map((_, i) => i * step), matched, shift: best.shift, pairs: best.pairs };

  for (let i = 0; i < starts.length; i++) {
    if (!Number.isNaN(starts[i])) continue;
    const before = [...known].reverse().find((k) => k < i);
    const after = known.find((k) => k > i);
    if (before !== undefined && after !== undefined) {
      starts[i] = starts[before] + ((starts[after] - starts[before]) * (i - before)) / (after - before);
    } else if (before !== undefined) {
      starts[i] = starts[before] + (i - before) * step;
    } else {
      starts[i] = Math.max(0, starts[after!] - (after! - i) * step);
    }
  }
  for (let i = 1; i < starts.length; i++) if (starts[i] < starts[i - 1]) starts[i] = starts[i - 1];
  return { starts, matched, shift: best.shift, pairs: best.pairs };
}
