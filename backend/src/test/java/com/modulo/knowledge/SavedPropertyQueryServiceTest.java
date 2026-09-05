package com.modulo.knowledge;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.*;
import java.util.*;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
import org.springframework.web.server.ResponseStatusException;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;

@Testcontainers
class SavedPropertyQueryServiceTest {
  @Container
  static final PostgreSQLContainer<?> database = new PostgreSQLContainer<>("postgres:16-alpine");

  static DriverManagerDataSource source;
  JdbcTemplate jdbc;
  ObjectMapper json = new ObjectMapper();
  NotePropertyService properties;
  SavedPropertyQueryService queries;

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
    jdbc.execute("TRUNCATE users,application.notes,audit_events CASCADE");
    jdbc.update("INSERT INTO users(id,username) VALUES(1,'one'),(2,'two')");
    jdbc.execute("SELECT setval('hibernate_sequence',1000)");
    var manager = new DataSourceTransactionManager(source);
    properties = new NotePropertyService(jdbc, json, manager);
    queries = new SavedPropertyQueryService(jdbc, json, properties, manager);
    properties.define(
        1, new NotePropertyService.Definition("score", "Score", "number", List.of(), 0));
    jdbc.update(
        "INSERT INTO application.notes(note_id,user_id,title,version)"
            + " VALUES(10,1,'ten',0),(11,1,'eleven',0),(20,2,'foreign',0)");
    properties.write(
        1,
        List.of(
            new NotePropertyService.Change(10, 0, Map.of("score", json.valueToTree(10)), List.of()),
            new NotePropertyService.Change(
                11, 0, Map.of("score", json.valueToTree(2)), List.of())));
  }

  SavedPropertyQueryService.Configuration config(String view) {
    return new SavedPropertyQueryService.Configuration(
        List.of(),
        new SavedPropertyQueryService.Sort("score", "asc"),
        "score",
        List.of("score"),
        List.of(new SavedPropertyQueryService.Formula("Double", "sum", List.of("score", "score"))),
        view);
  }

  @SuppressWarnings("unchecked")
  List<Map<String, Object>> rows(UUID id, int page, int limit) {
    return (List<Map<String, Object>>) queries.run(1, id, page, limit).get("rows");
  }

  @Test
  void sortingPaginationAndViewsKeepTheSameNotes() {
    var saved =
        queries.save(1, new SavedPropertyQueryService.Save(null, 0, "Scores", config("table")));
    UUID id = (UUID) saved.get("id");
    assertEquals(11L, rows(id, 0, 1).get(0).get("noteId"));
    assertEquals(10L, rows(id, 1, 1).get(0).get("noteId"));
    assertEquals(true, queries.run(1, id, 0, 1).get("hasMore"));
    assertEquals(false, queries.run(1, id, 1, 1).get("hasMore"));
    queries.save(1, new SavedPropertyQueryService.Save(id, 1, "Scores", config("board")));
    assertEquals(
        List.of(11L, 10L), rows(id, 0, 50).stream().map(row -> row.get("noteId")).toList());
    assertEquals(3, jdbc.queryForObject("SELECT count(*) FROM application.notes", Integer.class));
    assertEquals(1, queries.list(1).size());
    assertThrows(ResponseStatusException.class, () -> queries.get(2, id));
    assertThrows(
        ResponseStatusException.class,
        () -> queries.save(1, new SavedPropertyQueryService.Save(id, 1, "stale", config("list"))));
  }

  @Test
  void propertyEditsImmediatelyChangeResultsAndFormula() {
    var saved =
        queries.save(1, new SavedPropertyQueryService.Save(null, 0, "Scores", config("card")));
    UUID id = (UUID) saved.get("id");
    properties.write(
        1,
        List.of(
            new NotePropertyService.Change(
                11, 1, Map.of("score", json.valueToTree(30)), List.of())));
    var rows = rows(id, 0, 50);
    assertEquals(11L, rows.get(1).get("noteId"));
    assertEquals(
        new java.math.BigDecimal("60"), ((Map<?, ?>) rows.get(1).get("formulas")).get("Double"));
  }

  @Test
  void importIsAtomicIdempotentAndKeepsUserNotes() {
    var input =
        new SavedPropertyQueryService.DatabaseImport(
            "legacy",
            "Legacy",
            List.of(
                new SavedPropertyQueryService.DatabaseColumn("name", "Name", "text", List.of())),
            List.of(
                new SavedPropertyQueryService.DatabaseRow(
                    "one", Map.of("name", json.valueToTree("A"))),
                new SavedPropertyQueryService.DatabaseRow(
                    "two", Map.of("name", json.valueToTree("B")))));
    var first = queries.importDatabase(1, input);
    assertEquals(2, first.get("created"));
    var second = queries.importDatabase(1, input);
    assertEquals(0, second.get("created"));
    assertEquals(2, second.get("retained"));
    assertEquals(
        ((Map<?, ?>) first.get("query")).get("id"), ((Map<?, ?>) second.get("query")).get("id"));
    long note =
        jdbc.queryForObject(
            "SELECT note_id FROM embedded_database_note_imports WHERE owner_id=1 AND row_id='one'",
            Long.class);
    jdbc.update("DELETE FROM application.notes WHERE note_id=?", note);
    assertEquals(0, queries.importDatabase(1, input).get("created"));
    assertEquals(4, jdbc.queryForObject("SELECT count(*) FROM application.notes", Integer.class));
  }

  @Test
  void invalidImportRollsBackEveryCreatedRow() {
    var input =
        new SavedPropertyQueryService.DatabaseImport(
            "bad",
            "Bad",
            List.of(
                new SavedPropertyQueryService.DatabaseColumn(
                    "score", "Score", "number", List.of())),
            List.of(
                new SavedPropertyQueryService.DatabaseRow(
                    "one", Map.of("score", json.valueToTree(1))),
                new SavedPropertyQueryService.DatabaseRow(
                    "two", Map.of("score", json.valueToTree("not numeric")))));
    assertThrows(ResponseStatusException.class, () -> queries.importDatabase(1, input));
    assertEquals(3, jdbc.queryForObject("SELECT count(*) FROM application.notes", Integer.class));
    assertEquals(
        0,
        jdbc.queryForObject("SELECT count(*) FROM embedded_database_note_imports", Integer.class));
    assertTrue(queries.list(1).isEmpty());
  }
}
