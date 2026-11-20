import { breakGameSongs, type SongHit } from './gameSongs';
import { bestCombo, HAT, padStateFor, STICK, type Combo } from './ocarina';
import type { Note, Settings } from './types';

export interface PadEvent {
  t: number;
  buttons: number;
  hat: number;
  ly: number;
}

export interface CompiledSong {
  events: PadEvent[];
  combos: Combo[];
  skipped: number;
  songHits: SongHit[];
  durationMs: number;
}

const NEUTRAL = { buttons: 0, hat: HAT.NONE, ly: STICK.MID };
const MIN_STATE_MS = 30;
const LEGATO_GAP = 0.08;

export function combosFor(notes: Note[]): (Combo | null)[] {
  return notes.map((n) => n.combo ?? bestCombo(n.pitch));
}

export function compileSong(notes: Note[], settings: Settings): CompiledSong {
  const sorted = [...notes].sort((a, b) => a.start - b.start);
  const raw = combosFor(sorted);
  const playable = sorted.filter((_, i) => raw[i] !== null);
  let combos = raw.filter((c): c is Combo => c !== null);

  let songHits: SongHit[] = [];
  if (settings.avoidGameSongs) {
    const res = breakGameSongs(combos);
    combos = res.combos;
    songHits = res.fixed;
  }

  const events: PadEvent[] = [{ t: 0, ...NEUTRAL }];
  let origin = 1000;
  if (settings.takeOutOcarina) {
    events.push({ t: 300, buttons: 0, hat: HAT.LEFT, ly: STICK.MID });
    events.push({ t: 450, ...NEUTRAL });
    origin = 2000;
  }

  const lead = Math.max(MIN_STATE_MS, settings.leadMs);
  const minNote = Math.max(MIN_STATE_MS, settings.minNoteMs);
  const firstStart = playable.length ? playable[0].start : 0;
  let cursor = events[events.length - 1].t;

  const pads = playable.map((_, i) => padStateFor(combos[i], settings.layout));
  const tied = playable.map((note, i) => {
    if (settings.legato === 'off' || i === 0) return false;
    const prev = playable[i - 1];
    const [a, b] = [pads[i - 1], pads[i]];
    if (a.buttons === b.buttons || note.start - (prev.start + prev.dur) >= LEGATO_GAP) return false;
    return settings.legato === 'always' || (a.hat === b.hat && a.ly === b.ly);
  });

  playable.forEach((note, i) => {
    const pad = pads[i];
    let onset = Math.round(origin + (note.start - firstStart) * 1000);

    if (tied[i]) {
      onset = Math.max(onset, cursor + MIN_STATE_MS);
    } else {
      const prep = Math.max(cursor, onset - lead);
      events.push({ t: prep, buttons: 0, hat: pad.hat, ly: pad.ly });
      onset = Math.max(onset, prep + MIN_STATE_MS);
    }

    events.push({ t: onset, ...pad });
    cursor = onset;
    if (tied[i + 1]) return;

    let end = Math.round(onset + note.dur * 1000);
    const next = playable[i + 1];
    if (next) end = Math.min(end, Math.round(origin + (next.start - firstStart) * 1000) - lead);
    end = Math.max(end, onset + minNote);
    events.push({ t: end, ...NEUTRAL });
    cursor = end;
  });

  return {
    events: simplifyEvents(events),
    combos,
    skipped: sorted.length - playable.length,
    songHits,
    durationMs: cursor,
  };
}

function simplifyEvents(events: PadEvent[]): PadEvent[] {
  const out: PadEvent[] = [];
  for (const e of events) {
    const prev = out[out.length - 1];
    if (prev && e.t <= prev.t) {
      out[out.length - 1] = { ...e, t: prev.t };
      continue;
    }
    if (prev && prev.buttons === e.buttons && prev.hat === e.hat && prev.ly === e.ly) continue;
    out.push(e);
  }
  return out.filter((e, i) => {
    const p = out[i - 1];
    return !p || p.buttons !== e.buttons || p.hat !== e.hat || p.ly !== e.ly;
  });
}
