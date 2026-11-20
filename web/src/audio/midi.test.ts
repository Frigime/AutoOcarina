import { describe, expect, it } from 'vitest';
import type { Note } from '../core/types';
import { extractMidiMelody, type MidiTrack } from './midi';

const track = (name: string, notes: Note[]): MidiTrack => ({
  name,
  notes,
  averagePitch: notes.reduce((s, n) => s + n.pitch, 0) / notes.length,
});
const seq = (from: number, pitches: number[], step = 0.25): Note[] =>
  pitches.map((pitch, i) => ({ start: from + i * step, dur: step * 0.9, pitch, vel: 0.8 }));

const PHRASE = [72, 74, 76, 77, 76, 74, 72, 71, 72, 74, 72, 69, 71, 72];
const arpeggio = (from: number, bars: number) => seq(from, Array.from({ length: bars * 16 }, (_, i) => [60, 64, 67, 64][i % 4]));

describe('mélodie d’un MIDI', () => {
  it('préfère la mélodie à un arpège qui a beaucoup plus de notes', () => {
    const tracks = [track('Guitare', arpeggio(0, 4)), track('Célesta', seq(0, PHRASE, 0.5))];
    const m = extractMidiMelody(tracks);
    expect(m.tracks).toEqual([1]);
  });

  it('suit la mélodie quand elle passe d’une piste à l’autre', () => {
    const tracks = [
      track('Arpèges', arpeggio(0, 8)),
      track('Violon (couplet)', seq(0, PHRASE, 0.55)),
      track('Flûte (refrain)', seq(8, PHRASE, 0.55)),
    ];
    const m = extractMidiMelody(tracks);
    expect(m.tracks).toEqual([1, 2]);
    expect(m.notes.some((n) => n.start >= 8 && tracks[2].notes.includes(n))).toBe(true);
  });

  it('ne joue pas la batterie quand elle est seule (intro)', () => {
    const drum = seq(0, Array.from({ length: 48 }, () => 50));
    const tracks = [track('Tambour', drum), track('Mélodie', seq(4, PHRASE, 0.5))];
    const m = extractMidiMelody(tracks);
    expect(m.tracks).toEqual([1]);
    expect(m.notes.every((n) => n.start >= 4)).toBe(true);
  });
});
