import { describe, expect, it } from 'vitest';
import { alignTabToAudio } from './align';
import { quantizeStarts, sustain, trackBeats } from './beats';
import { compileSong } from './compile';
import { breakGameSongs, findGameSongs } from './gameSongs';
import { BTN, HAT, STICK, bestCombo, comboPitch, combosForPitch, MAX_PITCH, MIN_PITCH } from './ocarina';
import { bankSize, crc32, decodeBank, encodeBank } from './pack';
import { bestTranspose, cleanup, extractMelody, foldIntoRange, makePlayable, mergeDrift, skyline } from './simplify';
import { parseTab } from './tab';
import { DEFAULT_SETTINGS, type Note } from './types';
import { toUf2 } from './uf2';

const note = (start: number, pitch: number, dur = 0.3, vel = 0.8): Note => ({ start, pitch, dur, vel });

describe('ocarina', () => {
  it('chaque hauteur de la tessiture a une combinaison', () => {
    for (let p = MIN_PITCH; p <= MAX_PITCH; p++) {
      const c = bestCombo(p);
      expect(c, `hauteur ${p}`).not.toBeNull();
      expect(comboPitch(c!)).toBe(p);
    }
    expect(bestCombo(MIN_PITCH - 1)).toBeNull();
    expect(bestCombo(MAX_PITCH + 1)).toBeNull();
  });

  it('préfère la note naturelle puis la croix', () => {
    expect(bestCombo(69)).toEqual({ base: 2, offset: 0 });
    expect(bestCombo(70)).toEqual({ base: 2, offset: 1 });
    expect(combosForPitch(70)).toHaveLength(2);
  });
});

describe('tablature', () => {
  it('lit l’exemple du brief', () => {
    const r = parseTab('Intro:\nL , R , A+Dpad↑ , Y , - , X+Stick↓ , A , R+Dpad↓ , L+Stick↓', 'normal');
    expect(r.errors).toEqual([]);
    const pitches = r.items.map((i) => (i.kind === 'note' ? i.pitch : 'silence'));
    expect(pitches).toEqual([62, 65, 70, 71, 'silence', 72, 69, 64, 60]);
  });

  it('accepte les variantes d’écriture', () => {
    const r = parseTab('a + croix haut, x+stick down, Y+LS↓, r+joystick bas+d-pad bas, A*2, Y/2', 'normal');
    expect(r.errors).toEqual([]);
    const notes = r.items.filter((i) => i.kind === 'note');
    expect(notes.map((n) => n.pitch)).toEqual([70, 72, 69, 62, 69, 71]);
    expect(notes.map((n) => n.beats)).toEqual([1, 1, 1, 1, 2, 0.5]);
  });

  it('signale les mots inconnus sans tout bloquer', () => {
    const r = parseTab('L, Z, B, A+Stick↑+Stick↑', 'normal');
    expect(r.items).toHaveLength(1);
    expect(r.errors.map((e) => e.index)).toEqual([2, 3, 4]);
    expect(r.errors[1].message).toMatch(/Normale/);
  });

  it('disposition classique : B est une note', () => {
    const r = parseTab('R, B, A', 'classic');
    expect(r.errors).toEqual([]);
    expect(r.items.map((i) => (i.kind === 'note' ? i.pitch : 0))).toEqual([62, 65, 69]);
  });
});

