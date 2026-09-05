package com.modulo.state;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.modulo.security.AuthenticatedUserService;
import java.nio.charset.StandardCharsets;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

/**
 * PostgreSQL owner-scoped storage. All writes, quota accounting and audit rows share a transaction.
 */
@Service
public class PluginStateStore {
  private static final Pattern SEGMENT = Pattern.compile("[A-Za-z0-9_-][A-Za-z0-9_.-]{0,127}");
  private final JdbcTemplate jdbc;
  private final TransactionTemplate transactions;
  private final AuthenticatedUserService users;
  private final ObjectMapper json;
  private final Limits limits;
  private final StateSchemaRegistry schemas;
  private AccessResolver access;

  public record Access(long owner, String plugin) {}

  @FunctionalInterface
  public interface AccessResolver {
    Access resolve(String workspace, String namespace, boolean write);
  }

  PluginStateStore delegated(AccessResolver resolver) {
    PluginStateStore copy =
        new PluginStateStore(jdbc, transactions.getTransactionManager(), users, json, limits);
    copy.access = resolver;
    return copy;
  }

  public record Limits(
      int recordBytes, int namespaceRecords, long namespaceBytes, long ownerBytes) {
    public static Limits defaults() {
      return new Limits(1_048_576, 10_000, 52_428_800, 262_144_000);
    }
  }

  public record StateRecord(
      String key,
      String schemaId,
      int schemaVersion,
      long version,
      JsonNode value,
      boolean deleted,
      String createdAt,
      String updatedAt) {}

  public record Change(
      long id,
      String key,
      String operation,
      long version,
      String createdAt,
      long ownerId,
      String workspace,
      String namespace,
      String schemaId,
      Integer schemaVersion,
      String plugin,
      String requestId) {}

  public record Page(List<StateRecord> records, String nextCursor) {}

  public record WriteRequest(
      long expectedVersion, String schemaId, int schemaVersion, JsonNode value) {}

  public StateRecord putJson(String workspace, String namespace, String key, String envelope) {
    if (envelope.getBytes(StandardCharsets.UTF_8).length > limits.recordBytes() + 4096) {
      throw error(HttpStatus.PAYLOAD_TOO_LARGE, "STATE_PAYLOAD_TOO_LARGE");
    }
    JsonNode body = parse(envelope);
    if (!body.isObject()
        || body.size() != 4
        || !body.has("value")
        || !body.path("expectedVersion").isIntegralNumber()
        || !body.path("expectedVersion").canConvertToLong()
        || !body.path("schemaVersion").isIntegralNumber()
        || !body.path("schemaVersion").canConvertToInt()
        || !body.path("schemaId").isTextual()) {
      throw error(HttpStatus.BAD_REQUEST, "STATE_INVALID_REQUEST");
    }
    return put(
        workspace,
        namespace,
        key,
        body.get("expectedVersion").longValue(),
        body.get("schemaId").textValue(),
        body.get("schemaVersion").intValue(),
        body.get("value").toString());
  }

  @Autowired
  public PluginStateStore(
      JdbcTemplate jdbc,
      PlatformTransactionManager manager,
      AuthenticatedUserService users,
      ObjectMapper json) {
    this(jdbc, manager, users, json, Limits.defaults());
  }

  public PluginStateStore(
      JdbcTemplate jdbc,
      PlatformTransactionManager manager,
      AuthenticatedUserService users,
      ObjectMapper json,
      Limits limits) {
    this.jdbc = jdbc;
    this.transactions = new TransactionTemplate(manager);
    this.users = users;
    this.json = json.copy().enable(JsonParser.Feature.STRICT_DUPLICATE_DETECTION);
    this.limits = limits;
    this.schemas = new StateSchemaRegistry(jdbc, this.json);
  }

  private boolean generationRequired;
  private String expectedGeneration;

  PluginStateStore forGeneration(String expected) {
    PluginStateStore guarded = delegated(access);
    guarded.generationRequired = true;
    guarded.expectedGeneration = expected;
    return guarded;
  }

  public record StorageGeneration(String generation) {}

  public StorageGeneration generation(String workspace, String namespace) {
    try {
      scope(workspace, namespace, null);
    } catch (ResponseStatusException denied) {
      scope(workspace, namespace, null, true);
    }
    return new StorageGeneration(
        jdbc.queryForObject(
            "SELECT generation::text FROM plugin_state_storage WHERE singleton=1", String.class));
  }

  private void checkGeneration() {
    if (!generationRequired) return; // Trusted in-process mutations do not replay browser queues.
    if (expectedGeneration == null)
      throw error(HttpStatus.PRECONDITION_REQUIRED, "STATE_STORAGE_GENERATION_REQUIRED");
    String current =
        jdbc.queryForObject(
            "SELECT generation::text FROM plugin_state_storage WHERE singleton=1 FOR SHARE",
            String.class);
    if (!current.equals(expectedGeneration))
      throw error(HttpStatus.PRECONDITION_FAILED, "STATE_STORAGE_GENERATION_CHANGED");
  }

