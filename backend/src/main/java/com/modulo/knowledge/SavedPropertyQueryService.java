package com.modulo.knowledge;

import com.fasterxml.jackson.databind.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

@Service
public class SavedPropertyQueryService {
  private final JdbcTemplate jdbc;
  private final ObjectMapper json;
  private final NotePropertyService properties;
  private final TransactionTemplate tx;

  public SavedPropertyQueryService(
      JdbcTemplate jdbc,
      ObjectMapper json,
      NotePropertyService properties,
      PlatformTransactionManager manager) {
    this.jdbc = jdbc;
    this.json = json;
    this.properties = properties;
    tx = new TransactionTemplate(manager);
  }

  public record Sort(String key, String direction) {}

  public record Formula(String title, String operation, List<String> keys) {}

  public record Configuration(
      List<NotePropertyService.Filter> filters,
      Sort sort,
      String groupBy,
      List<String> columns,
      List<Formula> formulas,
      String view) {}

  public record Save(UUID id, long revision, String title, Configuration configuration) {}

  private void validate(long owner, Configuration config) {
    if (config == null
        || config.view() == null
        || !Set.of("table", "list", "card", "board").contains(config.view())
        || config.sort() == null
        || config.sort().direction() == null
        || !Set.of("asc", "desc").contains(config.sort().direction())
        || config.columns() == null
        || config.columns().size() > 20
        || new HashSet<>(config.columns()).size() != config.columns().size()
        || config.formulas() == null
        || config.formulas().size() > 10) throw bad("INVALID_QUERY_CONFIGURATION");
    var defs = new HashMap<String, Map<String, Object>>();
    for (var def : properties.definitions(owner)) defs.put(def.get("key").toString(), def);
    if (!"noteId".equals(config.sort().key()) && !defs.containsKey(config.sort().key()))
      throw bad("UNKNOWN_SORT_PROPERTY");
    for (String column : config.columns())
      if (!defs.containsKey(column)) throw bad("UNKNOWN_QUERY_COLUMN");
    if (config.groupBy() != null
        && !config.groupBy().isBlank()
        && !defs.containsKey(config.groupBy())) throw bad("UNKNOWN_GROUP_PROPERTY");
    if ("board".equals(config.view()) && (config.groupBy() == null || config.groupBy().isBlank()))
      throw bad("BOARD_REQUIRES_GROUP_PROPERTY");
    var titles = new HashSet<String>();
    for (var formula : config.formulas()) {
      if (formula == null
          || formula.title() == null
          || formula.title().isBlank()
          || formula.title().length() > 128
          || !titles.add(formula.title())
          || formula.operation() == null
          || !Set.of("sum", "concat").contains(formula.operation())
          || formula.keys() == null
          || formula.keys().isEmpty()
          || formula.keys().size() > 10) throw bad("INVALID_QUERY_FORMULA");
      for (String key : formula.keys())
        if (!defs.containsKey(key)
            || "sum".equals(formula.operation()) && !"number".equals(defs.get(key).get("type")))
          throw bad("INVALID_QUERY_FORMULA");
    }
    properties.predicate(owner, config.filters());
  }

  public Map<String, Object> save(long owner, Save input) {
    if (input == null
        || input.title() == null
        || input.title().isBlank()
        || input.title().length() > 256) throw bad("INVALID_QUERY_TITLE");
    return tx.execute(
        status -> {
          jdbc.execute(
              "SELECT pg_advisory_xact_lock(hashtextextended('saved-queries:" + owner + "',0))");
          validate(owner, input.configuration());
          UUID id = input.id();
          if (id == null) {
            if (input.revision() != 0) throw conflict();
            if (jdbc.queryForObject(
                    "SELECT count(*) FROM saved_property_queries WHERE owner_id=?",
                    Integer.class,
                    owner)
                >= 500) throw bad("SAVED_QUERY_QUOTA");
            id = UUID.randomUUID();
            jdbc.update(
                "INSERT INTO saved_property_queries(id,owner_id,title,configuration) VALUES"
                    + " (?,?,?,?::jsonb)",
                id,
                owner,
                input.title(),
                encode(input.configuration()));
          } else if (jdbc.update(
                  "UPDATE saved_property_queries SET"
                      + " title=?,configuration=?::jsonb,revision=revision+1,updated_at=clock_timestamp()"
                      + " WHERE id=? AND owner_id=? AND revision=?",
                  input.title(),
                  encode(input.configuration()),
                  id,
                  owner,
                  input.revision())
              != 1) throw conflict();
          return get(owner, id);
        });
  }

  public List<Map<String, Object>> list(long owner) {
    return jdbc.queryForList(
        "SELECT id,title,revision,updated_at FROM saved_property_queries WHERE owner_id=? ORDER BY"
            + " updated_at DESC,id LIMIT 500",
        owner);
  }

