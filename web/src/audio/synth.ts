import type { Note } from '../core/types';

export interface Playback {
  stop(): void;
  position(): number;
  done: Promise<void>;
}

const midiToHz = (p: number) => 440 * Math.pow(2, (p - 69) / 12);

export function playNotes(
  notes: Note[],
  opts: { from?: number; original?: AudioBuffer | null; originalVolume?: number; synthVolume?: number } = {},
): Playback {
  const ctx = new AudioContext();
  const from = opts.from ?? 0;
  const t0 = ctx.currentTime + 0.1;
  const master = ctx.createGain();
  master.gain.value = opts.synthVolume ?? 0.5;
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 2600;
  master.connect(tone).connect(ctx.destination);

  const vibrato = ctx.createOscillator();
  vibrato.frequency.value = 5.2;
  const vibratoDepth = ctx.createGain();
  vibratoDepth.gain.value = 3;
  vibrato.connect(vibratoDepth);
  vibrato.start(t0);

  let end = 0;
  for (const n of notes) {
    if (n.start + n.dur < from) continue;
    const start = t0 + Math.max(0, n.start - from);
    const dur = n.start < from ? n.dur - (from - n.start) : n.dur;
    const stop = start + Math.max(0.06, dur);
    end = Math.max(end, stop);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = midiToHz(n.pitch);
    vibratoDepth.connect(osc.detune);
    const harmonic = ctx.createOscillator();
    harmonic.type = 'triangle';
    harmonic.frequency.value = midiToHz(n.pitch) * 2;
    const hGain = ctx.createGain();
    hGain.gain.value = 0.08;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, start);
    env.gain.linearRampToValueAtTime(0.8, start + 0.03);
    env.gain.setTargetAtTime(0.6, start + 0.03, 0.1);
    env.gain.setTargetAtTime(0, stop, 0.04);

    osc.connect(env);
    harmonic.connect(hGain).connect(env);
    env.connect(master);
    osc.start(start);
    harmonic.start(start);
    osc.stop(stop + 0.3);
    harmonic.stop(stop + 0.3);
  }

  let original: AudioBufferSourceNode | null = null;
  if (opts.original) {
    original = ctx.createBufferSource();
    original.buffer = opts.original;
    const g = ctx.createGain();
    g.gain.value = opts.originalVolume ?? 0.6;
    original.connect(g).connect(ctx.destination);
    original.start(t0, from);
    end = Math.max(end, t0 + opts.original.duration - from);
  }

  let resolveDone!: () => void;
  const done = new Promise<void>((r) => (resolveDone = r));
  let stopped = false;
  const stopAll = () => {
    if (stopped) return;
    stopped = true;
    void ctx.close();
    resolveDone();
  };
  const timer = window.setTimeout(stopAll, (end - ctx.currentTime + 0.5) * 1000);

  return {
    stop() {
      window.clearTimeout(timer);
      stopAll();
    },
    position: () => (stopped ? from : from + Math.max(0, ctx.currentTime - t0)),
    done,
  };
}
