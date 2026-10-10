import { requireOptionalNativeModule } from 'expo-modules-core';

export type FoundLine = { text: string; confidence: number; box: { x: number; y: number; width: number; height: number }; crop: string };

type Native = {
  isScannerSupported(): boolean;
  memoryGB(): number;
  recognizeLine(uri: string, customWords: string[]): Promise<{ variants: string[]; confidence: number }>;
  scanDocument(): Promise<{ uri: string; width: number; height: number } | null>;
  straighten(uri: string): Promise<{ uri: string; width: number; height: number; straightened: boolean }>;
  findLines(uri: string): Promise<FoundLine[]>;
};

/** Null in Expo Go and on the web, where the native module is not built in. Builds made before a
 *  function was added lack it too, so callers check each function before using it. */
export default requireOptionalNativeModule<Native>('ResetaVision');
