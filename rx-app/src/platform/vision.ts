// Apple Vision page tools: straighten a photo of the paper and find each line of writing.
import ResetaVision, { type FoundLine } from '../../modules/reseta-vision';

export type { FoundLine };
export type Page = { uri: string; width: number; height: number };

export const pageToolsAvailable = !!(ResetaVision && typeof ResetaVision.findLines === 'function');

export async function straighten(p: Page): Promise<Page & { straightened: boolean }> {
  if (!ResetaVision || typeof ResetaVision.straighten !== 'function') return { ...p, straightened: false };
  return ResetaVision.straighten(p.uri);
}

export async function findLines(uri: string): Promise<FoundLine[]> {
  if (!pageToolsAvailable) return [];
  return ResetaVision!.findLines(uri);
}

export function memoryGB(): number {
  try { return ResetaVision && typeof ResetaVision.memoryGB === 'function' ? ResetaVision.memoryGB() : 0; } catch { return 0; }
}
