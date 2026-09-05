package com.modulo.knowledge;

import com.fasterxml.jackson.databind.*;
import java.net.URI;
import java.time.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

@Service
public class NotePropertyService {
  private final JdbcTemplate jdbc;
  private final ObjectMapper json;
  private final TransactionTemplate tx;
  private static final Set<String> TYPES =
      Set.of(
          "text",
          "number",
          "boolean",
          "date",
          "datetime",
          "select",
          "multiSelect",
          "link",
          "noteReference");

  public NotePropertyService(
      JdbcTemplate jdbc, ObjectMapper json, PlatformTransactionManager manager) {
    this.jdbc = jdbc;
    this.json = json;
    tx = new TransactionTemplate(manager);
  }

  public record Definition(
      String key, String title, String type, List<String> options, long revision) {}

  public record Change(long noteId, long version, Map<String, JsonNode> set, List<String> remove) {}

  public record Filter(String key, String operator, JsonNode value) {}

  public List<Map<String, Object>> definitions(long owner) {
    audit(owner, null, "PROPERTY_SCHEMA_READ");
    return jdbc
        .queryForList(
            "SELECT property_key AS key,title,value_type AS type,options::text,revision FROM"
                + " note_property_definitions WHERE owner_id=? ORDER BY property_key",
            owner)
        .stream()
        .map(this::decodeOptions)
        .toList();
  }

  private Map<String, Object> decodeOptions(Map<String, Object> row) {
    row.put("options", parse(row.get("options").toString()));
    return row;
  }

  public Map<String, Object> define(long owner, Definition definition) {
    if (definition == null
        || definition.key() == null
        || !definition.key().matches("[a-z][a-z0-9_.-]{0,127}")
        || definition.title() == null
        || definition.title().isBlank()
        || definition.title().length() > 256
        || definition.type() == null
        || !TYPES.contains(definition.type())) throw bad("INVALID_PROPERTY_DEFINITION");
    List<String> options = definition.options() == null ? List.of() : definition.options();
    if (options.size() > 100
        || options.stream().anyMatch(v -> v == null || v.isBlank() || v.length() > 256)
        || new HashSet<>(options).size() != options.size()
        || Set.of("select", "multiSelect").contains(definition.type()) && options.isEmpty())
      throw bad("INVALID_PROPERTY_OPTIONS");
    return tx.execute(
        status -> {
          lockOwner(owner);
          var rows =
              jdbc.queryForList(
                  "SELECT * FROM note_property_definitions WHERE owner_id=? AND property_key=? FOR"
                      + " UPDATE",
                  owner,
                  definition.key());
          if (rows.isEmpty()) {
            if (definition.revision() != 0) throw conflict();
            if (jdbc.queryForObject(
                    "SELECT count(*) FROM note_property_definitions WHERE owner_id=?",
                    Integer.class,
                    owner)
                >= 256) throw bad("PROPERTY_SCHEMA_QUOTA");
            jdbc.update(
                "INSERT INTO"
                    + " note_property_definitions(owner_id,property_key,title,value_type,options)"
                    + " VALUES (?,?,?,?,?::jsonb)",
                owner,
                definition.key(),
                definition.title(),
                definition.type(),
                encode(options));
          } else {
            var old = rows.get(0);
            if (((Number) old.get("revision")).longValue() != definition.revision())
              throw conflict();
            if (!old.get("value_type").equals(definition.type())
                || !parse(old.get("options").toString()).equals(json.valueToTree(options)))
              throw bad("PROPERTY_TYPE_AND_OPTIONS_IMMUTABLE");
            jdbc.update(
                "UPDATE note_property_definitions SET title=?,revision=revision+1 WHERE owner_id=?"
                    + " AND property_key=?",
                definition.title(),
                owner,
                definition.key());
          }
          audit(owner, null, "PROPERTY_SCHEMA_WRITE");
          return definitions(owner).stream()
              .filter(row -> row.get("key").equals(definition.key()))
              .findFirst()
              .orElseThrow();
        });
  }