  public Map<String, Object> get(long owner, UUID id) {
    var rows =
        jdbc.queryForList(
            "SELECT id,title,revision,configuration::text,updated_at FROM saved_property_queries"
                + " WHERE id=? AND owner_id=?",
            id,
            owner);
    if (rows.isEmpty())
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "QUERY_UNAVAILABLE");
    var row = rows.get(0);
    try {
      row.put(
          "configuration",
          json.readValue(row.get("configuration").toString(), Configuration.class));
    } catch (Exception failure) {
      throw bad("INVALID_STORED_QUERY");
    }
    return row;
  }

  public void delete(long owner, UUID id, long revision) {
    if (jdbc.update(
            "DELETE FROM saved_property_queries WHERE id=? AND owner_id=? AND revision=?",
            id,
            owner,
            revision)
        != 1) throw conflict();
  }

  public Map<String, Object> run(long owner, UUID id, int page, int limit) {
    if (page < 0 || page > 10000 || limit < 1 || limit > 100) throw bad("INVALID_QUERY_PAGE");
    return tx.execute(
        status -> {
          jdbc.execute("SET LOCAL statement_timeout='3s'");
          var saved = get(owner, id);
          var config = (Configuration) saved.get("configuration");
          validate(owner, config);
          var predicate = properties.predicate(owner, config.filters());
          var args = new ArrayList<Object>();
          String ordering = "n.note_id";
          if (!"noteId".equals(config.sort().key())) {
            ordering =
                "(SELECT v.value FROM note_property_values v WHERE v.owner_id=n.user_id AND"
                    + " v.note_id=n.note_id AND v.property_key=?)";
            args.add(config.sort().key());
          }
          args.addAll(predicate.arguments());
          args.add(limit + 1);
          args.add(page * limit);
          var ids =
              jdbc
                  .queryForList(
                      "SELECT n.note_id, "
                          + ordering
                          + " AS sort_value"
                          + predicate.sql()
                          + " ORDER BY sort_value "
                          + ("desc".equals(config.sort().direction()) ? "DESC" : "ASC")
                          + " NULLS LAST,n.note_id LIMIT ? OFFSET ?",
                      args.toArray())
                  .stream()
                  .map(row -> ((Number) row.get("note_id")).longValue())
                  .toList();
          boolean more = ids.size() > limit;
          var visible = ids.subList(0, Math.min(ids.size(), limit));
          var rows = new ArrayList<Map<String, Object>>();
          if (!visible.isEmpty()) {
            var byId = new HashMap<Long, Map<String, Object>>();
            for (var row : properties.read(owner, visible))
              byId.put(((Number) row.get("noteId")).longValue(), new HashMap<>(row));
            for (long note : visible) {
              var row = byId.get(note);
              row.put(
                  "title",
                  jdbc.queryForObject(
                      "SELECT title FROM application.notes WHERE note_id=? AND user_id=?",
                      String.class,
                      note,
                      owner));
              row.put("formulas", formulas(config, (Map<?, ?>) row.get("values")));
              rows.add(row);
            }
          }
          return Map.of("query", saved, "rows", rows, "page", page, "hasMore", more);
        });
  }

  public record DatabaseColumn(String id, String name, String kind, List<String> options) {}

  public record DatabaseRow(String id, Map<String, JsonNode> cells) {}

  public record DatabaseImport(
      String id, String title, List<DatabaseColumn> columns, List<DatabaseRow> rows) {}

  public Map<String, Object> importDatabase(long owner, DatabaseImport input) {
    if (input == null
        || input.id() == null
        || input.id().isBlank()
        || input.id().length() > 256
        || input.title() == null
        || input.title().isBlank()
        || input.title().length() > 256
        || input.columns() == null
        || input.columns().isEmpty()
        || input.columns().size() > 20
        || input.rows() == null
        || input.rows().size() > 100) throw bad("INVALID_DATABASE_IMPORT");
    return tx.execute(
        status -> {
          jdbc.execute(
              "SELECT pg_advisory_xact_lock(hashtextextended('saved-queries:" + owner + "',0))");
          String prefix =
              "db."
                  + com.modulo.blueprint.approval.ApprovalService.hash(input.id()).substring(0, 16)
                  + ".";
          var definitions = new HashMap<String, Map<String, Object>>();
          for (var def : properties.definitions(owner))
            definitions.put(def.get("key").toString(), def);
          var keys = new LinkedHashMap<String, String>();
          for (var column : input.columns()) {
            if (column == null
                || column.id() == null
                || column.id().isBlank()
                || column.id().length() > 256
                || column.kind() == null
                || !Set.of("text", "number", "select", "checkbox", "date").contains(column.kind())
                || keys.containsKey(column.id())) throw bad("INVALID_DATABASE_COLUMN");
            String key =
                prefix
                    + com.modulo.blueprint.approval.ApprovalService.hash(column.id())
                        .substring(0, 16);
            keys.put(column.id(), key);
            String type = "checkbox".equals(column.kind()) ? "boolean" : column.kind();
            var options = column.options() == null ? List.<String>of() : column.options();
            if (!definitions.containsKey(key))
              properties.define(
                  owner, new NotePropertyService.Definition(key, column.name(), type, options, 0));
            else if (!type.equals(definitions.get(key).get("type"))
                || !json.valueToTree(options).equals(definitions.get(key).get("options")))
              throw bad("DATABASE_SCHEMA_CHANGED");
          }
          String origin = prefix + "origin";
          if (!definitions.containsKey(origin))
            properties.define(
                owner,
                new NotePropertyService.Definition(
                    origin, "Imported database", "text", List.of(), 0));
          int created = 0, retained = 0;
          var seen = new HashSet<String>();
          for (var row : input.rows()) {
            if (row == null
                || row.id() == null
                || row.id().isBlank()
                || row.id().length() > 256
                || !seen.add(row.id())
                || row.cells() == null
                || row.cells().size() > 20
                || row.cells().keySet().stream().anyMatch(key -> !keys.containsKey(key)))
              throw bad("INVALID_DATABASE_ROW");
            if (jdbc.queryForObject(
                    "SELECT count(*) FROM embedded_database_note_imports WHERE owner_id=? AND"
                        + " database_id=? AND row_id=?",
                    Integer.class,
                    owner,
                    input.id(),
                    row.id())
                > 0) {
              retained++;
              continue;
            }
            long note = jdbc.queryForObject("SELECT nextval('hibernate_sequence')", Long.class);
            String title = input.title() + " — " + row.id();
            if (title.length() > 256) title = title.substring(0, 256);
            String markdown = "# " + title + "\n\nImported from embedded database.\n";
            jdbc.update(
                "INSERT INTO"
                    + " application.notes(note_id,user_id,title,content,markdown_content,version,created_at,updated_at)"
                    + " VALUES (?,?,?,?,?,0,clock_timestamp(),clock_timestamp())",
                note,
                owner,
                title,
                markdown,
                markdown);
            var values = new LinkedHashMap<String, JsonNode>();
            values.put(origin, json.valueToTree(input.id()));
            for (var cell : row.cells().entrySet())
              values.put(keys.get(cell.getKey()), cell.getValue());
            properties.write(
                owner, List.of(new NotePropertyService.Change(note, 0, values, List.of())));
            jdbc.update(
                "INSERT INTO embedded_database_note_imports(owner_id,database_id,row_id,note_id)"
                    + " VALUES (?,?,?,?)",
                owner,
                input.id(),
                row.id(),
                note);
            created++;
          }
          var config =
              new Configuration(
                  List.of(
                      new NotePropertyService.Filter(origin, "eq", json.valueToTree(input.id()))),
                  new Sort("noteId", "asc"),
                  null,
                  new ArrayList<>(keys.values()),
                  List.of(),
                  "table");
          var previous =
              jdbc.queryForList(
                  "SELECT query_id FROM embedded_database_query_imports WHERE owner_id=? AND"
                      + " database_id=?",
                  owner,
                  input.id());
          Map<String, Object> query;
          if (!previous.isEmpty() && previous.get(0).get("query_id") != null)
            query = get(owner, (UUID) previous.get(0).get("query_id"));
          else {
            query = save(owner, new Save(null, 0, input.title(), config));
            jdbc.update(
                "INSERT INTO embedded_database_query_imports(owner_id,database_id,query_id) VALUES"
                    + " (?,?,?) ON CONFLICT(owner_id,database_id) DO UPDATE SET"
                    + " query_id=excluded.query_id",
                owner,
                input.id(),
                query.get("id"));
          }
          return Map.of("created", created, "retained", retained, "query", query);
        });
  }

  private Map<String, Object> formulas(Configuration config, Map<?, ?> values) {
    var result = new LinkedHashMap<String, Object>();
    for (var formula : config.formulas()) {
      if ("sum".equals(formula.operation())) {
        java.math.BigDecimal sum = java.math.BigDecimal.ZERO;
        boolean complete = true;
        for (String key : formula.keys()) {
          var value = (JsonNode) values.get(key);
          if (value == null || !value.isNumber()) {
            complete = false;
            break;
          }
          sum = sum.add(value.decimalValue());
        }
        result.put(formula.title(), complete ? sum : null);
      } else {
        var parts = new ArrayList<String>();
        for (String key : formula.keys()) {
          var value = (JsonNode) values.get(key);
          if (value != null && !value.isNull())
            parts.add(value.isTextual() ? value.asText() : value.toString());
        }
        result.put(formula.title(), String.join(" ", parts));
      }
    }
    return result;
  }

  private String encode(Object value) {
    try {
      return json.writeValueAsString(value);
    } catch (Exception failure) {
      throw bad("INVALID_QUERY_CONFIGURATION");
    }
  }

  private static ResponseStatusException bad(String reason) {
    return new ResponseStatusException(HttpStatus.BAD_REQUEST, reason);
  }

  private static ResponseStatusException conflict() {
    return new ResponseStatusException(HttpStatus.CONFLICT, "QUERY_VERSION_CHANGED");
  }
}
