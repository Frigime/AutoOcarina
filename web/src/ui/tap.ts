import { t } from '../i18n';
import { comboLabel, bestCombo, noteName, type Layout } from '../core/ocarina';
import type { Note } from '../core/types';

export function openTapMode(
  notes: Note[],
  audio: AudioBuffer | null,
  layout: Layout,
  onDone: (notes: Note[]) => void,
): void {
  if (notes.length === 0) return;
  const overlay = document.createElement('div');
  overlay.className = 'tap-overlay';
  overlay.innerHTML = `
    <div class="tap-box" role="dialog" aria-modal="true" aria-label="${t('tapMode.title')}">
      <h2>${t('tapMode.title')}</h2>
      <p class="muted">${
        audio
          ? t('tapMode.withAudio')
          : t('tapMode.noAudio')
      }</p>
      <div class="tap-pad" tabindex="0">
        <div class="tap-next"></div>
        <div class="tap-count muted"></div>
      </div>
      <div class="row">
        <button class="btn" data-act="restart">${t('tapMode.restart')}</button>
        <button class="btn" data-act="cancel">${t('tapMode.cancel')}</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const pad = overlay.querySelector<HTMLElement>('.tap-pad')!;
  const next = overlay.querySelector<HTMLElement>('.tap-next')!;
  const count = overlay.querySelector<HTMLElement>('.tap-count')!;
  const sorted = [...notes].sort((a, b) => a.start - b.start);

  let ctx: AudioContext | null = null;
  let t0 = 0;
  let taps: number[] = [];

  const show = () => {
    const n = sorted[taps.length];
    if (!n) return;
    const combo = n.combo ?? bestCombo(n.pitch);
    next.textContent = combo ? comboLabel(combo, layout) : noteName(n.pitch);
    count.textContent = t('tapMode.count', { n: taps.length + 1, total: sorted.length });
  };

  const start = () => {
    void ctx?.close();
    ctx = new AudioContext();
    taps = [];
    t0 = ctx.currentTime + 0.3;
    if (audio) {
      const src = ctx.createBufferSource();
      src.buffer = audio;
      src.connect(ctx.destination);
      src.start(t0);
    }
    show();
    pad.focus();
  };

  const close = () => {
    void ctx?.close();
    overlay.remove();
    window.removeEventListener('keydown', onKey, true);
  };

  const tap = () => {
    if (!ctx || taps.length >= sorted.length) return;
    taps.push(Math.max(0, ctx.currentTime - t0));
    pad.classList.remove('flash');
    void pad.offsetWidth;
    pad.classList.add('flash');
    if (taps.length === sorted.length) {
      const result = sorted.map((n, i) => {
        const nextStart = taps[i + 1];
        const dur = nextStart !== undefined ? Math.max(0.08, (nextStart - taps[i]) * 0.92) : Math.max(0.3, n.dur);
        return { ...n, start: taps[i], dur };
      });
      close();
      onDone(result);
    } else show();
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
    else if (e.code === 'Space' || e.key === 'Enter') {
      e.preventDefault();
      if (!e.repeat) tap();
    }
  };
  window.addEventListener('keydown', onKey, true);
  pad.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    tap();
  });
  overlay.querySelector('[data-act="restart"]')!.addEventListener('click', start);
  overlay.querySelector('[data-act="cancel"]')!.addEventListener('click', close);
  start();
}
