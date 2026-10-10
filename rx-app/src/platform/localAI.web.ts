export const AI_DOWNLOAD_BYTES = 0;
export const AI_NAME = 'Qwen3-VL 2B';
export const aiSupported = false;
export const aiInstalled = () => false;
export const freeSpaceOk = () => false;
export const aiReady = () => false;
export async function downloadAI(_p: (done: number, total: number) => void, _s?: AbortSignal) {}
export const downloadedSoFar = () => 0;
export async function deleteAI() {}
export async function readLineAI(_crop: string): Promise<string | null> { return null; }
export async function releaseAI() {}
