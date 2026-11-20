import { t } from '../i18n';
import { BASE_PITCHES, LAYOUT_BUTTONS, type Combo, type Layout } from './ocarina';

export type TabItem =
  | { kind: 'note'; pitch: number; combo: Combo; beats: number; token: string }
  | { kind: 'rest'; beats: number; token: string };

export interface TabError {
  token: string;
  index: number;
  message: string;
}

export interface TabResult {
  items: TabItem[];
  errors: TabError[];
}

const UP = '(?:↑|⬆|\\^|up|haut|\\+)';
const DOWN = '(?:↓|⬇|v|down|bas|-)';
const STICK = '(?:joystick|l-?stick|stick|ls|analog(?:ique)?|joy)';
const DPAD = '(?:d-?pad|dpad|croix|pad|dp|fl[eè]che)';

function normalizeModifiers(text: string): string {
  return text
    .replace(new RegExp(`${STICK}\\s*${UP}`, 'gi'), '§S+§')
    .replace(new RegExp(`${STICK}\\s*${DOWN}`, 'gi'), '§S-§')
    .replace(new RegExp(`${DPAD}\\s*${UP}`, 'gi'), '§D+§')
    .replace(new RegExp(`${DPAD}\\s*${DOWN}`, 'gi'), '§D-§')
    .replace(/[↑⬆]/g, '§D+§')
    .replace(/[↓⬇]/g, '§D-§');
}

export function parseTab(text: string, layout: Layout): TabResult {
  const items: TabItem[] = [];
  const errors: TabError[] = [];

  const lines = text.split(/\r?\n/).map((l) => l.replace(/^\s*[^,:]{1,40}:\s*/, ''));
  const joined = normalizeModifiers(lines.join(' , '))
    .replace(/\s*\+\s*(?=§)/g, '+')
    .replace(/§\s*\+\s*/g, '§+')
    .replace(/\s*([*/])\s*/g, '$1');

  const tokens = joined.split(/[\s,;|]+/).filter((t) => t.length > 0);
  const buttons = LAYOUT_BUTTONS[layout].map((b) => b.name);

  tokens.forEach((raw, i) => {
    const index = i + 1;
    let token = raw;
    let beats = 1;

    const rhythm = token.match(/([*/])(\d+(?:[.,]\d+)?)$/);
    if (rhythm) {
      const n = parseFloat(rhythm[2].replace(',', '.'));
      if (n > 0) beats = rhythm[1] === '*' ? n : 1 / n;
      token = token.slice(0, -rhythm[0].length);
    }

    if (token === '-' || token === '_' || token === '…' || token === '...') {
      items.push({ kind: 'rest', beats, token: raw });
      return;
    }

    let offset = 0;
    for (const m of token.matchAll(/§([SD])([+-])§/g)) {
      offset += (m[1] === 'S' ? 2 : 1) * (m[2] === '+' ? 1 : -1);
    }
    const parts = token.replace(/§[SD][+-]§/g, '+').split('+').filter(Boolean);

    let base = -1;
    let problem = '';
    for (const part of parts) {
      const code = part.toUpperCase();
      const b = buttons.indexOf(code);
      if (b >= 0 && base < 0) base = b;
      else if (b >= 0) problem = t('tabErr.twoNotes');
      else if (code === 'B' && layout === 'normal')
        problem = t('tabErr.bNormal');
      else if (code === 'L' && layout === 'classic') problem = t('tabErr.lClassic');
      else problem = t('tabErr.unknown', { part });
    }
    if (!problem && base < 0) problem = t('tabErr.noBase');
    if (!problem && Math.abs(offset) > 3) problem = t('tabErr.tooMany');

    if (problem) {
      errors.push({ token: raw.replace(/§/g, ''), index, message: problem });
      return;
    }
    items.push({
      kind: 'note',
      pitch: BASE_PITCHES[base] + offset,
      combo: { base, offset },
      beats,
      token: raw.replace(/§/g, ''),
    });
  });

  return { items, errors };
}
