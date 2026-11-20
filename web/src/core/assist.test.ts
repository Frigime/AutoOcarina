import { describe, expect, it } from 'vitest';
import { applyStroke, assistedMelody, buildAssistData, displayCandidates, emptyChoices, passageVariants, solveAssisted, toggleBan, togglePin } from './assist';
import type { Note } from './types';

const melody = [72, 74, 76, 77];
const raw: Note[] = [];
melody.forEach((p, i) => {
  raw.push({ start: i * 0.5, dur: 0.4, pitch: p, vel: 0.35 });
  raw.push({ start: i * 0.5 + 0.01, dur: 0.45, pitch: 67 + (i % 2), vel: 0.95 });
});
const noModel = { frames: [], onsets: [] };
const beats = { period: 0.5, times: [], confidence: 0 };
const data = () => buildAssistData(raw, noModel, beats);
const pitches = (notes: Note[]) => notes.map((n) => n.pitch);

describe('mode assisté', () => {
  it('sans choix : même mélodie que l’analyse normale, et chaque note garde son numéro', () => {
    const d = data();
    const m = assistedMelody(d, emptyChoices());
    expect(pitches(m)).toEqual([67, 68, 67, 68]);
    for (const n of m) expect(d.raw[n.src!].pitch).toBe(n.pitch);
  });

  it('surligner un passage : la mélodie devient exactement les notes touchées', () => {
    const d = data();
    const choices = emptyChoices();
    const touched = d.raw.filter((n) => melody.includes(n.pitch)).map((n) => n.src!);
    applyStroke(d, choices, touched, 0, 2);
    expect(pitches(assistedMelody(d, choices))).toEqual(melody);
    expect(choices.banned.size).toBe(4);
    const half = emptyChoices();
    applyStroke(d, half, touched.slice(0, 2), 0, 0.6);
    expect(pitches(assistedMelody(d, half))).toEqual([72, 74, 67, 68]);
  });

  it('cliquer : imposer une note, en refuser une autre, puis annuler', () => {
    const d = data();
    const choices = emptyChoices();
    const high = d.raw.find((n) => n.pitch === 76)!.src!;
    togglePin(d, choices, high);
    expect(pitches(assistedMelody(d, choices))).toContain(76);
    togglePin(d, choices, high);
    expect(choices.pinned.size).toBe(0);
    const low = d.raw.find((n) => n.pitch === 67)!.src!;
    toggleBan(d, choices, low, 0.45);
    expect(assistedMelody(d, choices).some((n) => n.src === low)).toBe(false);
    toggleBan(d, choices, low);
    expect(choices.banned.has(low)).toBe(false);
  });

  it('arrangement : la transposition reste celle de la première analyse', () => {
    const d = data();
    const first = solveAssisted(d, emptyChoices(), 0.1);
    const choices = emptyChoices();
    applyStroke(d, choices, d.raw.filter((n) => melody.includes(n.pitch)).map((n) => n.src!), 0, 2);
    const second = solveAssisted(d, choices, 0.1);
    expect(second.transpose).toBe(first.transpose);
    expect(second.notes).toHaveLength(4);
    for (const n of second.notes) expect(n.src).toBeDefined();
  });

  it('notes grises : les candidates non choisies, à la hauteur où elles seraient jouées', () => {
    const d = data();
    const res = solveAssisted(d, emptyChoices(), 0.1);
    const cands = displayCandidates(d, res.notes, emptyChoices());
    expect(cands).toHaveLength(4);
    expect(cands.every((c) => c.state === 'free' && c.pitch >= 59 && c.pitch <= 77)).toBe(true);
    const shift = res.notes[0].pitch - 67;
    expect(cands.map((c) => c.pitch)).toEqual(melody.map((p) => (p + shift > 77 ? p + shift - 12 : p + shift)));
  });
});

describe('versions de la mélodie', () => {
  const lines: Note[] = [];
  [84, 91, 84, 91, 84, 91].forEach((p, i) => lines.push({ start: i * 0.5, dur: 0.2, pitch: p, vel: 0.5 }));
  [64, 65, 67, 65, 64, 62].forEach((p, i) => lines.push({ start: i * 0.5 + 0.22, dur: 0.26, pitch: p, vel: 0.5 }));
  const d = () => buildAssistData(lines, noModel, beats);

  it('« plus aiguë » et « plus grave » ne choisissent pas la même ligne', () => {
    const avg = (notes: Note[]) => notes.reduce((s, n) => s + n.pitch, 0) / notes.length;
    const high = avg(assistedMelody(d(), emptyChoices(), 'high'));
    const low = avg(assistedMelody(d(), emptyChoices(), 'low'));
    expect(high).toBeGreaterThan(low + 3);
  });

  it('une note choisie par l’utilisateur reste dans toutes les versions', () => {
    const data = d();
    const choices = emptyChoices();
    const pick = data.raw.find((n) => n.pitch === 62)!.src!;
    togglePin(data, choices, pick);
    for (const v of ['normal', 'high', 'low'] as const) expect(assistedMelody(data, choices, v).some((n) => n.src === pick)).toBe(true);
  });
});

describe('refaire un passage', () => {
  it('propose la ligne cachée du passage, sans toucher au reste', () => {
    const d = buildAssistData(raw, noModel, beats);
    const choices = emptyChoices();
    const current = assistedMelody(d, choices);
    const variants = passageVariants(d, choices, current, 0, 0.6);
    expect(variants.length).toBeGreaterThan(0);
    const melodyVariant = variants.find((v) => v.map((s) => d.raw[s].pitch).join(' ') === '72 74');
    expect(melodyVariant).toBeDefined();
    applyStroke(d, choices, melodyVariant!, 0, 0.6);
    expect(pitches(assistedMelody(d, choices))).toEqual([72, 74, 67, 68]);
    const keys = variants.map((v) => v.join(','));
    expect(new Set(keys).size).toBe(keys.length);
  });
});
