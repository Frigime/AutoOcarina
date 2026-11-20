const CACHE_NAME = 'ocarina-bot-models';

async function fetchWithProgress(url: string, expectedSize: number, onProgress: (loaded: number, total: number) => void) {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  const total = Number(res.headers.get('Content-Length')) || expectedSize;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    onProgress(loaded, total);
  }
  const out = new Uint8Array(loaded);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out.buffer;
}

export async function loadModelFile(
  localUrl: string,
  remoteUrl: string,
  expectedSize: number,
  onDownload: (loaded: number, total: number) => void,
): Promise<ArrayBuffer> {
  try {
    const head = await fetch(localUrl, { method: 'HEAD' });
    if (head.ok && (head.headers.get('Content-Type') ?? '').indexOf('html') < 0) {
      return await fetchWithProgress(localUrl, expectedSize, onDownload);
    }
  } catch {
  }
  let cache: Cache | null = null;
  try {
    cache = await caches.open(CACHE_NAME);
    const hit = await cache.match(remoteUrl);
    if (hit) return await hit.arrayBuffer();
  } catch {
    cache = null;
  }
  const data = await fetchWithProgress(remoteUrl, expectedSize, onDownload);
  try {
    await cache?.put(remoteUrl, new Response(data.slice(0)));
  } catch {
  }
  return data;
}
