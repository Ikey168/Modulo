package com.modulo.blueprint.approval;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.zip.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class EvidenceBundleService {
  private final JdbcTemplate jdbc;
  private final ObjectMapper json;
  private final ApprovalSigningService signing;
  private final TransactionTemplate tx;

  public record Options(boolean omitSummaries, boolean omitComments, boolean omitSignatures) {}

  public record Bundle(byte[] bytes, String rootHash) {}

  public EvidenceBundleService(
      JdbcTemplate jdbc,
      ObjectMapper json,
      ApprovalSigningService signing,
      PlatformTransactionManager manager) {
    this.jdbc = jdbc;
    this.json = json.copy().enable(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS);
    this.signing = signing;
    tx = new TransactionTemplate(manager);
    tx.setReadOnly(true);
    tx.setIsolationLevel(TransactionDefinition.ISOLATION_REPEATABLE_READ);
  }

  public Bundle export(UUID id, long owner, Options options) {
    return tx.execute(status -> build(id, owner, options));
  }

  private Bundle build(UUID id, long owner, Options options) {
    var rows =
        jdbc.queryForList(
            "SELECT"
                + " id,blueprint_id,blueprint_version,blueprint_digest,state,attempt,created_at,started_at,finished_at,error_class,COALESCE(parent_run_ref,parent_run_id)"
                + " AS parent_run_id FROM workflow_runs WHERE id=? AND owner_id=?",
            id,
            owner);
    if (rows.isEmpty()) throw new ApprovalFailure(HttpStatus.NOT_FOUND, "RUN_NOT_AVAILABLE");
    var run = rows.get(0);
    if (!Set.of("SUCCEEDED", "FAILED", "CANCELLED", "DEAD_LETTER").contains(run.get("state")))
      throw new ApprovalFailure(HttpStatus.CONFLICT, "EXPORT_REQUIRES_TERMINAL_RUN");
    var files = new TreeMap<String, byte[]>();
    var omitted = new TreeMap<String, byte[]>();
    var redactions = new TreeSet<String>();
    redactions.add(
        "Raw input values, note contents, private checkpoints, and full Blueprint configuration are"
            + " not exported");
    files.put("run.json", encode(normalize(run)));
    files.put(
        "blueprint.json",
        encode(
            Map.of(
                "version",
                run.get("blueprint_version"),
                "digest",
                run.get("blueprint_digest"),
                "configuration",
                "OMITTED")));
    var references = new TreeMap<String, Object>();
    var steps =
        jdbc.queryForList(
            "SELECT"
                + " id,sequence,attempt,node_id,node_type,state,started_at,finished_at,error_class,duration_ms,input_metadata::text,output_metadata::text"
                + " FROM workflow_steps WHERE run_id=? ORDER BY sequence,attempt,id LIMIT 10002",
            id);
    if (steps.size() > 10001)
      throw new ApprovalFailure(HttpStatus.PAYLOAD_TOO_LARGE, "BUNDLE_TOO_LARGE");
    for (var step : steps) {
      var data = normalize(step);
      for (String field : List.of("input_metadata", "output_metadata")) {
        try {
          var summary = json.readTree(step.get(field).toString());
          for (var ref : summary.path("references")) {
            if (ref.has("kind") && ref.has("id"))
              references.put(
                  ref.path("kind").asText() + ":" + ref.path("id").asText(),
                  Map.of(
                      "kind",
                      ref.path("kind").asText(),
                      "id",
                      ref.path("id").asText(),
                      "content",
                      "OMITTED"));
          }
          data.put(field, options.omitSummaries() ? Map.of("omitted", true) : summary);
        } catch (IOException invalid) {
          throw new ApprovalFailure(HttpStatus.CONFLICT, "INVALID_STORED_EVIDENCE");
        }
      }
      files.put("steps/" + step.get("id") + ".json", encode(data));
    }
    files.put("references.json", encode(references.values()));
    if (options.omitSummaries()) redactions.add("Step summaries omitted by exporter");
    var requests =
        jdbc.queryForList(
            "SELECT"
                + " id,requester_ref,approver_ref,run_ref,run_attempt,blueprint_digest,node_id,evidence_digest,policy_digest,state,revision,created_at,expires_at,resolved_at,safe_summary::text"
                + " FROM approval_requests WHERE run_ref=? AND owner_id=? ORDER BY id LIMIT 10001",
            id,
            owner);
    if (requests.size() > 10000)
      throw new ApprovalFailure(HttpStatus.PAYLOAD_TOO_LARGE, "BUNDLE_TOO_LARGE");
    for (var request : requests) {
      files.put("approvals/" + request.get("id") + ".json", encode(normalize(request)));
      for (var decision :
          jdbc.queryForList(
              "SELECT"
                  + " id,request_id,request_revision,actor_ref,outcome,comment_text,comment_digest,decided_at,binding::text"
                  + " FROM approval_decisions WHERE request_id=? ORDER BY id",
              request.get("id"))) {
        var data = normalize(decision);
        if (options.omitComments()) {
          data.remove("comment_text");
          data.put("comment_omitted", true);
          redactions.add("Decision comments and their containing signatures omitted by exporter");
        }
        files.put("decisions/" + decision.get("id") + ".json", encode(data));
        byte[] envelope = encode(signing.envelope((UUID) decision.get("id")));
        String path = "signatures/" + decision.get("id") + ".json";
        if (options.omitSignatures() || options.omitComments()) {
          omitted.put(path, envelope);
          redactions.add("Decision signatures omitted by exporter");
        } else files.put(path, envelope);
      }
    }
    var paths = new TreeSet<String>();
    paths.addAll(files.keySet());
    paths.addAll(omitted.keySet());
    var entries = new ArrayList<List<String>>();
    String chain = "0".repeat(64);
    long total = 0;
    for (String path : paths) {
      boolean missing = omitted.containsKey(path);
      byte[] bytes = missing ? omitted.get(path) : files.get(path);
      total += bytes.length;
      if (total > 56L * 1024 * 1024)
        throw new ApprovalFailure(HttpStatus.PAYLOAD_TOO_LARGE, "BUNDLE_TOO_LARGE");
      var entry =
          new ArrayList<>(
              List.of(
                  path,
                  ApprovalService.hash(bytes),
                  Long.toString(bytes.length),
                  missing ? "OMITTED" : "PRESENT",
                  chain));
      chain = ApprovalService.hash(encode(entry));
      entry.add(chain);
      entries.add(entry);
    }
    var manifest =
        List.of(
            "modulo.workflow.bundle.v1",
            id.toString(),
            run.get("blueprint_digest").toString(),
            new ArrayList<>(redactions),
            entries,
            chain);
    String root = ApprovalService.hash(encode(manifest));
    files.put(
        "manifest.json",
        encode(Map.of("manifest", manifest, "rootHash", root, "anchoring", "NOT_ANCHORED")));
    try {
      var output = new ByteArrayOutputStream();
      try (var zip = new ZipOutputStream(output, StandardCharsets.UTF_8)) {
        zip.setLevel(9);
        for (var file : files.entrySet()) {
          var entry = new ZipEntry(file.getKey());
          entry.setTimeLocal(java.time.LocalDateTime.of(1980, 1, 1, 0, 0));
          zip.putNextEntry(entry);
          zip.write(file.getValue());
          zip.closeEntry();
        }
      }
      return new Bundle(output.toByteArray(), root);
    } catch (IOException failure) {
      throw new ApprovalFailure(HttpStatus.INTERNAL_SERVER_ERROR, "BUNDLE_EXPORT_FAILED");
    }
  }

  private Map<String, Object> normalize(Map<String, Object> row) {
    var data = new TreeMap<String, Object>();
    row.forEach(
        (key, value) ->
            data.put(
                key,
                value == null
                    ? null
                    : value instanceof java.sql.Timestamp stamp
                        ? stamp.toInstant().toString()
                        : value.toString()));
    return data;
  }

  private byte[] encode(Object value) {
    try {
      return json.writeValueAsBytes(value);
    } catch (IOException invalid) {
      throw new ApprovalFailure(HttpStatus.CONFLICT, "INVALID_STORED_EVIDENCE");
    }
  }
}
