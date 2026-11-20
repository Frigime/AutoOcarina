import './style.css';

import { playNotes, type Playback } from './audio/synth';
import type { MidiTrack } from './audio/midi';
import {
  applyStroke,
  copyChoices,
  displayCandidates,
  emptyChoices,
  solveAssisted,
  toggleBan,
  passageVariants,
  togglePin,
  assistedMelody,
  type AssistData,
} from './core/assist';
import { compileSong, type CompiledSong } from './core/compile';
import { BANK_FLASH_ADDRESS, BANK_MAX_SIZE, BANK_MAX_SONGS, bankSize, crc32, encodeBank } from './core/pack';
import { GAME_SONGS } from './core/gameSongs';
import { SONG_COLORS, songColor } from './core/palette';
import type { MelodyChoices } from './core/simplify';
import type { Note, Settings, Song } from './core/types';
import { toUf2 } from './core/uf2';
import { Board, isWebHidSupported } from './device/board';
import { isWebSerialSupported, SerialBoard } from './device/serialBoard';
import { analyze } from './pipeline';
import { makeSpeedTest, SPEED_TEST_STEPS_MS } from './core/speedTest';
import { newSong, store } from './state';
import { applyI18n, getLang, onLangChange, setLang, t, type Key } from './i18n';
import { PianoRoll } from './ui/pianoRoll';
import { openTapMode } from './ui/tap';
import { keyboardLegend, VirtualPad, type PadResult } from './ui/virtualPad';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

let board: Board | SerialBoard | null = null;
let busy = false;
let syncedCrc: number | null = null;
let playback: Playback | null = null;
let playheadTimer = 0;
let pendingFile: File | null = null;
let midiTracks: MidiTrack[] = [];
let autoTracks: number[] = [];

const roll = new PianoRoll($('roll'));
roll.onChange = (notes) => setNotes(notes);

function setNotes(notes: Note[]) {
  store.update(() => {
    store.current.notes = notes;
  });
}

function songSettings(song: Song): Settings {
  const s = store.state.settings;
  return song.minNoteMs ? { ...s, minNoteMs: song.minNoteMs } : s;
}

function compiled(song: Song): CompiledSong {
  return compileSong(song.notes, songSettings(song));
}

function buildBank(): Uint8Array {
  const songs = store.state.songs.filter((s) => s.notes.length > 0);
  return encodeBank(songs.map((s) => ({ name: s.name, events: compiled(s).events })));
}

const colorName = (slot: number) => t(`color.${slot % SONG_COLORS.length}` as Key);