  public List<Map<String, Object>> read(long owner, List<Long> ids) {
    if (ids == null
        || ids.isEmpty()
        || ids.size() > 100
        || ids.stream().anyMatch(Objects::isNull)
        || new HashSet<>(ids).size() != ids.size()) throw bad("INVALID_NOTE_BATCH");
    return tx.execute(
        status -> {
          var result = new ArrayList<Map<String, Object>>();
          for (long id : new TreeSet<>(ids)) {
            var note = ownedNote(owner, id, false);
            var values = new TreeMap<String, JsonNode>();
            for (var row :
                jdbc.queryForList(
                    "SELECT property_key,value::text FROM note_property_values WHERE owner_id=? AND"
                        + " note_id=?",
                    owner,
                    id))
              values.put(
                  row.get("property_key").toString(),
                  visibleValue(
                      owner, row.get("value").toString(), row.get("property_key").toString()));
            result.add(
                Map.of(
                    "noteId",
                    id,
                    "version",
                    ((Number) note.get("version")).longValue(),
                    "values",
                    values));
            audit(owner, id, "PROPERTY_READ");
          }
          return result;
        });
  }

  private JsonNode visibleValue(long owner, String raw, String key) {
    JsonNode value = parse(raw);
    String type =
        jdbc.queryForObject(
            "SELECT value_type FROM note_property_definitions WHERE owner_id=? AND property_key=?",
            String.class,
            owner,
            key);
    if ("noteReference".equals(type)
        && !value.isNull()
        && jdbc.queryForObject(
                "SELECT count(*) FROM application.notes WHERE note_id=? AND user_id=?",
                Integer.class,
                value.longValue(),
                owner)
            != 1) return json.nullNode();
    return value;
  }

  public List<Map<String, Object>> write(long owner, List<Change> changes) {
    if (changes == null
        || changes.isEmpty()
        || changes.size() > 100
        || changes.stream().anyMatch(Objects::isNull)
        || changes.stream().map(Change::noteId).distinct().count() != changes.size())
      throw bad("INVALID_NOTE_BATCH");
    return tx.execute(
        status -> {
          lockOwner(owner);
          var sorted = changes.stream().sorted(Comparator.comparingLong(Change::noteId)).toList();
          for (var change : sorted) {
            var note = ownedNote(owner, change.noteId(), true);
            if (((Number) note.get("version")).longValue() != change.version()) throw conflict();
          }
          for (var change : sorted) {
            Map<String, JsonNode> set = change.set() == null ? Map.of() : change.set();
            List<String> remove = change.remove() == null ? List.of() : change.remove();
            if (set.size() + remove.size() > 256
                || remove.stream().anyMatch(Objects::isNull)
                || remove.stream().anyMatch(set::containsKey)) throw bad("INVALID_PROPERTY_PATCH");
            for (var item : set.entrySet()) {
              var defs =
                  jdbc.queryForList(
                      "SELECT value_type,options::text FROM note_property_definitions WHERE"
                          + " owner_id=? AND property_key=?",
                      owner,
                      item.getKey());
              if (defs.isEmpty()) throw bad("UNKNOWN_PROPERTY");
              JsonNode value = validateValue(owner, defs.get(0), item.getValue());
              jdbc.update(
                  "INSERT INTO note_property_values(owner_id,note_id,property_key,value) VALUES"
                      + " (?,?,?,?::jsonb) ON CONFLICT(owner_id,note_id,property_key) DO UPDATE SET"
                      + " value=excluded.value",
                  owner,
                  change.noteId(),
                  item.getKey(),
                  encode(value));
            }
            for (String key : remove)
              jdbc.update(
                  "DELETE FROM note_property_values WHERE owner_id=? AND note_id=? AND"
                      + " property_key=?",
                  owner,
                  change.noteId(),
                  key);
            jdbc.update(
                "UPDATE application.notes SET"
                    + " version=COALESCE(version,0)+1,updated_at=clock_timestamp() WHERE note_id=?"
                    + " AND user_id=?",
                change.noteId(),
                owner);
            audit(owner, change.noteId(), "PROPERTY_WRITE");
          }
          return read(owner, sorted.stream().map(Change::noteId).toList());
        });
  }

  public List<Map<String, Object>> writeDocument(
      long owner, Change change, String markdown, String expectedMarkdown) {
    if (markdown == null
        || markdown.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 2097152)
      throw bad("NOTE_DOCUMENT_TOO_LARGE");
    return tx.execute(
        status -> {
          lockOwner(owner);
          ownedNote(owner, change.noteId(), true);
          String stored =
              jdbc.queryForObject(
                  "SELECT COALESCE(markdown_content,content,'') FROM application.notes WHERE"
                      + " note_id=? AND user_id=?",
                  String.class,
                  change.noteId(),
                  owner);
          if (!Objects.equals(stored, expectedMarkdown)) throw conflict();
          var result = write(owner, List.of(change));
          jdbc.update(
              "UPDATE application.notes SET content=?,markdown_content=? WHERE note_id=? AND"
                  + " user_id=?",
              markdown,
              markdown,
              change.noteId(),
              owner);
          audit(owner, change.noteId(), "PROPERTY_DOCUMENT_WRITE");
          return result;
        });
  }

