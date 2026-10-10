export type FoundLine = { text: string; confidence: number; box: { x: number; y: number; width: number; height: number }; crop: string };
export type Page = { uri: string; width: number; height: number };
export const pageToolsAvailable = false;
export async function straighten(p: Page): Promise<Page & { straightened: boolean }> { return { ...p, straightened: false }; }
export async function findLines(_uri: string): Promise<FoundLine[]> { return []; }
export function memoryGB(): number { return 0; }
