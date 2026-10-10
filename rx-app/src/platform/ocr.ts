// Native text reader: Apple Vision through the app's own ResetaVision module (a development build).
// In Expo Go the module is missing, so the reader reports itself unavailable and the user types each line.
import ResetaVision from '../../modules/reseta-vision';

export type OcrResult = { text: string; confidence: number; variants?: string[] };

export const ocrAvailable = !!ResetaVision;
export const ocrName = ResetaVision ? 'Apple Vision, on this phone' : 'not in Expo Go (type each line)';

/** Reads one line crop. `hints` are the medicine names Vision should expect. */
export async function readLine(uri: string, hints: string[] = []): Promise<OcrResult | null> {
  if (!ResetaVision) return null;
  const r = await ResetaVision.recognizeLine(uri, hints);
  return { text: r.variants[0] ?? '', confidence: Math.round(r.confidence * 100), variants: r.variants };
}