function formatTime(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function renderSongList() {
  const list = $('song-list');
  list.innerHTML = '';
  let slot = 0;
  store.state.songs.forEach((song, i) => {
    const onBoard = song.notes.length > 0 ? slot++ : -1;
    const li = document.createElement('li');
    li.className = 'song-item' + (song.id === store.state.currentId ? ' active' : '');
    const color = onBoard >= 0 ? songColor(onBoard) : null;
    const c = song.notes.length ? compiled(song) : null;
    li.innerHTML = `
      <span class="led" style="${color ? `background:${color.css};color:${color.css}` : 'background:var(--surface-2)'}"
        title="${color ? t('songs.ledTitle', { color: colorName(onBoard), n: onBoard + 1 }) : t('songs.emptyTitle')}">
        <b style="color:#0b0f14">${onBoard >= 0 ? onBoard + 1 : '–'}</b></span>
      <div style="min-width:0">
        <div class="name"></div>
        <div class="meta">${c ? t('songs.meta', { n: song.notes.length, time: formatTime(c.durationMs) }) : t('songs.empty')}</div>
      </div>
      <div class="actions">
        <button class="icon-btn" data-act="up" title="${t('songs.up')}" ${i === 0 ? 'disabled' : ''}>▲</button>
        <button class="icon-btn" data-act="down" title="${t('songs.down')}" ${i === store.state.songs.length - 1 ? 'disabled' : ''}>▼</button>
        <button class="icon-btn" data-act="del" title="${t('songs.delete')}">✕</button>
      </div>`;
    li.querySelector('.name')!.textContent = song.name;
    li.addEventListener('click', (e) => {
      const act = (e.target as HTMLElement).closest('button')?.dataset.act;
      if (act === 'del') {
        if (song.notes.length && !confirm(t('songs.confirmDelete', { name: song.name }))) return;
        store.update((s) => {
          s.songs.splice(i, 1);
          if (s.songs.length === 0) s.songs.push(newSong());
          if (!s.songs.some((x) => x.id === s.currentId)) s.currentId = s.songs[0].id;
        });
        store.audio.delete(song.id);
        assistSessions.delete(song.id);
      } else if (act === 'up' || act === 'down') {
        const j = act === 'up' ? i - 1 : i + 1;
        store.update((s) => ([s.songs[i], s.songs[j]] = [s.songs[j], s.songs[i]]));
      } else if (song.id !== store.state.currentId) {
        stopPlayback();
        clearPassage();
        pendingFile = null;
        midiTracks = [];
        store.update((s) => (s.currentId = song.id));
        renderInputs();
      }
    });
    list.appendChild(li);
  });

  const songs = store.state.songs.filter((s) => s.notes.length > 0);
  let size = 0;
  try {
    size = bankSize(songs.map((s) => ({ events: compiled(s).events })));
  } catch {
  }
  const pct = Math.min(100, (size / BANK_MAX_SIZE) * 100);
  $('capacity-fill').style.width = `${pct}%`;
  $('capacity-fill').style.background = pct >= 100 ? 'var(--danger)' : '';
  $('capacity-text').textContent = t('songs.capacity', {
    n: songs.length,
    max: BANK_MAX_SONGS,
    size: (size / 1024).toFixed(1),
    maxSize: BANK_MAX_SIZE / 1024,
  });
}

function renderEditor() {
  const song = store.current;
  const name = $<HTMLInputElement>('song-name');
  if (document.activeElement !== name) name.value = song.name;

  const slot = store.state.songs.filter((s) => s.notes.length > 0).indexOf(song);
  const color = slot >= 0 ? songColor(slot) : null;
  $('song-led').innerHTML = color
    ? `<i style="background:${color.css}"></i> ${t('songs.led', { color: colorName(slot), n: slot + 1 })}`
    : '';

  roll.setNotes(song.notes, songSettings(song));
  renderAssist(song);
  roll.setAudio(store.audio.get(song.id) ?? null);

  const report = $('report');
  const r = song.report;
  if (r && song.notes.length) {
    const fidelity = Math.round(
      (r.fidelity ?? (r.detectedNotes ? r.keptNotes / r.detectedNotes : 1)) * 100,
    );
    const stats: [string, string, boolean?][] = [[`${song.notes.length}`, t('report.played')]];
    if (r.source === 'mp3+tab')
      stats.push([`${r.alignedNotes} / ${r.detectedNotes}`, t('report.aligned'), (r.alignedNotes ?? 0) < r.detectedNotes * 0.6]);
    else if (r.source !== 'tab') stats.push([`${fidelity} %`, t('report.fidelity'), fidelity < 80]);
    if (r.tooFast) stats.push([`${r.tooFast}`, t('report.tooFast'), true]);
    if (r.fixedArtifacts) stats.push([`${r.fixedArtifacts}`, t('report.fixed')]);
    stats.push([r.transpose ? `${r.transpose > 0 ? '+' : ''}${r.transpose}` : '0', t('report.transpose')]);
    if (r.folded) stats.push([`${r.folded}`, t('report.folded'), true]);
    if (r.bpm) stats.push([`${r.bpm}`, t('report.bpm')]);
    report.innerHTML = stats
      .map(([v, l, warn]) => `<div class="stat${warn ? ' warn' : ''}"><b>${v}</b><span>${l}</span></div>`)
      .join('');
    report.hidden = false;
  } else report.hidden = true;

  const warnings: string[] = [];
  if (song.notes.length) {
    const c = compiled(song);
    if (c.skipped) warnings.push(t('warn.skipped', { n: c.skipped }));
    for (const hit of c.songHits) {
      const index = GAME_SONGS.findIndex((g) => g.name === hit.song);
      const name = index >= 0 ? t(`gameSong.${index}` as Key) : hit.song;
      warnings.push(t('warn.gameSong', { song: name, n: hit.index + 1 }));
    }
    if (r?.tooFast && r.tooFast >= 3) warnings.push(t('warn.tooFast', { n: r.tooFast, ms: store.state.settings.minNoteMs }));
    if (r?.folded && r.folded >= 3) warnings.push(t('warn.folded'));
    if (r?.source === 'mp3' && song.notes.length >= 20) {
      const span = song.notes[song.notes.length - 1].start - song.notes[0].start || 1;
      const perSecond = song.notes.length / span;
      if (r.bpm ? (perSecond * 60) / r.bpm > 2.2 : perSecond > 3.5) warnings.push(t('warn.dense', { n: perSecond.toFixed(1) }));
    }
  }
  $('warnings').innerHTML = warnings.map((w) => `<li>${w}</li>`).join('');

  const hasAudio = store.audio.has(song.id);
  $<HTMLButtonElement>('play-mix').disabled = !hasAudio;
  $<HTMLButtonElement>('play').disabled = song.notes.length === 0;
  $<HTMLButtonElement>('tap').disabled = song.notes.length === 0;
  $<HTMLButtonElement>('play-board').disabled = !board || busy || song.notes.length === 0;
}

function renderInputs() {
  const song = store.current;
  $('file-name').textContent = pendingFile ? pendingFile.name : store.audio.has(song.id) ? t('drop.inMemory') : '';
  const isMidi = pendingFile ? /\.midi?$/i.test(pendingFile.name) : false;
  $('separate-row').hidden = isMidi;
  $('stem-row').hidden = isMidi || !$<HTMLInputElement>('separate').checked;
  $('midi-row').hidden = midiTracks.length < 2;
  $('error').hidden = true;
}

function renderSettings() {
  const s = store.state.settings;
  $<HTMLSelectElement>('set-layout').value = s.layout;
  $<HTMLInputElement>('set-lead').value = String(s.leadMs);
  $<HTMLInputElement>('set-min').value = String(s.minNoteMs);
  $<HTMLInputElement>('set-bpm').value = String(s.tabBpm);
  $<HTMLInputElement>('set-takeout').checked = s.takeOutOcarina;
  $<HTMLInputElement>('set-avoid').checked = s.avoidGameSongs;
  $<HTMLSelectElement>('set-legato').value = s.legato;
}

function renderDevice() {
  const status = $('device-status');
  const connect = $<HTMLButtonElement>('connect');
  const send = $<HTMLButtonElement>('send');
  status.className = 'pill';
  if (!isWebHidSupported() && !isWebSerialSupported()) {
    status.textContent = t('device.unsupported');
    status.classList.add('bad');
    connect.hidden = true;
  } else if (!board) {
    status.textContent = t('device.none');
    connect.hidden = false;
  } else {
    connect.hidden = true;
    const what = board.kind === 'bluetooth' ? 'ESP32' : t('device.board');
    status.textContent = busy ? t('device.sending') : board.isPlaying() ? t('device.playing', { what }) : t('device.connected', { what });
    status.classList.add(busy ? 'busy' : 'ok');
  }
  $('pad-view').hidden = board?.kind !== 'usb';
  renderRemote();

  let current: number | null = null;
  try {
    current = crc32(buildBank());
  } catch {
    current = null;
  }
  send.disabled = busy || current === null || !store.state.songs.some((s) => s.notes.length);
  send.textContent = board && syncedCrc === current ? t('send.upToDate') : t('send');
  $<HTMLButtonElement>('erase').disabled = !board || busy;
  $<HTMLButtonElement>('bootsel').disabled = board?.kind !== 'usb' || busy;
}

let pairing = false;

function renderRemote() {
  const remote = $('remote');
  remote.hidden = board?.kind !== 'bluetooth';
  if (!(board instanceof SerialBoard)) {
    closePad();
    return;
  }
  if (board.bt === 3) pairing = false;
  $('bt-state').innerHTML = pairing ? t('remote.pairing') : t(`bt.${board.bt}` as Key);
  const recent = board.version >= 2;
  $('old-firmware').hidden = recent;
  $<HTMLButtonElement>('r-pair').hidden = !recent;
  $<HTMLButtonElement>('r-pad').hidden = !recent;
  $<HTMLButtonElement>('r-pair').classList.toggle('primary', board.bt !== 3);
  $<HTMLButtonElement>('r-pair').disabled = busy;
  const ready = board.bt === 3 && !busy;
  for (const id of ['r-ocarina', 'r-a', 'r-b', 'r-lr', 'r-home', 'r-pad']) $<HTMLButtonElement>(id).disabled = !ready;
  $<HTMLButtonElement>('r-play').disabled = !ready || store.current.notes.length === 0;
  $<HTMLButtonElement>('r-stop').disabled = !board.isPlaying();
}

function renderAll() {
  renderSongList();
  renderEditor();
  renderDevice();
}

store.subscribe(renderAll);

interface AssistSession {
  data: AssistData;
  choices: MelodyChoices;
  history: MelodyChoices[];
}
const assistSessions = new Map<string, AssistSession>();
let assistOn = false;

function renderAssist(song: Song) {
  const session = assistSessions.get(song.id);
  if (!session) assistOn = false;
  roll.setAssist(
    assistOn && session ? { candidates: displayCandidates(session.data, song.notes, session.choices), pinned: session.choices.pinned } : null,
  );
  const button = $<HTMLButtonElement>('assist');
  button.disabled = !session;
  button.title = session ? t('assist.title') : t('assist.unavailable');
  button.classList.toggle('primary', assistOn);
  $('assist-bar').hidden = !assistOn;
  $('assist-count').textContent = session?.history.length ? t('assist.count', { n: session.history.length }) : '';
  $<HTMLButtonElement>('assist-undo').disabled = !session?.history.length;
  $<HTMLButtonElement>('assist-reset').disabled = !session?.history.length;
  roll.setSelectable(Boolean(session));
  $('passage-hint').hidden = !session || Boolean(passage);
  if (!session) clearPassage();
}

function resolveAssist(song: Song, session: AssistSession) {
  const res = solveAssisted(session.data, session.choices, songSettings(song).minNoteMs / 1000);
  store.update(() => {
    song.notes = res.notes;
    if (song.report)
      Object.assign(song.report, {
        detectedNotes: res.melodyCount,
        keptNotes: res.notes.length,
        folded: res.folded,
        fidelity: res.fidelity,
        tooFast: res.tooFast,
        fixedArtifacts: res.fixedArtifacts,
      });
  });
}

function assistEdit(mutate: (s: AssistSession) => void) {
  const song = store.current;
  const session = assistSessions.get(song.id);
  if (!session) return;
  session.history.push(copyChoices(session.choices));
  mutate(session);
  resolveAssist(song, session);
}

roll.onAssist = (action) =>
  assistEdit((s) => {
    if (action.kind === 'pin') {
      togglePin(s.data, s.choices, action.src);
      if (!playback && s.choices.pinned.has(action.src)) playNotes([{ start: 0, dur: 0.35, pitch: action.pitch }]);
    } else if (action.kind === 'ban') toggleBan(s.data, s.choices, action.src, action.dur);
    else if (action.kind === 'unban') action.srcs.forEach((src) => s.choices.banned.delete(src));
    else applyStroke(s.data, s.choices, action.srcs, action.from, action.to);
  });

$('assist').addEventListener('click', () => {
  assistOn = !assistOn;
  renderAssist(store.current);
});
interface Passage {
  from: number;
  to: number;
  variants: number[][];
  index: number;
  before: MelodyChoices;
}
let passage: Passage | null = null;

function formatSec(sec: number): string {
  return `${Math.floor(sec / 60)}:${(sec % 60).toFixed(1).padStart(4, '0')}`;
}

function renderPassage() {
  $('passage-bar').hidden = !passage;
  $('passage-hint').hidden = Boolean(passage) || !assistSessions.has(store.current.id);
  if (!passage) return;
  const where = t('passage.selected', { from: formatSec(passage.from), to: formatSec(passage.to) });
  const state =
    passage.variants.length === 0
      ? t('passage.none')
      : passage.index < 0
        ? t('passage.original')
        : t('passage.count', { i: passage.index + 1, n: passage.variants.length });
  $('passage-text').innerHTML = `${where} ${state}`;
  $<HTMLButtonElement>('passage-next').disabled = passage.variants.length === 0;
}

function clearPassage() {
  passage = null;
  roll.setSelection(null);
  renderPassage();
}

function playPassage() {
  if (!passage) return;
  const song = store.current;
  stopPlayback();
  const from = Math.max(0, passage.from - 0.3);
  const p = playNotes(song.notes, { from, original: store.audio.get(song.id) ?? null, originalVolume: 0.35, synthVolume: 0.55 });
  playback = p;
  const until = passage.to + 0.4;
  const tick = () => {
    if (playback !== p) return;
    const pos = p.position();
    if (pos >= until) return stopPlayback();
    roll.setPlayhead(pos);
    playheadTimer = requestAnimationFrame(tick);
  };
  tick();
}

roll.onSelect = (sel) => {
  const song = store.current;
  const session = assistSessions.get(song.id);
  if (!sel || !session) return clearPassage();
  const current = assistedMelody(session.data, session.choices);
  passage = { ...sel, variants: passageVariants(session.data, session.choices, current, sel.from, sel.to), index: -1, before: copyChoices(session.choices) };
  renderPassage();
};

$('passage-next').addEventListener('click', () => {
  const song = store.current;
  const session = assistSessions.get(song.id);
  if (!passage || !session || passage.variants.length === 0) return;
  if (passage.index === -1) session.history.push(copyChoices(session.choices));
  passage.index = passage.index + 1 >= passage.variants.length ? -1 : passage.index + 1;
  session.choices = copyChoices(passage.before);
  if (passage.index >= 0) applyStroke(session.data, session.choices, passage.variants[passage.index], passage.from, passage.to);
  resolveAssist(song, session);
  renderPassage();
  playPassage();
});
$('passage-play').addEventListener('click', playPassage);
$('passage-done').addEventListener('click', clearPassage);

$('assist-undo').addEventListener('click', () => {
  clearPassage();
  const song = store.current;
  const session = assistSessions.get(song.id);
  const previous = session?.history.pop();
  if (!session || !previous) return;
  session.choices = previous;
  resolveAssist(song, session);
});
$('assist-reset').addEventListener('click', () => {
  clearPassage();
  const song = store.current;
  const session = assistSessions.get(song.id);
  if (!session) return;
  session.choices = emptyChoices();
  session.history = [];
  resolveAssist(song, session);
});

function stopPlayback() {
  playback?.stop();
  playback = null;
  cancelAnimationFrame(playheadTimer);
  roll.setPlayhead(null);
}

function startPlayback(withOriginal: boolean) {
  stopPlayback();
  const song = store.current;
  const p = playNotes(song.notes, {
    from: 0,
    original: withOriginal ? store.audio.get(song.id) : null,
    synthVolume: withOriginal ? 0.45 : 0.6,
  });
  playback = p;
  const tick = () => {
    if (playback !== p) return;
    roll.setPlayhead(p.position());
    playheadTimer = requestAnimationFrame(tick);
  };
  tick();
  void p.done.then(() => {
    if (playback === p) stopPlayback();
  });
}

$('play').addEventListener('click', () => startPlayback(false));
$('play-mix').addEventListener('click', () => startPlayback(true));
$('stop').addEventListener('click', stopPlayback);
$('tap').addEventListener('click', () => {
  stopPlayback();
  const song = store.current;
  openTapMode(song.notes, store.audio.get(song.id) ?? null, store.state.settings.layout, setNotes);
});
function transposeAll(by: number) {
  const session = assistSessions.get(store.current.id);
  if (session) session.data.transpose = (session.data.transpose ?? 0) + by;
  setNotes(store.current.notes.map((n) => ({ ...n, pitch: n.pitch + by, combo: undefined })));
}
$('transpose-up').addEventListener('click', () => transposeAll(1));
$('transpose-down').addEventListener('click', () => transposeAll(-1));
$('zoom-in').addEventListener('click', () => roll.zoom(1.4));
$('zoom-out').addEventListener('click', () => roll.zoom(1 / 1.4));

$('add-song').addEventListener('click', () => {
  if (store.state.songs.length >= BANK_MAX_SONGS) return alert(t('songs.max', { n: BANK_MAX_SONGS }));
  stopPlayback();
  pendingFile = null;
  midiTracks = [];
  const song = newSong(t('songs.numbered', { n: store.state.songs.length + 1 }));
  store.update((s) => {
    s.songs.push(song);
    s.currentId = song.id;
  });
  renderInputs();
});

$('speed-test').addEventListener('click', () => {
  if (store.state.songs.length >= BANK_MAX_SONGS) return alert(t('songs.max', { n: BANK_MAX_SONGS }));
  stopPlayback();
  pendingFile = null;
  midiTracks = [];
  const song = makeSpeedTest();
  store.update((s) => {
    s.songs.push(song);
    s.currentId = song.id;
  });
  renderInputs();
  alert(
    t('speedTest.added', {
      count: SPEED_TEST_STEPS_MS.length,
      steps: SPEED_TEST_STEPS_MS.map((ms, i) => t('speedTest.step', { i: i + 1, ms })).join(' · '),
    }),
  );
});

$<HTMLInputElement>('song-name').addEventListener('input', (e) => {
  const value = (e.target as HTMLInputElement).value;
  store.update(() => (store.current.name = value || t('songs.untitled')));
});

function pickFile(file: File | undefined) {
  if (!file) return;
  pendingFile = file;
  midiTracks = [];
  if (/^(Morceau \d+|Nouveau morceau|Sans titre|Song \d+|New song|Untitled)$/.test(store.current.name)) {
    const name = file.name.replace(/\.[^.]+$/, '').slice(0, 23);
    store.update(() => (store.current.name = name));
  }
  renderInputs();
}

const drop = $('drop');
$<HTMLInputElement>('file').addEventListener('change', (e) => pickFile((e.target as HTMLInputElement).files?.[0]));
drop.addEventListener('dragover', (e) => {
  e.preventDefault();
  drop.classList.add('over');
});
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', (e) => {
  e.preventDefault();
  drop.classList.remove('over');
  pickFile(e.dataTransfer?.files[0]);
});
$('separate').addEventListener('change', renderInputs);
$('midi-track').addEventListener('change', () => void runAnalysis());

