import { t as tr } from '../i18n';
import type { Note, Song } from './types';

export const SPEED_TEST_STEPS_MS = [250, 200, 160, 130, 110, 95, 80, 70, 60];

export function makeSpeedTest(): Song {
  const notes: Note[] = [];
  const scale = [62, 65, 69, 71, 74, 71, 69, 65];
  const chromatic = [69, 70, 69, 70, 69, 70, 69, 70];
  let t = 0;
  for (const step of SPEED_TEST_STEPS_MS) {
    for (const pitch of [...scale, ...chromatic]) {
      notes.push({ start: t, dur: (step / 1000) * 0.8, pitch });
      t += step / 1000;
    }
    t += 1.5;
  }
  return {
    id: Math.random().toString(36).slice(2, 10),
    name: tr('songs.speedTestName'),
    notes,
    minNoteMs: 30,
  };
}
