import type { Combo, Layout } from './ocarina';

export interface Note {
  start: number;
  dur: number;
  pitch: number;
  vel?: number;
  combo?: Combo;
  src?: number;
}

export interface Song {
  id: string;
  name: string;
  notes: Note[];
  report?: AnalysisReport;
  minNoteMs?: number;
}

export interface AnalysisReport {
  source: 'mp3' | 'midi' | 'tab' | 'mp3+tab';
  detectedNotes: number;
  keptNotes: number;
  transpose: number;
  folded: number;
  alignedNotes?: number;
  bpm?: number;
  fidelity?: number;
  tooFast?: number;
  fixedArtifacts?: number;
}

export interface Settings {
  layout: Layout;
  leadMs: number;
  minNoteMs: number;
  takeOutOcarina: boolean;
  avoidGameSongs: boolean;
  tabBpm: number;
  legato: 'off' | 'safe' | 'always';
}

export const DEFAULT_SETTINGS: Settings = {
  layout: 'normal',
  leadMs: 50,
  minNoteMs: 100,
  takeOutOcarina: true,
  avoidGameSongs: true,
  tabBpm: 150,
  legato: 'safe',
};