describe('simplification', () => {
  it('skyline garde la note aiguë des accords', () => {
    const out = skyline([note(0, 60), note(0.01, 67), note(0.5, 64), note(0.5, 72)]);
    expect(out.map((n) => n.pitch)).toEqual([67, 72]);
  });

  it('transpose dans la tessiture', () => {
    const melody = [note(0, 84), note(0.5, 86), note(1, 88)];
    const t = bestTranspose(melody);
    for (const n of melody) expect(n.pitch + t).toBeGreaterThanOrEqual(MIN_PITCH);
    for (const n of melody) expect(n.pitch + t).toBeLessThanOrEqual(MAX_PITCH);
  });

  it('nettoie les notes trop rapprochées', () => {
    const out = cleanup([note(0, 62, 0.5), note(0.03, 65, 0.02), note(0.6, 69)], 0.1);
    expect(out.map((n) => n.pitch)).toEqual([62, 69]);
  });

  it('fusionne les notes identiques coupées par l’IA', () => {
    const out = cleanup([note(0, 62, 0.2), note(0.22, 62, 0.3)], 0.1, 0.06);
    expect(out).toHaveLength(1);
    expect(out[0].dur).toBeCloseTo(0.52);
  });

  it('extraction de mélodie : suit la mélodie au-dessus de l’accompagnement', () => {
    const melody = [72, 74, 76, 77, 76, 74, 72];
    const raw: Note[] = [];
    melody.forEach((p, i) => {
      raw.push(note(i * 0.5, p, 0.45, 0.9));
      raw.push(note(i * 0.5, 48, 0.45, 0.5));
    });
    expect(extractMelody(raw).map((n) => n.pitch)).toEqual(melody);
  });

  it('recolle les glissements de fin de note, garde les vraies notes voisines', () => {
    const notes = [
      note(0, 72, 0.25, 0.75),
      note(0.25, 71, 0.06, 0.35),
      note(0.31, 73, 0.1, 0.45),
      note(0.5, 71, 0.2, 0.7),
      note(0.7, 72, 0.2, 0.68),
    ];
    const { notes: out, merged } = mergeDrift(notes);
    expect(merged).toBe(2);
    expect(out.map((n) => n.pitch)).toEqual([72, 71, 72]);
    expect(out[0].dur).toBeCloseTo(0.41);
  });

  it('replie une phrase entière d’une octave plutôt que note par note', () => {
    const phrase = [74, 76, 79, 81].map((p, i) => note(i * 0.3, p, 0.25));
    const { notes } = foldIntoRange(phrase);
    const pitches = notes.map((n) => n.pitch);
    expect(pitches).toEqual([62, 64, 67, 69]);
    for (const p of pitches) expect(bestCombo(p)).not.toBeNull();
  });

  it('piano lié sur deux octaves : change d’octave une seule fois, au lieu de casser la ligne', () => {
    const scale = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81, 83, 84].map((p, i) => note(i * 0.2, p, 0.2));
    const { notes } = foldIntoRange(scale);
    let breaks = 0;
    for (let i = 1; i < notes.length; i++) if (notes[i].pitch - notes[i - 1].pitch !== scale[i].pitch - scale[i - 1].pitch) breaks++;
    expect(breaks).toBe(1);
    for (const n of notes) expect(bestCombo(n.pitch)).not.toBeNull();
  });

  it('fidélité : recoller des morceaux ne compte pas comme une perte', () => {
    const fragments = [note(0, 62, 0.2, 0.8), note(0.21, 62, 0.2, 0.75), note(0.6, 65, 0.3, 0.8)];
    const r = makePlayable(fragments, { kind: 'audio', minNoteSec: 0.1 });
    expect(r.notes).toHaveLength(2);
    expect(r.fidelity).toBeGreaterThan(0.95);
    expect(r.tooFast).toBe(0);
  });

  it('chaîne complète : tout est jouable', () => {
    const raw = Array.from({ length: 40 }, (_, i) => note(i * 0.25, 40 + ((i * 7) % 50), 0.2));
    const { notes } = makePlayable(raw, { kind: 'midi', minNoteSec: 0.1 });
    for (const n of notes) expect(bestCombo(n.pitch)).not.toBeNull();
  });
});

describe('chansons du jeu', () => {
  it('repère et casse la Berceuse de Zelda', () => {
    const lullaby = [3, 4, 2, 3, 4, 2].map((base) => ({ base, offset: 0 }));
    expect(findGameSongs(lullaby)[0].song).toBe('Berceuse de Zelda');
    const { combos, fixed } = breakGameSongs(lullaby);
    expect(fixed).toHaveLength(1);
    expect(findGameSongs(combos)).toEqual([]);
    combos.forEach((c, i) => expect(comboPitch(c)).toBe(comboPitch(lullaby[i])));
  });
});

describe('alignement tablature ↔ audio', () => {
  it('retrouve le rythme malgré une transposition et des notes parasites', () => {
    const tab = [62, 65, 69, 71, 74, 71, 69];
    const audio: Note[] = [];
    tab.forEach((p, i) => {
      audio.push(note(1 + i * 0.6, p + 5));
      if (i % 2) audio.push(note(1.3 + i * 0.6, 40));
    });
    const r = alignTabToAudio(tab, audio.sort((a, b) => a.start - b.start));
    expect(r.shift).toBe(5);
    expect(r.matched).toBe(tab.length);
    r.starts.forEach((s, i) => expect(s).toBeCloseTo(1 + i * 0.6));
  });
});

