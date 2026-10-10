import AsyncStorage from '@react-native-async-storage/async-storage';
import { uid, type Store } from './core/model';

const KEY = 'rxreader.v1';

export const emptyStore = (): Store => ({
  people: [{ id: uid(), name: 'Me', wake: '07:00', bed: '21:00' }],
  cards: [], log: [], samples: [], consent: null,
});

export async function loadStore(): Promise<Store> {
  try {
    const s = await AsyncStorage.getItem(KEY);
    if (s) return { ...emptyStore(), ...JSON.parse(s) };
  } catch {}
  return emptyStore();
}

export async function saveStore(store: Store): Promise<boolean> {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(store)); return true; } catch { return false; }
}

export async function clearStore(): Promise<void> {
  try { await AsyncStorage.removeItem(KEY); } catch {}
}
