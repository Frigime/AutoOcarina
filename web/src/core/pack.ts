import { t } from '../i18n';
import type { PadEvent } from './compile';

export const BANK_FLASH_ADDRESS = 0x101c0000;
export const BANK_MAX_SIZE = 128 * 1024;
export const BANK_MAX_SONGS = 16;
const HEADER = 16;
const NAME = 24;
const EVENT = 6;

let crcTable: Uint32Array | null = null;

export function crc32(data: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[i] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const b of data) crc = crcTable[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export interface BankSong {
  name: string;
  events: PadEvent[];
}

export function bankSize(songs: { events: PadEvent[] }[]): number {
  return songs.reduce((s, song) => s + NAME + eventCount(song.events) * EVENT, HEADER + 8 * songs.length);
}

function eventCount(events: PadEvent[]): number {
  let n = 0;
  let t = 0;
  for (const e of events) {
    const delta = Math.max(0, Math.round(e.t - t));
    n += Math.max(1, Math.ceil(delta / 65535));
    t = e.t;
  }
  return n;
}

export function encodeBank(songs: BankSong[]): Uint8Array {
  if (songs.length > BANK_MAX_SONGS) throw new Error(t('err.bankSongs', { n: BANK_MAX_SONGS }));
  const total = bankSize(songs);
  if (total > BANK_MAX_SIZE)
    throw new Error(t('err.bankSize', { size: Math.ceil(total / 1024), max: BANK_MAX_SIZE / 1024 }));

  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  out.set([0x4f, 0x43, 0x41, 0x52], 0);
  out[4] = 1;
  out[5] = songs.length;
  view.setUint32(8, total, true);

  let offset = HEADER + 8 * songs.length;
  songs.forEach((song, i) => {
    const name = new TextEncoder().encode(song.name).slice(0, NAME - 1);
    out.set(name, offset);

    let p = offset + NAME;
    let t = 0;
    let n = 0;
    const prevState = { buttons: 0, hat: 8, ly: 128 };
    for (const e of song.events) {
      let delta = Math.max(0, Math.round(e.t - t));
      while (delta > 65535) {
        view.setUint16(p, 65535, true);
        view.setUint16(p + 2, prevState.buttons, true);
        out[p + 4] = prevState.hat;
        out[p + 5] = prevState.ly;
        p += EVENT;
        n++;
        delta -= 65535;
      }
      view.setUint16(p, delta, true);
      view.setUint16(p + 2, e.buttons, true);
      out[p + 4] = e.hat;
      out[p + 5] = e.ly;
      p += EVENT;
      n++;
      t = e.t;
      Object.assign(prevState, { buttons: e.buttons, hat: e.hat, ly: e.ly });
    }

    view.setUint32(HEADER + 8 * i, offset, true);
    view.setUint32(HEADER + 8 * i + 4, n, true);
    offset = p;
  });

  view.setUint32(12, crc32(out.subarray(HEADER)), true);
  return out;
}

export function decodeBank(data: Uint8Array): BankSong[] {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (String.fromCharCode(...data.subarray(0, 4)) !== 'OCAR') throw new Error('Pas une banque AutoOcarina');
  const total = view.getUint32(8, true);
  if (crc32(data.subarray(HEADER, total)) !== view.getUint32(12, true)) throw new Error('CRC incorrect');
  const songs: BankSong[] = [];
  for (let i = 0; i < data[5]; i++) {
    const offset = view.getUint32(HEADER + 8 * i, true);
    const count = view.getUint32(HEADER + 8 * i + 4, true);
    const nameBytes = data.subarray(offset, offset + NAME);
    const name = new TextDecoder().decode(nameBytes.subarray(0, nameBytes.indexOf(0) < 0 ? NAME : nameBytes.indexOf(0)));
    const events: PadEvent[] = [];
    let t = 0;
    for (let k = 0; k < count; k++) {
      const p = offset + NAME + k * EVENT;
      t += view.getUint16(p, true);
      events.push({ t, buttons: view.getUint16(p + 2, true), hat: data[p + 4], ly: data[p + 5] });
    }
    songs.push({ name, events });
  }
  return songs;
}
