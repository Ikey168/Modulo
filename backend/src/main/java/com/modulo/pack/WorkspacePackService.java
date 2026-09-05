package com.modulo.pack;

import com.fasterxml.jackson.databind.*;
import com.modulo.blueprint.approval.ApprovalService;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.*;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

@Service
public class WorkspacePackService {
  private final JdbcTemplate jdbc;
  private final ObjectMapper json;
  private final TransactionTemplate tx;

  public WorkspacePackService(
      JdbcTemplate jdbc, ObjectMapper json, PlatformTransactionManager manager) {
    this.jdbc = jdbc;
    this.json = json.copy().enable(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS);
    tx = new TransactionTemplate(manager);
    tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
  }

  public Map<String, Object> plan(long owner, PackManifest manifest, boolean demo) {
    return plan(owner, manifest, demo, null, false);
  }

  public Map<String, Object> planRollback(long owner, String pack, UUID release) {
    var rows =
        jdbc.queryForList(
            "SELECT r.manifest::text FROM workspace_pack_releases r JOIN"
                + " workspace_pack_installations i ON i.id=r.installation_id WHERE r.id=? AND"
                + " i.owner_id=? AND i.pack_key=?",
            release,
            owner,
            pack);
    if (rows.isEmpty()) throw unavailable();
    return plan(owner, manifest(rows.get(0).get("manifest").toString()), false, release, false);
  }

  public Map<String, Object> planUninstall(long owner, String pack) {
    var rows =
        jdbc.queryForList(
            "SELECT r.manifest::text FROM workspace_pack_installations i JOIN"
                + " workspace_pack_releases r ON r.id=i.active_release WHERE i.owner_id=? AND"
                + " i.pack_key=? AND i.state='ACTIVE'",
            owner,
            pack);
    if (rows.isEmpty()) throw unavailable();
    return plan(owner, manifest(rows.get(0).get("manifest").toString()), false, null, true);
  }

  private Map<String, Object> plan(
      long owner, PackManifest manifest, boolean demo, UUID target, boolean uninstall) {
    var valid = PackManifestValidator.validate(manifest);
    if (!valid.ok()) throw conflict(valid.reason());
    if (!Integer.valueOf(2).equals(manifest.getManifestVersion()))
      throw conflict("USE_LEGACY_V1_INSTALLER");
    return tx.execute(
        status -> {
          lock(owner);
          var current = current(owner, manifest.getId());
          UUID from = current == null ? null : (UUID) current.get("active_release");
          if (uninstall && from == null) throw unavailable();
          if (target != null && target.equals(from)) throw conflict("RELEASE_ALREADY_ACTIVE");
          if (!uninstall
              && target == null
              && current != null
              && "ACTIVE".equals(current.get("state"))
              && SemVer.parse(manifest.getVersion())
                      .compareTo(SemVer.parse(current.get("version").toString()))
                  <= 0) throw conflict("UPGRADE_REQUIRES_NEWER_VERSION");
          if (jdbc.queryForObject(
                  "SELECT count(*) FROM workspace_pack_operations WHERE owner_id=?",
                  Long.class,
                  owner)
              >= 10000) throw conflict("PACK_OPERATION_QUOTA");
          preflight(owner, manifest, current, uninstall);
          var required = new TreeSet<String>();
          if (!uninstall)
            for (var resource : manifest.getResources())
              if (demo || !"demoData".equals(resource.get("kind")))
                required.addAll(strings(resource.get("capabilities")));
          var changes = new ArrayList<Map<String, Object>>();
          var incoming = new HashSet<String>();
          if (!uninstall)
            for (String key : valid.order()) {
              var resource = resource(manifest, key);
              incoming.add(key);
              var old =
                  current == null
                      ? List.<Map<String, Object>>of()
                      : jdbc.queryForList(
                          "SELECT * FROM workspace_pack_resources WHERE installation_id=? AND"
                              + " resource_key=?",
                          current.get("id"),
                          key);
              changes.add(
                  Map.of(
                      "resource",
                      key,
                      "kind",
                      resource.get("kind"),
                      "action",
                      old.isEmpty()
                          ? "ADD"
                          : modified(old.get(0)) ? "PRESERVE_USER_CONFIGURATION" : "REPLACE"));
            }
          if (current != null)
            for (var old :
                jdbc.queryForList(
                    "SELECT * FROM workspace_pack_resources WHERE installation_id=? AND NOT"
                        + " detached ORDER BY resource_key",
                    current.get("id")))
              if (!incoming.contains(old.get("resource_key")))
                changes.add(
                    Map.of(
                        "resource",
                        old.get("resource_key"),
                        "kind",
                        old.get("kind"),
                        "action",
                        modified(old) ? "DETACH_USER_CONFIGURATION" : "REMOVE_CONFIGURATION"));
          var details =
              Map.of(
                  "changes",
                  changes,
                  "requiredCapabilities",
                  required,
                  "includeDemo",
                  demo,
                  "userContent",
                  "PRESERVED",
                  "pluginProvisioning",
                  "REQUIRES_EXISTING_OWNED_ACTIVE_IMAGE");
          UUID id = UUID.randomUUID();
          String encoded = encode(manifest);
          String digest = ApprovalService.hash(encoded);
          String kind =
              uninstall
                  ? "UNINSTALL"
                  : target != null ? "ROLLBACK" : from == null ? "INSTALL" : "UPGRADE";
          jdbc.update(
              "INSERT INTO"
                  + " workspace_pack_operations(id,owner_id,pack_key,kind,from_release,target_release,manifest,manifest_digest,dependency_snapshot,consent,include_demo,plan,status)"
                  + " VALUES (?,?,?,?,?,?,CAST(? AS jsonb),?,CAST(? AS jsonb),CAST(? AS"
                  + " jsonb),?,CAST(? AS jsonb),'PLANNED')",
              id,
              owner,
              manifest.getId(),
              kind,
              from,
              target,
              encoded,
              digest,
              encode(snapshot(owner)),
              encode(required),
              demo,
              encode(details));
          return operation(id, owner);
        });
  }

