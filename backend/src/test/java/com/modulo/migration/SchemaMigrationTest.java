package com.modulo.migration;

import static org.junit.jupiter.api.Assertions.*;
import java.sql.DriverManager;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
class SchemaMigrationTest {
    @Container static final PostgreSQLContainer<?> DB = new PostgreSQLContainer<>("postgres:16-alpine");
    String database() throws Exception {
        String name = "migration_" + UUID.randomUUID().toString().replace("-", "");
        try (var c = DriverManager.getConnection(DB.getJdbcUrl(), DB.getUsername(), DB.getPassword()); var s = c.createStatement()) {
            s.execute("CREATE DATABASE " + name);
        }
        return name;
    }
    String url(String name) { return DB.getJdbcUrl().replace('/' + DB.getDatabaseName(), '/' + name); }
    Flyway flyway(String name) { return SchemaMigrationTool.flyway(url(name), DB.getUsername(), DB.getPassword()); }
    void execute(String name, String sql) throws Exception {
        try (var c = DriverManager.getConnection(url(name), DB.getUsername(), DB.getPassword()); var s = c.createStatement()) { s.execute(sql); }
    }
    @Test void freshDatabaseMatchesAllCurrentEntitiesAndJdbcTables() throws Exception {
        String name = database();
        assertEquals(3, flyway(name).migrate().migrationsExecuted);
        SchemaMigrationTool.validateSchema(url(name), DB.getUsername(), DB.getPassword());
        execute(name, "INSERT INTO application.notes(note_id,title,content,version) VALUES (nextval('hibernate_sequence'),'fresh','body',0)");
        assertEquals(0, flyway(name).migrate().migrationsExecuted);
        flyway(name).validate();
    }
    @Test void restoredUnmanagedBaselineCanBeAdoptedWithoutLosingNotes() throws Exception {
        String source = database(), destination = database();
        Flyway.configure().configuration(flyway(source).getConfiguration()).target("1").load().migrate();
        execute(source, "INSERT INTO application.notes(note_id,title,content,version) VALUES (nextval('hibernate_sequence'),'keep me','saved content',0)");
        execute(source, "DROP TABLE public.modulo_schema_history");
        var dump = DB.execInContainer("pg_dump", "-U", DB.getUsername(), "-d", source, "-Fc", "-f", "/tmp/baseline.dump");
        assertEquals(0, dump.getExitCode(), dump.getStderr());
        var restore = DB.execInContainer("pg_restore", "-U", DB.getUsername(), "-d", destination, "--exit-on-error", "/tmp/baseline.dump");
        assertEquals(0, restore.getExitCode(), restore.getStderr());
        assertThrows(Exception.class, () -> flyway(destination).migrate());
        SchemaMigrationTool.adopt(url(destination), DB.getUsername(), DB.getPassword());
        assertEquals(2, flyway(destination).migrate().migrationsExecuted);
        SchemaMigrationTool.validateSchema(url(destination), DB.getUsername(), DB.getPassword());
        try (var c = DriverManager.getConnection(url(destination), DB.getUsername(), DB.getPassword()); var s = c.createStatement(); var r = s.executeQuery("SELECT title,content FROM application.notes")) {
            assertTrue(r.next()); assertEquals("keep me", r.getString(1)); assertEquals("saved content", r.getString(2)); assertFalse(r.next());
        }
        execute(destination, "INSERT INTO application.notes(note_id,title,version) VALUES (nextval('hibernate_sequence'),'after upgrade',0)");
    }
    @Test void incompatibleSchemaIsRejectedBeforeAnyHistoryIsWritten() throws Exception {
        String name = database();
        execute(name, "CREATE SCHEMA application; CREATE TABLE application.notes(note_id UUID PRIMARY KEY, title TEXT)");
        assertThrows(Exception.class, () -> SchemaMigrationTool.adopt(url(name), DB.getUsername(), DB.getPassword()));
        try (var c = DriverManager.getConnection(url(name), DB.getUsername(), DB.getPassword()); var s = c.createStatement(); var r = s.executeQuery("SELECT to_regclass('public.modulo_schema_history')")) {
            assertTrue(r.next()); assertNull(r.getString(1));
        }
    }
    @Test void checksumDriftAndEntityTypeDriftFailValidation() throws Exception {
        String name = database();
        flyway(name).migrate();
        execute(name, "ALTER TABLE application.notes ALTER COLUMN title TYPE integer USING 0");
        assertThrows(Exception.class, () -> SchemaMigrationTool.validateSchema(url(name), DB.getUsername(), DB.getPassword()));
        execute(name, "UPDATE public.modulo_schema_history SET checksum = 0 WHERE version = '2'");
        assertThrows(Exception.class, () -> flyway(name).validate());
    }
}
