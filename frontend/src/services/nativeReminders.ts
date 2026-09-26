import { Capacitor, registerPlugin } from '@capacitor/core';

/** Native reminder scheduler on Android (#494); see features/workspace/androidReminders.ts. */
export interface NativeReminder {
  id: string;
  /** Epoch milliseconds at publish time. */
  at: number;
  /** Local wall-clock time; the native side keeps it across time-zone changes. */
  local: string;
  title: string;
  body: string;
  route: string;
}

export interface ReminderDeliveryStatus {
  notifications: 'granted' | 'denied' | 'prompt';
  exact: boolean;
  scheduled: number;
}

export interface RemindersBridge {
  replaceAll(options: { reminders: NativeReminder[] }): Promise<ReminderDeliveryStatus>;
  cancelAll(): Promise<void>;
  status(): Promise<ReminderDeliveryStatus>;
  requestPermission(): Promise<ReminderDeliveryStatus>;
  openSettings(options: { target: 'notifications' | 'exact' }): Promise<void>;
}

let bridge: RemindersBridge | undefined;
export function nativeReminders(): RemindersBridge | undefined {
  if (Capacitor.getPlatform() !== 'android') return undefined;
  bridge ??= registerPlugin<RemindersBridge>('ModuloReminders');
  return bridge;
}
