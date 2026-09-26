package com.modulo;

import android.Manifest;
import android.app.NotificationManager;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;
import org.json.JSONObject;

/**
 * Local reminder notifications (#494). The frontend derives the complete set of
 * upcoming reminders from the account's reminder records and publishes it with
 * `replaceAll`; the native side only arms alarms for that set.
 */
@CapacitorPlugin(name = "ModuloReminders",
    permissions = @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS }))
public class ModuloRemindersPlugin extends Plugin {
    private static final Pattern ID = Pattern.compile("^[A-Za-z0-9_.:-]{1,128}$");

    @PluginMethod
    public void replaceAll(PluginCall call) {
        JSArray values = call.getArray("reminders");
        if (values == null || values.length() > ReminderStore.MAX_REMINDERS) { call.reject("Invalid reminder set."); return; }
        List<ReminderStore.Reminder> next = new ArrayList<>();
        Set<String> ids = new HashSet<>();
        try {
            for (int i = 0; i < values.length(); i++) {
                JSONObject value = values.getJSONObject(i);
                ReminderStore.Reminder reminder = ReminderStore.Reminder.from(value);
                // Only in-app routes: a notification must never open an arbitrary URL.
                if (!ID.matcher(reminder.id).matches() || !ids.add(reminder.id) || reminder.at <= 0
                    || !reminder.route.startsWith("/app/") || reminder.route.length() > 512
                    || reminder.title.isEmpty() || reminder.title.length() > 200 || reminder.body.length() > 1000) {
                    call.reject("Invalid reminder " + i + ".");
                    return;
                }
                next.add(reminder);
            }
            List<ReminderStore.Reminder> previous = ReminderStore.load(getContext());
            ReminderStore.save(getContext(), next);
            ReminderStore.arm(getContext(), previous, next);
            call.resolve(status());
        } catch (Exception error) {
            call.reject("Reminders could not be scheduled on this device.");
        }
    }

    @PluginMethod
    public void cancelAll(PluginCall call) {
        try {
            List<ReminderStore.Reminder> previous = ReminderStore.load(getContext());
            ReminderStore.save(getContext(), new ArrayList<>());
            ReminderStore.arm(getContext(), previous, new ArrayList<>());
            getContext().getSystemService(NotificationManager.class).cancelAll();
            call.resolve();
        } catch (Exception error) {
            call.reject("Reminders could not be cleared.");
        }
    }

    private JSObject status() {
        JSObject result = new JSObject();
        boolean enabled = getContext().getSystemService(NotificationManager.class).areNotificationsEnabled();
        String permission = enabled ? "granted"
            : Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && getPermissionState("notifications") == PermissionState.PROMPT ? "prompt" : "denied";
        result.put("notifications", permission);
        result.put("exact", ReminderStore.exact(getContext()));
        result.put("scheduled", ReminderStore.load(getContext()).size());
        return result;
    }

    @PluginMethod
    public void status(PluginCall call) {
        call.resolve(status());
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU || getPermissionState("notifications") == PermissionState.GRANTED) {
            call.resolve(status());
            return;
        }
        requestPermissionForAlias("notifications", call, "permissionAnswered");
    }

    @PermissionCallback
    private void permissionAnswered(PluginCall call) {
        call.resolve(status());
    }

    /** Opens the system screen where notifications (or exact alarms) are allowed. */
    @PluginMethod
    public void openSettings(PluginCall call) {
        Intent intent;
        if ("exact".equals(call.getString("target")) && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + getContext().getPackageName()));
        } else {
            intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
            intent.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }
}
