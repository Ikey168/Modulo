package com.modulo;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.regex.Pattern;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import org.json.JSONObject;

/**
 * Credential storage backed by the Android Keystore (#488).
 *
 * Values (the OIDC refresh token and the identity it belongs to) are encrypted
 * with an AES-256-GCM key that never leaves the Keystore, then written to
 * app-private preferences excluded from backup. The WebView only receives a
 * value it asked for by key; nothing is logged.
 */
@CapacitorPlugin(name = "ModuloSecureStore")
public class ModuloSecureStorePlugin extends Plugin {
    private static final String KEY_ALIAS = "modulo.secure-store.v1";
    private static final String PREFERENCES = "modulo_secure_store";
    private static final String KEYSTORE = "AndroidKeyStore";
    private static final Pattern VALID_KEY = Pattern.compile("^[A-Za-z0-9_.:/-]{1,256}$");
    private static final int IV_BYTES = 12;
    private static final int TAG_BITS = 128;

    private SharedPreferences preferences() {
        return getContext().getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE);
    }

    private SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance(KEYSTORE);
        store.load(null);
        if (store.containsAlias(KEY_ALIAS)) {
            return ((KeyStore.SecretKeyEntry) store.getEntry(KEY_ALIAS, null)).getSecretKey();
        }
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE);
        generator.init(new KeyGenParameterSpec.Builder(KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .setRandomizedEncryptionRequired(true)
                .build());
        return generator.generateKey();
    }

    private static String requireKey(PluginCall call) {
        String key = call.getString("key");
        if (key == null || !VALID_KEY.matcher(key).matches()) return null;
        return key;
    }

    @PluginMethod
    public void set(PluginCall call) {
        String key = requireKey(call);
        String value = call.getString("value");
        if (key == null || value == null || value.length() > 65536) {
            call.reject("Invalid secure store entry.");
            return;
        }
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key());
            byte[] iv = cipher.getIV();
            // Bind the ciphertext to its key so one entry cannot be swapped for another.
            cipher.updateAAD(key.getBytes(StandardCharsets.UTF_8));
            byte[] encrypted = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
            ByteBuffer payload = ByteBuffer.allocate(iv.length + encrypted.length);
            payload.put(iv).put(encrypted);
            if (!preferences().edit().putString(key, Base64.encodeToString(payload.array(), Base64.NO_WRAP)).commit()) {
                call.reject("Secure store write was not committed.");
                return;
            }
            call.resolve();
        } catch (Exception error) {
            call.reject("Secure store is unavailable.");
        }
    }

    @PluginMethod
    public void get(PluginCall call) {
        String key = requireKey(call);
        if (key == null) {
            call.reject("Invalid secure store key.");
            return;
        }
        JSObject result = new JSObject();
        String stored = preferences().getString(key, null);
        if (stored == null) {
            result.put("value", JSONObject.NULL);
            call.resolve(result);
            return;
        }
        try {
            byte[] payload = Base64.decode(stored, Base64.NO_WRAP);
            if (payload.length <= IV_BYTES) throw new IllegalStateException("truncated");
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(TAG_BITS, payload, 0, IV_BYTES));
            cipher.updateAAD(key.getBytes(StandardCharsets.UTF_8));
            byte[] plain = cipher.doFinal(payload, IV_BYTES, payload.length - IV_BYTES);
            result.put("value", new String(plain, StandardCharsets.UTF_8));
            call.resolve(result);
        } catch (Exception error) {
            // A value the Keystore can no longer decrypt (key reset, restored data) is discarded.
            preferences().edit().remove(key).commit();
            result.put("value", JSONObject.NULL);
            call.resolve(result);
        }
    }

    @PluginMethod
    public void remove(PluginCall call) {
        String key = requireKey(call);
        if (key == null) {
            call.reject("Invalid secure store key.");
            return;
        }
        preferences().edit().remove(key).commit();
        call.resolve();
    }

    @PluginMethod
    public void clear(PluginCall call) {
        preferences().edit().clear().commit();
        call.resolve();
    }
}
