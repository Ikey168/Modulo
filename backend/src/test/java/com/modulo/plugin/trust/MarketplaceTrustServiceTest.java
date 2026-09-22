package com.modulo.plugin.trust;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.modulo.migration.SchemaMigrationTool;
import com.modulo.security.AuthenticatedUserService;
import java.util.*;
import javax.sql.DataSource;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@Testcontainers
class MarketplaceTrustServiceTest {
  @Container
  static final PostgreSQLContainer<?> DB = new PostgreSQLContainer<>(
      DockerImageName.parse("pgvector/pgvector:pg16").asCompatibleSubstituteFor("postgres"));

  JdbcTemplate jdbc;
  MarketplaceTrustService trust;
  AuthenticatedUserService users;
  final UUID publisher = UUID.randomUUID();
  final UUID oldRelease = UUID.randomUUID();
  final UUID newRelease = UUID.randomUUID();

  @BeforeAll
  static void migrate() {
    SchemaMigrationTool.flyway(DB.getJdbcUrl(), DB.getUsername(), DB.getPassword()).migrate();
  }

  @BeforeEach
  void setup() {
    DataSource source = new DriverManagerDataSource(DB.getJdbcUrl(), DB.getUsername(), DB.getPassword());
    jdbc = new JdbcTemplate(source);
    jdbc.execute("TRUNCATE marketplace_trust_reports,marketplace_publisher_history,marketplace_installations,marketplace_trust_evidence,marketplace_releases,marketplace_publishers,users CASCADE");
    jdbc.update("INSERT INTO users(id,username,email) VALUES(1,'publisher','publisher@example.test'),(2,'reviewer','reviewer@example.test')");
    jdbc.update("INSERT INTO marketplace_publishers(id,owner_id,display_name,verification_level,evidence) VALUES(?,1,'Acme','UNVERIFIED','{}'::jsonb)", publisher);
    insertRelease(oldRelease, "1.0.0", "a", "[\"notes:read\"]");
    insertRelease(newRelease, "2.0.0", "b", "[\"notes:read\",\"notes:write\"]");
    users = mock(AuthenticatedUserService.class);
    when(users.requireUserId()).thenReturn(2L);
    ArtifactTrustVerifier verifier = new ArtifactTrustVerifier() {
      private Evidence ok(String type, String identity) {
        return new Evidence(type, "VERIFIED", "fixture", "verified",
            identity == null ? Map.of() : Map.of("verificationPolicy", Map.of("signingIdentity", identity)));
      }
      public Evidence signature(String image,String digest,String identity){ return ok("SIGNATURE", identity); }
      public Evidence provenance(String image,String digest,String identity){ return ok("PROVENANCE", identity); }
      public Evidence sbom(String image,String digest){ return ok("SBOM", null); }
      public Evidence vulnerabilities(String image,String digest){ return ok("VULNERABILITY", null); }
    };
    trust = new MarketplaceTrustService(jdbc, new ObjectMapper(), verifier, users);
  }

  void insertRelease(UUID id, String version, String digestChar, String permissions) {
    String digest = "sha256:" + digestChar.repeat(64);
    jdbc.update("INSERT INTO marketplace_releases(id,plugin_key,version,image_reference,image_digest,publisher_id,permissions,immutable_digest) VALUES(?, 'acme.plugin', ?, 'ghcr.io/acme/plugin', ?, ?, ?::jsonb, ?)",
        id, version, digest, publisher, permissions, "f".repeat(64));
  }

  @Test
  void pluginHealthOnlyLinksToTheOwnersWorkflowRuns(){
    UUID own=UUID.randomUUID(),foreign=UUID.randomUUID();
    for(var entry:Map.of(own,2L,foreign,1L).entrySet()){
      jdbc.update("INSERT INTO workflow_runs(id,owner_id,blueprint_version,blueprint_digest,trigger_node_id,trigger_type,trigger_key,state) VALUES(?,?,'1',?,'trigger','manual',?,'FAILED')",entry.getKey(),entry.getValue(),"a".repeat(64),entry.getKey().toString());
      jdbc.update("INSERT INTO workflow_steps(id,run_id,sequence,node_id,node_type,state) VALUES(?,?,1,'plugin','acme.plugin.execute','FAILED')",UUID.randomUUID(),entry.getKey());
    }
    @SuppressWarnings("unchecked") var runs=(List<Map<String,Object>>)trust.health("acme.plugin").get("recentRuns");
    assertThat(runs).extracting(row->row.get("id")).containsExactly(own);
  }

