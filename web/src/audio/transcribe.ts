import type { Note } from '../core/types';
import { resampleMono } from './decode';

const MODEL_URL = `${import.meta.env.BASE_URL}models/basic-pitch/model.json`;

export interface ModelOutput {
  frames: number[][];
  onsets: number[][];
  contours: number[][];
}

export interface NoteParams {
  onsetThreshold: number;
  frameThreshold: number;
  minNoteFrames: number;
}

export const DEFAULT_NOTE_PARAMS: NoteParams = { onsetThreshold: 0.3, frameThreshold: 0.2, minNoteFrames: 4 };

let modelPromise: Promise<import('@spotify/basic-pitch').BasicPitch> | null = null;

function getModel() {
  modelPromise ??= import('@spotify/basic-pitch').then(({ BasicPitch }) => new BasicPitch(MODEL_URL));
  return modelPromise;
}

const SAMPLE_RATE = 22050;
const WINDOW_SAMPLES = SAMPLE_RATE * 2 - 256;
const WINDOW_HOP = WINDOW_SAMPLES - 30 * 256;
const WINDOW_FRAMES = 172 - 30;
const WINDOWS_PER_CHUNK = 8;

export async function runModel(buffer: AudioBuffer, onProgress: (p: number) => void): Promise<ModelOutput> {
  const audio = await resampleMono(buffer, SAMPLE_RATE);
  const model = await getModel();
  const out: ModelOutput = { frames: [], onsets: [], contours: [] };
  const totalWindows = Math.ceil(audio.length / WINDOW_HOP);

  for (let w = 0; w < totalWindows; w += WINDOWS_PER_CHUNK) {
    const margin = w > 0 ? 1 : 0;
    const from = (w - margin) * WINDOW_HOP;
    const to = Math.min(audio.length, (w + WINDOWS_PER_CHUNK + 1) * WINDOW_HOP + WINDOW_SAMPLES);
    const chunk: ModelOutput = { frames: [], onsets: [], contours: [] };
    await model.evaluateModel(
      audio.subarray(from, to),
      (f, o, c) => {
        chunk.frames.push(...f);
        chunk.onsets.push(...o);
        chunk.contours.push(...c);
      },
      (p) => onProgress(Math.min(1, (w + p * WINDOWS_PER_CHUNK) / totalWindows)),
    );
    const keepFrom = margin * WINDOW_FRAMES;
    const keepTo = keepFrom + WINDOWS_PER_CHUNK * WINDOW_FRAMES;
    out.frames.push(...chunk.frames.slice(keepFrom, keepTo));
    out.onsets.push(...chunk.onsets.slice(keepFrom, keepTo));
    out.contours.push(...chunk.contours.slice(keepFrom, keepTo));
  }

  const expected = Math.floor((audio.length * Math.floor(SAMPLE_RATE / 256)) / SAMPLE_RATE);
  out.frames.length = Math.min(out.frames.length, expected);
  out.onsets.length = Math.min(out.onsets.length, expected);
  out.contours.length = Math.min(out.contours.length, expected);
  onProgress(1);
  return out;
}

export async function runModelSingle(buffer: AudioBuffer): Promise<ModelOutput> {
  const audio = await resampleMono(buffer, SAMPLE_RATE);
  const model = await getModel();
  const out: ModelOutput = { frames: [], onsets: [], contours: [] };
  await model.evaluateModel(
    audio,
    (f, o, c) => {
      out.frames.push(...f);
      out.onsets.push(...o);
      out.contours.push(...c);
    },
    () => {},
  );
  return out;
}

export async function modelToNotes(out: ModelOutput, params: NoteParams = DEFAULT_NOTE_PARAMS): Promise<Note[]> {
  const { outputToNotesPoly, addPitchBendsToNoteEvents, noteFramesToTime } = await import('@spotify/basic-pitch');
  const events = noteFramesToTime(
    addPitchBendsToNoteEvents(
      out.contours,
      outputToNotesPoly(
        out.frames,
        out.onsets,
        params.onsetThreshold,
        params.frameThreshold,
        params.minNoteFrames,
        true,
        2100,
        60,
        true,
      ),
    ),
  );
  return events.map((e) => ({
    start: e.startTimeSeconds,
    dur: e.durationSeconds,
    pitch: e.pitchMidi,
    vel: e.amplitude,
  }));
}

export async function transcribe(buffer: AudioBuffer, onProgress: (p: number) => void): Promise<Note[]> {
  return modelToNotes(await runModel(buffer, onProgress));
}