function setProgress(label: string, p?: number) {
  $('progress').hidden = false;
  $('progress').classList.toggle('indeterminate', p === undefined);
  $('progress-fill').style.width = `${Math.round((p ?? 0) * 100)}%`;
  $('progress-text').textContent = p === undefined ? label : `${label} ${Math.round(p * 100)} %`;
}

async function runAnalysis() {
  const song = store.current;
  const btn = $<HTMLButtonElement>('analyze');
  btn.disabled = true;
  $('error').hidden = true;
  $('tab-errors').innerHTML = '';
  stopPlayback();
  try {
    const out = await analyze(
      {
        file: pendingFile,
        tab: $<HTMLTextAreaElement>('tab').value,
        separate: $<HTMLInputElement>('separate').checked,
        stem: $<HTMLSelectElement>('stem').value as 'auto' | 'vocals' | 'other',
        midiTrack: midiTracks.length && $<HTMLSelectElement>('midi-track').value !== 'auto' ? Number($<HTMLSelectElement>('midi-track').value) : null,
      },
      store.state.settings,
      setProgress,
    );
    if (out.audio) store.audio.set(song.id, out.audio);
    if (out.assist) assistSessions.set(song.id, { data: out.assist, choices: emptyChoices(), history: [] });
    else assistSessions.delete(song.id);
    if (out.midiTracks) {
      const select = $<HTMLSelectElement>('midi-track');
      const previous = midiTracks.length ? select.value : 'auto';
      midiTracks = out.midiTracks;
      const used = out.midiAutoTracks ?? autoTracks;
      autoTracks = used;
      const auto = `<option value="auto">${t('midi.auto', { tracks: used.map((i) => i + 1).join(' + ') })}</option>`;
      select.innerHTML =
        auto +
        midiTracks.map((tr, i) => `<option value="${i}">${i + 1}. ${t('midi.track', { name: tr.name, n: tr.notes.length })}</option>`).join('');
      select.value = previous;
    }
    $('tab-errors').innerHTML = out.tabErrors
      .map((e) => `<li>${t('tab.error', { index: e.index, token: e.token, message: e.message })}</li>`)
      .join('');
    if (out.stemUsed && out.stemUsed !== 'mix') $<HTMLSelectElement>('stem').value = out.stemUsed;
    store.update(() => {
      song.notes = out.notes;
      song.report = out.report;
    });
    renderInputs();
  } catch (e) {
    console.error(e);
    $('error').textContent = e instanceof Error ? e.message : String(e);
    $('error').hidden = false;
  } finally {
    btn.disabled = false;
    $('progress').hidden = true;
  }
}
$('analyze').addEventListener('click', () => void runAnalysis());

