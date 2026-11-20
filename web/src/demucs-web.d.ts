declare module 'demucs-web' {
  interface Stem {
    left: Float32Array;
    right: Float32Array;
  }
  export class DemucsProcessor {
    constructor(options: {
      ort: unknown;
      onProgress?: (p: { progress: number }) => void;
      sessionOptions?: Record<string, unknown>;
    });
    loadModel(model: ArrayBuffer | string): Promise<void>;
    separate(left: Float32Array, right: Float32Array): Promise<Record<'drums' | 'bass' | 'other' | 'vocals', Stem>>;
  }
}
