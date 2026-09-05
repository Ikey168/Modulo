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
        assertEquals(8, flyway(name).migrate().migrationsExecuted);
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
        assertEquals(7, flyway(destination).migrate().migrationsExecuted);
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
    @Test void sharedLegacyTagsAreSplitWithoutLosingUnownedRecords() throws Exception {
        String name = database();
        Flyway.configure().configuration(flyway(name).getConfiguration()).target("3").load().migrate();
        execute(name, "INSERT INTO application.notes(note_id,title,version,user_id) VALUES (101,'A',0,1),(102,'B',0,2),(103,'Legacy',0,NULL)");
        execute(name, "INSERT INTO application.tags(tag_id,name) VALUES ('00000000-0000-0000-0000-000000000001','shared')");
        execute(name, "INSERT INTO application.note_tags(note_id,tag_id) SELECT note_id,'00000000-0000-0000-0000-000000000001'::uuid FROM application.notes");
        execute(name, "INSERT INTO application.share_tokens(note_id,token,owner_id,revoked,created_at) VALUES (101,'legacy','1',false,now())");
        flyway(name).migrate();
        try (var c = DriverManager.getConnection(url(name), DB.getUsername(), DB.getPassword()); var q = c.createStatement()) {
            try (var r = q.executeQuery("SELECT n.note_id,n.user_id,t.user_id,t.name FROM application.notes n JOIN application.note_tags nt ON nt.note_id=n.note_id JOIN application.tags t ON t.tag_id=nt.tag_id ORDER BY n.note_id")) {
                for (int index = 1; index <= 3; index++) {
                    assertTrue(r.next()); assertEquals(100 + index, r.getInt(1));
                    assertEquals(r.getObject(2), r.getObject(3)); assertEquals("shared", r.getString(4));
                }
                assertFalse(r.next());
            }
            try (var r = q.executeQuery("SELECT count(DISTINCT tag_id) FROM application.note_tags")) { assertTrue(r.next()); assertEquals(3, r.getInt(1)); }
            try (var r = q.executeQuery("SELECT owner_verified FROM application.share_tokens")) { assertTrue(r.next()); assertFalse(r.getBoolean(1)); }
        }
    }
    @Test void explicitBackfillIsAtomicAndPreservesContentAndTagNames() throws Exception {
        String name = database(); flyway(name).migrate();
        execute(name, "INSERT INTO public.users(id,username) VALUES (1,'alice'),(2,'bob')");
        execute(name, "INSERT INTO application.notes(note_id,title,content,version) VALUES (101,'A','keep A',0),(102,'B','keep B',0)");
        execute(name, "INSERT INTO application.tags(tag_id,name) VALUES ('00000000-0000-0000-0000-000000000001','legacy')");
        execute(name, "INSERT INTO application.note_tags(note_id,tag_id) SELECT note_id,'00000000-0000-0000-0000-000000000001'::uuid FROM application.notes");
        try (var c = DriverManager.getConnection(url(name), DB.getUsername(), DB.getPassword())) {
            c.setAutoCommit(false);
            assertThrows(IllegalArgumentException.class, () -> OwnershipBackfillTool.assign(c, java.util.Map.of(101L,1L,102L,99L)));
            c.rollback();
            OwnershipBackfillTool.assign(c, java.util.Map.of(101L,1L,102L,2L));
            c.rollback(); // preview must leave all rows unowned
            try (var q = c.createStatement(); var r = q.executeQuery("SELECT count(*) FROM application.notes WHERE user_id IS NULL")) { assertTrue(r.next()); assertEquals(2,r.getInt(1)); }
            OwnershipBackfillTool.assign(c, java.util.Map.of(101L,1L,102L,2L)); c.commit();
            assertThrows(IllegalArgumentException.class, () -> OwnershipBackfillTool.assign(c, java.util.Map.of(101L,2L)));
            c.rollback();
            try (var q = c.createStatement(); var r = q.executeQuery("SELECT n.content,n.user_id,t.user_id,t.name FROM application.notes n JOIN application.note_tags nt ON n.note_id=nt.note_id JOIN application.tags t ON nt.tag_id=t.tag_id ORDER BY n.note_id")) {
                assertTrue(r.next()); assertEquals("keep A",r.getString(1)); assertEquals(1,r.getLong(2)); assertEquals(1,r.getLong(3)); assertEquals("legacy",r.getString(4));
                assertTrue(r.next()); assertEquals("keep B",r.getString(1)); assertEquals(2,r.getLong(2)); assertEquals(2,r.getLong(3)); assertEquals("legacy",r.getString(4)); assertFalse(r.next());
            }
        }
    }
}