function bindSetting<K extends keyof Settings>(id: string, key: K, read: (el: HTMLInputElement) => Settings[K]) {
  $(id).addEventListener('change', (e) => {
    const value = read(e.target as HTMLInputElement);
    store.update((s) => (s.settings[key] = value));
  });
}
bindSetting('set-layout', 'layout', (el) => el.value as Settings['layout']);
bindSetting('set-lead', 'leadMs', (el) => Math.max(20, Number(el.value) || 50));
bindSetting('set-min', 'minNoteMs', (el) => Math.max(40, Number(el.value) || 100));
bindSetting('set-bpm', 'tabBpm', (el) => Math.max(40, Number(el.value) || 150));
bindSetting('set-takeout', 'takeOutOcarina', (el) => el.checked);
bindSetting('set-avoid', 'avoidGameSongs', (el) => el.checked);
bindSetting('set-legato', 'legato', (el) => (el.value === 'always' || el.value === 'off' ? el.value : 'safe'));

function attachBoard(b: Board | SerialBoard) {
  board = b;
  syncedCrc = null;
  board.onChange(renderDevice);
  board.onDisconnect = () => {
    board = null;
    syncedCrc = null;
    $('send-status').textContent = t('send.unplugged');
    renderAll();
  };
  if (board instanceof SerialBoard) void board.setLang(getLang());
  const keys = document.querySelectorAll<HTMLElement>('.pad-keys span');
  if (board instanceof Board) board.onPad = (pad) => {
    keys.forEach((k) => {
      const on =
        (k.dataset.btn && (pad.buttons & Number(k.dataset.btn)) !== 0) ||
        (k.dataset.hat && pad.hat === Number(k.dataset.hat)) ||
        (k.dataset.ly && pad.ly === Number(k.dataset.ly));
      k.classList.toggle('on', Boolean(on));
    });
  };
  renderAll();
}

