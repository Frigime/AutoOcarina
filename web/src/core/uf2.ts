const MAGIC0 = 0x0a324655;
const MAGIC1 = 0x9e5d5157;
const MAGIC_END = 0x0ab16f30;
const FLAG_FAMILY = 0x00002000;
const RP2040_FAMILY = 0xe48bff56;
const PAYLOAD = 256;

export function toUf2(data: Uint8Array, address: number): Uint8Array {
  const blocks = Math.ceil(data.length / PAYLOAD);
  const out = new Uint8Array(blocks * 512);
  const view = new DataView(out.buffer);
  for (let i = 0; i < blocks; i++) {
    const o = i * 512;
    view.setUint32(o, MAGIC0, true);
    view.setUint32(o + 4, MAGIC1, true);
    view.setUint32(o + 8, FLAG_FAMILY, true);
    view.setUint32(o + 12, address + i * PAYLOAD, true);
    view.setUint32(o + 16, PAYLOAD, true);
    view.setUint32(o + 20, i, true);
    view.setUint32(o + 24, blocks, true);
    view.setUint32(o + 28, RP2040_FAMILY, true);
    out.set(data.subarray(i * PAYLOAD, (i + 1) * PAYLOAD), o + 32);
    view.setUint32(o + 508, MAGIC_END, true);
  }
  return out;
}
