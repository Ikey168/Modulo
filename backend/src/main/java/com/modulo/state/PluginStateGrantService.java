package com.modulo.state;

import com.modulo.plugin.manager.*;
import com.modulo.plugin.registry.PluginRegistry;
import com.modulo.security.AuthenticatedUserService;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

/**
 * A workload token proves plugin identity; a separate revocable grant proves the owner's consent.
 */
@Service
public class PluginStateGrantService {
  private final JdbcTemplate jdbc;
  private final TransactionTemplate transactions;
  private final AuthenticatedUserService users;
  private final PluginSecurityManager plugins;
  private final PluginRegistry registry;

  public PluginStateGrantService(
      JdbcTemplate jdbc,
      PlatformTransactionManager manager,
      AuthenticatedUserService users,
      PluginSecurityManager plugins,
      PluginRegistry registry) {
    this.jdbc = jdbc;
    this.transactions = new TransactionTemplate(manager);
    this.users = users;
    this.plugins = plugins;
    this.registry = registry;
  }

  public record GrantRequest(String pluginId, Set<String> permissions, int lifetimeSeconds) {}

  public record WorkloadRequest(String pluginId, Set<String> permissions, int lifetimeSeconds) {}

  public record Workload(
      String id, String pluginId, Set<String> permissions, String expiresAt, boolean revoked) {}

  public record IssuedWorkload(Workload workload, String token) {}

  public record Grant(
      String id, String namespace, Set<String> permissions, String expiresAt, boolean revoked) {}

  public record IssuedGrant(Grant grant, String token) {}

  private record WorkloadAccess(long owner, String pluginId, boolean canRead, boolean canWrite) {}

