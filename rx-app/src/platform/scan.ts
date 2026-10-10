// The iPhone document scanner (VisionKit): finds the paper's edges, straightens it and evens the light.
import ResetaVision from '../../modules/reseta-vision';

export type Scan = { uri: string; width: number; height: number };

export const scannerAvailable = (() => { try { return !!ResetaVision?.isScannerSupported(); } catch { return false; } })();

export async function scanDocument(): Promise<Scan | null> {
  return ResetaVision ? ResetaVision.scanDocument() : null;
}
