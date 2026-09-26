package com.modulo;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import java.util.ArrayList;
import java.util.List;

/** Posts a due reminder's notification; tapping it opens the reminder's record (#494). */
public class ReminderAlarmReceiver extends BroadcastReceiver {
    static final String CHANNEL = "reminders";

    @Override
    public void onReceive(Context context, Intent intent) {
        String id = intent.getStringExtra(ReminderStore.EXTRA_ID);
        if (id == null) return;
        List<ReminderStore.Reminder> reminders = ReminderStore.load(context);
        ReminderStore.Reminder due = null;
        List<ReminderStore.Reminder> remaining = new ArrayList<>();
        for (ReminderStore.Reminder reminder : reminders) {
            if (reminder.id.equals(id)) due = reminder; else remaining.add(reminder);
        }
        // Not in the published set any more: it was deleted or the account changed.
        if (due == null) return;
        post(context, due);
        try { ReminderStore.save(context, remaining); } catch (Exception ignored) { /* shown once; the next publish reconciles */ }
    }

    static void ensureChannel(Context context) {
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel channel = new NotificationChannel(CHANNEL, "Reminders", NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("Reminders you set in Modulo");
            manager.createNotificationChannel(channel);
        }
    }

    static void post(Context context, ReminderStore.Reminder reminder) {
        ensureChannel(context);
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (!manager.areNotificationsEnabled()) return;
        Intent open = new Intent(Intent.ACTION_VIEW, Uri.parse("com.modulo:/open?route=" + Uri.encode(reminder.route)), context, MainActivity.class);
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent content = PendingIntent.getActivity(context, reminder.id.hashCode(), open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification notification = new Notification.Builder(context, CHANNEL)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(reminder.title)
            .setContentText(reminder.body)
            .setStyle(new Notification.BigTextStyle().bigText(reminder.body))
            .setContentIntent(content)
            .setAutoCancel(true)
            .setCategory(Notification.CATEGORY_REMINDER)
            .build();
        // One notification per reminder id: a re-fire replaces rather than duplicates.
        manager.notify("reminder", reminder.id.hashCode(), notification);
    }
}
