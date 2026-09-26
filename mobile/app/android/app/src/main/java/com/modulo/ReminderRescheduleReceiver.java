package com.modulo;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import java.util.ArrayList;
import java.util.List;

/**
 * Alarms do not survive a reboot or an app update, and a clock or time-zone
 * change moves floating reminders. Re-arm the stored schedule without waiting
 * for the app to be opened (#494). Reminders that came due while the phone was
 * off are shown once if they are less than a day old.
 */
public class ReminderRescheduleReceiver extends BroadcastReceiver {
    private static final long MISSED_WINDOW_MS = 24L * 60 * 60 * 1000;

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (!Intent.ACTION_BOOT_COMPLETED.equals(action) && !Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)
            && !Intent.ACTION_TIME_CHANGED.equals(action) && !Intent.ACTION_TIMEZONE_CHANGED.equals(action)) return;
        List<ReminderStore.Reminder> reminders = ReminderStore.load(context);
        List<ReminderStore.Reminder> upcoming = new ArrayList<>();
        long now = System.currentTimeMillis();
        for (ReminderStore.Reminder reminder : reminders) {
            long due = reminder.due();
            if (due > now) upcoming.add(reminder);
            else if (Intent.ACTION_BOOT_COMPLETED.equals(action) && now - due < MISSED_WINDOW_MS) ReminderAlarmReceiver.post(context, reminder);
        }
        try { ReminderStore.save(context, upcoming); } catch (Exception ignored) { /* arm what we have */ }
        ReminderStore.arm(context, reminders, upcoming);
    }
}
