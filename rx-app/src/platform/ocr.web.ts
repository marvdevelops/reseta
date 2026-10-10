// Web text reader: Tesseract.js running in the browser. Nothing leaves the device.
import Tesseract from 'tesseract.js';

export type OcrResult = { text: string; confidence: number; variants?: string[] };

export const ocrAvailable = true;
export const ocrName = 'Tesseract.js (in the browser)';

let worker: Promise<Tesseract.Worker> | null = null;

export async function readLine(uri: string, _hints: string[] = []): Promise<OcrResult | null> {
  worker ??= Tesseract.createWorker('eng');
  const w = await worker;
  const r = await w.recognize(uri);
  return { text: r.data.text.replace(/\s+/g, ' ').trim(), confidence: Math.round(r.data.confidence ?? 0) };
}
