import { getLang, t } from '../i18n';

export type Layout = 'normal' | 'classic';

export const BTN = {
  Y: 1 << 0,
  B: 1 << 1,
  A: 1 << 2,
  X: 1 << 3,
  L: 1 << 4,
  R: 1 << 5,
  ZL: 1 << 6,
  ZR: 1 << 7,
} as const;

export const HAT = { UP: 0, RIGHT: 2, DOWN: 4, LEFT: 6, NONE: 8 } as const;
export const STICK = { UP: 0, MID: 128, DOWN: 255 } as const;

export const BASE_PITCHES = [62, 65, 69, 71, 74] as const;

export const LAYOUT_BUTTONS: Record<Layout, readonly { mask: number; name: string }[]> = {
  normal: [
    { mask: BTN.L, name: 'L' },
    { mask: BTN.R, name: 'R' },
    { mask: BTN.A, name: 'A' },
    { mask: BTN.Y, name: 'Y' },
    { mask: BTN.X, name: 'X' },
  ],
  classic: [
    { mask: BTN.R, name: 'R' },
    { mask: BTN.B, name: 'B' },
    { mask: BTN.A, name: 'A' },
    { mask: BTN.Y, name: 'Y' },
    { mask: BTN.X, name: 'X' },
  ],
};

export const MIN_PITCH = 59;
export const MAX_PITCH = 77;

export interface Combo {
  base: number;
  offset: number;
}

const OFFSET_COST = [0, 1, 1.2, 2.5];

export function comboCost(c: Combo): number {
  return OFFSET_COST[Math.abs(c.offset)];
}

export function comboPitch(c: Combo): number {
  return BASE_PITCHES[c.base] + c.offset;
}

export function modifiers(offset: number): { hat: number; ly: number } {
  const dir = Math.sign(offset);
  const n = Math.abs(offset);
  const dpad = n === 1 || n === 3;
  const stick = n >= 2;
  return {
    hat: dpad ? (dir > 0 ? HAT.UP : HAT.DOWN) : HAT.NONE,
    ly: stick ? (dir > 0 ? STICK.UP : STICK.DOWN) : STICK.MID,
  };
}

export function combosForPitch(pitch: number): Combo[] {
  const list: Combo[] = [];
  BASE_PITCHES.forEach((p, base) => {
    const offset = pitch - p;
    if (offset >= -3 && offset <= 3) list.push({ base, offset });
  });
  return list.sort((a, b) => comboCost(a) - comboCost(b) || a.base - b.base);
}

export function bestCombo(pitch: number): Combo | null {
  return combosForPitch(pitch)[0] ?? null;
}

export function inRange(pitch: number): boolean {
  return pitch >= MIN_PITCH && pitch <= MAX_PITCH;
}

export function padStateFor(c: Combo, layout: Layout): { buttons: number; hat: number; ly: number } {
  return { buttons: LAYOUT_BUTTONS[layout][c.base].mask, ...modifiers(c.offset) };
}

export function comboLabel(c: Combo, layout: Layout): string {
  const parts = [LAYOUT_BUTTONS[layout][c.base].name];
  const n = Math.abs(c.offset);
  const arrow = c.offset > 0 ? '↑' : '↓';
  if (n >= 2) parts.push(`${t('combo.stick')}${arrow}`);
  if (n === 1 || n === 3) parts.push(`${t('combo.dpad')}${arrow}`);
  return parts.join(' + ');
}

const NAMES_FR = ['Do', 'Do#', 'Ré', 'Ré#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];
const NAMES_EN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function noteName(pitch: number): string {
  const names = getLang() === 'en' ? NAMES_EN : NAMES_FR;
  return `${names[((pitch % 12) + 12) % 12]}${Math.floor(pitch / 12) - 1}`;
}

export const BASE_COLORS = ['#3fb950', '#4c8dff', '#ff5d5d', '#f2c744', '#b07cff'];