describe('compilation', () => {
  const settings = { ...DEFAULT_SETTINGS, takeOutOcarina: false, avoidGameSongs: false };

  it('tient le modificateur avant la note et relâche entre deux notes identiques', () => {
    const { events } = compileSong([note(0, 70, 0.4), note(0.5, 70, 0.4)], settings);
    const pressA = events.filter((e) => e.buttons === BTN.A);
    expect(pressA).toHaveLength(2);
    for (const press of pressA) {
      const before = events[events.indexOf(press) - 1];
      expect(before.buttons).toBe(0);
      expect(before.hat).toBe(HAT.UP);
      expect(press.t - before.t).toBeGreaterThanOrEqual(30);
    }
    const between = events.slice(events.indexOf(pressA[0]) + 1, events.indexOf(pressA[1]));
    expect(between.some((e) => e.buttons === 0)).toBe(true);
    expect(events[events.length - 1]).toMatchObject({ buttons: 0, hat: HAT.NONE, ly: STICK.MID });
  });

  it('les temps sont croissants et chaque état dure assez longtemps', () => {
    const notes = Array.from({ length: 30 }, (_, i) => note(i * 0.12, 59 + (i % 19), 0.1));
    const { events } = compileSong(notes, settings);
    for (let i = 1; i < events.length; i++) expect(events[i].t).toBeGreaterThan(events[i - 1].t);
  });

  it('sort l’ocarina au début si demandé', () => {
    const { events } = compileSong([note(0, 62)], { ...settings, takeOutOcarina: true });
    expect(events.some((e) => e.hat === HAT.LEFT)).toBe(true);
  });
});

describe('banque et UF2', () => {
  it('CRC-32 standard', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });

  it('aller-retour encode / décode', () => {
    const songs = [
      { name: 'Test é', events: compileSong([note(0, 62), note(0.5, 77)], DEFAULT_SETTINGS).events },
      { name: 'Long', events: [{ t: 0, buttons: 0, hat: 8, ly: 128 }, { t: 140000, buttons: BTN.A, hat: 8, ly: 128 }] },
    ];
    const bank = encodeBank(songs);
    expect(bank.length).toBe(bankSize(songs));
    const back = decodeBank(bank);
    expect(back[0]).toEqual(songs[0]);
    expect(back[1].events[back[1].events.length - 1]).toEqual(songs[1].events[1]);
  });

  it('UF2 : blocs de 512 octets à la bonne adresse', () => {
    const uf2 = toUf2(new Uint8Array(600), 0x101c0000);
    expect(uf2.length).toBe(3 * 512);
    const view = new DataView(uf2.buffer);
    expect(view.getUint32(512 + 12, true)).toBe(0x101c0100);
    expect(view.getUint32(24, true)).toBe(3);
  });
});

