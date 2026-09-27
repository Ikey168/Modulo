package com.modulo.blueprint.approval;

import static com.modulo.blueprint.approval.ApprovalCodec.hash;
import static com.modulo.blueprint.approval.ApprovalErrors.conflict;
import static com.modulo.blueprint.approval.ApprovalErrors.unavailable;

import com.modulo.blueprint.execution.TracePolicy;
import com.modulo.blueprint.execution.WorkflowRunService;
import com.modulo.note.Note;
import com.modulo.note.NoteService;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.TreeMap;
import java.util.UUID;

/**
 * The evidence an approval is bound to: capturing digests of the referenced notes and inputs
 * when a request is made, and verifying that neither the evidence nor the Blueprint changed
 * before a decision or a resume is accepted.
 */
final class ApprovalEvidence {
  private final ApprovalCodec codec;
  private final ApprovalRecords records;
  private final ApprovalReviewers reviewers;
  private final TracePolicy traces;
  private final WorkflowRunService runs;
  private final NoteService notes;

  ApprovalEvidence(
      ApprovalCodec codec,
      ApprovalRecords records,
      ApprovalReviewers reviewers,
      TracePolicy traces,
      WorkflowRunService runs,
      NoteService notes) {
    this.codec = codec;
    this.records = records;
    this.reviewers = reviewers;
    this.traces = traces;
    this.runs = runs;
    this.notes = notes;
  }

  /** The Blueprint must still be active, still hold the capability and be unchanged. */
  void verifyBlueprint(Map<String, Object> approval) {
    long owner = ((Number) approval.get("owner_id")).longValue();
    reviewers.requireCapability(approval.get("blueprint_id"));
    var blueprint =
        records.one(
            "SELECT config::text FROM plugin_registry WHERE id=? AND owner_id=? AND status='ACTIVE'"
                + " FOR SHARE",
            approval.get("blueprint_id"),
            owner);
    if (!codec.digestJson((String) blueprint.get("config")).equals(approval.get("blueprint_digest")))
      throw conflict("APPROVAL_SUPERSEDED");
  }

  /** {@link #verifyBlueprint} plus: the recorded checks and every referenced note are unchanged. */
  void verifyEvidence(Map<String, Object> approval) {
    long owner = ((Number) approval.get("owner_id")).longValue();
    verifyBlueprint(approval);
    var checks = codec.parse(approval.get("evidence_checks").toString());
    if (!hash(codec.encode(checks)).equals(approval.get("evidence_digest")))
      throw conflict("EVIDENCE_CHANGED");
    runs.asOwner(
        new WorkflowRunService.Lease((UUID) approval.get("run_ref"), owner, false),
        () -> {
          for (var check : (List<?>) checks.get("notes")) {
            var ref = (Map<?, ?>) check;
            var note =
                notes
                    .findByIdForApproval(Long.parseLong(ref.get("id").toString()))
                    .orElseThrow(() -> conflict("EVIDENCE_CHANGED"));
            if (!Objects.equals(note.getUserId(), owner)
                || !noteDigest(note).equals(ref.get("digest"))) throw conflict("EVIDENCE_CHANGED");
          }
          return null;
        });
  }

  /** Capture the evidence checks for a new request. */
  Map<String, Object> capture(Map<String, Object> inputs, long owner) {
    var references = new ArrayList<Map<String, Object>>();
    collectNotes(inputs, owner, references, 0);
    return Map.of(
        "notes",
        references,
        "inputDigest",
        hash(codec.encode(evidenceValue(inputs))),
        "summary",
        codec.parse(traces.summarize(owner, inputs, false)));
  }

  private Object evidenceValue(Object value) {
    if (value instanceof Note note)
      return Map.of("noteId", note.getId().toString(), "noteDigest", noteDigest(note));
    if (value instanceof Map<?, ?> map) {
      var normalized = new TreeMap<String, Object>();
      map.forEach((key, item) -> normalized.put((String) key, evidenceValue(item)));
      return normalized;
    }
    if (value instanceof Collection<?> list) return list.stream().map(this::evidenceValue).toList();
    return value;
  }

  private void collectNotes(
      Object value, long owner, List<Map<String, Object>> references, int depth) {
    if (depth > 12) throw conflict("EVIDENCE_TOO_LARGE");
    if (value == null
        || value instanceof String
        || value instanceof Number
        || value instanceof Boolean) return;
    if (value instanceof Note note) {
      if (!Objects.equals(note.getUserId(), owner) || note.getId() == null) throw unavailable();
      if (references.size() >= 16) throw conflict("EVIDENCE_TOO_LARGE");
      references.add(Map.of("id", note.getId().toString(), "digest", noteDigest(note)));
      return;
    }
    if (value instanceof Map<?, ?> map && map.size() <= 1000) {
      for (var entry : map.entrySet()) {
        if (!(entry.getKey() instanceof String)) throw conflict("INVALID_EVIDENCE");
        collectNotes(entry.getValue(), owner, references, depth + 1);
      }
      return;
    }
    if (value instanceof Collection<?> list && list.size() <= 1000) {
      for (var item : list) collectNotes(item, owner, references, depth + 1);
      return;
    }
    throw conflict("INVALID_EVIDENCE");
  }

  private String noteDigest(Note note) {
    return hash(
        codec.encode(
            Arrays.asList(
                note.getId(),
                note.getUserId(),
                note.getVersion(),
                note.getTitle(),
                note.getContent(),
                note.getMarkdownContent())));
  }
}