  public Map<String, Object> apply(
      UUID id, long owner, String expectedDigest, List<String> acceptedCapabilities) {
    try {
      return tx.execute(
          status -> {
            lock(owner);
            var rows =
                jdbc.queryForList(
                    "SELECT * FROM workspace_pack_operations WHERE id=? AND owner_id=? FOR UPDATE",
                    id,
                    owner);
            if (rows.isEmpty()) throw unavailable();
            var operation = rows.get(0);
            if (!Objects.equals(expectedDigest, operation.get("manifest_digest")))
              throw conflict("PLAN_DIGEST_CHANGED");
            if ("SUCCEEDED".equals(operation.get("status"))) return operation(id, owner);
            if (!"PLANNED".equals(operation.get("status"))) throw conflict("PLAN_NOT_APPLICABLE");
            if (acceptedCapabilities == null
                || !new TreeSet<>(acceptedCapabilities)
                    .equals(new TreeSet<>(readStrings(operation.get("consent").toString()))))
              throw conflict("CAPABILITY_CONSENT_REQUIRED");
            var manifest = manifest(operation.get("manifest").toString());
            var valid = PackManifestValidator.validate(manifest);
            if (!valid.ok() || !ApprovalService.hash(encode(manifest)).equals(expectedDigest))
              throw conflict("PLAN_MANIFEST_CHANGED");
            var current = current(owner, manifest.getId());
            if (!Objects.equals(
                    current == null ? null : current.get("active_release"),
                    operation.get("from_release"))
                || !jsonTree(encode(snapshot(owner)))
                    .equals(jsonTree(operation.get("dependency_snapshot").toString())))
              throw conflict("STALE_INSTALL_PLAN");
            boolean uninstall = "UNINSTALL".equals(operation.get("kind"));
            preflight(owner, manifest, current, uninstall);
            jdbc.update("UPDATE workspace_pack_operations SET status='APPLYING' WHERE id=?", id);
            afterStage("begin");
            UUID installation = current == null ? UUID.randomUUID() : (UUID) current.get("id");
            if (current == null)
              jdbc.update(
                  "INSERT INTO workspace_pack_installations(id,owner_id,pack_key,state) VALUES"
                      + " (?,?,?,'UNINSTALLED')",
                  installation,
                  owner,
                  manifest.getId());
            if (uninstall) {
              removeMissing(installation, owner, Set.of());
              jdbc.update(
                  "UPDATE workspace_pack_installations SET"
                      + " state='UNINSTALLED',active_release=NULL,updated_at=clock_timestamp()"
                      + " WHERE id=?",
                  installation);
            } else {
              UUID release = (UUID) operation.get("target_release");
              if (release == null) {
                var existing =
                    jdbc.queryForList(
                        "SELECT id,manifest_digest FROM workspace_pack_releases WHERE"
                            + " installation_id=? AND version=?",
                        installation,
                        manifest.getVersion());
                if (!existing.isEmpty()) {
                  if (!expectedDigest.equals(existing.get(0).get("manifest_digest")))
                    throw conflict("RELEASE_VERSION_IMMUTABLE");
                  release = (UUID) existing.get(0).get("id");
                } else {
                  release = UUID.randomUUID();
                  jdbc.update(
                      "INSERT INTO"
                          + " workspace_pack_releases(id,installation_id,version,manifest_digest,manifest)"
                          + " VALUES (?,?,?,?,CAST(? AS jsonb))",
                      release,
                      installation,
                      manifest.getVersion(),
                      expectedDigest,
                      encode(manifest));
                }
              }
              afterStage("release");
              var present = new HashSet<String>();
              for (String key : valid.order()) {
                var resource = resource(manifest, key);
                present.add(key);
                applyResource(
                    installation,
                    owner,
                    manifest,
                    resource,
                    (Boolean) operation.get("include_demo"),
                    acceptedCapabilities);
                afterStage("resource:" + key);
              }
              removeMissing(installation, owner, present);
              afterStage("removal");
              jdbc.update(
                  "UPDATE workspace_pack_installations SET"
                      + " active_release=?,state='ACTIVE',updated_at=clock_timestamp() WHERE id=?",
                  release,
                  installation);
            }
            afterStage("activation");
            jdbc.update(
                "UPDATE workspace_pack_operations SET"
                    + " status='SUCCEEDED',finished_at=clock_timestamp() WHERE id=?",
                id);
            afterStage("complete");
            return operation(id, owner);
          });
    } catch (ResponseStatusException failure) {
      if (failure.getStatus() != HttpStatus.NOT_FOUND
          && !Set.of("CAPABILITY_CONSENT_REQUIRED", "PLAN_DIGEST_CHANGED", "PLAN_NOT_APPLICABLE")
              .contains(Objects.toString(failure.getReason(), "")))
        markFailed(id, owner, failure.getReason());
      throw failure;
    } catch (RuntimeException failure) {
      markFailed(id, owner, "INSTALL_STAGE_FAILED");
      throw conflict("INSTALL_STAGE_FAILED");
    }
  }

