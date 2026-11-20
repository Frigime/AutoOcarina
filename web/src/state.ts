import { t } from './i18n';
import { DEFAULT_SETTINGS, type Settings, type Song } from './core/types';

export interface AppState {
  songs: Song[];
  currentId: string;
  settings: Settings;
}

const KEY = 'ocarina-bot:v1';

export function newSong(name = t('songs.newName')): Song {
  return { id: Math.random().toString(36).slice(2, 10), name, notes: [] };
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as AppState;
      if (Array.isArray(s.songs) && s.songs.length > 0) {
        return {
          songs: s.songs,
          currentId: s.songs.some((x) => x.id === s.currentId) ? s.currentId : s.songs[0].id,
          settings: sanitize({ ...DEFAULT_SETTINGS, ...s.settings }),
        };
      }
    }
  } catch {
  }
  const first = newSong();
  return { songs: [first], currentId: first.id, settings: { ...DEFAULT_SETTINGS } };
}

type Listener = (s: AppState) => void;

class Store {
  state: AppState = load();
  private listeners = new Set<Listener>();

  audio = new Map<string, AudioBuffer>();

  get current(): Song {
    return this.state.songs.find((s) => s.id === this.state.currentId) ?? this.state.songs[0];
  }

  subscribe(fn: Listener): void {
    this.listeners.add(fn);
  }

  update(mutate: (s: AppState) => void): void {
    mutate(this.state);
    try {
      localStorage.setItem(KEY, JSON.stringify(this.state));
    } catch {
    }
    this.listeners.forEach((l) => l(this.state));
  }

  replaceAll(next: AppState): void {
    this.update((s) => Object.assign(s, next));
  }
}

export const store = new Store();

function sanitize(s: Settings): Settings {
  if (!['off', 'safe', 'always'].includes(s.legato)) s.legato = DEFAULT_SETTINGS.legato;
  return s;
}
