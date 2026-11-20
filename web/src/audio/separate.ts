import { t } from '../i18n';
import { makeBuffer, resampleStereo } from './decode';
import { loadModelFile } from './models';

const LOCAL_MODEL = `${import.meta.env.BASE_URL}models/demucs/htdemucs_embedded.onnx`;
const REMOTE_MODEL = 'https://huggingface.co/timcsy/demucs-web-onnx/resolve/main/htdemucs_embedded.onnx';
const SAMPLE_RATE = 44100;

export interface Stems {
  vocals: AudioBuffer;
  other: AudioBuffer;
}

function loadModel(onDownload: (loaded: number, total: number) => void): Promise<ArrayBuffer> {
  return loadModelFile(LOCAL_MODEL, REMOTE_MODEL, 172_000_000, onDownload);
}

type Processor = InstanceType<(typeof import('demucs-web'))['DemucsProcessor']>;
let processorPromise: Promise<Processor> | null = null;
let reportProgress: (progress: number) => void = () => {};

function getProcessor(onStep: (label: string, progress: number) => void): Promise<Processor> {
  processorPromise ??= (async () => {
    const [ort, { DemucsProcessor }] = await Promise.all([import('onnxruntime-web'), import('demucs-web')]);
    const model = await loadModel((l, total) =>
      onStep(t('step.download', { done: Math.round(l / 1e6), total: Math.round(total / 1e6) }), l / total),
    );
    onStep(t('step.prepare'), 0);
    const processor = new DemucsProcessor({
      ort,
      onProgress: ({ progress }: { progress: number }) => reportProgress(progress),
      sessionOptions: { executionProviders: ['webgpu', 'wasm'] },
    });
    await processor.loadModel(model);
    return processor;
  })().catch((e) => {
    processorPromise = null;
    throw e;
  });
  return processorPromise;
}

export async function separateStems(
  buffer: AudioBuffer,
  onStep: (label: string, progress: number) => void,
): Promise<Stems> {
  const processor = await getProcessor(onStep);
  reportProgress = (p) => onStep(t('step.separate'), p);
  const [left, right] = await resampleStereo(buffer, SAMPLE_RATE);
  const result = await processor.separate(left, right);
  return {
    vocals: makeBuffer([result.vocals.left, result.vocals.right], SAMPLE_RATE),
    other: makeBuffer([result.other.left, result.other.right], SAMPLE_RATE),
  };
}

export function energy(buffer: AudioBuffer): number {
  const d = buffer.getChannelData(0);
  let s = 0;
  for (let i = 0; i < d.length; i += 16) s += d[i] * d[i];
  return s / (d.length / 16);
}