  protected void afterStage(String stage) {}

  private void markFailed(UUID id, long owner, String reason) {
    tx.executeWithoutResult(
        status ->
            jdbc.update(
                "UPDATE workspace_pack_operations SET"
                    + " status='FAILED',failure_code=?,finished_at=clock_timestamp() WHERE id=? AND"
                    + " owner_id=? AND status='PLANNED'",
                reason,
                id,
                owner));
  }

  private void preflight(
      long owner, PackManifest manifest, Map<String, Object> current, boolean uninstall) {
    var versions = snapshot(owner);
    if (uninstall) {
      for (var row :
          jdbc.queryForList(
              "SELECT i.pack_key,r.manifest::text FROM workspace_pack_installations i JOIN"
                  + " workspace_pack_releases r ON r.id=i.active_release WHERE i.owner_id=? AND"
                  + " i.state='ACTIVE' AND i.pack_key<>?",
              owner,
              manifest.getId()))
        for (var dep : manifest(row.get("manifest").toString()).getDependencies())
          if (dep.getId().equals(manifest.getId())) throw conflict("DEPENDENT_PACK_BLOCKS_REMOVAL");
      return;
    }
    for (var dependency : manifest.getDependencies()) {
      var value = versions.get(dependency.getId());
      if (value == null) throw conflict("MISSING_DEPENDENCY:" + dependency.getId());
      var installed = SemVer.parse(value.get("version").toString());
      if (installed.compareTo(SemVer.parse(dependency.getMinVersion())) < 0)
        throw conflict("DEPENDENCY_VERSION_CONFLICT:" + dependency.getId());
    }
    for (var row :
        jdbc.queryForList(
            "SELECT r.manifest::text FROM workspace_pack_installations i JOIN"
                + " workspace_pack_releases r ON r.id=i.active_release WHERE i.owner_id=? AND"
                + " i.state='ACTIVE' AND i.pack_key<>?",
            owner,
            manifest.getId()))
      for (var dep : manifest(row.get("manifest").toString()).getDependencies())
        if (dep.getId().equals(manifest.getId())
            && SemVer.parse(manifest.getVersion()).compareTo(SemVer.parse(dep.getMinVersion())) < 0)
          throw conflict("DEPENDENT_PACK_REQUIRES_NEWER_VERSION");
    if (current != null) {
      var previous =
          jdbc.queryForList(
              "SELECT manifest_digest FROM workspace_pack_releases WHERE installation_id=? AND"
                  + " version=?",
              String.class,
              current.get("id"),
              manifest.getVersion());
      if (!previous.isEmpty() && !previous.get(0).equals(ApprovalService.hash(encode(manifest))))
        throw conflict("RELEASE_VERSION_IMMUTABLE");
    }
    for (var resource : manifest.getResources()) {
      if (current != null) {
        var prior =
            jdbc.queryForList(
                "SELECT kind FROM workspace_pack_resources WHERE installation_id=? AND"
                    + " resource_key=?",
                String.class,
                current.get("id"),
                resource.get("id"));
        if (!prior.isEmpty() && !prior.get(0).equals(resource.get("kind")))
          throw conflict("RESOURCE_KIND_CHANGE_REQUIRES_NEW_ID");
      }
      if ("plugin".equals(resource.get("kind"))) plugin(owner, spec(resource));
    }
  }