  @Test
  void publisherApplicationIsUnverifiedUntilIndependentReviewAndDeploymentOutcomesAreAudited(){
    UUID applicant=trust.applyPublisher("New Publisher","proposed-signer","Domain control proof at https://example.test/proof");
    assertThat(jdbc.queryForObject("SELECT verification_level FROM marketplace_publishers WHERE id=?",String.class,applicant)).isEqualTo("UNVERIFIED");
    assertThat(jdbc.queryForObject("SELECT signing_identity FROM marketplace_publishers WHERE id=?",String.class,applicant)).isNull();
    assertThat(trust.publisherApplications()).hasSize(1);
    assertThatThrownBy(()->trust.verifyPublisher(applicant,"DOMAIN","proposed-signer","self",2)).isInstanceOf(IllegalStateException.class);
    UUID operation=trust.recordDeployment("acme.plugin",oldRelease,"FAILED");
    assertThat(jdbc.queryForObject("SELECT status FROM marketplace_installations WHERE id=?",String.class,operation)).isEqualTo("FAILED");
  }

  @Test
  void submissionCannotClaimAnotherPublishersEmailOrPluginName(){
    var submission=new com.modulo.plugin.submission.PluginSubmission("acme.plugin","3.0.0","publisher@example.test");
    submission.setDeveloperName("Acme");submission.setImageReference("ghcr.io/acme/plugin");submission.setImageDigest("sha256:"+"c".repeat(64));
    assertThatThrownBy(()->trust.recordSubmission(submission)).isInstanceOf(IllegalStateException.class).hasMessageContaining("different publisher");
    submission.setPluginName("new.plugin");UUID release=trust.recordSubmission(submission);
    assertThat(jdbc.queryForObject("SELECT p.owner_id FROM marketplace_releases r JOIN marketplace_publishers p ON p.id=r.publisher_id WHERE r.id=?",Long.class,release)).isEqualTo(2L);
    assertThat(trust.detail(release).get("verification_level")).isEqualTo("UNVERIFIED");
  }

  @Test void installRequiresConsentAndRuntimeCannotExpandPermissionsOrInventVersions(){
    trust.verifyPublisher(publisher,"ORGANIZATION","fixture-identity","approved",2);
    assertThatThrownBy(()->trust.approveInstall("acme.plugin",oldRelease,false)).isInstanceOf(IllegalArgumentException.class);
    trust.approveInstall("acme.plugin",oldRelease,true);
    trust.assertRuntimeRelease("acme.plugin","1.0.0","sha256:"+"a".repeat(64));
    assertThatThrownBy(()->trust.assertRuntimeRelease("acme.plugin","9.9.9","sha256:"+"a".repeat(64))).isInstanceOf(IllegalStateException.class);
    assertThatThrownBy(()->trust.assertRuntimePermissions("acme.plugin","1.0.0",List.of("notes:write"))).isInstanceOf(IllegalStateException.class);
    assertThat(trust.detail(oldRelease).get("permissions")).isEqualTo(List.of("notes:read"));
  }

  @Test void changingPublisherIdentityDoesNotRewriteHistoricalReleaseSigner(){
    trust.verifyPublisher(publisher,"ORGANIZATION","original-signer","approved",2);trust.verifyRelease(oldRelease);
    trust.verifyPublisher(publisher,"ORGANIZATION","replacement-signer","rotated",2);
    assertThat(trust.detail(oldRelease).get("release_signing_identity")).isEqualTo("original-signer");
    assertThat(trust.verifyRelease(oldRelease).get("trustStatus")).isEqualTo("PARTIAL");
  }