const connectDialog = $('connect-dialog');
$('connect').addEventListener('click', () => {
  connectDialog.hidden = false;
});
connectDialog.addEventListener('click', async (e) => {
  const kind = (e.target as HTMLElement).closest<HTMLElement>('[data-kind]')?.dataset.kind;
  if (!kind && e.target !== connectDialog) return;
  connectDialog.hidden = true;
  try {
    if (kind === 'bluetooth') {
      if (!isWebSerialSupported()) throw new Error(t('send.needChromeEsp'));
      $('send-status').textContent = t('send.connectingEsp');
      const b = await SerialBoard.request();
      if (b) attachBoard(b);
      $('send-status').textContent = '';
    } else if (kind === 'usb') {
      if (!isWebHidSupported()) throw new Error(t('send.needChrome'));
      const b = await Board.request();
      if (b) attachBoard(b);
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'NotFoundError') {
      $('send-status').textContent = '';
      return;
    }
    $('send-status').textContent = err instanceof Error ? err.message : String(err);
  }
});

async function upload(): Promise<boolean> {
  if (!board) {
    $('send-status').textContent = t('send.noBoard');
    return false;
  }
  const bank = buildBank();
  busy = true;
  renderDevice();
  try {
    await board.upload(bank, (p) => ($('send-status').textContent = t('send.progress', { p: Math.round(p * 100) })));
    syncedCrc = crc32(bank);
    const size = `${(bank.length / 1024).toFixed(1)} ${getLang() === 'en' ? 'KB' : 'Ko'}`;
    $('send-status').textContent = t(board.kind === 'usb' ? 'send.doneUsb' : 'send.done', { size });
    return true;
  } catch (e) {
    $('send-status').textContent = e instanceof Error ? e.message : String(e);
    return false;
  } finally {
    busy = false;
    renderAll();
  }
}