  private void applyResource(
      UUID installation,
      long owner,
      PackManifest manifest,
      Map<String, Object> resource,
      boolean demo,
      List<String> consent) {
    String key = resource.get("id").toString();
    String kind = resource.get("kind").toString();
    var spec = spec(resource);
    String digest = ApprovalService.hash(encode(spec));
    var rows =
        jdbc.queryForList(
            "SELECT * FROM workspace_pack_resources WHERE installation_id=? AND resource_key=? FOR"
                + " UPDATE",
            installation,
            key);
    var old = rows.isEmpty() ? null : rows.get(0);
    if (old != null && modified(old)) {
      jdbc.update(
          "UPDATE workspace_pack_resources SET user_modified=true,detached=false WHERE id=?",
          old.get("id"));
      return;
    }
    UUID resourceId = old == null ? UUID.randomUUID() : (UUID) old.get("id");
    Long registry = old == null ? null : (Long) old.get("registry_id");
    if (kind.equals("plugin")) registry = plugin(owner, spec);
    if (kind.equals("blueprint")) {
      String name =
          manifest.getId().substring(0, Math.min(60, manifest.getId().length())) + "." + key;
      String ir = encode(spec.get("ir"));
      if (registry == null) {
        if (jdbc.queryForObject(
                "SELECT count(*) FROM plugin_registry WHERE owner_id=? AND runtime='BLUEPRINT' AND"
                    + " blueprint_name=?",
                Long.class,
                owner,
                name)
            > 0) throw conflict("BLUEPRINT_NAME_CONFLICT");
        registry =
            jdbc.queryForObject(
                "INSERT INTO"
                    + " plugin_registry(name,owner_id,blueprint_name,version,description,author,type,runtime,status,config)"
                    + " VALUES (?,?,?,?,?,?,'INTERNAL','BLUEPRINT','ACTIVE',CAST(? AS jsonb))"
                    + " RETURNING id",
                Long.class,
                "blueprint." + UUID.randomUUID(),
                owner,
                name,
                manifest.getVersion(),
                resource.get("title"),
                Long.toString(owner),
                ir);
      } else
        jdbc.update(
            "UPDATE plugin_registry SET version=?,config=CAST(? AS"
                + " jsonb),status='ACTIVE',updated_at=clock_timestamp() WHERE id=? AND owner_id=?",
            manifest.getVersion(),
            ir,
            registry,
            owner);
      var required = strings(resource.get("capabilities"));
      jdbc.update("UPDATE plugin_permissions SET granted=false WHERE plugin_id=?", registry);
      for (String capability : required)
        jdbc.update(
            "INSERT INTO plugin_permissions(plugin_id,permission,granted) VALUES (?,?,?) ON"
                + " CONFLICT(plugin_id,permission) DO UPDATE SET granted=EXCLUDED.granted",
            registry,
            capability,
            consent.contains(capability));
      refresh(installation, registry);
    }
    jdbc.update(
        "INSERT INTO"
            + " workspace_pack_resources(id,installation_id,owner_id,resource_key,kind,title,spec,baseline_digest,registry_id)"
            + " VALUES (?,?,?,?,?,?,CAST(? AS jsonb),?,?) ON CONFLICT(installation_id,resource_key)"
            + " DO UPDATE SET"
            + " title=EXCLUDED.title,spec=EXCLUDED.spec,baseline_digest=EXCLUDED.baseline_digest,registry_id=EXCLUDED.registry_id,detached=false,updated_at=clock_timestamp()",
        resourceId,
        installation,
        owner,
        key,
        kind,
        resource.get("title"),
        encode(spec),
        digest,
        registry);
    if (kind.equals("demoData") && demo)
      for (var note : maps(spec.get("notes"))) {
        String demoKey = note.get("id").toString();
        if (jdbc.queryForObject(
                "SELECT count(*) FROM workspace_pack_demo_records WHERE installation_id=? AND"
                    + " resource_key=? AND demo_key=?",
                Long.class,
                installation,
                key,
                demoKey)
            > 0) continue;
        Long noteId =
            jdbc.queryForObject(
                "INSERT INTO"
                    + " application.notes(note_id,user_id,title,content,markdown_content,version,is_public,created_at,updated_at,last_editor)"
                    + " VALUES"
                    + " (nextval('hibernate_sequence'),?,?,?,?,0,false,clock_timestamp(),clock_timestamp(),?)"
                    + " RETURNING note_id",
                Long.class,
                owner,
                note.get("title"),
                note.get("markdown"),
                note.get("markdown"),
                Long.toString(owner));
        jdbc.update(
            "INSERT INTO workspace_pack_demo_records(installation_id,resource_key,demo_key,note_id)"
                + " VALUES (?,?,?,?)",
            installation,
            key,
            demoKey,
            noteId);
        jdbc.update(
            "INSERT INTO application.note_metadata(note_id,metadata_key,metadata_value) VALUES"
                + " (?,'pack.origin',?)",
            noteId,
            manifest.getId() + ":" + key + ":" + demoKey);
      }
  }