  public StateRecord get(String workspace, String namespace, String key) {
    long owner = scope(workspace, namespace, key);
    StateRecord current = find(owner, workspace, namespace, key);
    if (current == null || current.deleted()) throw error(HttpStatus.NOT_FOUND, "STATE_NOT_FOUND");
    return current;
  }

  public Page list(String workspace, String namespace, String after, int limit) {
    long owner = scope(workspace, namespace, null);
    if (limit < 1 || limit > 200) throw error(HttpStatus.BAD_REQUEST, "STATE_INVALID_PAGE_SIZE");
    // The key cursor is not an authority token. Every page repeats the full owner predicate.
    if (after != null && !after.isEmpty()) segment(after);
    List<StateRecord> result =
        jdbc.query(
            "SELECT * FROM plugin_state WHERE owner_id=? "
                + "AND workspace_id=? AND namespace=? AND NOT deleted AND state_key>? "
                + "ORDER BY state_key LIMIT ?",
            mapper(),
            owner,
            workspace,
            namespace,
            after == null ? "" : after,
            limit + 1);
    boolean more = result.size() > limit;
    List<StateRecord> records = more ? List.copyOf(result.subList(0, limit)) : List.copyOf(result);
    return new Page(records, more ? records.get(records.size() - 1).key() : null);
  }

  public List<Change> changes(String workspace, String namespace, long after, int limit) {
    long owner = scope(workspace, namespace, null);
    if (after < 0 || limit < 1 || limit > 200)
      throw error(HttpStatus.BAD_REQUEST, "STATE_INVALID_CURSOR");
    return jdbc.query(
        "SELECT * FROM plugin_state_events "
            + "WHERE owner_id=? AND workspace_id=? AND namespace=? AND id>? ORDER BY id LIMIT ?",
        (rs, row) ->
            new Change(
                rs.getLong("id"),
                rs.getString("state_key"),
                rs.getString("operation"),
                rs.getLong("version"),
                rs.getString("created_at"),
                rs.getLong("owner_id"),
                rs.getString("workspace_id"),
                rs.getString("namespace"),
                rs.getString("schema_id"),
                (Integer) rs.getObject("schema_version"),
                rs.getString("actor_plugin"),
                rs.getString("request_id")),
        owner,
        workspace,
        namespace,
        after,
        limit);
  }

