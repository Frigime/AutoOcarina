import { afterEach, describe, expect, it, vi } from 'vitest';
import { crc32, decodeBank, encodeBank } from '../core/pack';
import { SerialBoard } from './serialBoard';

function fakePort() {
  const sent: string[] = [];
  let flash = new Uint8Array(0);
  let push: (line: string) => void = () => {};
  const readable = new ReadableStream<Uint8Array>({
    start(controller) {
      push = (line) => controller.enqueue(new TextEncoder().encode(line + '\r\n'));
    },
  });
  let pending = '';
  const writable = new WritableStream<Uint8Array>({
    write(chunk) {
      pending += new TextDecoder().decode(chunk);
      let nl: number;
      while ((nl = pending.indexOf('\n')) >= 0) {
        const line = pending.slice(0, nl);
        pending = pending.slice(nl + 1);
        sent.push(line);
        const [cmd, ...args] = line.split(' ');
        push('INFO un journal à ignorer');
        if (cmd === 'HELLO') push('OK autoocarina-esp32 2');
        else if (cmd === 'STATUS') {
          push('ST bt=3 play=-1 sel=0 songs=0');
          push('OK');
        } else if (cmd === 'BEGIN') {
          flash = new Uint8Array(Number(args[0]));
          push('OK');
        } else if (cmd === 'DATA') {
          const bytes = Uint8Array.from(atob(args[1]), (c) => c.charCodeAt(0));
          flash.set(bytes, Number(args[0]));
          push('OK');
        } else if (cmd === 'COMMIT') push(parseInt(args[0], 16) === crc32(flash) ? 'OK 1' : 'ERR crc');
        else if (cmd === 'PLAY') push('ERR bluetooth');
        else if (cmd === 'PAD') push(args[0] === '1' ? 'ERR occupe' : 'OK');
        else push('OK');
      }
    },
  });
  const port = {
    readable,
    writable,
    open: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
    setSignals: vi.fn(async () => {}),
    addEventListener: vi.fn(),
  };
  return { port, sent, flash: () => flash };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SerialBoard (ESP32)', () => {
  it('se connecte, envoie une banque et relaie les erreurs', async () => {
    const fake = fakePort();
    vi.stubGlobal('navigator', { serial: { requestPort: async () => fake.port, getPorts: async () => [] } });

    const board = (await SerialBoard.request())!;
    expect(board.bt).toBe(3);
    expect(fake.port.setSignals).toHaveBeenCalledWith({ dataTerminalReady: false, requestToSend: false });

    const bank = encodeBank([
      {
        name: 'Long morceau',
        events: Array.from({ length: 400 }, (_, i) => ({ t: i * 100, buttons: i % 2 ? 4 : 0, hat: 8, ly: 128 })),
      },
    ]);
    const progress: number[] = [];
    await board.upload(bank, (p) => progress.push(p));
    expect(fake.flash()).toEqual(bank);
    expect(decodeBank(fake.flash())[0].name).toBe('Long morceau');
    expect(progress[progress.length - 1]).toBe(1);
    expect(fake.sent.filter((l) => l.startsWith('DATA')).length).toBe(Math.ceil(bank.length / 384));

    await expect(board.play(0)).rejects.toThrow(/Switch/);
    await board.tap(0x30, 8, 128, 300);
    expect(fake.sent[fake.sent.length - 1]).toBe('TAP 30 8 128 300');

    expect(board.version).toBe(2);
    expect(await board.pad({ buttons: 0x1004, hat: 2, lx: 0, ly: 128, rx: 255, ry: 128 })).toBe('ok');
    expect(fake.sent[fake.sent.length - 1]).toBe('PAD 1004 2 0 128 255 128');
    expect(await board.pad({ buttons: 1, hat: 8, lx: 128, ly: 128, rx: 128, ry: 128 })).toBe('busy');
    await board.setLang('en');
    expect(fake.sent[fake.sent.length - 1]).toBe('LANG en');
  });
});