$('send').addEventListener('click', () => void upload());

async function playCurrentOnBoard() {
  if (!board) return;
  const slot = store.state.songs.filter((s) => s.notes.length > 0).indexOf(store.current);
  let current: number | null = null;
  try {
    current = crc32(buildBank());
  } catch {
  }
  if (syncedCrc !== current && !(await upload())) return;
  try {
    await board.play(slot);
  } catch (e) {
    $('send-status').textContent = e instanceof Error ? e.message : String(e);
  }
}
$('play-board').addEventListener('click', () => void playCurrentOnBoard());

function remote(action: (b: SerialBoard) => Promise<void>) {
  if (!(board instanceof SerialBoard)) return;
  action(board).catch((e) => ($('send-status').textContent = e instanceof Error ? e.message : String(e)));
}
$('r-ocarina').addEventListener('click', () => remote((b) => b.tap(0, 6, 128, 150)));
$('r-a').addEventListener('click', () => remote((b) => b.tap(1 << 2)));
$('r-b').addEventListener('click', () => remote((b) => b.tap(1 << 1)));
$('r-lr').addEventListener('click', () => remote((b) => b.tap((1 << 4) | (1 << 5), 8, 128, 300)));
$('r-home').addEventListener('click', () => remote((b) => b.tap(1 << 12)));
$('r-pair').addEventListener('click', () =>
  remote(async (b) => {
    pairing = true;
    renderRemote();
    await b.pair();
  }),
);
$('r-play').addEventListener('click', () => void playCurrentOnBoard());
$('r-stop').addEventListener('click', () => remote((b) => b.stop()));
$('r-unpair').addEventListener('click', () => {
  if (!confirm(t('confirm.unpair'))) return;
  remote((b) => b.unpair());
});

