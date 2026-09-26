package com.modulo;

import android.app.Activity;
import android.content.ClipData;
import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Files in and out of Modulo on Android (#493).
 *
 * Incoming: Share-to-Modulo. Text, links and files shared from other apps are
 * copied into app-private storage at once, because the sender's URI grant ends
 * with the activity and Android may kill the process before the WebView has
 * routed the share. A share stays pending until the frontend completes it, so a
 * restart never loses or double-imports it.
 *
 * Outgoing: saving through the Storage Access Framework (the WebView cannot
 * download a blob) and sharing through the system share sheet.
 */
@CapacitorPlugin(name = "ModuloShare")
public class ModuloSharePlugin extends Plugin {
    private static final String INBOX = "shared-inbox";
    private static final long MAX_FILE_BYTES = 25L * 1024 * 1024;
    private static final int MAX_FILES = 10;
    private static final int MAX_TEXT = 100_000;
    private static final Pattern SHARE_ID = Pattern.compile("^[0-9a-f-]{36}$");

    @Override
    public void load() {
        Activity activity = getActivity();
        if (activity == null) return;
        Intent intent = activity.getIntent();
        // Relaunching from Recents redelivers the original intent; it was imported then.
        if (intent != null && (intent.getFlags() & Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY) == 0 && receive(intent)) {
            activity.setIntent(new Intent(Intent.ACTION_MAIN));
        }
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        receive(intent);
    }

    private File inbox() {
        File dir = new File(getContext().getFilesDir(), INBOX);
        if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("Share inbox unavailable");
        return dir;
    }

    /** Copy an incoming share into the inbox. Returns false for intents that are not shares. */
    private boolean receive(Intent intent) {
        String action = intent.getAction();
        if (!Intent.ACTION_SEND.equals(action) && !Intent.ACTION_SEND_MULTIPLE.equals(action)) return false;
        try {
            String id = UUID.randomUUID().toString();
            File dir = new File(inbox(), id + ".partial");
            if (!dir.mkdirs()) throw new IllegalStateException("Share directory unavailable");
            JSONObject manifest = new JSONObject();
            manifest.put("id", id);
            manifest.put("receivedAt", System.currentTimeMillis());
            CharSequence text = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
            if (text != null) manifest.put("text", truncate(text.toString()));
            String subject = intent.getStringExtra(Intent.EXTRA_SUBJECT);
            if (subject != null) manifest.put("subject", truncate(subject));
            JSONArray files = new JSONArray();
            List<String> skipped = new ArrayList<>();
            for (Uri uri : streams(intent)) {
                if (files.length() >= MAX_FILES) { skipped.add("more than " + MAX_FILES + " files"); break; }
                JSONObject file = copyIn(uri, new File(dir, "f" + files.length()), skipped);
                if (file != null) files.put(file);
            }
            manifest.put("files", files);
            manifest.put("skipped", new JSONArray(skipped));
            if (text == null && files.length() == 0 && skipped.isEmpty()) { deleteTree(dir); return true; }
            write(new File(dir, "manifest.json"), manifest.toString().getBytes(StandardCharsets.UTF_8));
            // The rename is the commit: a half-copied share is never listed.
            if (!dir.renameTo(new File(inbox(), id))) throw new IllegalStateException("Share could not be committed");
            JSObject event = new JSObject();
            event.put("id", id);
            notifyListeners("shareReceived", event, true);
        } catch (Exception error) {
            JSObject event = new JSObject();
            event.put("message", "A shared item could not be saved on this device.");
            notifyListeners("shareFailed", event, true);
        }
        return true;
    }

    private static String truncate(String value) {
        return value.length() > MAX_TEXT ? value.substring(0, MAX_TEXT) : value;
    }

    @SuppressWarnings("deprecation")
    private static List<Uri> streams(Intent intent) {
        List<Uri> uris = new ArrayList<>();
        ClipData clip = intent.getClipData();
        if (clip != null) {
            for (int i = 0; i < clip.getItemCount(); i++) if (clip.getItemAt(i).getUri() != null) uris.add(clip.getItemAt(i).getUri());
        }
        if (!uris.isEmpty()) return uris;
        if (Intent.ACTION_SEND_MULTIPLE.equals(intent.getAction())) {
            ArrayList<Uri> extra = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
            if (extra != null) uris.addAll(extra);
        } else {
            Uri extra = intent.getParcelableExtra(Intent.EXTRA_STREAM);
            if (extra != null) uris.add(extra);
        }
        return uris;
    }

    private JSONObject copyIn(Uri uri, File target, List<String> skipped) throws Exception {
        // Never read Modulo's own private files through a crafted file:// share.
        if (!ContentResolver.SCHEME_CONTENT.equals(uri.getScheme())) { skipped.add("unsupported location"); return null; }
        ContentResolver resolver = getContext().getContentResolver();
        String name = "shared-file";
        long declared = -1;
        try (Cursor cursor = resolver.query(uri, new String[] { OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE }, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int nameColumn = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                int sizeColumn = cursor.getColumnIndex(OpenableColumns.SIZE);
                if (nameColumn >= 0 && cursor.getString(nameColumn) != null) name = cursor.getString(nameColumn);
                if (sizeColumn >= 0 && !cursor.isNull(sizeColumn)) declared = cursor.getLong(sizeColumn);
            }
        } catch (SecurityException denied) {
            skipped.add("permission revoked for " + name);
            return null;
        }
        name = name.replaceAll("[\\\\/\\x00-\\x1f]", "_");
        if (name.length() > 200) name = name.substring(0, 200);
        if (declared > MAX_FILE_BYTES) { skipped.add(name + " is larger than 25 MB"); return null; }
        long size = 0;
        try (InputStream in = resolver.openInputStream(uri); OutputStream out = new FileOutputStream(target)) {
            if (in == null) { skipped.add(name + " is unavailable"); return null; }
            byte[] buffer = new byte[64 * 1024];
            int read;
            while ((read = in.read(buffer)) != -1) {
                size += read;
                if (size > MAX_FILE_BYTES) break;
                out.write(buffer, 0, read);
            }
        } catch (SecurityException denied) {
            skipped.add("permission revoked for " + name);
            return null;
        }
        if (size > MAX_FILE_BYTES) { target.delete(); skipped.add(name + " is larger than 25 MB"); return null; }
        String mime = resolver.getType(uri);
        JSONObject file = new JSONObject();
        file.put("name", name);
        file.put("mime", mime == null ? "application/octet-stream" : mime);
        file.put("size", size);
        return file;
    }

    private static void write(File file, byte[] bytes) throws Exception {
        try (FileOutputStream out = new FileOutputStream(file)) {
            out.write(bytes);
            out.getFD().sync();
        }
    }

    private static byte[] read(File file) throws Exception {
        byte[] bytes = new byte[(int) file.length()];
        try (FileInputStream in = new FileInputStream(file)) {
            int offset = 0;
            while (offset < bytes.length) {
                int read = in.read(bytes, offset, bytes.length - offset);
                if (read < 0) break;
                offset += read;
            }
        }
        return bytes;
    }

    private static void deleteTree(File file) {
        File[] children = file.listFiles();
        if (children != null) for (File child : children) deleteTree(child);
        file.delete();
    }

    private File share(PluginCall call) {
        String id = call.getString("id");
        if (id == null || !SHARE_ID.matcher(id).matches()) return null;
        File dir = new File(inbox(), id);
        return dir.isDirectory() ? dir : null;
    }

    @PluginMethod
    public void pending(PluginCall call) {
        JSArray shares = new JSArray();
        File[] dirs = inbox().listFiles();
        if (dirs != null) {
            for (File dir : dirs) {
                if (dir.getName().endsWith(".partial")) { deleteTree(dir); continue; }
                try {
                    shares.put(new JSONObject(new String(read(new File(dir, "manifest.json")), StandardCharsets.UTF_8)));
                } catch (Exception unreadable) {
                    deleteTree(dir);
                }
            }
        }
        JSObject result = new JSObject();
        result.put("shares", shares);
        call.resolve(result);
    }

    @PluginMethod
    public void readFile(PluginCall call) {
        File dir = share(call);
        Integer index = call.getInt("index");
        if (dir == null || index == null || index < 0 || index >= MAX_FILES) { call.reject("Unknown shared file."); return; }
        File file = new File(dir, "f" + index);
        if (!file.isFile()) { call.reject("Shared file is no longer available."); return; }
        try {
            JSObject result = new JSObject();
            result.put("data", Base64.encodeToString(read(file), Base64.NO_WRAP));
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Shared file could not be read.");
        }
    }

    @PluginMethod
    public void complete(PluginCall call) {
        File dir = share(call);
        if (dir != null) deleteTree(dir);
        call.resolve();
    }

    /** Save through the system file picker; resolves { saved } or { cancelled }. */
    @PluginMethod
    public void saveDocument(PluginCall call) {
        String name = call.getString("name");
        String data = call.getString("data");
        if (name == null || data == null || name.isEmpty() || name.length() > 200) { call.reject("Invalid document."); return; }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(call.getString("mime", "application/octet-stream"));
        intent.putExtra(Intent.EXTRA_TITLE, name);
        startActivityForResult(call, intent, "documentSaved");
    }

    @ActivityCallback
    private void documentSaved(PluginCall call, ActivityResult result) {
        JSObject outcome = new JSObject();
        Uri uri = result.getData() == null ? null : result.getData().getData();
        if (result.getResultCode() != Activity.RESULT_OK || uri == null) {
            outcome.put("cancelled", true);
            call.resolve(outcome);
            return;
        }
        try (OutputStream out = getContext().getContentResolver().openOutputStream(uri, "wt")) {
            if (out == null) throw new IllegalStateException("destination unavailable");
            out.write(Base64.decode(call.getString("data"), Base64.DEFAULT));
            outcome.put("saved", true);
            call.resolve(outcome);
        } catch (Exception error) {
            call.reject("The document could not be written to the chosen location.");
        }
    }

    /** Offer a file or text to other apps through the system share sheet. */
    @PluginMethod
    public void shareDocument(PluginCall call) {
        String name = call.getString("name");
        String data = call.getString("data");
        String text = call.getString("text");
        Intent send = new Intent(Intent.ACTION_SEND);
        try {
            if (data != null) {
                if (name == null || name.isEmpty() || name.length() > 200 || !name.equals(new File(name).getName())) { call.reject("Invalid document name."); return; }
                File outgoing = new File(getContext().getCacheDir(), "share");
                if (!outgoing.exists() && !outgoing.mkdirs()) throw new IllegalStateException("share cache unavailable");
                File file = new File(outgoing, name);
                write(file, Base64.decode(data, Base64.DEFAULT));
                Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
                send.setType(call.getString("mime", "application/octet-stream"));
                send.putExtra(Intent.EXTRA_STREAM, uri);
                send.setClipData(ClipData.newRawUri(name, uri));
                send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            } else if (text != null) {
                send.setType("text/plain");
            } else {
                call.reject("Nothing to share.");
                return;
            }
            if (text != null) send.putExtra(Intent.EXTRA_TEXT, text);
            getActivity().startActivity(Intent.createChooser(send, call.getString("title", "Share")));
            call.resolve();
        } catch (Exception error) {
            call.reject("Sharing is unavailable.");
        }
    }
}
