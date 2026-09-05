package com.modulo.blueprint.approval;

import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.*;

/** Fixed-order string array: no floating-point, object ordering, or timestamp ambiguity. */
public final class DecisionStatement {
  public static final List<String> FIELDS =
      List.of(
          "format",
          "keyId",
          "decisionId",
          "requestId",
          "requestRevision",
          "runId",
          "runAttempt",
          "nodeId",
          "blueprintDigest",
          "evidenceDigest",
          "policyDigest",
          "nonceDigest",
          "checkpoint",
          "actor",
          "outcome",
          "comment",
          "commentDigest",
          "decidedAt",
          "idempotencyKey");

  public static String canonical(Map<String, String> fields) {
    if (!fields.keySet().equals(new HashSet<>(FIELDS)))
      throw new IllegalArgumentException("Invalid decision statement fields");
    var values = new ArrayList<String>();
    for (String field : FIELDS) {
      String value = fields.get(field);
      if (value == null || !Normalizer.isNormalized(value, Normalizer.Form.NFC))
        throw new IllegalArgumentException("Invalid statement string");
      for (int i = 0; i < value.length(); i++) {
        char c = value.charAt(i);
        if (Character.isHighSurrogate(c)) {
          if (++i >= value.length() || !Character.isLowSurrogate(value.charAt(i)))
            throw new IllegalArgumentException("Invalid Unicode");
        } else if (Character.isLowSurrogate(c))
          throw new IllegalArgumentException("Invalid Unicode");
      }
      values.add(value);
    }
    if (!"modulo.approval.decision.v1".equals(fields.get("format")))
      throw new IllegalArgumentException("Unsupported decision format");
    String result =
        "[" + String.join(",", values.stream().map(DecisionStatement::quote).toList()) + "]";
    if (result.getBytes(StandardCharsets.UTF_8).length > 32768)
      throw new IllegalArgumentException("Statement too large");
    return result;
  }

  private static String quote(String value) {
    var result = new StringBuilder("\"");
    for (int i = 0; i < value.length(); i++) {
      char c = value.charAt(i);
      switch (c) {
        case '"' -> result.append("\\\"");
        case '\\' -> result.append("\\\\");
        case '\b' -> result.append("\\b");
        case '\f' -> result.append("\\f");
        case '\n' -> result.append("\\n");
        case '\r' -> result.append("\\r");
        case '\t' -> result.append("\\t");
        default -> {
          if (c < 32) result.append(String.format(java.util.Locale.ROOT, "\\u%04x", (int) c));
          else result.append(c);
        }
      }
    }
    return result.append('"').toString();
  }

  private DecisionStatement() {}
}
