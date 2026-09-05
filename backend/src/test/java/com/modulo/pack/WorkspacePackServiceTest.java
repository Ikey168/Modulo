package com.modulo.pack;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.*;
import java.nio.file.*;
import java.util.*;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
import org.springframework.web.server.ResponseStatusException;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;

@Testcontainers
class WorkspacePackServiceTest {
  @Container
  static final PostgreSQLContainer<?> database = new PostgreSQLContainer<>("postgres:16-alpine");

  static DriverManagerDataSource source;
  JdbcTemplate jdbc;
  ObjectMapper json = new ObjectMapper();
  WorkspacePackService packs;

  @BeforeAll
  static void migrate() {
    source =
        new DriverManagerDataSource(
            database.getJdbcUrl(), database.getUsername(), database.getPassword());
    Flyway.configure().dataSource(source).locations("classpath:db/postgresql").load().migrate();
  }

  @BeforeEach
  void setup() {
    jdbc = new JdbcTemplate(source);
    jdbc.execute("TRUNCATE users,plugin_registry,application.notes CASCADE");
    jdbc.update("INSERT INTO users(id,username) VALUES(1,'owner'),(2,'other')");
    packs = new WorkspacePackService(jdbc, json, new DataSourceTransactionManager(source));
  }

  PackManifest sample(String name) throws Exception {
    return json.readValue(
        Files.readString(Path.of("../shared/packs/" + name + ".v2.json")), PackManifest.class);
  }

  @SuppressWarnings("unchecked")
  List<String> consent(Map<String, Object> plan) {
    return json.convertValue(((JsonNode) plan.get("plan")).get("requiredCapabilities"), List.class);
  }

  Map<String, Object> apply(Map<String, Object> plan) {
    return packs.apply(
        (UUID) plan.get("id"), 1, plan.get("manifest_digest").toString(), consent(plan));
  }

  long count(String table) {
    return jdbc.queryForObject("SELECT count(*) FROM " + table, Long.class);
  }

  @Test
  void runtimeAcknowledgementCacheAdvancesOnlyAfterCommit() throws Exception {
    apply(packs.plan(1, sample("security-audit"), false));
    var fail = new java.util.concurrent.atomic.AtomicBoolean(true);
    var manager =
        new DataSourceTransactionManager(source) {
          @Override
          protected void doCommit(
              org.springframework.transaction.support.DefaultTransactionStatus status) {
            if (fail.getAndSet(false))
              throw new org.springframework.transaction.TransactionSystemException(
                  "injected commit failure");
            super.doCommit(status);
          }
        };
    manager.setRollbackOnCommitFailure(true);
    var interpreter = mock(com.modulo.blueprint.interpreter.BlueprintInterpreterService.class);
    var worker = new WorkspacePackRuntimeWorker(jdbc, json, interpreter, manager);
    assertThrows(org.springframework.transaction.TransactionSystemException.class, worker::refresh);
    worker.refresh();
    worker.refresh();
    verify(interpreter, times(2)).registerBlueprint(any());
    assertEquals(0L, ((Number) packs.installations(1).get(0).get("runtime_pending")).longValue());
  }

  @Test
  void failureAtEveryInstallStageLeavesOnlyAnAuditableFailedOperation() throws Exception {
    var manifest = sample("knowledge-base");
    var stages = new ArrayList<>(List.of("begin", "release", "removal", "activation", "complete"));
    for (String id : PackManifestValidator.validate(manifest).order()) stages.add("resource:" + id);
    for (String failureStage : stages) {
      packs =
          new WorkspacePackService(jdbc, json, new DataSourceTransactionManager(source)) {
            @Override
            protected void afterStage(String stage) {
              if (stage.equals(failureStage)) throw new IllegalStateException("injected");
            }
          };
      var plan = packs.plan(1, manifest, true);
      assertThrows(ResponseStatusException.class, () -> apply(plan), failureStage);
      assertEquals(0, count("workspace_pack_installations"), failureStage);
      assertEquals(0, count("workspace_pack_releases"));
      assertEquals(0, count("workspace_pack_resources"));
      assertEquals(0, count("application.notes"));
      assertEquals("FAILED", packs.operation((UUID) plan.get("id"), 1).get("status"));
    }
  }

