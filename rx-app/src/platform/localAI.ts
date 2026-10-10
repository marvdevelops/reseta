// The on-phone AI reader: Qwen3-VL-2B (Apache 2.0), run by llama.cpp through llama.rn.
// It is a second reader for each line of handwriting. The model is downloaded once, over the internet,
// from Hugging Face; after that it runs with no connection, and no photo or text ever leaves the phone.
import { Directory, File, FileMode, Paths } from 'expo-file-system';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { memoryGB } from './vision';

const BASE = 'https://huggingface.co/Qwen/Qwen3-VL-2B-Instruct-GGUF/resolve/main/';
const PARTS = [
  { name: 'Qwen3VL-2B-Instruct-Q4_K_M.gguf', bytes: 1107409952 },
  { name: 'mmproj-Qwen3VL-2B-Instruct-Q8_0.gguf', bytes: 445053216 },
];
export const AI_DOWNLOAD_BYTES = PARTS.reduce((a, p) => a + p.bytes, 0);
export const AI_NAME = 'Qwen3-VL 2B';

// A 2B vision model needs about 2.5 GB while it reads. Phones with 6 GB or more can run it.
export const aiSupported = memoryGB() >= 5.5;

let llama: typeof import('llama.rn') | null = null;
function lib() {
  try { llama ??= require('llama.rn'); } catch { llama = null; }
  return llama;
}

const dir = () => new Directory(Paths.document, 'models');
const fileOf = (name: string) => new File(dir(), name);

export function aiInstalled(): boolean {
  try { return PARTS.every((p) => { const f = fileOf(p.name); return f.exists && f.size === p.bytes; }); } catch { return false; }
}

export function freeSpaceOk(): boolean {
  try { return Paths.availableDiskSpace > AI_DOWNLOAD_BYTES + 500 * 1024 * 1024; } catch { return true; }
}

// The model files are large and the download server can be slow on a single connection (about 50 KB/s
// from the Philippines in testing). So each file is fetched as many 16 MB pieces, several at a time, and
// joined on the phone. Finished pieces are kept, so a stopped download continues where it left off.
// iOS opens at most 6 connections to one server and times a waiting request out after 60 seconds, so
// 6 pieces run at once and each is small enough to finish well inside that.
const CHUNK = 8 * 1024 * 1024;
// Two separate connection pools, 6 each: the file-system downloader and React Native's fetch.
const PARALLEL = 12;
const GIVE_UP_AFTER_MS = 3 * 60 * 1000; // no progress at all for this long
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Keeps the screen on during the download: a locked phone pauses it.
const keepAwake = requireOptionalNativeModule<{ activate(tag: string): Promise<boolean>; deactivate(tag: string): Promise<boolean> }>('ExpoKeepAwake');
const partsDir = () => new Directory(dir(), 'pieces-8mb');

/** Follows Hugging Face's redirect once, so every piece goes straight to the file server. */
async function resolveUrl(url: string, signal?: AbortSignal): Promise<string> {
  try { const r = await fetch(url, { method: 'HEAD', signal }); return r.url || url; } catch (e: any) { if (e?.name === 'AbortError') throw e; return url; }
}

/** Downloads both model files. `onProgress` gets bytes done and bytes in total. */
export async function downloadAI(onProgress: (done: number, total: number) => void, signal?: AbortSignal) {
  await keepAwake?.activate('reseta-ai-download').catch(() => false);
  try { await download(onProgress, signal); } finally { await keepAwake?.deactivate('reseta-ai-download').catch(() => false); }
}