  @Test
  void publisherVerificationBindsEvidenceAndRevocationPreservesHistory() {
    assertThat(trust.verifyRelease(oldRelease).get("trustStatus")).isEqualTo("PARTIAL");
    assertThatThrownBy(() -> trust.verifyPublisher(publisher, "ORGANIZATION", "https://github.com/acme/plugin/.github/workflows/release.yml@refs/heads/main", "self", 1))
        .isInstanceOf(IllegalStateException.class);
    trust.verifyPublisher(publisher, "ORGANIZATION", "https://github.com/acme/plugin/.github/workflows/release.yml@refs/heads/main", "domain and org ownership verified", 2);
    assertThat(trust.verifyRelease(oldRelease).get("trustStatus")).isEqualTo("VERIFIED");
    assertThat(trust.evidenceHistory(oldRelease)).hasSize(8); // recheck appends, never rewrites
    trust.revokePublisher(publisher, "ownership changed", 2);
    assertThat(trust.detail(oldRelease).get("trustStatus")).isEqualTo("FAILED");
    assertThat(trust.evidenceHistory(oldRelease)).hasSize(8);
    assertThat(trust.publisherHistory(publisher)).extracting(row -> row.get("new_level"))
        .containsExactly("UNVERIFIED", "ORGANIZATION");
  }

  @Test
  void expiryAndVerifiedPublisherImpersonationAreRejected() {
    trust.verifyPublisher(publisher, "ORGANIZATION", "fixture-identity", "approved", 2);
    trust.verifyRelease(oldRelease);
    jdbc.update("UPDATE marketplace_publishers SET expires_at=now()-interval '1 second' WHERE id=?", publisher);
    assertThat(trust.detail(oldRelease).get("trustStatus")).isEqualTo("STALE");

    UUID impostor=UUID.randomUUID();
    jdbc.update("INSERT INTO marketplace_publishers(id,owner_id,display_name,verification_level,evidence) VALUES(?,NULL,'Acme','UNVERIFIED','{}'::jsonb)",impostor);
    assertThatThrownBy(() -> trust.verifyPublisher(impostor,"ORGANIZATION","other-identity","lookalike",2))
        .isInstanceOf(IllegalStateException.class).hasMessageContaining("name");
    jdbc.update("UPDATE marketplace_publishers SET display_name='Other' WHERE id=?",impostor);
    assertThatThrownBy(() -> trust.verifyPublisher(impostor,"ORGANIZATION","fixture-identity","identity reuse",2))
        .isInstanceOf(IllegalStateException.class).hasMessageContaining("Signing identity");
  }

  @Test
  void permissionExpansionDeclineKeepsActiveReleaseAndRollbackRestoresIt() {
    trust.verifyPublisher(publisher, "ORGANIZATION", "fixture-identity", "approved", 2);
    trust.verifyRelease(oldRelease);
    trust.verifyRelease(newRelease);
    jdbc.update("INSERT INTO marketplace_installations(id,owner_id,plugin_key,release_id,action,permission_diff,consented,status) VALUES(?,2,'acme.plugin',?,'INSTALL','{}'::jsonb,TRUE,'APPLIED')", UUID.randomUUID(), oldRelease);

    UUID declined = trust.recordUpgrade("acme.plugin", oldRelease, newRelease, false);
    Map<String,Object> declinedRow = jdbc.queryForMap("SELECT status,release_id FROM marketplace_installations WHERE id=?", declined);
    assertThat(declinedRow.get("status")).isEqualTo("DECLINED");
    assertThat(trust.health("acme.plugin").get("desired").toString()).contains(oldRelease.toString());

    UUID applied = trust.recordUpgrade("acme.plugin", oldRelease, newRelease, true);
    assertThat(jdbc.queryForObject("SELECT status FROM marketplace_installations WHERE id=?", String.class, applied)).isEqualTo("APPLIED");
    assertThat(trust.health("acme.plugin").get("desired").toString()).contains(newRelease.toString());

    UUID rollback = trust.rollback("acme.plugin", oldRelease);
    Map<String,Object> rollbackRow = jdbc.queryForMap("SELECT status,release_id,previous_release_id FROM marketplace_installations WHERE id=?", rollback);
    assertThat(rollbackRow.get("status")).isEqualTo("APPLIED");
    assertThat(rollbackRow.get("release_id").toString()).isEqualTo(oldRelease.toString());
    assertThat(rollbackRow.get("previous_release_id").toString()).isEqualTo(newRelease.toString());
    assertThat(trust.health("acme.plugin").get("desired").toString()).contains(oldRelease.toString());
  }
}