  private void removeMissing(UUID installation, long owner, Set<String> present) {
    for (var old :
        jdbc.queryForList(
            "SELECT * FROM workspace_pack_resources WHERE installation_id=? FOR UPDATE",
            installation))
      if (!present.contains(old.get("resource_key"))) {
        if (modified(old)) {
          jdbc.update(
              "UPDATE workspace_pack_resources SET user_modified=true,detached=true WHERE id=?",
              old.get("id"));
          continue;
        }
        if ("blueprint".equals(old.get("kind")) && old.get("registry_id") != null) {
          long registry = ((Number) old.get("registry_id")).longValue();
          jdbc.update("DELETE FROM plugin_registry WHERE id=? AND owner_id=?", registry, owner);
          refresh(installation, registry);
        }
        jdbc.update("DELETE FROM workspace_pack_resources WHERE id=?", old.get("id"));
      }
  }

  private boolean modified(Map<String, Object> resource) {
    if (Boolean.TRUE.equals(resource.get("user_modified"))
        || "blueprint".equals(resource.get("kind")) && resource.get("registry_id") == null)
      return true;
    if ("blueprint".equals(resource.get("kind")) && resource.get("registry_id") != null) {
      var rows =
          jdbc.queryForList(
              "SELECT config::text FROM plugin_registry WHERE id=? AND owner_id=?",
              String.class,
              resource.get("registry_id"),
              resource.get("owner_id"));
      if (rows.isEmpty()) return true;
      return !jsonTree(rows.get(0)).equals(jsonTree(resource.get("spec").toString()).path("ir"));
    }
    return false;
  }

