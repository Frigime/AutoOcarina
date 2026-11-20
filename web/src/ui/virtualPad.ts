import { t } from '../i18n';

export interface PadState {
  buttons: number;
  hat: number;
  lx: number;
  ly: number;
  rx: number;
  ry: number;
}

export type PadResult = 'ok' | 'bluetooth' | 'busy' | 'error';

export const NEUTRAL: PadState = { buttons: 0, hat: 8, lx: 128, ly: 128, rx: 128, ry: 128 };

const B = { Y: 1, B: 2, A: 4, X: 8, L: 16, R: 32, ZL: 64, ZR: 128, MINUS: 256, PLUS: 512, L3: 1024, R3: 2048, HOME: 4096, CAPTURE: 8192 };

const KEY_BUTTONS: Record<string, number> = {
  KeyL: B.A, KeyK: B.B, KeyI: B.X, KeyJ: B.Y,
  KeyQ: B.L, KeyE: B.ZL, KeyU: B.R, KeyO: B.ZR,
  Enter: B.PLUS, Backspace: B.MINUS, KeyH: B.HOME, KeyC: B.CAPTURE, KeyZ: B.L3, KeyM: B.R3,
};
const KEY_STICK: Record<string, [number, number]> = { KeyW: [0, -1], KeyS: [0, 1], KeyA: [-1, 0], KeyD: [1, 0] };
const KEY_HAT: Record<string, 'up' | 'down' | 'left' | 'right'> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };

const GAMEPAD_BUTTONS = [B.B, B.A, B.Y, B.X, B.L, B.R, B.ZL, B.ZR, B.MINUS, B.PLUS, B.L3, B.R3];
const GAMEPAD_HAT = { 12: 'up', 13: 'down', 14: 'left', 15: 'right' } as const;
const DEADZONE = 0.15;

function hatFrom(d: { up: boolean; down: boolean; left: boolean; right: boolean }): number {
  const up = d.up && !d.down;
  const down = d.down && !d.up;
  const left = d.left && !d.right;
  const right = d.right && !d.left;
  if (up) return right ? 1 : left ? 7 : 0;
  if (down) return right ? 3 : left ? 5 : 4;
  if (right) return 2;
  if (left) return 6;
  return 8;
}

function capture(el: HTMLElement, pointerId: number) {
  try {
    el.setPointerCapture(pointerId);
  } catch {
  }
}

const toByte = (v: number) => Math.max(0, Math.min(255, Math.round(v < 0 ? 128 + v * 128 : 128 + v * 127)));
const same = (a: PadState, b: PadState) =>
  a.buttons === b.buttons && a.hat === b.hat && a.lx === b.lx && a.ly === b.ly && a.rx === b.rx && a.ry === b.ry;
export const isNeutral = (s: PadState) => same(s, NEUTRAL);

export class VirtualPad {
  private screenButtons = new Map<number, number>();
  private screenHat = new Map<number, string>();
  private sticks: Record<'left' | 'right', [number, number]> = { left: [0, 0], right: [0, 0] };
  private keys = new Set<string>();
  private sent: PadState = NEUTRAL;
  private inflight = false;
  private heartbeat = 0;
  private frame = 0;
  private open = false;
  private gamepadName = '';

