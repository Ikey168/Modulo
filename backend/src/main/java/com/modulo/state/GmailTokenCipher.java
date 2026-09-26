package com.modulo.state;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

final class GmailTokenCipher {
  private final SecretKeySpec key;
  GmailTokenCipher(String secret) {
    if (secret == null || secret.length() < 32) throw new IllegalArgumentException("Gmail requires an encryption key of at least 32 characters");
    try { key = new SecretKeySpec(MessageDigest.getInstance("SHA-256").digest(("modulo-gmail-v1:" + secret).getBytes(StandardCharsets.UTF_8)), "AES"); }
    catch (Exception failure) { throw new IllegalStateException("Token encryption unavailable"); }
  }
  String encrypt(long owner, String value) {
    try { byte[] nonce = new byte[12]; new SecureRandom().nextBytes(nonce);
      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(128, nonce)); cipher.updateAAD(Long.toString(owner).getBytes(StandardCharsets.UTF_8));
      byte[] encrypted = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8)); byte[] envelope = Arrays.copyOf(nonce, nonce.length + encrypted.length); System.arraycopy(encrypted, 0, envelope, nonce.length, encrypted.length);
      return Base64.getEncoder().encodeToString(envelope);
    } catch (Exception failure) { throw new IllegalStateException("Could not protect Google token"); }
  }
  String decrypt(long owner, String value) {
    try { byte[] envelope = Base64.getDecoder().decode(value); if (envelope.length < 29) throw new IllegalArgumentException();
      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, Arrays.copyOf(envelope, 12))); cipher.updateAAD(Long.toString(owner).getBytes(StandardCharsets.UTF_8));
      return new String(cipher.doFinal(Arrays.copyOfRange(envelope, 12, envelope.length)), StandardCharsets.UTF_8);
    } catch (Exception failure) { throw new IllegalStateException("Could not read Google token; reconnect Gmail"); }
  }
}
