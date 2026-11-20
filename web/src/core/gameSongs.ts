import { comboCost, type Combo } from './ocarina';

export const GAME_SONGS: { name: string; notes: number[] }[] = [
  { name: 'Berceuse de Zelda', notes: [3, 4, 2, 3, 4, 2] },
  { name: 'Chant d’Epona', notes: [4, 3, 2, 4, 3, 2] },
  { name: 'Chant de Saria', notes: [1, 2, 3, 1, 2, 3] },
  { name: 'Chant du Soleil', notes: [2, 1, 4, 2, 1, 4] },
  { name: 'Chant du Temps', notes: [2, 0, 1, 2, 0, 1] },
  { name: 'Chant des Tempêtes', notes: [0, 1, 4, 0, 1, 4] },
  { name: 'Menuet de la Forêt', notes: [0, 4, 3, 2, 3, 2] },
  { name: 'Boléro du Feu', notes: [1, 0, 1, 0, 2, 1, 2, 1] },
  { name: 'Sérénade de l’Eau', notes: [0, 1, 2, 2, 3] },
  { name: 'Nocturne de l’Ombre', notes: [3, 2, 2, 0, 3, 2, 1] },
  { name: 'Requiem des Esprits', notes: [0, 1, 0, 2, 1, 0] },
  { name: 'Prélude de la Lumière', notes: [4, 2, 4, 2, 3, 4] },
];

const ALTERNATIVE: Combo[] = [
  { base: 1, offset: -3 },
  { base: 0, offset: 3 },
  { base: 3, offset: -2 },
  { base: 2, offset: 2 },
  { base: 3, offset: 3 },
];

export interface SongHit {
  song: string;
  index: number;
}

export function findGameSongs(combos: Combo[]): SongHit[] {
  const hits: SongHit[] = [];
  for (const song of GAME_SONGS) {
    const len = song.notes.length;
    for (let i = 0; i + len <= combos.length; i++) {
      let ok = true;
      for (let k = 0; k < len && ok; k++) {
        const c = combos[i + k];
        ok = c.offset === 0 && c.base === song.notes[k];
      }
      if (ok) hits.push({ song: song.name, index: i });
    }
  }
  return hits.sort((a, b) => a.index - b.index);
}

export function breakGameSongs(combos: Combo[]): { combos: Combo[]; fixed: SongHit[] } {
  const out = combos.map((c) => ({ ...c }));
  const fixed: SongHit[] = [];
  for (let guard = 0; guard < 1000; guard++) {
    const hit = findGameSongs(out)[0];
    if (!hit) break;
    const len = GAME_SONGS.find((s) => s.name === hit.song)!.notes.length;
    let pick = hit.index;
    for (let k = hit.index; k < hit.index + len; k++) {
      if (comboCost(ALTERNATIVE[out[k].base]) < comboCost(ALTERNATIVE[out[pick].base])) pick = k;
    }
    out[pick] = { ...ALTERNATIVE[out[pick].base] };
    fixed.push(hit);
  }
  return { combos: out, fixed };
}