$('bootsel').addEventListener('click', async () => {
  if (!(board instanceof Board) || !confirm(t('confirm.bootsel'))) return;
  await board.rebootToBootloader();
});

$('erase').addEventListener('click', async () => {
  if (!board || !confirm(t('confirm.erase'))) return;
  await board.erase();
  syncedCrc = null;
  $('send-status').textContent = t('send.erased');
  renderDevice();
});

function download(data: BlobPart, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$('download-uf2').addEventListener('click', () => {
  try {
    download(toUf2(buildBank(), BANK_FLASH_ADDRESS) as Uint8Array<ArrayBuffer>, t('file.uf2'), 'application/octet-stream');
    $('send-status').textContent = t('send.uf2Hint');
  } catch (e) {
    $('send-status').textContent = e instanceof Error ? e.message : String(e);
  }
});

$('export').addEventListener('click', () => {
  download(JSON.stringify(store.state, null, 1), t('file.backup'), 'application/json');
});
$<HTMLInputElement>('import').addEventListener('change', async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.songs)) throw new Error();
    store.replaceAll({ ...store.state, ...data });
    renderSettings();
    renderInputs();
  } catch {
    alert(t('import.bad'));
  }
});

const padDialog = $('pad-dialog');
const PAD_STATUS: Record<PadResult, [Key, string]> = {
  ok: ['pad.ok', 'ok-text'],
  bluetooth: ['pad.notReady', 'warn-text'],
  busy: ['pad.busy', 'warn-text'],
  error: ['serial.timeout', 'warn-text'],
};
const virtualPad = new VirtualPad(
  padDialog,
  (s) => (board instanceof SerialBoard ? board.pad(s) : Promise.resolve('error' as const)),
  (r) => {
    $('pad-status').textContent = t(PAD_STATUS[r][0]);
    $('pad-status').className = `small ${PAD_STATUS[r][1]}`;
  },
  (name) => ($('pad-gamepad').textContent = name ? t('pad.gamepadFound', { name }) : t('pad.gamepadNone')),
);

