export type Scan = { uri: string; width: number; height: number };
export const scannerAvailable = false;
export async function scanDocument(): Promise<Scan | null> { return null; }
