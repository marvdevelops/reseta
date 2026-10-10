// Native alarms: local notifications at each dose time, plus events with alerts in the phone's calendar.
// Production replaces the notifications with AlarmKit (iOS) and AlarmManager.setAlarmClock (Android)
// through small native modules; this build uses what runs in Expo Go.
import * as Notifications from 'expo-notifications';
import * as Calendar from 'expo-calendar/legacy';
import { Platform } from 'react-native';
import { FREQ_WORDS } from '../core/sig';
import type { Card } from '../core/model';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export const alarmsName = 'phone notifications';

export async function scheduleCard(card: Card, personName: string): Promise<string[]> {
  const perm = await Notifications.requestPermissionsAsync();
  if (!perm.granted) throw new Error('Reminders are turned off for Reseta. Turn on notifications for Reseta in Settings.');
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('doses', { name: 'Medicine reminders', importance: Notifications.AndroidImportance.MAX, sound: 'default', vibrationPattern: [0, 400, 200, 400] });
  }
  const ids: string[] = [];
  for (const t of card.times) {
    const [hour, minute] = t.split(':').map(Number);
    ids.push(await Notifications.scheduleNotificationAsync({
      content: {
        title: personName.trim().toLowerCase() === 'me' ? 'Time for your medicine' : `Time for ${personName}'s medicine`,
        body: `${card.drug} ${card.strength}: ${card.dose}${card.food ? ', ' + card.food : ''}`,
        data: { cardId: card.id, slot: t },
        sound: true,
        interruptionLevel: 'timeSensitive',
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: 'doses' },
    }));
  }
  return ids;
}

export async function cancelCard(card: Card): Promise<void> {
  for (const id of card.scheduledIds ?? []) await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}

/** Writes one repeating event per dose time, each with an alert at the dose time, into the phone's calendar. */
export async function addToCalendar(card: Card, personName: string): Promise<string> {
  const perm = await Calendar.requestCalendarPermissionsAsync();
  if (!perm.granted) throw new Error('Reseta cannot use your calendar yet. Allow it in Settings, then try again.');
  let calendarId: string | undefined;
  if (Platform.OS === 'ios') calendarId = (await Calendar.getDefaultCalendarAsync()).id;
  else {
    const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    calendarId = (cals.find((c) => c.isPrimary && c.allowsModifications) ?? cals.find((c) => c.allowsModifications))?.id;
  }
  if (!calendarId) throw new Error('Reseta could not find a calendar it can add to on this phone.');
  for (const t of card.times) {
    const [h, m] = t.split(':').map(Number);
    const start = new Date(`${card.start}T00:00:00`);
    start.setHours(h, m, 0, 0);
    await Calendar.createEventAsync(calendarId, {
      title: `${personName}: ${card.drug} ${card.strength}`,
      notes: `${card.dose}, ${FREQ_WORDS[card.freq]}${card.food ? ', ' + card.food : ''}. Checked against the prescription on ${card.start} in Reseta.`,
      startDate: start,
      endDate: new Date(start.getTime() + 10 * 60 * 1000),
      alarms: [{ relativeOffset: 0 }],
      recurrenceRule: {
        frequency: Calendar.Frequency.DAILY,
        interval: card.every2 ? 2 : 1,
        ...(card.days ? { occurrence: Math.ceil(card.days / (card.every2 ? 2 : 1)) } : {}),
      },
    });
  }
  return `Added to your calendar, with an alert at ${card.times.length === 1 ? 'the dose time' : `each of the ${card.times.length} dose times`}.`;
}
