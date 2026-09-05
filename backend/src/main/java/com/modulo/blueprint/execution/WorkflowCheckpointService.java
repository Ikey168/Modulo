package com.modulo.blueprint.execution;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.modulo.blueprint.interpreter.BlueprintIRGraph;
import com.modulo.entity.Note;
import com.modulo.service.NoteService;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/** Private replay checkpoints, separate from the trace API and pruned with the run. */
@Service
public class WorkflowCheckpointService {
  private final JdbcTemplate jdbc;
  private final ObjectMapper json;
  private final NoteService notes;

  public WorkflowCheckpointService(JdbcTemplate jdbc, ObjectMapper json, NoteService notes) {
    this.jdbc = jdbc;
    this.json = json;
    this.notes = notes;
  }

  public record Snapshot(
      BlueprintIRGraph graph,
      String fromNode,
      String outPin,
      Map<String, Object> pins,
      int sequence) {}

  public void save(
      WorkflowRunService.Lease lease,
      int sequence,
      BlueprintIRGraph graph,
      String fromNode,
      String outPin,
      Map<String, Object> pins) {
    try {
      String value =
          json.writeValueAsString(
              Map.of(
                  "graph",
                  graph,
                  "fromNode",
                  fromNode,
                  "outPin",
                  outPin,
                  "pins",
                  encode(pins, lease.owner(), 0),
                  "sequence",
                  sequence));
      if (value.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 1048576)
        throw new IllegalArgumentException();
      jdbc.update(
          "INSERT INTO workflow_checkpoints(run_id,sequence,snapshot) SELECT id,?,CAST(? AS jsonb)"
              + " FROM workflow_runs WHERE id=? AND owner_id=? AND state='RUNNING' AND (SELECT"
              + " COALESCE(sum(octet_length(snapshot::text)),0) FROM workflow_checkpoints WHERE"
              + " run_id=?) + octet_length(?) <= 4194304 ON CONFLICT DO NOTHING",
          sequence,
          value,
          lease.id(),
          lease.owner(),
          lease.id(),
          value);
    } catch (Exception unsupported) {
      // A checkpoint failure cannot convert a completed business action into a retryable failure.
      // Unsupported or oversized inputs remain inspectable, but have no replay checkpoint.
    }
  }

  @SuppressWarnings("unchecked")
  public Snapshot load(UUID run, long owner, int sequence) {
    var rows =
        jdbc.queryForList(
            "SELECT c.snapshot::text FROM workflow_checkpoints c JOIN workflow_runs r ON"
                + " r.id=c.run_id WHERE c.run_id=? AND r.owner_id=? AND c.sequence=?",
            String.class,
            run,
            owner,
            sequence);
    if (rows.isEmpty())
      throw new ResponseStatusException(HttpStatus.CONFLICT, "CHECKPOINT_UNAVAILABLE");
    try {
      var data = json.readValue(rows.get(0), Map.class);
      return new Snapshot(
          json.convertValue(data.get("graph"), BlueprintIRGraph.class),
          (String) data.get("fromNode"),
          (String) data.get("outPin"),
          (Map<String, Object>) decode(data.get("pins"), owner, 0),
          sequence);
    } catch (ResponseStatusException denied) {
      throw denied;
    } catch (Exception invalid) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "CHECKPOINT_INVALID");
    }
  }

  private Object encode(Object value, long owner, int depth) {
    if (depth > 12) throw new IllegalArgumentException();
    if (value == null
        || value instanceof String
        || value instanceof Boolean
        || value instanceof Number) return Arrays.asList("scalar", value);
    if (value instanceof Note note) {
      if (!Objects.equals(note.getUserId(), owner) || note.getId() == null)
        throw new IllegalArgumentException();
      return Arrays.asList("note", note.getId(), note.getVersion());
    }
    if (value instanceof Map<?, ?> map && map.size() <= 10000) {
      Map<String, Object> encoded = new LinkedHashMap<>();
      for (var entry : map.entrySet()) {
        if (!(entry.getKey() instanceof String key)) throw new IllegalArgumentException();
        encoded.put(key, encode(entry.getValue(), owner, depth + 1));
      }
      return List.of("map", encoded);
    }
    if (value instanceof Collection<?> list && list.size() <= 10000) {
      List<Object> encoded = new ArrayList<>();
      for (var entry : list) encoded.add(encode(entry, owner, depth + 1));
      return List.of("list", encoded);
    }
    throw new IllegalArgumentException();
  }

  @SuppressWarnings("unchecked")
  private Object decode(Object encoded, long owner, int depth) {
    if (depth > 12) throw new IllegalArgumentException();
    var parts = (List<Object>) encoded;
    return switch ((String) parts.get(0)) {
      case "scalar" -> parts.get(1);
      case "note" -> {
        var note =
            notes
                .findById(((Number) parts.get(1)).longValue())
                .orElseThrow(
                    () ->
                        new ResponseStatusException(
                            HttpStatus.CONFLICT, "CHECKPOINT_NOTE_UNAVAILABLE"));
        Long version = parts.get(2) == null ? null : ((Number) parts.get(2)).longValue();
        if (!Objects.equals(note.getUserId(), owner) || !Objects.equals(note.getVersion(), version))
          throw new ResponseStatusException(HttpStatus.CONFLICT, "CHECKPOINT_NOTE_CHANGED");
        yield note;
      }
      case "map" -> {
        Map<String, Object> result = new LinkedHashMap<>();
        ((Map<String, Object>) parts.get(1))
            .forEach((key, value) -> result.put(key, decode(value, owner, depth + 1)));
        yield result;
      }
      case "list" -> {
        List<Object> result = new ArrayList<>();
        for (var value : (List<?>) parts.get(1)) result.add(decode(value, owner, depth + 1));
        yield result;
      }
      default -> throw new IllegalArgumentException();
    };
  }
}