  private JsonNode validateValue(long owner, Map<String, Object> definition, JsonNode value) {
    if (value == null || value.isNull()) return json.nullNode();
    String type = definition.get("value_type").toString();
    JsonNode options = parse(definition.get("options").toString());
    boolean valid = false;
    switch (type) {
      case "text":
        valid = value.isTextual() && value.textValue().length() <= 4096;
        break;
      case "number":
        valid =
            value.isNumber()
                && Double.isFinite(value.doubleValue())
                && value.asText().length() <= 128;
        break;
      case "boolean":
        valid = value.isBoolean();
        break;
      case "date":
        try {
          valid =
              value.isTextual()
                  && LocalDate.parse(value.textValue()).toString().equals(value.textValue());
        } catch (Exception ignored) {
        }
        break;
      case "datetime":
        try {
          if (value.isTextual())
            return json.getNodeFactory().textNode(canonicalInstant(value.textValue()));
        } catch (Exception ignored) {
        }
        break;
      case "select":
        valid = value.isTextual() && contains(options, value);
        break;
      case "multiSelect":
        valid = value.isArray() && value.size() <= 100;
        var seen = new HashSet<JsonNode>();
        if (valid)
          for (var item : value)
            valid = valid && item.isTextual() && contains(options, item) && seen.add(item);
        break;
      case "link":
        try {
          URI uri = URI.create(value.asText());
          valid =
              value.isTextual()
                  && value.textValue().length() <= 2048
                  && Set.of("https", "http").contains(uri.getScheme())
                  && uri.getHost() != null
                  && uri.getUserInfo() == null;
        } catch (Exception ignored) {
        }
        break;
      case "noteReference":
        valid = value.isIntegralNumber() && value.canConvertToLong() && value.longValue() > 0;
        if (valid) ownedNote(owner, value.longValue(), false);
        break;
    }
    if (!valid) throw bad("INVALID_PROPERTY_VALUE");
    return value;
  }

  private String canonicalInstant(String value) {
    Instant instant = Instant.parse(value);
    int year = instant.atOffset(ZoneOffset.UTC).getYear();
    if (year < 1 || year > 9999) throw bad("INVALID_PROPERTY_VALUE");
    return new java.time.format.DateTimeFormatterBuilder()
        .appendInstant(9)
        .toFormatter()
        .format(instant);
  }

  private boolean contains(JsonNode array, JsonNode value) {
    for (var item : array) if (item.equals(value)) return true;
    return false;
  }

  public record QueryPredicate(String sql, List<Object> arguments) {}