  public StateRecord put(
      String workspace,
      String namespace,
      String key,
      long expectedVersion,
      String schemaId,
      int schemaVersion,
      String document) {
    long owner = scope(workspace, namespace, key, true);
    if (expectedVersion < 0
        || expectedVersion == Long.MAX_VALUE
        || schemaId == null
        || schemaId.isBlank()
        || schemaId.length() > 256
        || schemaVersion < 1) {
      throw error(HttpStatus.BAD_REQUEST, "STATE_INVALID_METADATA");
    }
    if (document == null
        || document.getBytes(StandardCharsets.UTF_8).length > limits.recordBytes()) {
      throw error(HttpStatus.PAYLOAD_TOO_LARGE, "STATE_PAYLOAD_TOO_LARGE");
    }
    JsonNode value = parse(document);
    String serialized = value.toString();
    int bytes = serialized.getBytes(StandardCharsets.UTF_8).length;
    if (bytes > limits.recordBytes())
      throw error(HttpStatus.PAYLOAD_TOO_LARGE, "STATE_PAYLOAD_TOO_LARGE");
    return transactions.execute(
        status -> {
          lockOwner(owner);
          checkGeneration();
          if (scope(workspace, namespace, key, true) != owner)
            throw error(HttpStatus.NOT_FOUND, "STATE_ACCESS_REVOKED");
          if (jdbc.queryForObject(
                  "SELECT count(*) FROM plugin_state_events WHERE owner_id=?", Long.class, owner)
              >= 100_000) throw error(HttpStatus.TOO_MANY_REQUESTS, "STATE_EVENT_QUOTA_EXCEEDED");
          schemas.validate(owner, namespace, schemaId, schemaVersion, value);
          OperationalSchemas.validate(schemaId, key, value);
          StateRecord current = find(owner, workspace, namespace, key);
          compare(current, expectedVersion, workspace, namespace);
          if (current != null
              && current.schemaId().equals(schemaId)
              && current.schemaVersion() > schemaVersion)
            throw error(HttpStatus.BAD_REQUEST, "STATE_SCHEMA_DOWNGRADE");
          // Tombstones count against record quota, preventing unbounded unique-key churn.
          long count =
              jdbc.queryForObject(
                  "SELECT COUNT(*) FROM plugin_state WHERE owner_id=? AND namespace=?",
                  Long.class,
                  owner,
                  namespace);
          long namespaceBytes =
              jdbc.queryForObject(
                  "SELECT COALESCE(SUM(payload_bytes),0) FROM plugin_state "
                      + "WHERE owner_id=? AND namespace=?",
                  Long.class,
                  owner,
                  namespace);
          long ownerBytes =
              jdbc.queryForObject(
                  "SELECT COALESCE(SUM(payload_bytes),0) FROM plugin_state " + "WHERE owner_id=?",
                  Long.class,
                  owner);
          int previousBytes =
              current == null
                  ? 0
                  : jdbc.queryForObject(
                      "SELECT payload_bytes FROM plugin_state "
                          + "WHERE owner_id=? AND workspace_id=? AND namespace=? AND state_key=?",
                      Integer.class,
                      owner,
                      workspace,
                      namespace,
                      key);
          if ((current == null && count >= limits.namespaceRecords())
              || namespaceBytes - previousBytes + bytes > limits.namespaceBytes()
              || ownerBytes - previousBytes + bytes > limits.ownerBytes()) {
            throw error(HttpStatus.TOO_MANY_REQUESTS, "STATE_QUOTA_EXCEEDED");
          }
          long version = expectedVersion + 1;
          if (current == null) {
            jdbc.update(
                "INSERT INTO"
                    + " plugin_state(owner_id,workspace_id,namespace,state_key,schema_id,schema_version,version,value,payload_bytes)"
                    + " VALUES (?,?,?,?,?,?,?,CAST(? AS jsonb),?)",
                owner,
                workspace,
                namespace,
                key,
                schemaId,
                schemaVersion,
                version,
                serialized,
                bytes);
          } else {
            jdbc.update(
                "UPDATE plugin_state SET schema_id=?,schema_version=?,version=?,value=CAST(? AS"
                    + " jsonb),payload_bytes=?,deleted=FALSE,updated_at=CURRENT_TIMESTAMP WHERE"
                    + " owner_id=? AND workspace_id=? AND namespace=? AND state_key=?",
                schemaId,
                schemaVersion,
                version,
                serialized,
                bytes,
                owner,
                workspace,
                namespace,
                key);
          }
          event(owner, workspace, namespace, key, current == null ? "create" : "update", version);
          return find(owner, workspace, namespace, key);
        });
  }

  public StateRecord delete(String workspace, String namespace, String key, long expectedVersion) {
    long owner = scope(workspace, namespace, key, true);
    if (expectedVersion < 1 || expectedVersion == Long.MAX_VALUE) {
      throw error(HttpStatus.BAD_REQUEST, "STATE_INVALID_VERSION");
    }
    return transactions.execute(
        status -> {
          lockOwner(owner);
          checkGeneration();
          if (scope(workspace, namespace, key, true) != owner)
            throw error(HttpStatus.NOT_FOUND, "STATE_ACCESS_REVOKED");
          if (jdbc.queryForObject(
                  "SELECT count(*) FROM plugin_state_events WHERE owner_id=?", Long.class, owner)
              >= 100_000) throw error(HttpStatus.TOO_MANY_REQUESTS, "STATE_EVENT_QUOTA_EXCEEDED");
          StateRecord current = find(owner, workspace, namespace, key);
          compare(current, expectedVersion, workspace, namespace);
          if (current.deleted()) throw error(HttpStatus.NOT_FOUND, "STATE_NOT_FOUND");
          jdbc.update(
              "UPDATE plugin_state SET"
                  + " deleted=TRUE,value=NULL,payload_bytes=0,version=?,updated_at=CURRENT_TIMESTAMP"
                  + " WHERE owner_id=? AND workspace_id=? AND namespace=? AND state_key=?",
              expectedVersion + 1,
              owner,
              workspace,
              namespace,
              key);
          event(owner, workspace, namespace, key, "delete", expectedVersion + 1);
          return find(owner, workspace, namespace, key);
        });
  }

  public void registerSchema(
      String workspace, String namespace, String id, int version, String definition) {
    if (access != null) throw error(HttpStatus.NOT_FOUND, "STATE_ACCESS_DENIED");
    long owner = scope(workspace, namespace, null, true);
    if (definition == null || definition.getBytes(StandardCharsets.UTF_8).length > 16384)
      throw error(HttpStatus.PAYLOAD_TOO_LARGE, "STATE_SCHEMA_TOO_LARGE");
    JsonNode schema = parse(definition);
    transactions.executeWithoutResult(
        status -> {
          lockOwner(owner);
          schemas.register(owner, namespace, id, version, schema);
        });
  }

  private long scope(String workspace, String namespace, String key) {
    return scope(workspace, namespace, key, false);
  }