  private Long plugin(long owner, Map<String, Object> spec) {
    var rows =
        jdbc.queryForList(
            "SELECT id FROM plugin_registry WHERE owner_id=? AND path=? AND runtime=? AND"
                + " status='ACTIVE' FOR SHARE",
            Long.class,
            owner,
            spec.get("image"),
            spec.get("runtime"));
    if (rows.size() != 1) throw conflict("PLUGIN_IMAGE_NOT_PROVISIONED");
    if (spec.containsKey("configuration")
        && !jsonTree(encode(spec.get("configuration")))
            .equals(
                jsonTree(
                    jdbc.queryForObject(
                        "SELECT config::text FROM plugin_registry WHERE id=?",
                        String.class,
                        rows.get(0)))))
      throw conflict("PLUGIN_CONFIGURATION_REQUIRES_PROVISIONING");
    return rows.get(0);
  }

  private void refresh(UUID installation, long registry) {
    jdbc.update(
        "INSERT INTO workspace_pack_runtime_refresh(registry_id,installation_id) VALUES (?,?) ON"
            + " CONFLICT(registry_id) DO UPDATE SET"
            + " requested_at=clock_timestamp(),attempts=0,last_error=NULL,completed_at=NULL",
        registry,
        installation);
  }

  private void lock(long owner) {
    if (jdbc.queryForList("SELECT id FROM users WHERE id=?", Long.class, owner).isEmpty())
      throw unavailable();
    jdbc.execute(
        "SELECT pg_advisory_xact_lock(hashtextextended('workspace-packs:" + owner + "',0))");
  }

  private Map<String, Object> current(long owner, String pack) {
    var rows =
        jdbc.queryForList(
            "SELECT i.*,r.version FROM workspace_pack_installations i LEFT JOIN"
                + " workspace_pack_releases r ON r.id=i.active_release WHERE i.owner_id=? AND"
                + " i.pack_key=?",
            owner,
            pack);
    return rows.isEmpty() ? null : rows.get(0);
  }

  private Map<String, Map<String, Object>> snapshot(long owner) {
    var result = new TreeMap<String, Map<String, Object>>();
    for (var row :
        jdbc.queryForList(
            "SELECT i.pack_key,i.active_release,r.version FROM workspace_pack_installations i JOIN"
                + " workspace_pack_releases r ON r.id=i.active_release WHERE i.owner_id=? AND"
                + " i.state='ACTIVE' ORDER BY i.pack_key",
            owner))
      result.put(
          row.get("pack_key").toString(),
          Map.of("release", row.get("active_release").toString(), "version", row.get("version")));
    return result;
  }

  public Map<String, Object> operation(UUID id, long owner) {
    var rows =
        jdbc.queryForList(
            "SELECT"
                + " id,pack_key,kind,from_release,target_release,manifest_digest,include_demo,plan::text,status,failure_code,created_at,finished_at"
                + " FROM workspace_pack_operations WHERE id=? AND owner_id=?",
            id,
            owner);
    if (rows.isEmpty()) throw unavailable();
    var result = rows.get(0);
    result.put("plan", jsonTree(result.get("plan").toString()));
    return result;
  }

