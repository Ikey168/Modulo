package com.modulo.blueprint.approval;

import static com.modulo.blueprint.approval.ApprovalErrors.conflict;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Map;

/** Canonical JSON encoding (map keys sorted) and SHA-256 digests used for approval records. */
final class ApprovalCodec {
  private final ObjectMapper json;

  ApprovalCodec(ObjectMapper json) {
    this.json =
        json.copy()
            .enable(com.fasterxml.jackson.databind.SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS);
  }

  @SuppressWarnings("unchecked")
  Map<String, Object> parse(String value) {
    try {
      return json.readValue(value, Map.class);
    } catch (Exception invalid) {
      throw conflict("INVALID_EVIDENCE");
    }
  }

  String digestJson(String value) {
    return hash(encode(parse(value)));
  }

  String encode(Object value) {
    try {
      return json.writeValueAsString(value);
    } catch (Exception invalid) {
      throw conflict("INVALID_EVIDENCE");
    }
  }

  static String hash(String value) {
    return hash(value.getBytes(StandardCharsets.UTF_8));
  }

  static String hash(byte[] value) {
    try {
      return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value));
    } catch (Exception impossible) {
      throw new IllegalStateException(impossible);
    }
  }
}