  constructor(
    private root: HTMLElement,
    private send: (s: PadState) => Promise<PadResult>,
    private onStatus: (r: PadResult) => void,
    private onGamepad: (name: string) => void,
  ) {
    this.bindScreen();
    window.addEventListener('keydown', (e) => this.onKey(e, true), true);
    window.addEventListener('keyup', (e) => this.onKey(e, false), true);
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.update();
    });
  }

  start(): void {
    this.open = true;
    this.pollGamepad();
    this.update(true);
  }

  stop(): void {
    this.open = false;
    cancelAnimationFrame(this.frame);
    clearInterval(this.heartbeat);
    this.heartbeat = 0;
    this.screenButtons.clear();
    this.screenHat.clear();
    this.sticks = { left: [0, 0], right: [0, 0] };
    this.keys.clear();
    this.root.querySelectorAll('.on').forEach((el) => el.classList.remove('on'));
    this.root.querySelectorAll<HTMLElement>('.vstick-knob').forEach((k) => (k.style.transform = ''));
    void this.push(NEUTRAL);
  }

  private gamepadState(): { buttons: number; dir: Record<string, boolean>; l: [number, number]; r: [number, number] } {
    const none = { buttons: 0, dir: {}, l: [0, 0] as [number, number], r: [0, 0] as [number, number] };
    const pads = navigator.getGamepads?.() ?? [];
    const gp = [...pads].find((p) => p && p.connected);
    const name = gp ? gp.id.replace(/\s*\(.*$/, '') : '';
    if (name !== this.gamepadName) {
      this.gamepadName = name;
      this.onGamepad(name);
    }
    if (!gp) return none;
    let buttons = 0;
    GAMEPAD_BUTTONS.forEach((b, i) => {
      if (gp.buttons[i]?.pressed) buttons |= b;
    });
    if (gp.buttons[16]?.pressed) buttons |= B.HOME;
    if (gp.buttons[17]?.pressed) buttons |= B.CAPTURE;
    const dir: Record<string, boolean> = {};
    for (const [i, d] of Object.entries(GAMEPAD_HAT)) if (gp.buttons[Number(i)]?.pressed) dir[d] = true;
    const axis = (i: number) => (Math.abs(gp.axes[i] ?? 0) < DEADZONE ? 0 : gp.axes[i]);
    return { buttons, dir, l: [axis(0), axis(1)], r: [axis(2), axis(3)] };
  }

  private current(): PadState {
    const gp = this.gamepadState();
    let buttons = gp.buttons;
    this.screenButtons.forEach((b) => (buttons |= b));
    const dir: Record<string, boolean> = { ...gp.dir };
    this.screenHat.forEach((d) => (dir[d] = true));
    for (const k of this.keys) {
      if (KEY_BUTTONS[k]) buttons |= KEY_BUTTONS[k];
      if (KEY_HAT[k]) dir[KEY_HAT[k]] = true;
    }
    let [lx, ly] = this.sticks.left;
    if (lx === 0 && ly === 0) {
      for (const k of this.keys) if (KEY_STICK[k]) [lx, ly] = [lx + KEY_STICK[k][0], ly + KEY_STICK[k][1]];
      lx = Math.max(-1, Math.min(1, lx));
      ly = Math.max(-1, Math.min(1, ly));
    }
    if (lx === 0 && ly === 0) [lx, ly] = gp.l;
    let [rx, ry] = this.sticks.right;
    if (rx === 0 && ry === 0) [rx, ry] = gp.r;
    return {
      buttons,
      hat: hatFrom({ up: !!dir.up, down: !!dir.down, left: !!dir.left, right: !!dir.right }),
      lx: toByte(lx),
      ly: toByte(ly),
      rx: toByte(rx),
      ry: toByte(ry),
    };
  }

  private update(force = false): void {
    if (!this.open) return;
    const s = this.current();
    this.showPressed(s);
    if (force || !same(s, this.sent)) void this.push(s);
    if (!isNeutral(s) && !this.heartbeat) this.heartbeat = window.setInterval(() => void this.push(this.sent, true), 300);
    if (isNeutral(s) && this.heartbeat) {
      clearInterval(this.heartbeat);
      this.heartbeat = 0;
    }
  }

  private async push(s: PadState, repeat = false): Promise<void> {
    this.sent = s;
    if (this.inflight) return;
    this.inflight = true;
    try {
      let last: PadState | null = null;
      do {
        last = this.sent;
        this.onStatus(await this.send(last));
      } while (!repeat && !same(last, this.sent));
    } finally {
      this.inflight = false;
    }
  }

  private pollGamepad = () => {
    if (!this.open) return;
    this.update();
    this.frame = requestAnimationFrame(this.pollGamepad);
  };

  private showPressed(s: PadState): void {
    this.root.querySelectorAll<HTMLElement>('[data-b]').forEach((el) => el.classList.toggle('on', (s.buttons & Number(el.dataset.b)) !== 0));
    const dirs = { up: [7, 0, 1], right: [1, 2, 3], down: [3, 4, 5], left: [5, 6, 7] } as const;
    this.root.querySelectorAll<HTMLElement>('[data-hat]').forEach((el) => {
      el.classList.toggle('on', (dirs[el.dataset.hat as keyof typeof dirs] as readonly number[]).includes(s.hat));
    });
    for (const side of ['left', 'right'] as const) {
      const knob = this.root.querySelector<HTMLElement>(`[data-stick="${side}"] .vstick-knob`);
      const [x, y] = side === 'left' ? [s.lx, s.ly] : [s.rx, s.ry];
      if (knob) knob.style.transform = `translate(${((x - 128) / 128) * 30}px, ${((y - 128) / 128) * 30}px)`;
    }
  }

  private bindScreen(): void {
    const release = (e: PointerEvent) => {
      this.screenButtons.delete(e.pointerId);
      this.screenHat.delete(e.pointerId);
      this.update();
    };
    this.root.querySelectorAll<HTMLElement>('[data-b], [data-hat]').forEach((el) => {
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        capture(el, e.pointerId);
        if (el.dataset.b) this.screenButtons.set(e.pointerId, Number(el.dataset.b));
        else this.screenHat.set(e.pointerId, el.dataset.hat!);
        this.update();
      });
      el.addEventListener('pointerup', release);
      el.addEventListener('pointercancel', release);
      el.addEventListener('lostpointercapture', release);
    });
    this.root.querySelectorAll<HTMLElement>('[data-stick]').forEach((area) => {
      const side = area.dataset.stick as 'left' | 'right';
      const move = (e: PointerEvent) => {
        const r = area.getBoundingClientRect();
        const radius = r.width / 2;
        let x = (e.clientX - r.left - radius) / radius;
        let y = (e.clientY - r.top - radius) / radius;
        const len = Math.hypot(x, y);
        if (len > 1) [x, y] = [x / len, y / len];
        this.sticks[side] = [x, y];
        this.update();
      };
      const end = () => {
        this.sticks[side] = [0, 0];
        this.update();
      };
      area.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        capture(area, e.pointerId);
        move(e);
      });
      area.addEventListener('pointermove', (e) => {
        if (area.hasPointerCapture(e.pointerId)) move(e);
      });
      area.addEventListener('pointerup', end);
      area.addEventListener('pointercancel', end);
    });
  }

  private onKey(e: KeyboardEvent, down: boolean): void {
    if (!this.open) return;
    if (e.code === 'Escape') return;
    const known = e.code in KEY_BUTTONS || e.code in KEY_STICK || e.code in KEY_HAT;
    if (!known) return;
    e.preventDefault();
    e.stopPropagation();
    if (down) this.keys.add(e.code);
    else this.keys.delete(e.code);
    this.update();
  }
}

export async function keyboardLegend(): Promise<string> {
  let map: Map<string, string> | null = null;
  try {
    map = (await (navigator as Navigator & { keyboard?: { getLayoutMap(): Promise<Map<string, string>> } }).keyboard?.getLayoutMap()) ?? null;
  } catch {
    map = null;
  }
  const k = (code: string) => (map?.get(code) ?? code.replace('Key', '')).toUpperCase();
  return t('pad.keys', {
    w: k('KeyW'), a: k('KeyA'), s: k('KeyS'), d: k('KeyD'),
    kA: k('KeyL'), kB: k('KeyK'), kX: k('KeyI'), kY: k('KeyJ'),
    kL: k('KeyQ'), kZL: k('KeyE'), kR: k('KeyU'), kZR: k('KeyO'),
    kH: k('KeyH'), kC: k('KeyC'),
  });
}
