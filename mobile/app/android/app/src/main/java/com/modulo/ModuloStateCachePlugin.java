package com.modulo;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONException;
import org.json.JSONObject;
import java.net.URI;
import java.util.UUID;

/** Transactional, private offline queue. Authenticated server state remains authoritative. */
@CapacitorPlugin(name = "ModuloStateCache")
public class ModuloStateCachePlugin extends Plugin {
    private Database database;

    @Override
    public void load() {
        database = new Database(getContext());
    }

    @Override
    protected void handleOnDestroy() {
        if (database != null) database.close();
    }

    @PluginMethod
    public void replica(PluginCall call) {
        execute(() -> {
            try {
                SQLiteDatabase db = database.getWritableDatabase();
                String value;
                db.beginTransaction();
                try {
                    try (Cursor cursor = db.query("metadata", new String[]{"value"}, "key = ?",
                            new String[]{"replica"}, null, null, null)) {
                        value = cursor.moveToFirst() ? cursor.getString(0) : null;
                    }
                    if (value == null) {
                        value = UUID.randomUUID().toString();
                        ContentValues row = new ContentValues();
                        row.put("key", "replica");
                        row.put("value", value);
                        if (db.insertWithOnConflict("metadata", null, row, SQLiteDatabase.CONFLICT_IGNORE) < 0) {
                            throw new IllegalStateException("SQLite did not create the state replica.");
                        }
                    }
                    db.setTransactionSuccessful();
                } finally {
                    db.endTransaction();
                }
                JSObject result = new JSObject();
                result.put("replica", value);
                call.resolve(result);
            } catch (Exception error) {
                call.reject("Could not obtain the Android state replica.", null, error);
            }
        });
    }

    @PluginMethod
    public void server(PluginCall call) {
        execute(() -> {
            try (Cursor cursor = database.getReadableDatabase().query("metadata", new String[]{"value"},
                    "key = ?", new String[]{"serverOrigin"}, null, null, null)) {
                JSObject result = new JSObject();
                result.put("origin", cursor.moveToFirst() ? cursor.getString(0) : JSONObject.NULL);
                call.resolve(result);
            } catch (Exception error) {
                call.reject("Could not read the configured Modulo server.", null, error);
            }
        });
    }

    @PluginMethod
    public void setServer(PluginCall call) {
        String origin = call.getString("origin");
        try {
            URI uri = new URI(origin);
            String authority = uri.getRawAuthority();
            if (!"https".equals(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null
                    || uri.getRawQuery() != null || uri.getRawFragment() != null
                    || (uri.getRawPath() != null && !uri.getRawPath().isEmpty())
                    || !origin.equals("https://" + authority)) {
                call.reject("Use a complete HTTPS server origin without a path or credentials.");
                return;
            }
        } catch (Exception error) {
            call.reject("Use a valid HTTPS server origin.");
            return;
        }
        execute(() -> {
            try {
                SQLiteDatabase db = database.getWritableDatabase();
                db.beginTransaction();
                try {
                    ContentValues values = new ContentValues();
                    values.put("key", "serverOrigin");
                    values.put("value", origin);
                    if (db.insertWithOnConflict("metadata", null, values, SQLiteDatabase.CONFLICT_REPLACE) < 0) {
                        throw new IllegalStateException("SQLite did not save the server origin.");
                    }
                    db.setTransactionSuccessful();
                } finally {
                    db.endTransaction();
                }
                call.resolve();
            } catch (Exception error) {
                call.reject("Could not save the configured Modulo server.", null, error);
            }
        });
    }

    @PluginMethod
    public void clearServer(PluginCall call) {
        execute(() -> {
            try {
                SQLiteDatabase db = database.getWritableDatabase();
                db.beginTransaction();
                try {
                    db.delete("metadata", "key = ?", new String[]{"serverOrigin"});
                    db.setTransactionSuccessful();
                } finally {
                    db.endTransaction();
                }
                call.resolve();
            } catch (Exception error) {
                call.reject("Could not clear the configured Modulo server.", null, error);
            }
        });
    }

    @PluginMethod
    public void load(PluginCall call) {
        String partition = call.getString("partition");
        if (partition == null || partition.isEmpty()) {
            call.reject("A state partition is required.");
            return;
        }
        execute(() -> {
            try (Cursor cursor = database.getReadableDatabase().query("snapshots", new String[]{"snapshot"},
                    "partition = ?", new String[]{partition}, null, null, null)) {
                JSObject result = new JSObject();
                result.put("snapshot", cursor.moveToFirst() ? cursor.getString(0) : JSONObject.NULL);
                call.resolve(result);
            } catch (Exception error) {
                call.reject("Could not read plugin state cache.", null, error);
            }
        });
    }

    @PluginMethod
    public void save(PluginCall call) {
        String partition = call.getString("partition");
        String snapshot = call.getString("snapshot");
        if (partition == null || partition.isEmpty() || snapshot == null) {
            call.reject("A partition and snapshot are required.");
            return;
        }
        if (snapshot.length() > 60_000_000) {
            call.reject("Plugin state cache exceeds the supported size.");
            return;
        }
        try {
            JSONObject parsed = new JSONObject(snapshot);
            if (!partition.equals(parsed.getString("partition")) || parsed.getInt("format") != 1) {
                call.reject("Plugin state cache partition or format mismatch.");
                return;
            }
        } catch (JSONException error) {
            call.reject("Plugin state cache is malformed.", null, error);
            return;
        }
        execute(() -> {
            try {
                SQLiteDatabase db = database.getWritableDatabase();
                db.beginTransaction();
                try {
                    ContentValues values = new ContentValues();
                    values.put("partition", partition);
                    values.put("snapshot", snapshot);
                    if (db.insertWithOnConflict("snapshots", null, values, SQLiteDatabase.CONFLICT_REPLACE) < 0) {
                        throw new IllegalStateException("SQLite did not insert the state snapshot.");
                    }
                    db.setTransactionSuccessful();
                } finally {
                    db.endTransaction();
                }
                call.resolve();
            } catch (Exception error) {
                call.reject("Could not save plugin state cache.", null, error);
            }
        });
    }

    private static class Database extends SQLiteOpenHelper {
        Database(Context context) {
            super(context, "modulo-plugin-state.db", null, 2);
            setWriteAheadLoggingEnabled(true);
        }

        @Override
        public void onCreate(SQLiteDatabase db) {
            db.execSQL("CREATE TABLE snapshots (partition TEXT PRIMARY KEY NOT NULL, snapshot TEXT NOT NULL)");
            db.execSQL("CREATE TABLE metadata (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)");
        }

        @Override
        public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
            if (oldVersion == 1 && newVersion == 2) {
                db.execSQL("CREATE TABLE metadata (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)");
                return;
            }
            throw new IllegalStateException("Unsupported plugin state cache schema upgrade.");
        }
    }
}
