import type { NativeReminder } from '../../services/nativeReminders';
import { lifeOccurrenceDone, lifeRecordOccursOn, type LifeCollectionData } from './lifeStore';

/**
 * Android delivery for Reminders & Notifications (#494).
 *
 * The WebView is not running when a reminder is due, so the frontend publishes
 * the next occurrences of every open reminder to the native scheduler, which
 * arms alarms and survives reboot, updates and time-zone changes. The whole
 * set is replaced on each publish: editing, completing or deleting a reminder
 * (on any device, once synchronized) removes its alarms, and signing out
 * clears them. Timing follows Android's rules: exact when the user allowed
 * exact alarms, otherwise possibly a few minutes late.
 */
export type { NativeReminder, ReminderDeliveryStatus, RemindersBridge } from '../../services/nativeReminders';
export { nativeReminders } from '../../services/nativeReminders';

/** How far ahead occurrences are armed; the next publish (any app open) extends it. */
export const HORIZON_DAYS = 45;
/** Per recurring reminder, so a daily one cannot crowd out the rest of the 500-alarm budget. */
const OCCURRENCES_PER_REMINDER = 7;
const MAX_ALARMS = 500;

const pad = (value: number) => String(value).padStart(2, '0');
const localStamp = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
const isoDay = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

function leadMs(lead: string | undefined): number {
  const match = /(\d+)\s*(minute|hour|day)/i.exec(lead || '');
  if (!match) return 0;
  const unit = match[2].toLowerCase() === 'day' ? 86_400_000 : match[2].toLowerCase() === 'hour' ? 3_600_000 : 60_000;
  return Number(match[1]) * unit;
}

/** The alarms to arm for the account's reminder records, soonest first. */
export function planNativeReminders(data: LifeCollectionData, completedStatuses: readonly string[], pluginView: string,
  now = new Date()): NativeReminder[] {
  const planned: NativeReminder[] = [];
  for (const record of data.records) {
    if (!record.date || completedStatuses.includes(record.status)) continue;
    const time = /^\d{2}:\d{2}$/.test(record.values.time ?? '') ? record.values.time : '09:00';
    let count = 0;
    for (let offset = 0; offset <= HORIZON_DAYS && count < OCCURRENCES_PER_REMINDER; offset += 1) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
      const date = isoDay(day);
      // A snoozed or once-only reminder is due on its date; recurring ones on each occurrence.
      if (!lifeRecordOccursOn(record, date) || lifeOccurrenceDone(data, record.id, date)) continue;
      const due = new Date(`${date}T${time}:00`);
      const notify = new Date(due.getTime() - leadMs(record.values.leadTime));
      if (notify.getTime() <= now.getTime()) continue;
      count += 1;
      planned.push({
        id: `${record.id}:${date}`.slice(0, 128),
        at: notify.getTime(),
        local: localStamp(notify),
        title: record.title.slice(0, 200) || 'Reminder',
        body: (record.values.message || record.notes || `Due ${date} ${time}`).slice(0, 1000),
        route: `/app/${pluginView}?record=${encodeURIComponent(record.id)}`,
      });
      if (record.recurrence === 'Once') break;
    }
  }
  return planned.sort((a, b) => a.at - b.at).slice(0, MAX_ALARMS);
}
