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
class NotePropertyServiceTest {
  @Container
  static final PostgreSQLContainer<?> database = new PostgreSQLContainer<>("postgres:16-alpine");

  static DriverManagerDataSource source;
  JdbcTemplate jdbc;
  ObjectMapper json = new ObjectMapper();
  NotePropertyService service;

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
    jdbc.execute("TRUNCATE users, application.notes, audit_events CASCADE");
    jdbc.update("INSERT INTO users(id,username) VALUES(1,'one'),(2,'two')");
    jdbc.update(
        "INSERT INTO application.notes(note_id,user_id,title,version)"
            + " VALUES(10,1,'one',0),(11,1,'two',0),(20,2,'foreign',0)");
    service = new NotePropertyService(jdbc, json, new DataSourceTransactionManager(source));
  }

  void define(String key, String type) {
    service.define(
        1,
        new NotePropertyService.Definition(
            key,
            key,
            type,
            Set.of("select", "multiSelect").contains(type) ? List.of("Open", "Closed") : List.of(),
            0));
  }

  JsonNode node(Object value) {
    return json.valueToTree(value);
  }

  @SuppressWarnings("unchecked")
  Map<String, JsonNode> values(long id) {
    return (Map<String, JsonNode>) service.read(1, List.of(id)).get(0).get("values");
  }

  @Test
  void typesNullAndMissingRoundTrip() {
    var types =
        Map.of(
            "text",
            "text",
            "score",
            "number",
            "done",
            "boolean",
            "day",
            "date",
            "at",
            "datetime",
            "status",
            "select",
            "labels",
            "multiSelect",
            "url",
            "link",
            "ref",
            "noteReference");
    types.forEach(this::define);
    define("empty", "text");
    define("absent", "text");
    var set = new HashMap<String, JsonNode>();
    set.put("text", node("Grüße 🌍"));
    set.put("score", node(12.5));
    set.put("done", node(false));
    set.put("day", node("2026-09-06"));
    set.put("at", node("2026-09-06T12:00:00Z"));
    set.put("status", node("Open"));
    set.put("labels", node(List.of("Closed", "Open")));
    set.put("url", node("https://example.org/evidence"));
    set.put("ref", node(11));
    set.put("empty", json.nullNode());
    service.write(1, List.of(new NotePropertyService.Change(10, 0, set, List.of())));
    var actual = values(10);
    assertEquals(set.get("text"), actual.get("text"));
    assertTrue(actual.get("score").isNumber());
    assertTrue(actual.get("done").isBoolean());
    assertTrue(actual.get("empty").isNull());
    assertFalse(actual.containsKey("absent"));
    assertEquals("2026-09-06T12:00:00.000000000Z", actual.get("at").asText());
    assertEquals(set.get("labels"), actual.get("labels"));
    service.write(1, List.of(new NotePropertyService.Change(10, 1, Map.of(), List.of("empty"))));
    assertFalse(values(10).containsKey("empty"));
  }

  @Test
  void batchesRollbackOnStaleVersionAndForeignReference() {
    define("ref", "noteReference");
    define("title", "text");
    assertThrows(
        ResponseStatusException.class,
        () ->
            service.write(
                1,
                List.of(
                    new NotePropertyService.Change(
                        10, 0, Map.of("title", node("changed")), List.of()),
                    new NotePropertyService.Change(11, 9, Map.of(), List.of()))));
    assertTrue(values(10).isEmpty());
    assertThrows(
        ResponseStatusException.class,
        () ->
            service.write(
                1,
                List.of(
                    new NotePropertyService.Change(
                        10, 0, Map.of("title", node("changed")), List.of()),
                    new NotePropertyService.Change(11, 0, Map.of("ref", node(20)), List.of()))));
    assertTrue(values(10).isEmpty());
    assertEquals(
        0L,
        jdbc.queryForObject("SELECT version FROM application.notes WHERE note_id=10", Long.class));
    assertThrows(ResponseStatusException.class, () -> service.read(2, List.of(10L)));
    assertTrue(service.definitions(2).isEmpty());
  }

  @Test
  void filtersAreTypedOwnedAndAudited() {
    define("score", "number");
    define("labels", "multiSelect");
    service.write(
        1,
        List.of(
            new NotePropertyService.Change(
                10, 0, Map.of("score", node(2), "labels", node(List.of("Open"))), List.of()),
            new NotePropertyService.Change(11, 0, Map.of("score", node(10)), List.of())));
    assertEquals(
        11L,
        service
            .query(1, List.of(new NotePropertyService.Filter("score", "gt", node(3))), 0, 10)
            .get(0)
            .get("noteId"));
    assertEquals(
        10L,
        service
            .query(
                1,
                List.of(new NotePropertyService.Filter("labels", "contains", node("Open"))),
                0,
                10)
            .get(0)
            .get("noteId"));
    assertEquals(
        11L,
        service
            .query(1, List.of(new NotePropertyService.Filter("labels", "missing", null)), 0, 10)
            .get(0)
            .get("noteId"));
    assertThrows(
        ResponseStatusException.class,
        () ->
            service.query(
                2, List.of(new NotePropertyService.Filter("score", "eq", node(2))), 0, 10));
    assertTrue(
        jdbc.queryForObject(
                "SELECT count(*) FROM audit_events WHERE user_id='1' AND actor_verified AND"
                    + " event_type='PROPERTY_QUERY'",
                Integer.class)
            >= 3);
    assertEquals(
        0,
        jdbc.queryForObject(
            "SELECT count(*) FROM audit_events WHERE detail IS NOT NULL", Integer.class));
  }

  @Test
  void rejectsTypeChangesAndInvalidValues() {
    define("status", "select");
    assertThrows(
        ResponseStatusException.class,
        () ->
            service.define(
                1, new NotePropertyService.Definition("status", "status", "text", List.of(), 1)));
    assertThrows(
        ResponseStatusException.class,
        () ->
            service.write(
                1,
                List.of(
                    new NotePropertyService.Change(
                        10, 0, Map.of("status", node("unknown")), List.of()))));
    assertTrue(values(10).isEmpty());
  }

  @Test
  void longTextAndTransferPreserveBoundaries() {
    define("body", "text");
    service.write(
        1,
        List.of(
            new NotePropertyService.Change(
                10, 0, Map.of("body", node("界".repeat(4096))), List.of())));
    assertEquals(4096, values(10).get("body").asText().length());
    jdbc.update("UPDATE application.notes SET user_id=2 WHERE note_id=10");
    assertEquals(
        0,
        jdbc.queryForObject(
            "SELECT count(*) FROM note_property_values WHERE note_id=10", Integer.class));
  }

  @Test
  void equalityUsesIndexOnRepresentativeData() {
    define("score", "number");
    jdbc.execute(
        "INSERT INTO application.notes(note_id,user_id,title,version) SELECT i,1,'load',0 FROM"
            + " generate_series(100,20099) i");
    jdbc.execute(
        "INSERT INTO note_property_values(owner_id,note_id,property_key,value) SELECT"
            + " 1,i,'score',to_jsonb(i % 1000) FROM generate_series(100,20099) i");
    jdbc.execute("ANALYZE note_property_values");
    String plan =
        String.join(
            "\n",
            jdbc.queryForList(
                "EXPLAIN (ANALYZE,BUFFERS) SELECT note_id FROM note_property_values WHERE"
                    + " owner_id=1 AND property_key='score' AND octet_length(value::text)<=1024 AND"
                    + " value='42'::jsonb",
                String.class));
    System.out.println("PROPERTY_QUERY_PLAN\n" + plan);
    assertTrue(plan.contains("note_property_range_idx"));
    assertTrue(plan.contains("rows=20"));
  }
}