  public QueryPredicate predicate(long owner, List<Filter> filters) {
    if (filters == null || filters.size() > 32) throw bad("INVALID_PROPERTY_QUERY");
    StringBuilder sql = new StringBuilder(" FROM application.notes n WHERE n.user_id=?");
    var args = new ArrayList<Object>(List.of(owner));
    for (var filter : filters) {
      if (filter == null
          || filter.key() == null
          || filter.operator() == null
          || !Set.of("eq", "gt", "gte", "lt", "lte", "contains", "exists", "missing", "isEmpty")
              .contains(filter.operator())) throw bad("INVALID_PROPERTY_FILTER");
      var defs =
          jdbc.queryForList(
              "SELECT value_type,options::text FROM note_property_definitions WHERE"
                  + " owner_id=? AND property_key=?",
              owner,
              filter.key());
      if (defs.isEmpty()) throw bad("UNKNOWN_PROPERTY");
      boolean missing = "missing".equals(filter.operator()) || "isEmpty".equals(filter.operator());
      sql.append(missing ? " AND NOT EXISTS (" : " AND EXISTS (")
          .append(
              "SELECT 1 FROM note_property_values p WHERE p.owner_id=n.user_id AND"
                  + " p.note_id=n.note_id AND p.property_key=?");
      args.add(filter.key());
      if ("isEmpty".equals(filter.operator()))
        sql.append(" AND p.value NOT IN ('null'::jsonb,'\"\"'::jsonb,'[]'::jsonb)");
      if (!Set.of("exists", "missing", "isEmpty").contains(filter.operator())) {
        String type = defs.get(0).get("value_type").toString();
        JsonNode value = filter.value();
        if ("contains".equals(filter.operator())) {
          if ("text".equals(type)
              && value != null
              && value.isTextual()
              && value.asText().length() <= 4096) {
            sql.append(" AND strpos(p.value #>> '{}',?)>0");
            args.add(value.asText());
          } else {
            if (!"multiSelect".equals(type)
                || value == null
                || !value.isTextual()
                || !contains(parse(defs.get(0).get("options").toString()), value))
              throw bad("INVALID_PROPERTY_FILTER");
            sql.append(" AND p.value @> ?::jsonb");
            args.add(encode(List.of(value)));
          }
        } else {
          value = validateValue(owner, defs.get(0), value);
          if (!"eq".equals(filter.operator())
              && (!Set.of("number", "date", "datetime").contains(type) || value.isNull()))
            throw bad("INVALID_PROPERTY_FILTER");
          if (!"eq".equals(filter.operator()))
            sql.append(" AND octet_length(p.value::text)<=1024 AND p.value <> 'null'::jsonb");
          else if (Set.of("number", "date", "datetime", "boolean", "noteReference").contains(type))
            sql.append(" AND octet_length(p.value::text)<=1024");
          else {
            sql.append(" AND md5(p.value::text)=md5((?::jsonb)::text)");
            args.add(encode(value));
          }
          String operator =
              switch (filter.operator()) {
                case "gt" -> ">";
                case "gte" -> ">=";
                case "lt" -> "<";
                case "lte" -> "<=";
                default -> "=";
              };
          sql.append(" AND p.value ").append(operator).append(" ?::jsonb");
          args.add(encode(value));
        }
      }
      sql.append(')');
    }
    return new QueryPredicate(sql.toString(), args);
  }

  public List<Map<String, Object>> query(long owner, List<Filter> filters, long after, int limit) {
    if (after < 0 || limit < 1 || limit > 100) throw bad("INVALID_PROPERTY_QUERY");
    return tx.execute(
        status -> {
          var predicate = predicate(owner, filters);
          var args = new ArrayList<>(predicate.arguments());
          args.add(after);
          args.add(limit);
          var ids =
              jdbc.queryForList(
                  "SELECT n.note_id"
                      + predicate.sql()
                      + " AND n.note_id>? ORDER BY n.note_id LIMIT ?",
                  Long.class,
                  args.toArray());
          audit(owner, null, "PROPERTY_QUERY");
          return ids.isEmpty() ? List.of() : read(owner, ids);
        });
  }

  private Map<String, Object> ownedNote(long owner, long id, boolean write) {
    var rows =
        jdbc.queryForList(
            "SELECT note_id,COALESCE(version,0) AS version FROM application.notes WHERE note_id=?"
                + " AND user_id=?"
                + (write ? " FOR UPDATE" : " FOR SHARE"),
            id,
            owner);
    if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "NOTE_UNAVAILABLE");
    return rows.get(0);
  }

  private void lockOwner(long owner) {
    jdbc.execute(
        "SELECT pg_advisory_xact_lock(hashtextextended('note-properties:" + owner + "',0))");
  }

  private void audit(long owner, Long note, String event) {
    jdbc.update(
        "INSERT INTO audit_events(event_type,note_id,user_id,actor_verified,outcome,created_at)"
            + " VALUES (?,?,?,true,'SUCCESS',clock_timestamp())",
        event,
        note,
        Long.toString(owner));
  }

  private JsonNode parse(String value) {
    try {
      return json.readTree(value);
    } catch (Exception failure) {
      throw bad("INVALID_PROPERTY_JSON");
    }
  }

  private String encode(Object value) {
    try {
      return json.writeValueAsString(value);
    } catch (Exception failure) {
      throw bad("INVALID_PROPERTY_JSON");
    }
  }

  private static ResponseStatusException bad(String reason) {
    return new ResponseStatusException(HttpStatus.BAD_REQUEST, reason);
  }

  private static ResponseStatusException conflict() {
    return new ResponseStatusException(HttpStatus.CONFLICT, "PROPERTY_VERSION_CHANGED");
  }
}