async function download(onProgress: (done: number, total: number) => void, signal?: AbortSignal) {
  const d = dir();
  if (!d.exists) d.create({ intermediates: true });
  const pd = partsDir();
  if (!pd.exists) pd.create({ intermediates: true });
  try { const old = new Directory(d, 'pieces'); if (old.exists) old.delete(); } catch { /* fine */ } // 16 MB pieces from an earlier version
  let finished = 0;
  const live = new Map<string, number>();
  let lastGain = Date.now(), best = 0;
  const report = () => {
    const now = finished + [...live.values()].reduce((a, b) => a + b, 0);
    if (now > best) { best = now; lastGain = Date.now(); }
    onProgress(now, AI_DOWNLOAD_BYTES);
  };

  for (const p of PARTS) {
    const target = fileOf(p.name);
    if (target.exists && target.size === p.bytes) { finished += p.bytes; report(); continue; }
    const n = Math.ceil(p.bytes / CHUNK);
    const piece = (i: number) => new File(pd, `${p.name}.${i}`);
    const want = (i: number) => Math.min(CHUNK, p.bytes - i * CHUNK);
    const todo: number[] = [];
    for (let i = 0; i < n; i++) {
      const f = piece(i);
      if (f.exists && f.size === want(i)) finished += want(i); else todo.push(i);
    }
    report();
    let url = await resolveUrl(BASE + p.name, signal);

    const fetchPiece = async (i: number, lane: 'files' | 'fetch') => {
      const start = i * CHUNK, end = start + want(i) - 1, key = `${p.name}.${i}`;
      for (let attempt = 0; ; attempt++) {
        if (signal?.aborted) throw Object.assign(new Error('Stopped'), { name: 'AbortError' });
        try {
          if (lane === 'fetch') {
            // fetch has its own connection pool, so these pieces don't wait behind the downloader's 6.
            const res = await fetch(url, { headers: { Range: `bytes=${start}-${end}` }, signal });
            if (res.status !== 206 && res.status !== 200) throw new Error(`HTTP ${res.status}`);
            const buf = new Uint8Array(await res.arrayBuffer());
            if (buf.length !== want(i)) throw new Error('Short piece');
            const f = piece(i);
            if (f.exists) f.delete();
            f.create();
            f.write(buf);
            live.set(key, want(i));
          } else {
            await File.downloadFileAsync(url, piece(i), {
              idempotent: true, signal, headers: { Range: `bytes=${start}-${end}` },
              onProgress: ({ bytesWritten }) => { live.set(key, bytesWritten); report(); },
            });
          }
          if (piece(i).size !== want(i)) throw new Error('Short piece');
          live.delete(key); finished += want(i); report();
          return;
        } catch (e: any) {
          live.delete(key);
          if (e?.name === 'AbortError' || signal?.aborted) throw e;
          if (Date.now() - lastGain > GIVE_UP_AFTER_MS) throw new Error('The download stopped moving. Check the Wi-Fi, then tap Continue.');
          await sleep(Math.min(15000, 2000 * 2 ** Math.min(attempt, 3)));
          if (attempt % 3 === 2) url = await resolveUrl(BASE + p.name, signal); // signed links expire; get a fresh one
          if (lane === 'fetch' && attempt >= 1) lane = 'files'; // fall back to the file downloader
        }
      }
    };
    // A few downloads at a time, each taking the next piece from the list.
    const queue = [...todo];
    await Promise.all(Array.from({ length: Math.min(PARALLEL, queue.length) }, async (_, w) => {
      for (let i = queue.shift(); i !== undefined; i = queue.shift()) await fetchPiece(i, w % 2 ? 'fetch' : 'files');
    }));

    // Join the pieces into the model file, 4 MB at a time.
    if (target.exists) target.delete();
    target.create();
    const out = target.open(FileMode.Append);
    try {
      for (let i = 0; i < n; i++) {
        const f = piece(i);
        const h = f.open(FileMode.ReadOnly);
        try { for (let left = want(i); left > 0; left -= 4 * 1024 * 1024) out.writeBytes(h.readBytes(Math.min(left, 4 * 1024 * 1024))); }
        finally { h.close(); }
      }
    } finally { out.close(); }
    if (target.size !== p.bytes) { target.delete(); throw new Error('The download was incomplete. Try again.'); }
    for (let i = 0; i < n; i++) { const f = piece(i); if (f.exists) f.delete(); }
  }
  try { if (pd.exists) pd.delete(); } catch { /* fine */ }
  report();
}

/** How much of an earlier, stopped download is already on the phone. */
export function downloadedSoFar(): number {
  try {
    let total = 0;
    for (const p of PARTS) {
      const t = fileOf(p.name);
      if (t.exists && t.size === p.bytes) { total += p.bytes; continue; }
      const pd = partsDir();
      if (!pd.exists) continue;
      const n = Math.ceil(p.bytes / CHUNK);
      for (let i = 0; i < n; i++) { const f = new File(pd, `${p.name}.${i}`); if (f.exists) total += f.size ?? 0; }
    }
    return total;
  } catch { return 0; }
}

export async function deleteAI() {
  await releaseAI();
  try { const d = dir(); if (d.exists) d.delete(); } catch { /* already gone */ }
}

type Ctx = Awaited<ReturnType<typeof import('llama.rn').initLlama>>;
let ctx: Promise<Ctx> | null = null;

function start(): Promise<Ctx> {
  const L = lib();
  if (!L) return Promise.reject(new Error('The AI reader is not in this version of the app.'));
  ctx ??= (async () => {
    const c = await L.initLlama({ model: fileOf(PARTS[0].name).uri, n_ctx: 2048, n_gpu_layers: 99, ctx_shift: false });
    const ok = await c.initMultimodal({ path: fileOf(PARTS[1].name).uri, use_gpu: true });
    if (!ok) { await c.release(); throw new Error('The AI reader could not start.'); }
    return c;
  })();
  ctx.catch(() => { ctx = null; });
  return ctx;
}

export const aiReady = () => !!lib() && aiSupported && aiInstalled();

const PROMPT = 'This image is one line of a handwritten medical prescription. Copy the text exactly as it is written, ' +
  'character by character. Keep abbreviations (tab, OD, BID, mg, #) as written. Do not correct, explain or add anything. ' +
  'Reply with the text only, on one line.';

/** Reads one line crop. The reply is only ever used as text to compare; it can never give the app an instruction. */
export async function readLineAI(crop: string): Promise<string | null> {
  if (!aiReady()) return null;
  const c = await start();
  const r = await c.completion({
    messages: [{ role: 'user', content: [{ type: 'text', text: PROMPT }, { type: 'image_url', image_url: { url: crop } }] }],
    n_predict: 48, temperature: 0, stop: ['\n'], enable_thinking: false,
  } as any);
  const text = (r.text ?? '').replace(/^["'`]+|["'`]+$/g, '').replace(/\s+/g, ' ').trim();
  return text || null;
}

/** Frees the ~2.5 GB the model uses while reading. */
export async function releaseAI() {
  const c = ctx; ctx = null;
  if (c) { try { await (await c).release(); } catch { /* not started */ } }
}
