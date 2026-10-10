import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/** Writes a text file to the app cache and opens the share sheet so the user decides where it goes. */
export async function saveText(name: string, text: string, mime: string): Promise<void> {
  const f = new File(Paths.cache, name);
  if (f.exists) f.delete();
  f.create();
  f.write(text);
  await Sharing.shareAsync(f.uri, { mimeType: mime, dialogTitle: name });
}
