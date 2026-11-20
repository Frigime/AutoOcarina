import { t } from './i18n';
import { alignTabToAudio } from './core/align';
import { buildAssistData, emptyChoices, solveAssisted, type AssistData } from './core/assist';
import { trackBeats } from './core/beats';
import { joinFragments } from './core/fragments';
import { extractMelody, makePlayable } from './core/simplify';
import { parseTab, type TabError } from './core/tab';
import type { AnalysisReport, Note, Settings } from './core/types';
import { decodeAudioFile } from './audio/decode';
import { extractMidiMelody, readMidi, type MidiTrack } from './audio/midi';
import { energy, separateStems } from './audio/separate';
import { modelToNotes, runModel } from './audio/transcribe';

export type Step = (label: string, progress?: number) => void;

export interface AnalysisInput {
  file: File | null;
  tab: string;
  separate: boolean;
  stem: 'auto' | 'vocals' | 'other';
  midiTrack: number | null;
}

export interface AnalysisOutput {
  notes: Note[];
  report: AnalysisReport;
  audio: AudioBuffer | null;
  midiTracks?: MidiTrack[];
  midiAutoTracks?: number[];
  tabErrors: TabError[];
  stemUsed?: 'vocals' | 'other' | 'mix';
  assist?: AssistData;
}

const isMidi = (f: File) => /\.midi?$/i.test(f.name) || f.type.includes('midi');

export async function analyze(input: AnalysisInput, settings: Settings, step: Step): Promise<AnalysisOutput> {
  const minNoteSec = settings.minNoteMs / 1000;
  const tab = input.tab.trim() ? parseTab(input.tab, settings.layout) : null;
  const tabErrors = tab?.errors ?? [];
  const tabNotes = tab?.items.filter((i) => i.kind === 'note') ?? [];

  if (!input.file && !tab) throw new Error(t('err.nothing'));
  if (tab && tabNotes.length === 0 && !input.file) throw new Error(t('err.tabEmpty'));

  if (!input.file && tab) {
    const beat = 60 / settings.tabBpm;
    let t = 0;
    const notes: Note[] = [];
    for (const item of tab.items) {
      if (item.kind === 'note') notes.push({ start: t, dur: item.beats * beat * 0.9, pitch: item.pitch, combo: item.combo });
      t += item.beats * beat;
    }
    return {
      notes,
      audio: null,
      tabErrors,
      report: { source: 'tab', detectedNotes: notes.length, keptNotes: notes.length, transpose: 0, folded: 0 },
    };
  }

  const file = input.file!;

  if (isMidi(file)) {
    step(t('step.midi'));
    const tracks = await readMidi(file);
    if (tracks.length === 0) throw new Error(t('err.midiEmpty'));
    const auto = input.midiTrack === null ? extractMidiMelody(tracks) : null;
    const raw = auto ? auto.notes : tracks[Math.min(input.midiTrack!, tracks.length - 1)].notes;
    const res = makePlayable(raw, { kind: 'midi', minNoteSec });
    return {
      notes: res.notes,
      audio: null,
      midiTracks: tracks,
      midiAutoTracks: auto?.tracks,
      tabErrors,
      report: { source: 'midi', detectedNotes: res.melodyCount, keptNotes: res.notes.length, transpose: res.transpose, folded: res.folded, fidelity: res.fidelity, tooFast: res.tooFast, fixedArtifacts: res.fixedArtifacts },
    };
  }

  step(t('step.decode'));
  const original = await decodeAudioFile(file);
  let source = original;
  let stemUsed: AnalysisOutput['stemUsed'] = 'mix';

  if (input.separate) {
    const stems = await separateStems(original, step);
    const sung = energy(stems.vocals) > energy(stems.other) * 0.25;
    stemUsed = input.stem === 'auto' ? (sung ? 'vocals' : 'mix') : input.stem;
    source = stemUsed === 'mix' ? original : stems[stemUsed];
  }

  const model = await runModel(source, (p) => step(t('step.listen'), p));
  const raw = await modelToNotes(model);
  if (raw.length === 0) throw new Error(t('err.noNotes'));
  step(t('step.melody'));
  const melody = joinFragments(extractMelody(raw), model);

  if (tab && tabNotes.length > 0) {
    step(t('step.align'));
    const aligned = alignTabToAudio(
      tabNotes.map((n) => n.pitch),
      melody,
    );
    const notes: Note[] = tabNotes.map((n, i) => {
      const next = aligned.starts[i + 1];
      const dur = next !== undefined ? Math.max(0.08, next - aligned.starts[i]) : 0.5;
      return { start: aligned.starts[i], dur, pitch: n.pitch, combo: n.combo };
    });
    return {
      notes,
      audio: original,
      tabErrors,
      stemUsed,
      report: {
        source: 'mp3+tab',
        detectedNotes: tabNotes.length,
        keptNotes: notes.length,
        transpose: 0,
        folded: 0,
        alignedNotes: aligned.matched,
      },
    };
  }

  step(t('step.tempo'));
  const assist = buildAssistData(raw, model, trackBeats(model));
  const res = solveAssisted(assist, emptyChoices(), minNoteSec);
  return {
    notes: res.notes,
    audio: original,
    tabErrors,
    stemUsed,
    assist,
    report: { source: 'mp3', bpm: res.bpm, detectedNotes: res.melodyCount, keptNotes: res.notes.length, transpose: res.transpose, folded: res.folded, fidelity: res.fidelity, tooFast: res.tooFast, fixedArtifacts: res.fixedArtifacts },
  };
}