  public List<Map<String, Object>> history(long owner, int page) {
    if (page < 0 || page > 10000) throw conflict("INVALID_HISTORY_PAGE");
    return jdbc.queryForList(
        "SELECT id,pack_key,kind,status,failure_code,created_at,finished_at FROM"
            + " workspace_pack_operations WHERE owner_id=? ORDER BY created_at DESC,id DESC LIMIT"
            + " 100 OFFSET ?",
        owner,
        page * 100L);
  }

  public List<Map<String, Object>> installations(long owner) {
    return jdbc.queryForList(
        "SELECT i.id,i.pack_key,i.state,i.active_release,r.version,i.updated_at,(SELECT count(*)"
            + " FROM workspace_pack_runtime_refresh q WHERE q.installation_id=i.id AND"
            + " q.completed_at IS NULL) AS runtime_pending FROM workspace_pack_installations i LEFT"
            + " JOIN workspace_pack_releases r ON r.id=i.active_release WHERE i.owner_id=? ORDER BY"
            + " i.pack_key",
        owner);
  }

  public List<Map<String, Object>> resources(long owner) {
    return jdbc.queryForList(
        "SELECT"
            + " r.id,r.resource_key,r.kind,r.title,r.spec::text,r.registry_id,r.user_modified,r.detached,i.pack_key"
            + " FROM workspace_pack_resources r JOIN workspace_pack_installations i ON"
            + " i.id=r.installation_id WHERE r.owner_id=? AND (i.state='ACTIVE' OR r.detached)"
            + " ORDER BY i.pack_key,r.resource_key",
        owner);
  }

  public int retryRuntime(long owner, String pack) {
    return jdbc.update(
        "UPDATE workspace_pack_runtime_refresh SET"
            + " attempts=0,last_error=NULL,completed_at=NULL,requested_at=clock_timestamp() WHERE"
            + " installation_id IN(SELECT id FROM workspace_pack_installations WHERE owner_id=? AND"
            + " pack_key=?)",
        owner,
        pack);
  }

  public List<Map<String, Object>> releases(long owner, String pack) {
    return jdbc.queryForList(
        "SELECT r.id,r.version,r.manifest_digest,r.created_at FROM workspace_pack_releases r JOIN"
            + " workspace_pack_installations i ON i.id=r.installation_id WHERE i.owner_id=? AND"
            + " i.pack_key=? ORDER BY r.created_at DESC",
        owner,
        pack);
  }

  private PackManifest manifest(String value) {
    try {
      return json.readValue(value, PackManifest.class);
    } catch (Exception invalid) {
      throw conflict("INVALID_MANIFEST");
    }
  }

  private JsonNode jsonTree(String value) {
    try {
      return json.readTree(value);
    } catch (Exception invalid) {
      throw conflict("INVALID_STORED_PACK_DATA");
    }
  }

  private String encode(Object value) {
    try {
      return json.writeValueAsString(value);
    } catch (Exception invalid) {
      throw conflict("INVALID_MANIFEST");
    }
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> spec(Map<String, Object> resource) {
    return (Map<String, Object>) resource.get("spec");
  }

  @SuppressWarnings("unchecked")
  private static List<Map<String, Object>> maps(Object value) {
    return (List<Map<String, Object>>) value;
  }

  @SuppressWarnings("unchecked")
  private static List<String> strings(Object value) {
    return (List<String>) value;
  }

  private List<String> readStrings(String value) {
    try {
      return json.readValue(
          value, json.getTypeFactory().constructCollectionType(List.class, String.class));
    } catch (Exception invalid) {
      throw conflict("INVALID_STORED_PACK_DATA");
    }
  }

  private static Map<String, Object> resource(PackManifest manifest, String id) {
    return manifest.getResources().stream()
        .filter(value -> id.equals(value.get("id")))
        .findFirst()
        .orElseThrow();
  }

  private static ResponseStatusException conflict(String code) {
    return new ResponseStatusException(HttpStatus.CONFLICT, code);
  }

  private static ResponseStatusException unavailable() {
    return new ResponseStatusException(HttpStatus.NOT_FOUND, "WORKSPACE_PACK_NOT_AVAILABLE");
  }
}