  @Test
  void upgradeRollbackAndUninstallPreserveUserContentAndModifiedConfiguration() throws Exception {
    var first = sample("knowledge-base");
    var plan = packs.plan(1, first, true);
    apply(plan);
    UUID original = (UUID) packs.installations(1).get(0).get("active_release");
    Long note = jdbc.queryForObject("SELECT note_id FROM application.notes", Long.class);
    jdbc.update(
        "UPDATE application.notes SET title='User edited',content='private user"
            + " content',version=version+1 WHERE note_id=?",
        note);
    jdbc.update(
        "UPDATE workspace_pack_resources SET user_modified=true,spec='{"
            + "\"custom\":true}'::jsonb WHERE resource_key='overview'");
    var second = sample("knowledge-base");
    second.setVersion("2.0.0");
    apply(packs.plan(1, second, true));
    assertEquals(1, count("application.notes"));
    assertEquals(
        "User edited",
        jdbc.queryForObject(
            "SELECT title FROM application.notes WHERE note_id=?", String.class, note));
    apply(packs.planRollback(1, first.getId(), original));
    assertEquals(original, packs.installations(1).get(0).get("active_release"));
    assertEquals(1, count("application.notes"));
    apply(packs.planUninstall(1, first.getId()));
    assertEquals("UNINSTALLED", packs.installations(1).get(0).get("state"));
    assertEquals(1, count("application.notes"));
    assertEquals(1, count("workspace_pack_resources"));
    assertEquals(true, packs.resources(1).get(0).get("detached"));
    apply(packs.plan(1, first, true));
    assertEquals(1, count("application.notes"));
    assertEquals(2, count("workspace_pack_releases"));
  }

  @Test
  void consentIdempotenceStalePlansAndOwnerIsolation() throws Exception {
    var manifest = sample("knowledge-base");
    var plan = packs.plan(1, manifest, false);
    UUID id = (UUID) plan.get("id");
    assertThrows(ResponseStatusException.class, () -> packs.operation(id, 2));
    assertThrows(
        ResponseStatusException.class,
        () -> packs.apply(id, 2, plan.get("manifest_digest").toString(), consent(plan)));
    assertThrows(
        ResponseStatusException.class,
        () -> packs.apply(id, 1, plan.get("manifest_digest").toString(), List.of()));
    assertEquals("PLANNED", packs.operation(id, 1).get("status"));
    apply(plan);
    apply(plan);
    assertEquals(1, count("workspace_pack_releases"));
    assertEquals(0, count("application.notes"));
    manifest.setVersion("2.0.0");
    var stale = packs.plan(1, manifest, false);
    var another = sample("knowledge-base");
    another.setId("org.example.other");
    apply(packs.plan(1, another, false));
    assertThrows(ResponseStatusException.class, () -> apply(stale));
    assertEquals("FAILED", packs.operation((UUID) stale.get("id"), 1).get("status"));
    assertEquals(0, packs.installations(2).size());
  }

  @Test
  void dependencyConflictsFailBeforePlanningOrMutation() throws Exception {
    var dependency = sample("knowledge-base");
    dependency.setId("org.example.dependency");
    var dependent = sample("knowledge-base");
    var requirement = new PackManifest.PackDependency();
    requirement.setId(dependency.getId());
    requirement.setMinVersion("1.0.0");
    dependent.setDependencies(List.of(requirement));
    assertThrows(ResponseStatusException.class, () -> packs.plan(1, dependent, false));
    assertEquals(0, count("workspace_pack_operations"));
    apply(packs.plan(1, dependency, false));
    apply(packs.plan(1, dependent, false));
    assertThrows(ResponseStatusException.class, () -> packs.planUninstall(1, dependency.getId()));
    UUID old =
        (UUID)
            packs.installations(1).stream()
                .filter(row -> dependency.getId().equals(row.get("pack_key")))
                .findFirst()
                .orElseThrow()
                .get("active_release");
    dependency.setVersion("2.0.0");
    apply(packs.plan(1, dependency, false));
    dependent.setVersion("2.0.0");
    requirement.setMinVersion("2.0.0");
    apply(packs.plan(1, dependent, false));
    assertThrows(
        ResponseStatusException.class, () -> packs.planRollback(1, dependency.getId(), old));
  }

  @Test
  void failedUpgradeKeepsPreviousReleaseActive() throws Exception {
    var manifest = sample("knowledge-base");
    apply(packs.plan(1, manifest, true));
    var before = packs.installations(1).get(0);
    manifest.setVersion("2.0.0");
    var plan = packs.plan(1, manifest, true);
    packs =
        new WorkspacePackService(jdbc, json, new DataSourceTransactionManager(source)) {
          @Override
          protected void afterStage(String stage) {
            if (stage.equals("activation")) throw new IllegalStateException();
          }
        };
    assertThrows(ResponseStatusException.class, () -> apply(plan));
    assertEquals(before.get("active_release"), packs.installations(1).get(0).get("active_release"));
    assertEquals(1, count("workspace_pack_releases"));
    assertEquals(1, count("application.notes"));
  }

