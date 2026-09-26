package com.modulo.remote;

import com.modulo.security.AuthenticatedUserService;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeMap;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/**
 * Service credentials held by the server on behalf of a user (#495), so phones
 * and browsers never store provider tokens. Write-only through the API: the
 * client learns which keys are configured, never their values.
 */
@Service
public class RemoteCredentialStore {
  public static final Set<String> KEYS = Set.of(
      "tmdbToken", "youtubeApiKey", "igdbClientId", "igdbClientSecret",
      "minifluxToken", "karakeepToken", "paperlessToken",
      "caldavUsername", "caldavPassword", "ntfyToken");
  private static final int MAX_VALUE = 8192;

  private final JdbcTemplate jdbc;
  private final AuthenticatedUserService users;
  private final SecretKeySpec key;
  private final SecureRandom random = new SecureRandom();

  public RemoteCredentialStore(JdbcTemplate jdbc, AuthenticatedUserService users,
      @Value("${modulo.remote.credential-key:}") String encodedKey) {
    this.jdbc = jdbc;
    this.users = users;
    SecretKeySpec parsed = null;
    if (encodedKey != null && !encodedKey.isBlank()) {
      byte[] bytes = Base64.getDecoder().decode(encodedKey.strip());
      if (bytes.length != 32) throw new IllegalStateException("modulo.remote.credential-key must be 32 bytes, base64 encoded");
      parsed = new SecretKeySpec(bytes, "AES");
    }
    this.key = parsed;
  }

  public boolean available() {
    return key != null;
  }

  public List<String> configured() {
    return jdbc.queryForList("SELECT credential_key FROM remote_service_credentials WHERE owner_id=? ORDER BY credential_key",
        String.class, users.requireUserId());
  }

  /** Store a credential; a blank value deletes it. */
  public List<String> set(String name, String value) {
    if (!KEYS.contains(name)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CREDENTIAL_KEY_UNSUPPORTED");
    if (value == null || value.length() > MAX_VALUE) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CREDENTIAL_VALUE_INVALID");
    long owner = users.requireUserId();
    if (value.isBlank()) {
      jdbc.update("DELETE FROM remote_service_credentials WHERE owner_id=? AND credential_key=?", owner, name);
    } else {
      requireKey();
      jdbc.update("INSERT INTO remote_service_credentials(owner_id,credential_key,ciphertext) VALUES (?,?,?)"
          + " ON CONFLICT (owner_id,credential_key) DO UPDATE SET ciphertext=EXCLUDED.ciphertext, updated_at=CURRENT_TIMESTAMP",
          owner, name, encrypt(owner, name, value.strip()));
    }
    return configured();
  }

  /** Decrypted credentials of the current user, for server-side use only. */
  public Map<String, String> current() {
    long owner = users.requireUserId();
    Map<String, String> values = new TreeMap<>();
    if (key == null) return values;
    jdbc.query("SELECT credential_key, ciphertext FROM remote_service_credentials WHERE owner_id=?",
        rs -> {
          String name = rs.getString(1);
          decrypt(owner, name, rs.getBytes(2)).ifPresent(value -> values.put(name, value));
        }, owner);
    return values;
  }

  private void requireKey() {
    if (key == null) {
      throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
          "REMOTE_CREDENTIALS_UNCONFIGURED: set modulo.remote.credential-key on the server");
    }
  }

  // The owner and key name are authenticated data: a ciphertext cannot be moved to another user or key.
  private static byte[] aad(long owner, String name) {
    return (owner + ":" + name).getBytes(StandardCharsets.UTF_8);
  }

  byte[] encrypt(long owner, String name, String value) {
    try {
      byte[] iv = new byte[12];
      random.nextBytes(iv);
      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
      cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(128, iv));
      cipher.updateAAD(aad(owner, name));
      byte[] sealed = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
      return ByteBuffer.allocate(iv.length + sealed.length).put(iv).put(sealed).array();
    } catch (Exception error) {
      throw new IllegalStateException("Credential encryption failed", error);
    }
  }

  Optional<String> decrypt(long owner, String name, byte[] payload) {
    try {
      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
      cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, payload, 0, 12));
      cipher.updateAAD(aad(owner, name));
      return Optional.of(new String(cipher.doFinal(payload, 12, payload.length - 12), StandardCharsets.UTF_8));
    } catch (Exception undecryptable) {
      // Rotated server key or tampered row: treat as not configured.
      return Optional.empty();
    }
  }
}
