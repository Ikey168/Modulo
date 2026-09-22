package com.modulo.files;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.modulo.security.AuthenticatedUserService;
import org.junit.jupiter.api.*;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.springframework.web.server.ResponseStatusException;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
class WorkspaceFileStoreTest {
  @Container
  static final PostgreSQLContainer<?> DB =
      new PostgreSQLContainer<>(
          org.testcontainers.utility.DockerImageName.parse("pgvector/pgvector:pg16")
              .asCompatibleSubstituteFor("postgres"));

  private static DriverManagerDataSource dataSource;
  private JdbcTemplate jdbc;
  private WorkspaceFileStore store;
  private final ThreadLocal<Long> owner = ThreadLocal.withInitial(() -> 1L);

  @BeforeAll
  static void schema() throws Exception {
    dataSource = new DriverManagerDataSource(DB.getJdbcUrl(), DB.getUsername(), DB.getPassword());
    try (var connection = dataSource.getConnection()) {
      connection.createStatement().execute("CREATE TABLE users(id BIGINT PRIMARY KEY)");
      ScriptUtils.executeSqlScript(
          connection, new ClassPathResource("db/postgresql/V24__Workspace_files.sql"));
    }
  }

  @BeforeEach
  void setup() {
    jdbc = new JdbcTemplate(dataSource);
    jdbc.execute("TRUNCATE workspace_files, users CASCADE");
    jdbc.update("INSERT INTO users(id) VALUES (1),(2)");
    AuthenticatedUserService users = mock(AuthenticatedUserService.class);
    when(users.requireUserId()).thenAnswer(call -> owner.get());
    store = new WorkspaceFileStore(jdbc, users);
    owner.set(1L);
  }

  @AfterEach
  void cleanup() {
    owner.remove();
  }

  @Test
  void storesReplacesAndDeletesFiles() {
    var meta = store.put("personal", "record-1", "photo.png", "image/png", new byte[] {1, 2, 3});
    assertEquals(3, meta.size());
    assertEquals("photo.png", meta.name());
    assertArrayEquals(new byte[] {1, 2, 3}, store.get("personal", "record-1").orElseThrow().content());
    store.put("personal", "record-1", "photo.png", "image/png", new byte[] {9});
    assertEquals(1, store.get("personal", "record-1").orElseThrow().meta().size());
    assertEquals(1, store.list("personal").size());
    assertTrue(store.delete("personal", "record-1"));
    assertTrue(store.get("personal", "record-1").isEmpty());
  }

  @Test
  void ownersCannotSeeEachOthersFiles() {
    store.put("personal", "secret", "a.txt", "text/plain", new byte[] {1});
    owner.set(2L);
    assertTrue(store.get("personal", "secret").isEmpty());
    assertTrue(store.list("personal").isEmpty());
    assertFalse(store.delete("personal", "secret"));
    owner.set(1L);
    assertTrue(store.get("personal", "secret").isPresent());
  }

  @Test
  void rejectsInvalidIdsWorkspacesAndOversizedFiles() {
    var badId = assertThrows(ResponseStatusException.class, () -> store.put("personal", "../x", "x", "text/plain", new byte[0]));
    assertEquals(HttpStatus.BAD_REQUEST, badId.getStatus());
    var badWorkspace = assertThrows(ResponseStatusException.class, () -> store.list("team"));
    assertEquals(HttpStatus.NOT_FOUND, badWorkspace.getStatus());
    var tooLarge = assertThrows(ResponseStatusException.class,
        () -> store.put("personal", "big", "big.bin", null, new byte[WorkspaceFileStore.MAX_FILE_BYTES + 1]));
    assertEquals(HttpStatus.PAYLOAD_TOO_LARGE, tooLarge.getStatus());
  }

  @Test
  void defaultsMissingContentTypeAndName() {
    var meta = store.put("personal", "blob", null, null, new byte[] {1});
    assertEquals("blob", meta.name());
    assertEquals("application/octet-stream", meta.contentType());
  }
}