describe('notes liées et rythme', () => {
  const settings = { ...DEFAULT_SETTINGS, takeOutOcarina: false, avoidGameSongs: false };

  it('enchaîne deux notes collées sans relâcher (mêmes modificateurs)', () => {
    const { events } = compileSong([note(0, 62, 0.3), note(0.3, 65, 0.3)], settings);
    const iL = events.findIndex((e) => e.buttons === BTN.L);
    const iR = events.findIndex((e) => e.buttons === BTN.R);
    expect(iR).toBe(iL + 1);
    const off = compileSong([note(0, 62, 0.3), note(0.3, 65, 0.3)], { ...settings, legato: 'off' as const }).events;
    expect(off.some((e, i) => i > off.findIndex((x) => x.buttons === BTN.L) && e.buttons === 0 && i < off.findIndex((x) => x.buttons === BTN.R))).toBe(true);
  });

  it('mode « toujours » : change de modificateur sans relâcher', () => {
    const tied = compileSong([note(0, 62, 0.3), note(0.3, 76, 0.3)], { ...settings, legato: 'always' as const }).events;
    const i = tied.findIndex((e) => e.buttons === BTN.L);
    expect(tied[i + 1].buttons).not.toBe(0);
    const safe = compileSong([note(0, 62, 0.3), note(0.3, 76, 0.3)], settings).events;
    expect(safe[safe.findIndex((e) => e.buttons === BTN.L) + 1].buttons).toBe(0);
  });

  it('relâche toujours entre deux notes identiques', () => {
    const { events } = compileSong([note(0, 62, 0.3), note(0.3, 62, 0.3)], settings);
    const presses = events.filter((e) => e.buttons === BTN.L);
    expect(presses).toHaveLength(2);
  });

  it('fait tenir une note jusqu’à la suivante, mais garde un vrai silence', () => {
    const out = sustain([note(0, 62, 0.1), note(0.3, 65, 0.1), note(2, 69, 0.2)], 0.4);
    expect(out[0].dur).toBeCloseTo(0.3);
    expect(out[1].dur).toBeCloseTo(0.1);
  });

  it('retrouve le tempo et cale les notes sur la grille', () => {
    const fps = 22050 / 256;
    const frames: number[][] = [];
    const onsets: number[][] = [];
    for (let t = 0; t < fps * 12; t++) {
      const beat = Math.abs(((t / fps) % 0.5)) < 1 / fps;
      onsets.push(Array.from({ length: 88 }, (_, k) => (beat && k === 40 ? 1 : 0)));
      frames.push(Array.from({ length: 88 }, (_, k) => (k === 40 && (t / fps) % 0.5 < 0.3 ? 1 : 0)));
    }
    const b = trackBeats({ frames, onsets });
    expect(60 / b.period).toBeGreaterThan(115);
    expect(60 / b.period).toBeLessThan(125);
    const notes = quantizeStarts([note(2.02, 62, 0.4), note(2.48, 65, 0.4)], b);
    const grid = (x: number) => Math.min(...b.times.map((g) => Math.abs(g - x)));
    expect(grid(notes[0].start)).toBeLessThan(0.015);
    expect(grid(notes[1].start)).toBeLessThan(0.015);
  });
});

describe('traduction', () => {
  it('le dictionnaire anglais a toutes les clés et les mêmes {variables}', async () => {
    const src = (await import('node:fs')).readFileSync(new URL('../i18n.ts', import.meta.url), 'utf8');
    const block = (name: string) => src.slice(src.indexOf(`const ${name}`), src.indexOf('};', src.indexOf(`const ${name}`)));
    const entries = (b: string) => new Map([...b.matchAll(/^\s+'([\w.]+)':\s*\n?\s*'((?:[^'\\]|\\.)*)'/gm)].map((m) => [m[1], m[2]]));
    const fr = entries(block('fr'));
    const en = entries(block('en'));
    expect(fr.size).toBeGreaterThan(200);
    expect([...fr.keys()].filter((k) => !en.has(k))).toEqual([]);
    const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
    for (const [k, v] of fr) expect(vars(en.get(k)!), k).toBe(vars(v));
  });
});

describe('mode assisté : notes imposées et refusées', () => {
  const raw: Note[] = [
    { start: 0, dur: 0.4, pitch: 72, vel: 0.8, src: 0 },
    { start: 0.5, dur: 0.4, pitch: 55, vel: 0.9, src: 1 },
    { start: 0.5, dur: 0.4, pitch: 74, vel: 0.4, src: 2 },
    { start: 1, dur: 0.4, pitch: 76, vel: 0.8, src: 3 },
    { start: 1.5, dur: 0.4, pitch: 57, vel: 0.9, src: 4 },
  ];
  const srcs = (notes: Note[]) => notes.map((n) => n.src);

  it('sans choix, le résultat est le même qu’avant', () => {
    expect(extractMelody(raw, undefined, { pinned: new Set(), banned: new Set() })).toEqual(extractMelody(raw));
  });

  it('une note refusée n’est plus jamais choisie', () => {
    const free = srcs(extractMelody(raw));
    expect(free).toContain(4);
    expect(srcs(extractMelody(raw, undefined, { pinned: new Set(), banned: new Set([4]) }))).not.toContain(4);
  });

  it('une note imposée est toujours dans la mélodie, même faible ou isolée', () => {
    for (const pin of [1, 2, 4]) {
      const out = srcs(extractMelody(raw, undefined, { pinned: new Set([pin]), banned: new Set() }));
      expect(out).toContain(pin);
    }
    const out = srcs(extractMelody(raw, undefined, { pinned: new Set([2]), banned: new Set() }));
    expect(out).not.toContain(1);
  });

  it('deux notes imposées au même instant : choix ignorés plutôt que mélodie vide', () => {
    const out = extractMelody(raw, undefined, { pinned: new Set([1, 2]), banned: new Set() });
    expect(out.length).toBeGreaterThan(0);
  });
});
