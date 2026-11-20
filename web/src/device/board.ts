import { t, type Key } from '../i18n';
import { crc32 } from '../core/pack';

const FILTER = { vendorId: 0x0f0d, productId: 0x0092 };

const CMD = { HELLO: 1, BEGIN: 2, DATA: 3, COMMIT: 4, PLAY: 5, STOP: 6, SELECT: 7, BOOTSEL: 8, ERASE: 9 };

export const STATUS = {
  NONE: 0x00,
  READY: 0x11,
  RECEIVING: 0x20,
  WRITING: 0x30,
  SAVED: 0x40,
  PLAYING: 0x60,
};

const ERRORS: Record<number, Key> = {
  0x51: 'board.lost',
  0x52: 'board.tooBig',
  0x53: 'board.crc',
  0x54: 'board.invalid',
  0x55: 'board.flash',
};

export function isWebHidSupported(): boolean {
  return typeof navigator !== 'undefined' && 'hid' in navigator;
}

export class Board {
  readonly kind = 'usb' as const;
  private status = STATUS.NONE;
  private listeners = new Set<(s: number) => void>();
  onDisconnect: (() => void) | null = null;
  onPad: ((pad: { buttons: number; hat: number; ly: number }) => void) | null = null;

  private constructor(private device: HIDDevice) {
    device.addEventListener('inputreport', (e) => {
      this.onPad?.({ buttons: e.data.getUint16(0, true), hat: e.data.getUint8(2) & 0x0f, ly: e.data.getUint8(4) });
      const s = e.data.getUint8(7);
      if (s !== this.status) {
        this.status = s;
        this.listeners.forEach((l) => l(s));
      }
    });
    navigator.hid.addEventListener('disconnect', (e) => {
      if (e.device === this.device) this.onDisconnect?.();
    });
  }

  static async request(): Promise<Board | null> {
    const [device] = await navigator.hid.requestDevice({ filters: [FILTER] });
    return device ? Board.open(device) : null;
  }

  static async reconnect(): Promise<Board | null> {
    const devices = await navigator.hid.getDevices();
    const device = devices.find((d) => d.vendorId === FILTER.vendorId && d.productId === FILTER.productId);
    if (!device) return null;
    try {
      return await Board.open(device);
    } catch {
      return null;
    }
  }

  private static async open(device: HIDDevice): Promise<Board> {
    if (!device.opened) await device.open();
    const board = new Board(device);
    await board.send(CMD.HELLO, [0x4f, 0x43, 0x41]);
    try {
      await board.waitFor((s) => s === STATUS.READY || (s & 0xf0) === 0x60, 1500);
    } catch {
      await device.close();
      throw new Error(t('board.noAnswer'));
    }
    return board;
  }

  get name(): string {
    return this.device.productName;
  }

  get currentStatus(): number {
    return this.status;
  }

  onStatus(cb: (s: number) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  onChange(cb: () => void): () => void {
    return this.onStatus(() => cb());
  }

  isPlaying(): boolean {
    return this.status === STATUS.PLAYING;
  }

  private async send(cmd: number, payload: number[] | Uint8Array = []): Promise<void> {
    const msg = new Uint8Array(8);
    msg[0] = cmd;
    msg.set(payload.slice(0, 7), 1);
    await this.device.sendReport(0, msg);
  }

  private waitFor(pred: (s: number) => boolean, timeoutMs: number): Promise<number> {
    return new Promise((resolve, reject) => {
      if (pred(this.status)) return resolve(this.status);
      const timer = setTimeout(() => {
        off();
        reject(new Error('timeout'));
      }, timeoutMs);
      const off = this.onStatus((s) => {
        if (pred(s)) {
          clearTimeout(timer);
          off();
          resolve(s);
        }
      });
    });
  }

  private static check(status: number) {
    if ((status & 0xf0) === 0x50) throw new Error(t('board.error', { what: ERRORS[status] ? t(ERRORS[status]) : `0x${status.toString(16)}` }));
  }

  async upload(bank: Uint8Array, onProgress: (p: number) => void): Promise<void> {
    const size = new Uint8Array(new Uint32Array([bank.length]).buffer);
    await this.send(CMD.BEGIN, size);
    Board.check(await this.waitFor((s) => s === STATUS.RECEIVING || (s & 0xf0) === 0x50, 2000));

    const packets = Math.ceil(bank.length / 6);
    for (let i = 0; i < packets; i++) {
      const chunk = bank.subarray(i * 6, i * 6 + 6);
      await this.send(CMD.DATA, [i & 0xff, ...chunk]);
      if ((this.status & 0xf0) === 0x50) Board.check(this.status);
      if (i % 64 === 0) onProgress(i / packets);
    }
    onProgress(1);

    const crc = new Uint8Array(new Uint32Array([crc32(bank)]).buffer);
    await this.send(CMD.COMMIT, crc);
    Board.check(await this.waitFor((s) => s === STATUS.SAVED || (s & 0xf0) === 0x50, 15000));
  }

  play(index = 0xff) {
    return this.send(CMD.PLAY, [index]);
  }
  stop() {
    return this.send(CMD.STOP);
  }
  select(index: number) {
    return this.send(CMD.SELECT, [index]);
  }
  rebootToBootloader() {
    return this.send(CMD.BOOTSEL);
  }
  async erase() {
    await this.send(CMD.ERASE);
    await this.waitFor((s) => s === STATUS.SAVED, 3000);
  }
}
