package com.modulo.blueprint.execution;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.modulo.entity.Note;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Trace data is a typed summary, never a copy of arbitrary workflow values. */
@Component
public class TracePolicy {
  private final List<Pattern> patterns = new ArrayList<>();
  private final ObjectMapper json = new ObjectMapper();

  public TracePolicy(@Value("${modulo.workflow.trace.redact-patterns:}") String configured) {
    patterns.add(
        Pattern.compile(
            "(?i)(password|passwd|secret|token|authorization|api[_-]?key|bearer)[=: _-]"));
    patterns.add(Pattern.compile("[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}"));
    if (configured.length() > 2048)
      throw new IllegalArgumentException("Trace redaction configuration too large");
    for (String expression : configured.split(";"))
      if (!expression.isBlank()) {
        if (patterns.size() >= 18 || expression.length() > 128)
          throw new IllegalArgumentException("Too many trace redaction patterns");
        patterns.add(Pattern.compile(Pattern.quote(expression), Pattern.CASE_INSENSITIVE));
      }
  }

  public String identifier(String value) {
    if (value == null) return null;
    // Identifiers are bounded at ingress; patterns never scan payloads or note contents.
    String bounded = value.length() > 255 ? value.substring(0, 255) : value;
    for (Pattern pattern : patterns)
      if (pattern.matcher(bounded).find()) {
        try {
          return "redacted."
              + HexFormat.of()
                  .formatHex(
                      MessageDigest.getInstance("SHA-256")
                          .digest(value.getBytes(StandardCharsets.UTF_8)))
                  .substring(0, 24);
        } catch (Exception impossible) {
          throw new IllegalStateException(impossible);
        }
      }
    return bounded;
  }

  public String summarize(long owner, Map<String, ?> values, boolean referencesAllowed) {
    if (values == null) return "{}";
    Map<String, Integer> counts = new TreeMap<>();
    List<Map<String, Object>> references = new ArrayList<>();
    int inspected = 0;
    for (Object value : values.values()) {
      if (inspected++ >= 256) break;
      String type =
          value == null
              ? "null"
              : value instanceof Number
                  ? "number"
                  : value instanceof Boolean
                      ? "boolean"
                      : value instanceof CharSequence
                          ? "text"
                          : value instanceof Collection<?>
                              ? "collection"
                              : value instanceof Map<?, ?> ? "object" : "reference";
      counts.merge(type, 1, Integer::sum);
      if (referencesAllowed
          && value instanceof Note note
          && note.getId() != null
          && note.getId() > 0
          && Objects.equals(note.getUserId(), owner)
          && references.size() < 16) references.add(Map.of("kind", "note", "id", note.getId()));
    }
    try {
      return json.writeValueAsString(
          Map.of(
              "fields",
              values.size(),
              "types",
              counts,
              "references",
              references,
              "sampled",
              Math.min(values.size(), 256)));
    } catch (Exception impossible) {
      throw new IllegalStateException(impossible);
    }
  }
}