  private long scope(String workspace, String namespace, String key, boolean write) {
    long owner =
        access == null
            ? users.requireUserId()
            : access.resolve(workspace, namespace, write).owner();
    segment(workspace);
    segment(namespace);
    if (key != null) segment(key);
    // Only personal workspaces exist today. Unknown workspace names are not implicit grants.
    if (!"personal".equals(workspace)
        || namespace.equals("core")
        || namespace.startsWith("core.")) {
      throw error(HttpStatus.NOT_FOUND, "STATE_NAMESPACE_NOT_AVAILABLE");
    }
    return owner;
  }

  private void segment(String value) {
    if (value == null || !SEGMENT.matcher(value).matches()) {
      throw error(HttpStatus.BAD_REQUEST, "STATE_INVALID_SEGMENT");
    }
  }

  private void lockOwner(long owner) {
    if (jdbc.queryForList("SELECT id FROM users WHERE id=? FOR UPDATE", Long.class, owner)
        .isEmpty()) {
      throw error(HttpStatus.FORBIDDEN, "STATE_OWNER_NOT_FOUND");
    }
  }

  private StateRecord find(long owner, String workspace, String namespace, String key) {
    List<StateRecord> records =
        jdbc.query(
            "SELECT * FROM plugin_state WHERE owner_id=? "
                + "AND workspace_id=? AND namespace=? AND state_key=?",
            mapper(),
            owner,
            workspace,
            namespace,
            key);
    return records.isEmpty() ? null : records.get(0);
  }

  private void compare(StateRecord current, long expected, String workspace, String namespace) {
    long actual = current == null ? 0 : current.version();
    if (actual != expected) {
      boolean readable = true;
      if (access != null) {
        try {
          access.resolve(workspace, namespace, false);
        } catch (ResponseStatusException denied) {
          readable = false;
        }
      }
      throw new VersionConflict(expected, actual, readable ? current : null);
    }
  }

  private void event(
      long owner, String workspace, String namespace, String key, String operation, long version) {
    String plugin = access == null ? "host" : access.resolve(workspace, namespace, true).plugin();
    jdbc.update(
        "INSERT INTO"
            + " plugin_state_events(owner_id,workspace_id,namespace,state_key,operation,version,schema_id,schema_version,actor_plugin,request_id)"
            + " SELECT"
            + " owner_id,workspace_id,namespace,state_key,?,version,schema_id,schema_version,?,?"
            + " FROM plugin_state WHERE owner_id=? AND workspace_id=? AND namespace=? AND"
            + " state_key=?",
        operation,
        plugin,
        java.util.UUID.randomUUID(),
        owner,
        workspace,
        namespace,
        key);
  }

  private JsonNode parse(String document) {
    try (JsonParser parser = json.createParser(document)) {
      // Scan depth before building a tree, avoiding recursion on malicious input.
      int depth = 0;
      while (parser.nextToken() != null) {
        if (parser.currentToken().isStructStart() && ++depth > 64) {
          throw error(HttpStatus.BAD_REQUEST, "STATE_JSON_TOO_DEEP");
        }
        if (parser.currentToken().isStructEnd()) depth--;
      }
    } catch (ResponseStatusException e) {
      throw e;
    } catch (Exception e) {
      throw error(HttpStatus.BAD_REQUEST, "STATE_INVALID_JSON");
    }
    try (JsonParser parser = json.createParser(document)) {
      JsonNode value = json.readTree(parser);
      if (value == null || parser.nextToken() != null)
        throw error(HttpStatus.BAD_REQUEST, "STATE_INVALID_JSON");
      return value;
    } catch (ResponseStatusException e) {
      throw e;
    } catch (Exception e) {
      throw error(HttpStatus.BAD_REQUEST, "STATE_INVALID_JSON");
    }
  }

  private RowMapper<StateRecord> mapper() {
    return (rs, row) ->
        new StateRecord(
            rs.getString("state_key"),
            rs.getString("schema_id"),
            rs.getInt("schema_version"),
            rs.getLong("version"),
            readValue(rs),
            rs.getBoolean("deleted"),
            rs.getString("created_at"),
            rs.getString("updated_at"));
  }

  private JsonNode readValue(ResultSet rs) throws SQLException {
    String value = rs.getString("value");
    if (value == null) return null;
    try {
      return json.readTree(value);
    } catch (Exception e) {
      throw new SQLException("Invalid stored state JSON", e);
    }
  }

  private static ResponseStatusException error(HttpStatus status, String code) {
    return new ResponseStatusException(status, code);
  }

  public static class VersionConflict extends ResponseStatusException {
    public final long expectedVersion;
    public final long actualVersion;
    public final StateRecord current;

    VersionConflict(long expected, long actual, StateRecord current) {
      super(HttpStatus.CONFLICT, "STATE_VERSION_CONFLICT");
      this.expectedVersion = expected;
      this.actualVersion = actual;
      this.current = current;
    }
  }
}