async function openPad() {
  if (!(board instanceof SerialBoard)) return;
  stopPlayback();
  padDialog.hidden = false;
  $('pad-status').textContent = '';
  $('pad-gamepad').textContent = t('pad.gamepadNone');
  $('pad-keys').innerHTML = await keyboardLegend();
  virtualPad.start();
}
function closePad() {
  if (padDialog.hidden) return;
  padDialog.hidden = true;
  virtualPad.stop();
}
$('r-pad').addEventListener('click', () => void openPad());
$('pad-close').addEventListener('click', closePad);
padDialog.addEventListener('click', (e) => {
  if (e.target === padDialog) closePad();
});
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && !padDialog.hidden) closePad();
});

const FW_KEY = 'ocarina-bot-board';
function setFirmwareBoard(board: string) {
  const select = $<HTMLSelectElement>('fw-board');
  if (![...select.options].some((o) => o.value === board)) board = select.options[0].value;
  select.value = board;
  document.querySelectorAll<HTMLAnchorElement>('.fw-link').forEach((a) => {
    a.href = `firmware/autoocarina_${board}.uf2`;
    a.download = `autoocarina_${board}.uf2`;
  });
  try {
    localStorage.setItem(FW_KEY, board);
  } catch {
  }
}
$('fw-board').addEventListener('change', (e) => setFirmwareBoard((e.target as HTMLSelectElement).value));
try {
  setFirmwareBoard(localStorage.getItem(FW_KEY) ?? '');
} catch {
  setFirmwareBoard('');
}

$('lang').addEventListener('click', () => setLang(getLang() === 'fr' ? 'en' : 'fr'));
onLangChange((lang) => {
  renderAll();
  renderInputs();
  if (!padDialog.hidden) void keyboardLegend().then((html) => ($('pad-keys').innerHTML = html));
  if (board instanceof SerialBoard) void board.setLang(lang);
});

window.addEventListener('keydown', (e) => {
  const tag = (e.target as HTMLElement).tagName;
  if (e.code !== 'Space' || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'CANVAS'].includes(tag)) return;
  if (document.querySelector('.tap-overlay:not([hidden])')) return;
  e.preventDefault();
  if (playback) stopPlayback();
  else if (store.current.notes.length) startPlayback(false);
});

document.documentElement.lang = getLang();
applyI18n();
$('browser-warning').hidden = isWebHidSupported() || isWebSerialSupported();
renderSettings();
renderInputs();
renderAll();
async function autoConnect() {
  if (board) return;
  const b =
    (isWebSerialSupported() ? await SerialBoard.reconnect() : null) ??
    (isWebHidSupported() ? await Board.reconnect() : null);
  if (b && !board) attachBoard(b);
}
void autoConnect();
if (isWebHidSupported()) navigator.hid.addEventListener('connect', () => void autoConnect());
if (isWebSerialSupported()) navigator.serial.addEventListener('connect', () => void autoConnect());
