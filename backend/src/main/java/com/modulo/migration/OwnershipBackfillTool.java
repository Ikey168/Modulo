package com.modulo.migration;

import java.nio.file.*;
import java.sql.*;
import java.util.*;

/** Offline, explicitly reviewed note-to-account assignments. Never infers ownership from headers or email. */
public final class OwnershipBackfillTool {
    private OwnershipBackfillTool() { }

    public static void assign(Connection connection, Map<Long, Long> assignments) throws SQLException {
        if (connection.getAutoCommit()) throw new IllegalArgumentException("An explicit transaction is required");
        try (var statement = connection.createStatement()) {
            statement.execute("LOCK TABLE application.notes, application.tags, application.note_tags IN SHARE ROW EXCLUSIVE MODE");
        }
        // Validate the entire mapping before changing any row.
        for (var assignment : assignments.entrySet()) {
            try (var query = connection.prepareStatement("SELECT n.user_id FROM application.notes n WHERE n.note_id=? AND EXISTS (SELECT 1 FROM public.users u WHERE u.id=?)")) {
                query.setLong(1, assignment.getKey()); query.setLong(2, assignment.getValue());
                try (var result = query.executeQuery()) {
                    if (!result.next() || result.getObject(1) != null) {
                        throw new IllegalArgumentException("Note must exist and be unowned; target account must exist: " + assignment.getKey());
                    }
                }
            }
        }
        for (var assignment : assignments.entrySet()) {
            long note = assignment.getKey(), owner = assignment.getValue();
            try (var insert = connection.prepareStatement("""
                INSERT INTO application.tags(tag_id,name,user_id)
                SELECT md5(t.tag_id::text || ':' || ?::text)::uuid,t.name,?
                FROM application.tags t JOIN application.note_tags nt ON nt.tag_id=t.tag_id
                WHERE nt.note_id=? ON CONFLICT(user_id,name) DO NOTHING
                """)) {
                insert.setLong(1, owner); insert.setLong(2, owner); insert.setLong(3, note); insert.executeUpdate();
            }
            try (var update = connection.prepareStatement("""
                UPDATE application.note_tags nt SET tag_id=owned.tag_id
                FROM application.tags old, application.tags owned
                WHERE nt.note_id=? AND old.tag_id=nt.tag_id AND owned.name=old.name AND owned.user_id=?
                """)) {
                update.setLong(1, note); update.setLong(2, owner); update.executeUpdate();
            }
            try (var update = connection.prepareStatement("UPDATE application.notes SET user_id=? WHERE note_id=? AND user_id IS NULL")) {
                update.setLong(1, owner); update.setLong(2, note);
                if (update.executeUpdate() != 1) throw new IllegalStateException("Ownership changed during backfill");
            }
        }
    }

    public static void main(String[] args) throws Exception {
        if (args.length != 2 || !Set.of("preview", "apply").contains(args[0])) {
            throw new IllegalArgumentException("Usage: OwnershipBackfillTool preview|apply assignments.csv (note_id,owner_id; no header)");
        }
        Map<Long, Long> assignments = new LinkedHashMap<>();
        for (String line : Files.readAllLines(Path.of(args[1]))) {
            if (line.isBlank()) continue;
            String[] fields = line.split(",", -1);
            if (fields.length != 2) throw new IllegalArgumentException("Each row must contain note_id,owner_id");
            long note = Long.parseLong(fields[0].trim()), owner = Long.parseLong(fields[1].trim());
            if (note <= 0 || owner <= 0 || assignments.putIfAbsent(note, owner) != null) throw new IllegalArgumentException("Invalid or duplicate assignment");
        }
        if (assignments.isEmpty()) throw new IllegalArgumentException("No assignments provided");
        try (var connection = DriverManager.getConnection(required("SPRING_DATASOURCE_URL"), required("SPRING_DATASOURCE_USERNAME"), required("SPRING_DATASOURCE_PASSWORD"))) {
            connection.setAutoCommit(false);
            try {
                assign(connection, assignments);
                if (args[0].equals("apply")) connection.commit(); else connection.rollback();
            } catch (Exception failure) { connection.rollback(); throw failure; }
        }
        System.out.println(args[0] + " succeeded for " + assignments.size() + " reviewed note assignments.");
    }
    private static String required(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) throw new IllegalArgumentException("Missing " + name);
        return value;
    }
}
