import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

export type Rect = { x: number; y: number; width: number; height: number };

/** Crops one line out of the photo (pixel coordinates) and returns it as a portable data URI. */
export async function cropLine(uri: string, r: Rect): Promise<string> {
  const ctx = ImageManipulator.manipulate(uri).crop({
    originX: Math.max(0, Math.round(r.x)), originY: Math.max(0, Math.round(r.y)),
    width: Math.max(1, Math.round(r.width)), height: Math.max(1, Math.round(r.height)),
  });
  const img = await ctx.renderAsync();
  const out = await img.saveAsync({ base64: true, compress: 0.85, format: SaveFormat.JPEG });
  return `data:image/jpeg;base64,${out.base64}`;
}

/** Shrinks a photo to at most `max` px on its long side, so storage and reading stay fast. */
export async function downscale(uri: string, width: number, height: number, max = 1600): Promise<{ uri: string; width: number; height: number }> {
  const k = Math.min(1, max / Math.max(width, height));
  if (k === 1) return { uri, width, height };
  const img = await ImageManipulator.manipulate(uri).resize({ width: Math.round(width * k) }).renderAsync();
  const out = await img.saveAsync({ compress: 0.85, format: SaveFormat.JPEG });
  return { uri: out.uri, width: out.width, height: out.height };
}
