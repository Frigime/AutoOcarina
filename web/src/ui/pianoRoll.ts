import { t } from '../i18n';
import type { Candidate } from '../core/assist';
import { compileSong } from '../core/compile';
import {
  BASE_COLORS,
  BASE_PITCHES,
  bestCombo,
  comboLabel,
  MAX_PITCH,
  MIN_PITCH,
  noteName,
  type Combo,
  type Layout,
} from '../core/ocarina';
import type { Note, Settings } from '../core/types';

const TOP = MAX_PITCH + 2;
const BOTTOM = MIN_PITCH - 2;
const LANES = TOP - BOTTOM + 1;
const LANE_H = 20;
const RULER_H = 22;
const GUTTER = 92;
const EDGE = 7;

export interface AssistView {
  candidates: Candidate[];
  pinned: Set<number>;
}

export type AssistAction =
  | { kind: 'pin'; src: number; pitch: number }
  | { kind: 'ban'; src: number; dur: number }
  | { kind: 'unban'; srcs: number[] }
  | { kind: 'stroke'; srcs: number[]; from: number; to: number };

type AssistHit = { type: 'note'; index: number } | { type: 'cand'; index: number };
type Touched = { src: number; start: number; dur: number; pitch: number };

type Drag =
  | { kind: 'move'; index: number; dx: number; startPitch: number; startY: number; moved: boolean }
  | { kind: 'resize'; index: number }
  | { kind: 'pan'; x: number; scroll: number }
  | { kind: 'select'; t0: number; t1: number }
  | {
      kind: 'stroke';
      touched: Map<string, Touched>;
      first: AssistHit;
      tMin: number;
      tMax: number;
      startX: number;
      startY: number;
      lastX: number;
      lastY: number;
      moved: boolean;
    };

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export class PianoRoll {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private notes: Note[] = [];
  private combos: (Combo | null)[] = [];
  private layout: Layout = 'normal';
  private peaks: Float32Array | null = null;
  private pxPerSec = 120;
  private scroll = 0;
  private selected = -1;
  private drag: Drag | null = null;
  private playhead: number | null = null;
  private width = 0;

  private assist: AssistView | null = null;
  private selection: { from: number; to: number } | null = null;
  private selectable = false;

  onChange: (notes: Note[]) => void = () => {};
  onAssist: (action: AssistAction) => void = () => {};
  onSelect: (sel: { from: number; to: number } | null) => void = () => {};

  constructor(private host: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.tabIndex = 0;
    this.canvas.className = 'roll-canvas';
    this.canvas.setAttribute('aria-label', t('roll.aria'));
    host.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;

    new ResizeObserver(() => this.resize()).observe(host);
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => this.draw());
    this.canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    this.canvas.addEventListener('pointermove', (e) => this.onMove(e));
    this.canvas.addEventListener('pointerup', () => this.onUp());
    this.canvas.addEventListener('pointercancel', () => this.onUp());
    this.canvas.addEventListener('dblclick', (e) => this.onDouble(e));
    this.canvas.addEventListener('keydown', (e) => this.onKey(e));
    this.canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    this.resize();
  }

  setNotes(notes: Note[], settings: Settings): void {
    this.notes = notes.map((n) => ({ ...n })).sort((a, b) => a.start - b.start);
    this.layout = settings.layout;
    const compiled = compileSong(this.notes, settings);
    let k = 0;
    this.combos = this.notes.map((n) => (bestCombo(n.pitch) || n.combo ? compiled.combos[k++] ?? null : null));
    if (this.selected >= this.notes.length) this.selected = -1;
    this.draw();
  }

  setAudio(buffer: AudioBuffer | null): void {
    if (!buffer) {
      this.peaks = null;
      this.draw();
      return;
    }
    const data = buffer.getChannelData(0);
    const n = Math.ceil(buffer.duration * 100);
    const step = Math.max(1, Math.floor(data.length / n));
    const peaks = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let m = 0;
      for (let j = i * step; j < Math.min(data.length, (i + 1) * step); j += 4) m = Math.max(m, Math.abs(data[j]));
      peaks[i] = m;
    }
    this.peaks = peaks;
    this.draw();
  }

  setSelectable(on: boolean): void {
    this.selectable = on;
    if (!on && this.selection) this.setSelection(null);
  }

  setSelection(sel: { from: number; to: number } | null): void {
    this.selection = sel;
    this.draw();
  }

  setAssist(view: AssistView | null): void {
    this.assist = view;
    if (view) this.selected = -1;
    this.drag = null;
    this.draw();
  }

  setPlayhead(t: number | null): void {
    this.playhead = t;
    if (t !== null) {
      const visible = (this.width - GUTTER) / this.pxPerSec;
      if (t < this.scroll || t > this.scroll + visible * 0.85) this.scroll = Math.max(0, t - visible * 0.15);
    }
    this.draw();
  }

  zoom(factor: number): void {
    this.pxPerSec = Math.min(800, Math.max(15, this.pxPerSec * factor));
    this.draw();
  }

  get selectedStart(): number {
    return this.selected >= 0 ? this.notes[this.selected].start : 0;
  }

  private x(t: number) {
    return GUTTER + (t - this.scroll) * this.pxPerSec;
  }
  private t(x: number) {
    return (x - GUTTER) / this.pxPerSec + this.scroll;
  }
  private y(pitch: number) {
    return RULER_H + (TOP - pitch) * LANE_H;
  }
  private pitchAt(y: number) {
    return Math.max(BOTTOM, Math.min(TOP, TOP - Math.floor((y - RULER_H) / LANE_H)));
  }

  private resize() {
    const dpr = window.devicePixelRatio || 1;
    this.width = this.host.clientWidth;
    const height = RULER_H + LANES * LANE_H;
    this.canvas.width = this.width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.draw();
  }

  draw(): void {
    const c = this.ctx;
    const W = this.width;
    const H = RULER_H + LANES * LANE_H;
    const bg = cssVar('--roll-bg');
    const lane = cssVar('--roll-lane');
    const grid = cssVar('--roll-grid');
    const text = cssVar('--text-muted');
    const out = cssVar('--roll-out');
    c.clearRect(0, 0, W, H);
    c.fillStyle = bg;
    c.fillRect(0, 0, W, H);

    for (let p = BOTTOM; p <= TOP; p++) {
      const y = this.y(p);
      const natural = BASE_PITCHES.indexOf(p as (typeof BASE_PITCHES)[number]);
      if (p < MIN_PITCH || p > MAX_PITCH) c.fillStyle = out;
      else if (natural >= 0) c.fillStyle = BASE_COLORS[natural] + '22';
      else c.fillStyle = [1, 3, 6, 8, 10].includes(p % 12) ? lane : bg;
      c.fillRect(GUTTER, y, W - GUTTER, LANE_H);
      c.fillStyle = grid;
      c.fillRect(GUTTER, y + LANE_H - 1, W - GUTTER, 1);
    }

    if (this.peaks) {
      c.fillStyle = cssVar('--roll-wave');
      const mid = RULER_H + (LANES * LANE_H) / 2;
      const amp = (LANES * LANE_H) / 2.2;
      for (let px = GUTTER; px < W; px++) {
        const i = Math.floor(this.t(px) * 100);
        if (i < 0 || i >= this.peaks.length) continue;
        const h = this.peaks[i] * amp;
        c.fillRect(px, mid - h, 1, h * 2);
      }
    }

    c.fillStyle = cssVar('--surface');
    c.fillRect(0, 0, W, RULER_H);
    c.font = '11px system-ui, sans-serif';
    c.textBaseline = 'middle';
    const stepSec = this.pxPerSec > 200 ? 0.5 : this.pxPerSec > 60 ? 1 : this.pxPerSec > 25 ? 5 : 10;
    for (let s = Math.floor(this.scroll / stepSec) * stepSec; this.x(s) < W; s += stepSec) {
      const x = this.x(s);
      if (x < GUTTER) continue;
      c.fillStyle = grid;
      c.fillRect(x, RULER_H, 1, H - RULER_H);
      c.fillStyle = cssVar('--text');
      c.globalAlpha = 0.8;
      c.fillRect(x, RULER_H - 5, 1, 5);
      const m = Math.floor(s / 60);
      c.fillText(`${m}:${(s % 60).toFixed(stepSec < 1 ? 1 : 0).padStart(stepSec < 1 ? 4 : 2, '0')}`, x + 3, RULER_H / 2);
      c.globalAlpha = 1;
    }
    c.fillStyle = grid;
    c.fillRect(GUTTER, RULER_H - 1, W - GUTTER, 1);

    const gold = cssVar('--gold');
    if (this.assist) {
      const muted = cssVar('--text-muted');
      const danger = cssVar('--danger');
      for (const cand of this.assist.candidates) {
        const x = this.x(cand.start);
        const w = Math.max(3, cand.dur * this.pxPerSec);
        if (x + w < GUTTER || x > W) continue;
        c.beginPath();
        c.roundRect(x, this.y(cand.pitch) + 4, w, LANE_H - 8, 3);
        if (cand.state === 'banned') {
          c.globalAlpha = 0.45;
          c.strokeStyle = danger;
          c.lineWidth = 1;
          c.stroke();
        } else {
          c.globalAlpha = 0.15 + 0.55 * Math.min(1, cand.strength);
          c.fillStyle = muted;
          c.fill();
          if (cand.state === 'pinned') {
            c.globalAlpha = 1;
            c.strokeStyle = gold;
            c.lineWidth = 2;
            c.stroke();
          }
        }
        c.globalAlpha = 1;
      }
    }

    c.textBaseline = 'middle';
    this.notes.forEach((n, i) => {
      const x = this.x(n.start);
      const w = Math.max(4, n.dur * this.pxPerSec);
      if (x + w < GUTTER || x > W) return;
      const y = this.y(n.pitch) + 2;
      const combo = this.combos[i];
      const playable = combo !== null;
      c.fillStyle = playable ? BASE_COLORS[combo.base] : '#777';
      c.globalAlpha = playable ? 1 : 0.5;
      c.beginPath();
      c.roundRect(x, y, w, LANE_H - 4, 4);
      c.fill();
      c.globalAlpha = 1;
      if (i === this.selected) {
        c.strokeStyle = cssVar('--text');
        c.lineWidth = 2;
        c.stroke();
      }
      if (this.assist && n.src !== undefined && this.assist.pinned.has(n.src)) {
        c.strokeStyle = gold;
        c.lineWidth = 2;
        c.stroke();
      }
      if (w > 28) {
        c.fillStyle = '#0b0f14';
        c.font = '600 11px system-ui, sans-serif';
        const label = playable ? comboLabel(combo, this.layout).replace(t('combo.dpad'), '✚').replace(t('combo.stick'), '◎') : '×';
        c.save();
        c.beginPath();
        c.rect(x, y, w, LANE_H - 4);
        c.clip();
        c.fillText(label, x + 4, y + (LANE_H - 4) / 2 + 0.5);
        c.restore();
      }
    });

    const sel =
      this.drag?.kind === 'select'
        ? { from: Math.min(this.drag.t0, this.drag.t1), to: Math.max(this.drag.t0, this.drag.t1) }
        : this.selection;
    if (sel) {
      const accent = cssVar('--accent');
      const x0 = Math.max(GUTTER, this.x(sel.from));
      const x1 = this.x(sel.to);
      if (x1 > GUTTER) {
        c.globalAlpha = 0.14;
        c.fillStyle = accent;
        c.fillRect(x0, RULER_H, Math.max(0, x1 - x0), H - RULER_H);
        c.globalAlpha = 1;
        c.fillStyle = accent;
        if (this.x(sel.from) >= GUTTER) c.fillRect(this.x(sel.from), RULER_H, 2, H - RULER_H);
        c.fillRect(x1 - 2, RULER_H, 2, H - RULER_H);
      }
    }

    if (this.drag?.kind === 'stroke' && this.drag.moved) {
      const accent = cssVar('--accent');
      const x0 = Math.max(GUTTER, this.x(this.drag.tMin));
      c.globalAlpha = 0.12;
      c.fillStyle = accent;
      c.fillRect(x0, RULER_H, Math.max(0, this.x(this.drag.tMax) - x0), H - RULER_H);
      c.globalAlpha = 1;
      c.strokeStyle = accent;
      c.lineWidth = 2;
      for (const it of this.drag.touched.values()) {
        c.beginPath();
        c.roundRect(this.x(it.start), this.y(it.pitch) + 2, Math.max(4, it.dur * this.pxPerSec), LANE_H - 4, 4);
        c.stroke();
      }
    }

    if (this.playhead !== null) {
      const x = this.x(this.playhead);
      const accent = cssVar('--accent');
      c.save();
      c.shadowColor = accent;
      c.shadowBlur = 8;
      c.fillStyle = accent;
      c.fillRect(x - 1, RULER_H, 3, H - RULER_H);
      c.restore();
      c.fillStyle = accent;
      c.beginPath();
      c.moveTo(x - 6, 2);
      c.lineTo(x + 7, 2);
      c.lineTo(x + 0.5, RULER_H - 2);
      c.closePath();
      c.fill();
    }

    c.fillStyle = cssVar('--surface');
    c.fillRect(0, 0, GUTTER, H);
    c.font = '11px system-ui, sans-serif';
    for (let p = BOTTOM; p <= TOP; p++) {
      const y = this.y(p) + LANE_H / 2;
      const combo = bestCombo(p);
      c.fillStyle = combo ? (combo.offset === 0 ? BASE_COLORS[combo.base] : text) : out;
      c.fillText(noteName(p), 6, y);
      if (combo) {
        c.fillStyle = text;
        c.fillText(comboLabel(combo, this.layout).replace(t('combo.dpad'), '✚').replace(t('combo.stick'), '◎'), 44, y);
      }
    }
  }

  private hit(e: PointerEvent | MouseEvent): { index: number; edge: boolean } {
    const r = this.canvas.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    for (let i = this.notes.length - 1; i >= 0; i--) {
      const n = this.notes[i];
      const x = this.x(n.start);
      const w = Math.max(4, n.dur * this.pxPerSec);
      const y = this.y(n.pitch);
      if (px >= x && px <= x + w && py >= y && py <= y + LANE_H) return { index: i, edge: px > x + w - EDGE };
    }
    return { index: -1, edge: false };
  }

  private assistAt(px: number, py: number): AssistHit | null {
    if (!this.assist || py < RULER_H || px < GUTTER) return null;
    const time = this.t(px);
    const pitch = this.pitchAt(py);
    const pad = 3 / this.pxPerSec;
    const min = 4 / this.pxPerSec;
    const over = (start: number, dur: number) => time >= start - pad && time <= start + Math.max(dur, min) + pad;
    for (let i = this.notes.length - 1; i >= 0; i--) {
      const n = this.notes[i];
      if (n.pitch === pitch && over(n.start, n.dur)) return { type: 'note', index: i };
    }
    let best = -1;
    const cands = this.assist.candidates;
    for (let i = 0; i < cands.length; i++) {
      if (cands[i].pitch === pitch && over(cands[i].start, cands[i].dur) && (best < 0 || cands[i].strength > cands[best].strength)) best = i;
    }
    return best >= 0 ? { type: 'cand', index: best } : null;
  }

  private backgroundDrag(e: PointerEvent, px: number, py: number): Drag {
    if (this.selectable && py >= RULER_H) {
      const t0 = this.t(px);
      return { kind: 'select', t0, t1: t0 };
    }
    return { kind: 'pan', x: e.clientX, scroll: this.scroll };
  }

  private capture(e: PointerEvent) {
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
    }
  }

  private touchedOf(hit: AssistHit): Touched | null {
    if (hit.type === 'note') {
      const n = this.notes[hit.index];
      return n.src === undefined ? null : { src: n.src, start: n.start, dur: n.dur, pitch: n.pitch };
    }
    const cand = this.assist!.candidates[hit.index];
    return { src: cand.srcs[0], start: cand.start, dur: cand.dur, pitch: cand.pitch };
  }

  private onDown(e: PointerEvent) {
    this.canvas.focus();
    const r = this.canvas.getBoundingClientRect();
    const px = e.clientX - r.left;
    if (px < GUTTER) return;
    if (this.assist) {
      const py = e.clientY - r.top;
      const hit = this.assistAt(px, py);
      this.capture(e);
      if (!hit) {
        this.drag = this.backgroundDrag(e, px, py);
        this.draw();
        return;
      }
      const time = this.t(px);
      const touched = new Map<string, Touched>();
      const first = this.touchedOf(hit);
      if (first) touched.set(`${hit.type}:${hit.index}`, first);
      this.drag = { kind: 'stroke', touched, first: hit, tMin: time, tMax: time, startX: px, startY: py, lastX: px, lastY: py, moved: false };
      this.draw();
      return;
    }
    const { index, edge } = this.hit(e);
    this.capture(e);
    this.selected = index;
    if (index < 0) {
      this.drag = this.backgroundDrag(e, px, e.clientY - r.top);
    } else if (edge) {
      this.drag = { kind: 'resize', index };
    } else {
      const n = this.notes[index];
      this.drag = { kind: 'move', index, dx: this.t(px) - n.start, startPitch: n.pitch, startY: e.clientY, moved: false };
    }
    this.draw();
  }

  private onMove(e: PointerEvent) {
    const r = this.canvas.getBoundingClientRect();
    if (!this.drag) {
      if (this.assist) {
        this.canvas.style.cursor = this.assistAt(e.clientX - r.left, e.clientY - r.top) ? 'pointer' : 'default';
        return;
      }
      const { index, edge } = this.hit(e);
      this.canvas.style.cursor = index >= 0 ? (edge ? 'ew-resize' : 'grab') : 'default';
      return;
    }
    if (this.drag.kind === 'stroke') {
      const d = this.drag;
      const px = e.clientX - r.left;
      const py = e.clientY - r.top;
      if (Math.hypot(px - d.startX, py - d.startY) > 5) d.moved = true;
      const along = Math.abs(py - d.lastY) < LANE_H / 2;
      const steps = along ? Math.max(1, Math.ceil(Math.abs(px - d.lastX) / 4)) : 1;
      for (let s = 1; s <= steps; s++) {
        const hit = this.assistAt(d.lastX + ((px - d.lastX) * s) / steps, d.lastY + ((py - d.lastY) * s) / steps);
        const item = hit && this.touchedOf(hit);
        if (hit && item) d.touched.set(`${hit.type}:${hit.index}`, item);
      }
      d.lastX = px;
      d.lastY = py;
      d.tMin = Math.min(d.tMin, this.t(px));
      d.tMax = Math.max(d.tMax, this.t(px));
      this.draw();
      return;
    }
    const t = this.t(e.clientX - r.left);
    if (this.drag.kind === 'select') {
      this.drag.t1 = Math.max(0, t);
      this.draw();
      return;
    }
    if (this.drag.kind === 'pan') {
      this.scroll = Math.max(0, this.drag.scroll - (e.clientX - this.drag.x) / this.pxPerSec);
    } else if (this.drag.kind === 'resize') {
      const n = this.notes[this.drag.index];
      n.dur = Math.max(0.05, Math.round((t - n.start) * 100) / 100);
    } else {
      const n = this.notes[this.drag.index];
      n.start = Math.max(0, Math.round((t - this.drag.dx) * 100) / 100);
      const pitch = this.pitchAt(e.clientY - r.top);
      if (pitch !== n.pitch) {
        n.pitch = pitch;
        n.combo = undefined;
      }
      this.drag.moved = true;
    }
    this.draw();
  }

  private onUp() {
    const d = this.drag;
    this.drag = null;
    if (d?.kind === 'select') {
      const from = Math.max(0, Math.min(d.t0, d.t1));
      const to = Math.max(d.t0, d.t1);
      this.selection = (to - from) * this.pxPerSec > 6 ? { from, to } : null;
      this.draw();
      this.onSelect(this.selection);
      return;
    }
    if (d?.kind === 'stroke') {
      this.draw();
      if (!this.assist) return;
      if (d.moved) {
        const items = [...d.touched.values()];
        if (items.length === 0) return;
        const from = Math.min(d.tMin, ...items.map((it) => it.start));
        this.onAssist({ kind: 'stroke', srcs: items.map((it) => it.src), from, to: d.tMax });
      } else if (d.first.type === 'note') {
        const n = this.notes[d.first.index];
        if (n.src === undefined) return;
        this.onAssist(this.assist.pinned.has(n.src) ? { kind: 'pin', src: n.src, pitch: n.pitch } : { kind: 'ban', src: n.src, dur: n.dur });
      } else {
        const cand = this.assist.candidates[d.first.index];
        this.onAssist(cand.state === 'banned' ? { kind: 'unban', srcs: cand.srcs } : { kind: 'pin', src: cand.srcs[0], pitch: cand.pitch });
      }
      return;
    }
    if (d && d.kind !== 'pan') this.commit();
  }

  private onDouble(e: MouseEvent) {
    if (this.assist || this.hit(e).index >= 0) return;
    const r = this.canvas.getBoundingClientRect();
    const px = e.clientX - r.left;
    if (px < GUTTER) return;
    const note: Note = {
      start: Math.max(0, Math.round(this.t(px) * 100) / 100),
      dur: 0.3,
      pitch: this.pitchAt(e.clientY - r.top),
    };
    this.notes.push(note);
    this.notes.sort((a, b) => a.start - b.start);
    this.selected = this.notes.indexOf(note);
    this.commit();
  }

  private onKey(e: KeyboardEvent) {
    if (this.assist || this.selected < 0) return;
    const n = this.notes[this.selected];
    if (e.key === 'Delete' || e.key === 'Backspace') {
      this.notes.splice(this.selected, 1);
      this.selected = -1;
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      n.pitch += e.key === 'ArrowUp' ? 1 : -1;
      n.combo = undefined;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      n.start = Math.max(0, Math.round((n.start + (e.key === 'ArrowRight' ? 0.02 : -0.02)) * 100) / 100);
    } else return;
    e.preventDefault();
    this.commit();
  }

  private onWheel(e: WheelEvent) {
    e.preventDefault();
    if (e.ctrlKey) this.zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15);
    else this.scroll = Math.max(0, this.scroll + (e.deltaX || e.deltaY) / this.pxPerSec);
    this.draw();
  }

  private commit() {
    const selectedNote = this.notes[this.selected];
    this.notes.sort((a, b) => a.start - b.start);
    this.selected = selectedNote ? this.notes.indexOf(selectedNote) : -1;
    this.onChange(this.notes.map((n) => ({ ...n })));
  }
}
