# Android files, sharing and reminders

Issues: [#493](https://github.com/Ikey168/Modulo/issues/493) (files, capture,
sharing) and [#494](https://github.com/Ikey168/Modulo/issues/494) (reminders and
background work). Architecture: [ADR 0009](../architecture/adr-0009-android-shared-frontend.md).

## Share to Modulo

Modulo appears in Android's share sheet for text, links, images and
documents (`ACTION_SEND` / `ACTION_SEND_MULTIPLE`).

1. `ModuloSharePlugin` copies the share into app-private storage
   (`files/shared-inbox/<id>`) as soon as it arrives. The sender's URI grant ends
   with the activity, and Android may kill the process before the WebView has
   routed the share, so nothing is left on a borrowed URI. A share directory is
   renamed into place only after every file was copied; a half-copied share is
   never listed and is removed on the next start.
2. Only `content://` URIs are read (a crafted `file://` share cannot expose
   Modulo's own files). Files over 25 MB, more than 10 files, revoked
   permissions and unavailable files are recorded as "not kept" and shown to the
   user instead of failing the whole share.
3. The workspace shows a sheet for each pending share: **Save as note** or
   **Discard**. Saving creates one note (links become a titled link note) and
   uploads each file as an attachment. Files over the server's 10 MB attachment
   limit are named in the note instead.
4. Progress is committed to device storage after the note is created and after
   each upload (`share.import.<id>`). A failed upload keeps the share pending
   with a **Retry**; the retry reuses the note and skips uploaded files. The note
   carries a hidden marker, so an import interrupted between creating the note
   and recording it finds that note instead of creating a second one. The share
   is completed only when nothing is left to retry.

Attachments are ordinary server attachments, so a desktop client opens them
like any other.

## Saving and exporting files

The Android WebView ignores `<a download>`. Every export, backup and recovery
file in the catalog is built as a blob link, so on Android
`installAndroidDownloads` routes those links to the system **Save to** dialog
(Storage Access Framework, `ACTION_CREATE_DOCUMENT`). The user picks the
destination (Downloads, Drive, a USB device); cancelling is reported as such and
writes nothing. Blobs are captured when their object URL is created, because
most callers revoke the URL immediately after `click()`.

`shareDocument` offers a file or text to other apps through the share sheet.
Only files Modulo wrote to `cache/share/` are exposed through the
`FileProvider`; the previous configuration exposed all external storage.

Picking files and camera capture use the standard `<input type="file">`
(with `capture` where a view asks for a photo). Capacitor's WebView opens the
system document picker or the camera app; neither needs a storage or camera
permission, and a cancelled picker simply returns no file.

## Reminders

Reminders & Notifications records stay the source of truth on the server.
On Android the workspace publishes the **complete** set of upcoming reminder
occurrences to `ModuloRemindersPlugin.replaceAll` whenever the records change
(including changes synchronized from another device):

- Up to 7 occurrences per reminder within 45 days, and at most 500 alarms,
  are armed. Opening Modulo extends the window.
- Each occurrence has a stable id (`<record>:<date>`), so re-publishing
  replaces rather than duplicates. Reminders missing from a new set (completed,
  deleted, or edited elsewhere) have their alarms cancelled, and a stale alarm
  whose reminder is no longer in the set shows nothing. Signing out cancels
  every alarm and notification.
- Reminder times are wall-clock times: 09:00 stays 09:00 after a time-zone
  change.
- Alarms are re-armed after reboot, app update, clock change and time-zone
  change by `ReminderRescheduleReceiver`, without starting the WebView.
  Reminders that came due while the phone was off are shown once after boot
  if they are less than a day old.
- Tapping a notification opens `com.modulo:/open?route=/app/...`, which the app
  accepts only for workspace routes, and the collection opens the record named
  by `?record=`.

### Delivery semantics

Android decides when background work runs; Modulo does not keep a WebView or
service running to deliver reminders.

| Situation | Behaviour |
| --- | --- |
| Notifications allowed, "Alarms & reminders" allowed | Delivered at the minute, including in Doze (`setExactAndAllowWhileIdle`) |
| Notifications allowed, exact alarms not allowed | Delivered, possibly several minutes late; the view offers **Allow exact timing** |
| Notification permission denied | Nothing is shown; the view says so and offers **Allow notifications**, which opens system settings after a permanent denial. Due reminders remain visible in the view and the calendar |
| Phone off at the due time | Shown once after boot if less than 24 hours late |
| App force-stopped by the user | Android cancels its alarms until Modulo is opened again; they are re-armed on the next start |
| Reminder edited offline on the phone | The local edit is published immediately; the server copy follows the normal offline queue |

Workflows that must run whether or not a phone is on (scheduled Blueprint runs,
server jobs) are scheduled on the Modulo server, not on the device.
