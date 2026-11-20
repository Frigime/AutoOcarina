import { t } from '../i18n';
export async function decodeAudioFile(file: Blob): Promise<AudioBuffer> {
  const ctx = new AudioContext();
  try {
    return await ctx.decodeAudioData(await file.arrayBuffer());
  } catch {
    throw new Error(t('err.audio'));
  } finally {
    void ctx.close();
  }
}

export async function resampleMono(buffer: AudioBuffer, sampleRate: number): Promise<Float32Array> {
  const length = Math.ceil(buffer.duration * sampleRate);
  const ctx = new OfflineAudioContext(1, length, sampleRate);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(ctx.destination);
  src.start();
  const out = await ctx.startRendering();
  return out.getChannelData(0);
}

export async function resampleStereo(buffer: AudioBuffer, sampleRate: number): Promise<[Float32Array, Float32Array]> {
  const length = Math.ceil(buffer.duration * sampleRate);
  const ctx = new OfflineAudioContext(2, length, sampleRate);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(ctx.destination);
  src.start();
  const out = await ctx.startRendering();
  return [out.getChannelData(0), out.getChannelData(1)];
}

export function makeBuffer(channels: Float32Array[], sampleRate: number): AudioBuffer {
  const buf = new AudioBuffer({ numberOfChannels: channels.length, length: channels[0].length, sampleRate });
  channels.forEach((c, i) => buf.copyToChannel(c as Float32Array<ArrayBuffer>, i));
  return buf;
}
