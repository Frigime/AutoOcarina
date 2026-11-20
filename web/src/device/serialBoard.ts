import { crc32 } from '../core/pack';
import { t, type Lang } from '../i18n';
import type { PadResult, PadState } from '../ui/virtualPad';

const FILTERS = [{ usbVendorId: 0x1a86 }, { usbVendorId: 0x10c4 }, { usbVendorId: 0x0403 }, { usbVendorId: 0x303a }];
const BAUD = 921600;
const CHUNK = 384;

export type BtState = 0 | 1 | 2 | 3;

export function isWebSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator;
}

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export class BoardError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

export class SerialBoard {
  readonly kind = 'bluetooth' as const;
  bt: BtState = 0;
  version = 1;
  playing = -1;
  songs = 0;
  onDisconnect: (() => void) | null = null;
  private listeners = new Set<() => void>();
  private waiting: ((line: string) => void) | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private closed = false;

  private constructor(private port: SerialPort) {}

  static async request(): Promise<SerialBoard | null> {
    const port = await navigator.serial.requestPort({ filters: FILTERS });
    return SerialBoard.open(port);
  }

  static async reconnect(): Promise<SerialBoard | null> {
    for (const port of await navigator.serial.getPorts()) {
      try {
        return await SerialBoard.open(port);
      } catch {
      }
    }
    return null;
  }

  private static async open(port: SerialPort): Promise<SerialBoard> {
    try {
      await port.open({ baudRate: BAUD, bufferSize: 16384 });
    } catch {
      throw new Error(t('serial.open'));
    }
    await port.setSignals({ dataTerminalReady: false, requestToSend: false }).catch(() => {});
    const board = new SerialBoard(port);
    board.readLoop();
    board.writer = port.writable!.getWriter();
    try {
      let hello = '';
      for (let i = 0; i < 6 && !/(autoocarina|ocarina-bot)-esp32/.test(hello); i++) {
        hello = await board.command('HELLO', 800).catch(() => '');
      }
      if (!/(autoocarina|ocarina-bot)-esp32/.test(hello)) throw new Error();
      board.version = Number(hello.match(/(?:autoocarina|ocarina-bot)-esp32 (\d+)/)?.[1] ?? 1);
      await board.command('STATUS');
    } catch {
      await board.close();
      throw new Error(t('serial.noAnswer'));
    }
    port.addEventListener('disconnect', () => {
      board.closed = true;
      board.onDisconnect?.();
    });
    return board;
  }

  get name(): string {
    return 'ESP32 Bluetooth';
  }

  onChange(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  isPlaying(): boolean {
    return this.playing >= 0;
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }

  private async readLoop() {
    const decoder = new TextDecoder();
    let pending = '';
    while (this.port.readable && !this.closed) {
      const reader = this.port.readable.getReader();
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          pending += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = pending.indexOf('\n')) >= 0) {
            this.onLine(pending.slice(0, nl).trim());
            pending = pending.slice(nl + 1);
          }
        }
      } catch {
      } finally {
        reader.releaseLock();
      }
    }
  }

  private onLine(line: string) {
    if (line.startsWith('ST ')) {
      const get = (k: string) => Number(line.match(new RegExp(`${k}=(-?\\d+)`))?.[1] ?? 0);
      this.bt = get('bt') as BtState;
      this.playing = get('play');
      this.songs = get('songs');
      this.emit();
    } else if (line.startsWith('OK') || line.startsWith('ERR')) {
      const w = this.waiting;
      this.waiting = null;
      w?.(line);
    }
  }

  private command(line: string, timeoutMs = 3000): Promise<string> {
    const run = async () => {
      const answer = new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => {
          this.waiting = null;
          reject(new BoardError(t('serial.timeout'), 'timeout'));
        }, timeoutMs);
        this.waiting = (l) => {
          clearTimeout(timer);
          resolve(l);
        };
      });
      await this.writer!.write(new TextEncoder().encode(line + '\n'));
      const res = await answer;
      if (res.startsWith('ERR')) throw new BoardError(SerialBoard.explain(res), res.slice(4).split(' ')[0]);
      return res;
    };
    const p = this.queue.then(run, run);
    this.queue = p.catch(() => {});
    return p;
  }

  private static explain(err: string): string {
    if (err.includes('bluetooth')) return t('serial.bt');
    if (err.includes('crc')) return t('serial.crc');
    if (err.includes('taille')) return t('serial.size');
    if (err.includes('occupe')) return t('serial.busy');
    return t('serial.other', { what: err.slice(4) });
  }

  async upload(bank: Uint8Array, onProgress: (p: number) => void): Promise<void> {
    await this.command(`BEGIN ${bank.length}`, 8000);
    for (let o = 0; o < bank.length; o += CHUNK) {
      await this.command(`DATA ${o} ${toBase64(bank.subarray(o, o + CHUNK))}`);
      onProgress(Math.min(1, (o + CHUNK) / bank.length));
    }
    await this.command(`COMMIT ${crc32(bank).toString(16)}`, 8000);
    await this.command('STATUS');
  }

  play(index = -1) {
    return this.command(`PLAY ${index}`).then(() => {});
  }
  stop() {
    return this.command('STOP').then(() => {});
  }
  select(index: number) {
    return this.command(`SELECT ${index}`).then(() => {});
  }
  erase() {
    return this.command('ERASE').then(() => {});
  }
  tap(buttons: number, hat = 8, ly = 128, ms = 150) {
    return this.command(`TAP ${buttons.toString(16)} ${hat} ${ly} ${ms}`).then(() => {});
  }
  unpair() {
    return this.command('UNPAIR', 8000).then(() => {});
  }
  reconnectSwitch() {
    return this.command('RECONNECT', 8000).then(() => {});
  }
  pair() {
    return this.command('PAIR', 8000).then(() => {});
  }
  pad(s: PadState): Promise<PadResult> {
    const line = `PAD ${s.buttons.toString(16)} ${s.hat} ${s.lx} ${s.ly} ${s.rx} ${s.ry}`;
    return this.command(line, 1500).then(
      () => 'ok' as const,
      (e) => (e instanceof BoardError && e.code === 'bluetooth' ? 'bluetooth' : e instanceof BoardError && e.code === 'occupe' ? 'busy' : 'error'),
    );
  }
  setLang(lang: Lang) {
    if (this.version < 2) return Promise.resolve();
    return this.command(`LANG ${lang}`).then(
      () => {},
      () => {},
    );
  }

  async close() {
    this.closed = true;
    try {
      this.writer?.releaseLock();
      await this.port.close();
    } catch {
    }
  }
}
