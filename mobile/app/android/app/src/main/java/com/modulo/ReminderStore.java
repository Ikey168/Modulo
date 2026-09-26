package com.modulo;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * The reminder schedule the frontend last published (#494), kept natively so
 * alarms can be re-armed without a WebView after reboot, app update or a clock
 * or time-zone change.
 *
 * The frontend always publishes the complete set for the signed-in account
 * (`replaceAll`), so an edit, a deletion or an account switch is a new set:
 * alarms for reminders that are no longer in it are cancelled, and a deleted
 * reminder cannot come back from an old alarm.
 */
final class ReminderStore {
    static final String PREFERENCES = "modulo_reminders";
    private static final String KEY = "schedule";
    static final String EXTRA_ID = "com.modulo.reminder.ID";
    static final int MAX_REMINDERS = 500;

    private ReminderStore() {}

    static final class Reminder {
        final String id;
        final long at;
        final String local;
        final String title;
        final String body;
        final String route;

        Reminder(String id, long at, String local, String title, String body, String route) {
            this.id = id; this.at = at; this.local = local; this.title = title; this.body = body; this.route = route;
        }

        JSONObject json() throws Exception {
            JSONObject value = new JSONObject();
            value.put("id", id).put("at", at).put("title", title).put("body", body).put("route", route);
            if (local != null) value.put("local", local);
            return value;
        }

        static Reminder from(JSONObject value) {
            return new Reminder(value.optString("id"), value.optLong("at"), value.has("local") ? value.optString("local") : null,
                value.optString("title"), value.optString("body"), value.optString("route"));
        }

        /**
         * A "floating" reminder (09:00 wherever I am) keeps its wall-clock time
         * when the time zone changes; others fire at the absolute instant.
         */
        long due() {
            if (local == null) return at;
            try {
                return LocalDateTime.parse(local).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();
            } catch (Exception invalid) {
                return at;
            }
        }
    }

    static List<Reminder> load(Context context) {
        List<Reminder> reminders = new ArrayList<>();
        try {
            JSONArray stored = new JSONArray(prefs(context).getString(KEY, "[]"));
            for (int i = 0; i < stored.length(); i++) reminders.add(Reminder.from(stored.getJSONObject(i)));
        } catch (Exception corrupt) {
            prefs(context).edit().remove(KEY).commit();
        }
        return reminders;
    }

    static void save(Context context, List<Reminder> reminders) throws Exception {
        JSONArray values = new JSONArray();
        for (Reminder reminder : reminders) values.put(reminder.json());
        if (!prefs(context).edit().putString(KEY, values.toString()).commit()) throw new IllegalStateException("not committed");
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE);
    }

    static PendingIntent alarm(Context context, String id, int flags) {
        Intent intent = new Intent(context, ReminderAlarmReceiver.class);
        intent.setAction("com.modulo.reminder.FIRE");
        // The data URI makes each reminder's PendingIntent distinct.
        intent.setData(android.net.Uri.parse("modulo-reminder:" + android.net.Uri.encode(id)));
        intent.putExtra(EXTRA_ID, id);
        return PendingIntent.getBroadcast(context, 0, intent, flags | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Whether alarms fire at the exact minute. Without the grant Android may defer them. */
    static boolean exact(Context context) {
        AlarmManager alarms = context.getSystemService(AlarmManager.class);
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarms.canScheduleExactAlarms();
    }

    /** Cancel what is no longer published and (re)arm everything that is. */
    static void arm(Context context, List<Reminder> previous, List<Reminder> next) {
        AlarmManager alarms = context.getSystemService(AlarmManager.class);
        for (Reminder old : previous) {
            boolean kept = false;
            for (Reminder reminder : next) kept |= reminder.id.equals(old.id);
            if (!kept) {
                PendingIntent pending = alarm(context, old.id, PendingIntent.FLAG_NO_CREATE);
                if (pending != null) { alarms.cancel(pending); pending.cancel(); }
            }
        }
        long now = System.currentTimeMillis();
        for (Reminder reminder : next) {
            long due = reminder.due();
            if (due <= now) continue;
            PendingIntent pending = alarm(context, reminder.id, PendingIntent.FLAG_UPDATE_CURRENT);
            if (exact(context)) alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, due, pending);
            else alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, due, pending);
        }
    }
}
