package com.modulo.knowledge;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Locale;
import org.springframework.stereotype.Component;

/**
 * Deterministic, dependency-free local embedding used by default and in tests.
 * Text never leaves the process. The signed hashing projection is intentionally
 * simple; callers can replace it through the {@link EmbeddingProvider} boundary.
 */
@Component
public final class LocalHashEmbeddingProvider implements EmbeddingProvider {
  public static final int DIMENSIONS = 64;
  @Override public String id() { return "local"; }
  @Override public String model() { return "hashing-v1"; }
  @Override public int dimensions() { return DIMENSIONS; }
  @Override public boolean remote() { return false; }

  @Override public float[] embed(String text) {
    float[] vector = new float[DIMENSIONS];
    String normalized = text == null ? "" : text.toLowerCase(Locale.ROOT);
    for (String token : normalized.split("[^\\p{L}\\p{N}_-]+")) {
      if (token.isBlank()) continue;
      project(vector, "w:" + token, 1f);
      // Character n-grams make the tiny offline model useful for related
      // inflections (authenticate/authentication, secure/security) without a
      // vocabulary download or external service.
      String padded = "^" + token + "$";
      for (int i = 0; i + 3 <= padded.length(); i++) project(vector, "g:" + padded.substring(i, i + 3), .35f);
    }
    double norm = 0;
    for (float value : vector) norm += value * value;
    if (norm > 0) {
      float scale = (float) (1d / Math.sqrt(norm));
      for (int i = 0; i < vector.length; i++) vector[i] *= scale;
    }
    return vector;
  }

  private static void project(float[] vector, String feature, float weight) {
    byte[] digest = sha256(feature);
    for (int i = 0; i < 4; i++) {
      int bucket = Byte.toUnsignedInt(digest[i]) % DIMENSIONS;
      vector[bucket] += (digest[8 + i] & 1) == 0 ? weight : -weight;
    }
  }

  private static byte[] sha256(String value) {
    try { return MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)); }
    catch (Exception impossible) { throw new IllegalStateException(impossible); }
  }
}
