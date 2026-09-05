package com.modulo.pack;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.modulo.service.IpfsService;
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
class PackAuthoringServiceTest {
  @Container
  static final PostgreSQLContainer<?> database = new PostgreSQLContainer<>("postgres:16-alpine");

  static DriverManagerDataSource source;
  JdbcTemplate jdbc;
  ObjectMapper json = new ObjectMapper();
  IpfsService ipfs;
  PackAuthoringService studio;

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
    jdbc.execute("TRUNCATE users CASCADE");
    jdbc.update("INSERT INTO users(id,username) VALUES(1,'author'),(2,'other')");
    ipfs = mock(IpfsService.class);
    studio = new PackAuthoringService(jdbc, json, ipfs, new DataSourceTransactionManager(source));
  }

  String example() throws Exception {
    return Files.readString(Path.of("../shared/packs/security-audit.v2.json"));
  }

  @Test
  void previewIsReproducibleAndNeverInstalls() throws Exception {
    String source = example();
    var first = studio.preview(source);
    assertEquals(first, studio.preview(source));
    assertEquals(true, first.get("ok"));
    assertEquals(false, first.get("installsResources"));
    assertEquals(
        0L, jdbc.queryForObject("SELECT count(*) FROM workspace_pack_installations", Long.class));
    assertEquals(0L, jdbc.queryForObject("SELECT count(*) FROM workspace_pack_drafts", Long.class));
    verifyNoInteractions(ipfs);
  }

  @Test
  void draftsAreOwnedAndRevisionProtected() throws Exception {
    var draft = studio.saveDraft(1, null, 0, example());
    UUID id = (UUID) draft.get("id");
    assertThrows(ResponseStatusException.class, () -> studio.draft(id, 2));
    studio.saveDraft(1, id, 1, example());
    assertThrows(ResponseStatusException.class, () -> studio.saveDraft(1, id, 1, example()));
    assertThrows(ResponseStatusException.class, () -> studio.deleteDraft(id, 2, 2));
    assertEquals(1, studio.drafts(1).size());
    assertEquals(0, studio.drafts(2).size());
  }

  @Test
  void publishAndExportUseExactlyTheVerifiedSourceBytes() throws Exception {
    var preview = studio.preview(example());
    String canonical = preview.get("canonicalSource").toString();
    String cid = "bafyreiaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    when(ipfs.isAvailable()).thenReturn(true);
    when(ipfs.uploadPublicContent(canonical)).thenReturn(cid);
    when(ipfs.pinContent(cid)).thenReturn(true);
    when(ipfs.retrievePublicContent(cid, 2097152)).thenReturn(canonical);
    when(ipfs.getGatewayUrl(cid)).thenReturn("https://gateway.example/ipfs/" + cid);
    var published = studio.publish(1, example(), preview.get("contentHash").toString(), true);
    assertEquals("PUBLISHED", published.get("state"));
    UUID id = (UUID) published.get("id");
    assertEquals(canonical, studio.publishedSource(id, 1));
    assertEquals(
        published, studio.publish(1, example(), preview.get("contentHash").toString(), true));
    verify(ipfs, times(1)).uploadPublicContent(canonical);
    assertThrows(ResponseStatusException.class, () -> studio.publishedSource(id, 2));
    assertEquals("NOT_ANCHORED", published.get("anchoring"));
    assertThrows(
        org.springframework.dao.DataAccessException.class,
        () ->
            jdbc.update("UPDATE workspace_pack_publications SET source='changed' WHERE id=?", id));
  }

  @Test
  void publicConsentAndDigestAreCheckedBeforeExternalCalls() throws Exception {
    var preview = studio.preview(example());
    assertThrows(
        ResponseStatusException.class,
        () -> studio.publish(1, example(), preview.get("contentHash").toString(), false));
    assertThrows(
        ResponseStatusException.class, () -> studio.publish(1, example(), "changed", true));
    verifyNoInteractions(ipfs);
  }

  @Test
  void corruptedIpfsRoundTripIsNeverReportedAsPublished() throws Exception {
    var preview = studio.preview(example());
    String cid = "bafyreiaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    when(ipfs.isAvailable()).thenReturn(true);
    when(ipfs.uploadPublicContent(anyString())).thenReturn(cid);
    when(ipfs.pinContent(cid)).thenReturn(true);
    when(ipfs.retrievePublicContent(cid, 2097152)).thenReturn("changed");
    assertThrows(
        ResponseStatusException.class,
        () -> studio.publish(1, example(), preview.get("contentHash").toString(), true));
    assertEquals("FAILED", studio.publications(1).get(0).get("state"));
  }
}
