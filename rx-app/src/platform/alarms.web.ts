// Web: the browser cannot set alarms that ring with the page closed. The app's own ticker shows the
// dose screen while the page is open, and "Add to calendar" downloads a calendar file with alerts.
import { buildIcs, type Card } from '../core/model';
import { saveText } from './files';

export const alarmsName = 'in-page alarms while open, plus a calendar file';

export async function scheduleCard(_card: Card, _personName: string): Promise<string[]> {
  return [];
}

export async function cancelCard(_card: Card): Promise<void> {}

export async function addToCalendar(card: Card, personName: string): Promise<string> {
  await saveText(`${personName}-${card.drug}.ics`.replace(/\s+/g, '-'), buildIcs(card, personName), 'text/calendar');
  return 'Downloaded a calendar file. Open it to add the dose alarms to your calendar.';
}