  public IssuedWorkload createWorkload(WorkloadRequest request) {
    long owner = users.requireUserId();
    if (request == null
        || !validPluginId(request.pluginId())
        || request.permissions() == null
        || request.permissions().isEmpty()
        || !Set.of("state.read", "state.write").containsAll(request.permissions())
        || request.lifetimeSeconds() < 3600
        || request.lifetimeSeconds() > 7_776_000)
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "STATE_INVALID_WORKLOAD");
    return transactions.execute(
        status -> {
          lockOwner(owner);
          long active = jdbc.queryForObject(
              "SELECT count(*) FROM plugin_state_workloads WHERE owner_id=? AND plugin_id=?"
                  + " AND NOT revoked AND expires_at>CURRENT_TIMESTAMP",
              Long.class, owner, request.pluginId());
          if (active >= 10) throw new ResponseStatusException(
              HttpStatus.TOO_MANY_REQUESTS, "STATE_WORKLOAD_QUOTA_EXCEEDED");
          byte[] bytes = new byte[32];
          new SecureRandom().nextBytes(bytes);
          String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
          String id = hash(token);
          Instant expires = Instant.now().plusSeconds(request.lifetimeSeconds());
          jdbc.update(
              "INSERT INTO plugin_state_workloads"
                  + "(token_hash,owner_id,plugin_id,can_read,can_write,expires_at) VALUES (?,?,?,?,?,?)",
              id, owner, request.pluginId(), request.permissions().contains("state.read"),
              request.permissions().contains("state.write"), java.sql.Timestamp.from(expires));
          return new IssuedWorkload(
              new Workload(id, request.pluginId(), Set.copyOf(request.permissions()),
                  expires.toString(), false), token);
        });
  }

  public List<Workload> listWorkloads() {
    return jdbc.query(
        "SELECT * FROM plugin_state_workloads WHERE owner_id=? ORDER BY created_at DESC LIMIT 200",
        (rs, row) -> {
          Set<String> permissions = new HashSet<>();
          if (rs.getBoolean("can_read")) permissions.add("state.read");
          if (rs.getBoolean("can_write")) permissions.add("state.write");
          return new Workload(rs.getString("token_hash"), rs.getString("plugin_id"),
              Set.copyOf(permissions), rs.getTimestamp("expires_at").toInstant().toString(),
              rs.getBoolean("revoked"));
        }, users.requireUserId());
  }

  public void revokeWorkload(String id) {
    long owner = users.requireUserId();
    transactions.executeWithoutResult(status -> {
      lockOwner(owner);
      if (jdbc.update("UPDATE plugin_state_workloads SET revoked=TRUE"
              + " WHERE token_hash=? AND owner_id=?", id, owner) != 1) throw denied();
      jdbc.update("UPDATE plugin_state_grants SET revoked=TRUE"
          + " WHERE owner_id=? AND plugin_id=(SELECT plugin_id FROM plugin_state_workloads"
          + " WHERE token_hash=? AND owner_id=?)", owner, id, owner);
    });
  }

  public IssuedGrant create(String workspace, GrantRequest request) {
    long owner = users.requireUserId();
    if (!"personal".equals(workspace)
        || request == null
        || request.permissions() == null
        || request.permissions().isEmpty()
        || !Set.of("state.read", "state.write").containsAll(request.permissions())
        || request.lifetimeSeconds() < 1
        || request.lifetimeSeconds() > 3600)
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "STATE_INVALID_GRANT");
    String plugin = request.pluginId();
    validatePlugin(owner, plugin, request.permissions());
    return transactions.execute(
        status -> {
          lockOwner(owner);
          long count =
              jdbc.queryForObject(
                  "SELECT count(*) FROM plugin_state_grants WHERE owner_id=? AND NOT revoked AND"
                      + " expires_at>CURRENT_TIMESTAMP",
                  Long.class,
                  owner);
          long total =
              jdbc.queryForObject(
                  "SELECT count(*) FROM plugin_state_grants WHERE owner_id=?", Long.class, owner);
          if (count >= 100 || total >= 1000)
            throw new ResponseStatusException(
                HttpStatus.TOO_MANY_REQUESTS, "STATE_GRANT_QUOTA_EXCEEDED");
          byte[] bytes = new byte[32];
          new SecureRandom().nextBytes(bytes);
          String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes),
              id = hash(token);
          Instant expires = Instant.now().plusSeconds(request.lifetimeSeconds());
          jdbc.update(
              "INSERT INTO"
                  + " plugin_state_grants(token_hash,owner_id,workspace_id,namespace,plugin_id,can_read,can_write,expires_at)"
                  + " VALUES (?,?,?,?,?,?,?,?)",
              id,
              owner,
              workspace,
              plugin,
              plugin,
              request.permissions().contains("state.read"),
              request.permissions().contains("state.write"),
              java.sql.Timestamp.from(expires));
          return new IssuedGrant(
              new Grant(id, plugin, Set.copyOf(request.permissions()), expires.toString(), false),
              token);
        });
  }

  public List<Grant> list() {
    return jdbc.query(
        "SELECT * FROM plugin_state_grants WHERE owner_id=? ORDER BY created_at DESC LIMIT 200",
        (rs, row) -> {
          Set<String> permissions = new HashSet<>();
          if (rs.getBoolean("can_read")) permissions.add("state.read");
          if (rs.getBoolean("can_write")) permissions.add("state.write");
          return new Grant(
              rs.getString("token_hash"),
              rs.getString("namespace"),
              permissions,
              rs.getTimestamp("expires_at").toInstant().toString(),
              rs.getBoolean("revoked"));
        },
        users.requireUserId());
  }

  public void revoke(String id) {
    long owner = users.requireUserId();
    transactions.executeWithoutResult(
        status -> {
          lockOwner(owner);
          if (jdbc.update(
                  "UPDATE plugin_state_grants SET revoked=TRUE WHERE token_hash=? AND owner_id=?",
                  id,
                  owner)
              != 1) throw denied();
        });
  }

  PluginStateStore delegate(PluginStateStore store, String workloadToken, String grantToken) {
    return store.delegated(
        (workspace, namespace, write) ->
            authorize(workloadToken, grantToken, workspace, namespace, write));
  }

  PluginStateStore.Access authorize(
      String workloadToken, String grantToken, String workspace, String namespace, boolean write) {
    if (workloadToken == null
        || grantToken == null
        || workloadToken.length() > 256
        || grantToken.length() > 256) throw denied();
    String plugin = plugins.validatePluginToken(workloadToken);
    WorkloadAccess workload = persistentWorkload(workloadToken);
    if (plugin == null && workload != null) plugin = workload.pluginId();
    if (plugin == null || !plugin.equals(namespace)) throw denied();
    String permission = write ? "state.write" : "state.read";
    if (workload != null) {
      if ((write && !workload.canWrite()) || (!write && !workload.canRead())) throw denied();
    } else validatePlugin(null, plugin, Set.of(permission));
    var owners =
        jdbc.queryForList(
            "SELECT owner_id FROM plugin_state_grants WHERE token_hash=? AND plugin_id=? AND"
                + " namespace=? AND workspace_id=? AND NOT revoked AND expires_at>CURRENT_TIMESTAMP"
                + " AND "
                + (write ? "can_write" : "can_read"),
            Long.class,
            hash(grantToken),
            plugin,
            namespace,
            workspace);
    if (owners.size() != 1 || (workload != null && owners.get(0) != workload.owner())) throw denied();
    return new PluginStateStore.Access(owners.get(0), plugin);
  }

  public IssuedGrant renew(String workloadToken, String grantToken, int lifetimeSeconds) {
    if (lifetimeSeconds < 60 || lifetimeSeconds > 3600) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "STATE_INVALID_GRANT");
    }
    WorkloadAccess workload = persistentWorkload(workloadToken);
    if (workload == null) throw denied();
    return transactions.execute(status -> {
      lockOwner(workload.owner());
      var rows = jdbc.queryForList(
          "SELECT token_hash,workspace_id,namespace,can_read,can_write FROM plugin_state_grants"
              + " WHERE token_hash=? AND owner_id=? AND plugin_id=? AND NOT revoked"
              + " AND expires_at>CURRENT_TIMESTAMP FOR UPDATE",
          hash(grantToken), workload.owner(), workload.pluginId());
      if (rows.size() != 1) throw denied();
      var row = rows.get(0);
      boolean canRead = Boolean.TRUE.equals(row.get("can_read"));
      boolean canWrite = Boolean.TRUE.equals(row.get("can_write"));
      if ((canRead && !workload.canRead()) || (canWrite && !workload.canWrite())) throw denied();
      jdbc.update("UPDATE plugin_state_grants SET revoked=TRUE WHERE token_hash=?",
          row.get("token_hash"));
      byte[] bytes = new byte[32];
      new SecureRandom().nextBytes(bytes);
      String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
      String id = hash(token);
      Instant expires = Instant.now().plusSeconds(lifetimeSeconds);
      jdbc.update(
          "INSERT INTO plugin_state_grants"
              + "(token_hash,owner_id,workspace_id,namespace,plugin_id,can_read,can_write,expires_at)"
              + " VALUES (?,?,?,?,?,?,?,?)",
          id, workload.owner(), row.get("workspace_id"), row.get("namespace"),
          workload.pluginId(), canRead, canWrite, java.sql.Timestamp.from(expires));
      Set<String> permissions = new HashSet<>();
      if (canRead) permissions.add("state.read");
      if (canWrite) permissions.add("state.write");
      return new IssuedGrant(new Grant(id, String.valueOf(row.get("namespace")),
          Set.copyOf(permissions), expires.toString(), false), token);
    });
  }

  private void validatePlugin(Long owner, String plugin, Set<String> permissions) {
    if (!validPluginId(plugin)) throw denied();
    if (owner != null) {
      long count = jdbc.queryForObject(
          "SELECT count(*) FROM plugin_state_workloads WHERE owner_id=? AND plugin_id=?"
              + " AND NOT revoked AND expires_at>CURRENT_TIMESTAMP"
              + (permissions.contains("state.read") ? " AND can_read" : "")
              + (permissions.contains("state.write") ? " AND can_write" : ""),
          Long.class, owner, plugin);
      if (count > 0) return;
    }
    var entry = registry.getByName(plugin).orElseThrow(PluginStateGrantService::denied);
    if (entry.getStatus() != PluginStatus.ACTIVE || !"EXTERNAL".equals(entry.getType()))
      throw denied();
    var durable = registry.getPluginPermissions(plugin);
    for (String permission : permissions)
      if (!plugins.hasPermission(plugin, permission)
          || durable.stream().noneMatch(p -> permission.equals(p.getPermission())
              && Boolean.TRUE.equals(p.getGranted()))) throw denied();
  }

  private static boolean validPluginId(String plugin) {
    return plugin != null
        && plugin.matches("[A-Za-z0-9_-][A-Za-z0-9_.-]{0,127}")
        && !plugin.equals("core")
        && !plugin.startsWith("core.")
        && !plugin.equals("workspace-settings");
  }

  private WorkloadAccess persistentWorkload(String token) {
    if (token == null || token.length() > 256) return null;
    var rows = jdbc.query(
        "SELECT owner_id,plugin_id,can_read,can_write FROM plugin_state_workloads"
            + " WHERE token_hash=? AND NOT revoked AND expires_at>CURRENT_TIMESTAMP",
        (rs, row) -> new WorkloadAccess(rs.getLong("owner_id"), rs.getString("plugin_id"),
            rs.getBoolean("can_read"), rs.getBoolean("can_write")), hash(token));
    return rows.size() == 1 ? rows.get(0) : null;
  }

  private void lockOwner(long owner) {
    if (jdbc.queryForList("SELECT id FROM users WHERE id=? FOR UPDATE", Long.class, owner)
        .isEmpty()) throw denied();
  }

  private static String hash(String token) {
    try {
      return HexFormat.of()
          .formatHex(
              MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException impossible) {
      throw new IllegalStateException(impossible);
    }
  }

  private static ResponseStatusException denied() {
    return new ResponseStatusException(HttpStatus.NOT_FOUND, "STATE_ACCESS_DENIED");
  }
}