  @Test
  void blueprintRuntimeRefreshIsDurableAndUserEditsArePreserved() throws Exception {
    var manifest = sample("security-audit");
    apply(packs.plan(1, manifest, false));
    assertEquals(1, count("workspace_pack_runtime_refresh"));
    var interpreter = mock(com.modulo.blueprint.interpreter.BlueprintInterpreterService.class);
    var worker =
        new WorkspacePackRuntimeWorker(
            jdbc, json, interpreter, new DataSourceTransactionManager(source));
    worker.refresh();
    verify(interpreter).registerBlueprint(any());
    assertEquals(
        0L,
        jdbc.queryForObject(
            "SELECT count(*) FROM workspace_pack_runtime_refresh WHERE completed_at IS NULL",
            Long.class));
    var otherInterpreter = mock(com.modulo.blueprint.interpreter.BlueprintInterpreterService.class);
    new WorkspacePackRuntimeWorker(
            jdbc, json, otherInterpreter, new DataSourceTransactionManager(source))
        .refresh();
    verify(otherInterpreter).registerBlueprint(any());
    jdbc.update(
        "UPDATE plugin_registry SET config=jsonb_set(config,'{metadata,name}','\"User renamed"
            + " workflow\"') WHERE runtime='BLUEPRINT'");
    manifest.setVersion("2.0.0");
    apply(packs.plan(1, manifest, false));
    assertEquals(
        "User renamed workflow",
        jdbc.queryForObject(
            "SELECT config->'metadata'->>'name' FROM plugin_registry WHERE runtime='BLUEPRINT'",
            String.class));
    apply(packs.planUninstall(1, manifest.getId()));
    assertEquals(1, count("plugin_registry"));
  }

  @Test
  void runtimeFailuresRemainDurableAndCanBeRetried() throws Exception {
    var manifest = sample("security-audit");
    apply(packs.plan(1, manifest, false));
    var interpreter = mock(com.modulo.blueprint.interpreter.BlueprintInterpreterService.class);
    doThrow(new IllegalStateException("injected")).when(interpreter).registerBlueprint(any());
    var worker =
        new WorkspacePackRuntimeWorker(
            jdbc, json, interpreter, new DataSourceTransactionManager(source));
    worker.refresh();
    assertEquals(
        1,
        jdbc.queryForObject("SELECT attempts FROM workspace_pack_runtime_refresh", Integer.class));
    assertEquals(1L, ((Number) packs.installations(1).get(0).get("runtime_pending")).longValue());
    assertEquals(0, packs.retryRuntime(2, manifest.getId()));
    assertEquals(1, packs.retryRuntime(1, manifest.getId()));
    reset(interpreter);
    worker.refresh();
    worker.refresh();
    assertEquals(0L, ((Number) packs.installations(1).get(0).get("runtime_pending")).longValue());
  }

  @Test
  void pluginImageMustBeProvisionedForTheSameOwner() throws Exception {
    var manifest = sample("knowledge-base");
    String image = "registry.example/plugin@sha256:" + "a".repeat(64);
    var resources = new ArrayList<>(manifest.getResources());
    resources.add(
        Map.of(
            "id",
            "plugin",
            "kind",
            "plugin",
            "title",
            "Plugin",
            "requires",
            List.of(),
            "capabilities",
            List.of("plugins:install"),
            "spec",
            Map.of("image", image, "runtime", "EXTERNAL")));
    manifest.setResources(resources);
    var capabilities = new ArrayList<>(manifest.getCapabilities());
    capabilities.add("plugins:install");
    manifest.setCapabilities(capabilities);
    assertThrows(ResponseStatusException.class, () -> packs.plan(1, manifest, false));
    jdbc.update(
        "INSERT INTO plugin_registry(name,owner_id,version,type,runtime,status,path) VALUES"
            + " ('foreign',2,'1','EXTERNAL','EXTERNAL','ACTIVE',?)",
        image);
    assertThrows(ResponseStatusException.class, () -> packs.plan(1, manifest, false));
    jdbc.update(
        "INSERT INTO plugin_registry(name,owner_id,version,type,runtime,status,path) VALUES"
            + " ('owned',1,'1','EXTERNAL','EXTERNAL','ACTIVE',?)",
        image);
    apply(packs.plan(1, manifest, false));
    apply(packs.planUninstall(1, manifest.getId()));
    assertEquals(2, count("plugin_registry"));
  }
}
