import { useCallback, useEffect, useState } from 'react';
import { BellRing } from 'lucide-react';
import { Button } from '@/ui';
import { nativeReminders, planNativeReminders, type ReminderDeliveryStatus } from './androidReminders';
import { REMINDERS_PLUGIN_ID, FOUNDATION_TOOL_DEFINITIONS } from './foundationTools';
import { useLifeCollection } from './useLifeCollection';

const COMPLETED = FOUNDATION_TOOL_DEFINITIONS.find(tool => tool.pluginId === REMINDERS_PLUGIN_ID)?.config.completedStatuses ?? [];
const PUBLISHED = 'modulo:reminders-published';

/**
 * Keeps the Android reminder schedule equal to the account's reminder records
 * (#494). Mounted by the workspace while the plugin is installed, so a
 * reminder edited on another device is re-armed as soon as it synchronizes,
 * not only when the Reminders view is open.
 */
export function AndroidReminderSync() {
  const [data] = useLifeCollection(REMINDERS_PLUGIN_ID);
  const bridge = nativeReminders();
  useEffect(() => {
    if (!bridge) return;
    let current = true;
    bridge.replaceAll({ reminders: planNativeReminders(data, COMPLETED, REMINDERS_PLUGIN_ID) })
      .then(status => { if (current) window.dispatchEvent(new CustomEvent(PUBLISHED, { detail: status })); })
      .catch(error => { if (current) window.dispatchEvent(new CustomEvent(PUBLISHED, { detail: { error: error instanceof Error ? error.message : String(error) } })); });
    return () => { current = false; };
  }, [bridge, data]);
  return null;
}

/** What the user must allow for reminders to arrive on this phone. */
export function AndroidReminderDelivery() {
  const bridge = nativeReminders();
  const [status, setStatus] = useState<ReminderDeliveryStatus>();
  const [error, setError] = useState<string>();
  const refresh = useCallback(() => {
    void bridge?.status().then(setStatus, () => setError('Reminder status is unavailable.'));
  }, [bridge]);
  useEffect(() => {
    refresh();
    const published = (event: Event) => {
      const detail = (event as CustomEvent<ReminderDeliveryStatus | { error: string }>).detail;
      if ('error' in detail) setError(`Reminders could not be scheduled on this device: ${detail.error}`);
      else { setStatus(detail); setError(undefined); }
    };
    window.addEventListener(PUBLISHED, published);
    // Returning from system settings changes what is allowed.
    window.addEventListener('focus', refresh);
    return () => { window.removeEventListener(PUBLISHED, published); window.removeEventListener('focus', refresh); };
  }, [refresh]);
  if (!bridge) return null;
  const allow = async () => {
    try {
      const next = await bridge.requestPermission();
      setStatus(next);
      if (next.notifications === 'denied') await bridge.openSettings({ target: 'notifications' });
    } catch { setError('Notification settings could not be opened.'); }
  };
  const count = (n: number) => `${n} upcoming reminder${n === 1 ? '' : 's'}`;
  const message = error
    ?? (!status ? 'Checking reminder delivery on this device…'
      : status.notifications !== 'granted'
        ? 'Notifications are off for Modulo, so reminders will not appear. Due reminders still show here and in the calendar.'
        : status.exact
          ? `${count(status.scheduled)} scheduled on this device, including while Modulo is closed.`
          : `${count(status.scheduled)} scheduled. Without "Alarms & reminders" access Android may deliver them a few minutes late.`);
  return <section aria-label="Reminder delivery" className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
    <BellRing className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    <p role={error ? 'alert' : 'status'} className={error ? 'min-w-0 flex-1 text-sm text-destructive' : 'min-w-0 flex-1 text-sm text-muted-foreground'}>{message}</p>
    {status && status.notifications !== 'granted' && <Button size="sm" onClick={() => void allow()}>Allow notifications</Button>}
    {status?.notifications === 'granted' && !status.exact && (
      <Button size="sm" variant="outline" onClick={() => void bridge.openSettings({ target: 'exact' })}>Allow exact timing</Button>
    )}
  </section>;
}
