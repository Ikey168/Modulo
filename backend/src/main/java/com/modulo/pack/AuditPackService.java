package com.modulo.pack;

import com.fasterxml.jackson.databind.*;
import com.modulo.blueprint.*;
import com.modulo.blueprint.approval.*;
import com.modulo.blueprint.interpreter.BlueprintInterpreterService;
import com.modulo.knowledge.NotePropertyService;
import com.modulo.service.NoteService;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuditPackService {
  public static final String PACK = "org.modulo.security-audit";
  private final JdbcTemplate jdbc;
  private final ObjectMapper json;
  private final TransactionTemplate tx;
  private final NotePropertyService properties;
  private final BlueprintRepository blueprints;
  private final BlueprintInterpreterService interpreter;
  private final NoteService notes;
  private final ApprovalService approvals;
  private final ApprovalSigningService signing;

  public AuditPackService(
      JdbcTemplate jdbc,
      ObjectMapper json,
      PlatformTransactionManager manager,
      NotePropertyService properties,
      BlueprintRepository blueprints,
      BlueprintInterpreterService interpreter,
      NoteService notes,
      ApprovalService approvals,
      ApprovalSigningService signing) {
    this.jdbc = jdbc;
    this.json = json.copy().enable(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS);
    tx = new TransactionTemplate(manager);
    this.properties = properties;
    this.blueprints = blueprints;
    this.interpreter = interpreter;
    this.notes = notes;
    this.approvals = approvals;
    this.signing = signing;
  }

  public Map<String, Object> status(long owner) {
    return Map.of(
        "installed",
        active(owner),
        "signingConfigured",
        signing.configured(),
        "anchoring",
        "NOT_ANCHORED");
  }

  public PackManifest manifest(long owner, long reviewer) {
    if (owner == reviewer
        || jdbc.queryForObject("SELECT count(*) FROM users WHERE id=?", Integer.class, reviewer)
            != 1) throw bad("INVALID_AUDIT_REVIEWER");
    try (var stream = getClass().getResourceAsStream("/packs/security-audit.v2.json")) {
      var manifest = json.readValue(stream, PackManifest.class);
      for (var resource : manifest.getResources())
        if ("review".equals(resource.get("id"))) {
          var tree = json.valueToTree(resource);
          ((com.fasterxml.jackson.databind.node.ObjectNode)
                  tree.path("spec").path("ir").path("nodes").get(1).path("config"))
              .put("approverUserId", Long.toString(reviewer));
          resource.clear();
          resource.putAll(json.convertValue(tree, Map.class));
        }
      return manifest;
    } catch (Exception failure) {
      throw bad("AUDIT_MANIFEST_UNAVAILABLE");
    }
  }

  public record Intake(UUID requestId, String title, String scope) {}

  public record Finding(
      UUID requestId,
      String title,
      String severity,
      String description,
      String recommendation,
      String vulnerabilityClass) {}

  public List<Map<String, Object>> list(long owner) {
    return jdbc.queryForList(
        "SELECT e.*,r.state AS run_state FROM audit_pack_engagements e LEFT JOIN workflow_runs r ON"
            + " r.id=e.review_run WHERE e.owner_id=? ORDER BY e.created_at DESC,e.id LIMIT 100",
        owner);
  }

  public Map<String, Object> engagement(long owner, UUID id) {
    var rows =
        jdbc.queryForList(
            "SELECT e.*,r.state AS run_state FROM audit_pack_engagements e LEFT JOIN workflow_runs"
                + " r ON r.id=e.review_run WHERE e.id=? AND e.owner_id=?",
            id,
            owner);
    if (rows.isEmpty()) throw unavailable();
    var result = rows.get(0);
    result.put(
        "records",
        jdbc.queryForList(
            "SELECT n.note_id,n.title,n.version,x.kind FROM audit_pack_engagement_records x JOIN"
                + " application.notes n ON n.note_id=x.note_id WHERE x.engagement_id=? AND"
                + " n.user_id=? ORDER BY x.kind,n.note_id",
            id,
            owner));
    result.put(
        "approvals",
        jdbc.queryForList(
            "SELECT a.id,a.state,CASE WHEN d.id IS NULL THEN 'NOT_DECIDED' WHEN s.decision_id IS"
                + " NULL THEN 'UNSIGNED' ELSE 'SERVER_SIGNED' END AS signature_state FROM"
                + " approval_requests a LEFT JOIN approval_decisions d ON d.request_id=a.id LEFT"
                + " JOIN approval_signatures s ON s.decision_id=d.id WHERE a.run_id=? AND"
                + " a.owner_id=? ORDER BY a.created_at DESC",
            result.get("review_run"),
            owner));
    return result;
  }

  public Map<String, Object> create(long owner, Intake input) {
    requireActive(owner);
    if (input == null || input.requestId() == null) throw bad("INVALID_ENGAGEMENT");
    String title = text(input.title(), 256), scope = text(input.scope(), 32000);
    return tx.execute(
        status -> {
          lock(owner);
          if (!jdbc.queryForList(
                  "SELECT id FROM audit_pack_engagements WHERE id=? AND owner_id=?",
                  input.requestId(),
                  owner)
              .isEmpty()) return engagement(owner, input.requestId());
          if (jdbc.queryForObject(
                  "SELECT count(*) FROM audit_pack_engagements WHERE owner_id=?",
                  Integer.class,
                  owner)
              >= 100) throw bad("ENGAGEMENT_QUOTA");
          String key = input.requestId().toString();
          jdbc.update(
              "INSERT INTO audit_pack_engagements(id,owner_id,title,engagement_key) VALUES"
                  + " (?,?,?,?)",
              input.requestId(),
              owner,
              title,
              key);
          long intake =
              createNote(
                  owner,
                  input.requestId(),
                  key,
                  "engagement",
                  title,
                  "# Engagement intake\n\n" + scope + "\n",
                  Map.of());
          long checklist =
              createNote(
                  owner,
                  input.requestId(),
                  key,
                  "checklist",
                  title + " — checklist",
                  template(owner, "checklist-template"),
                  Map.of());
          tag(owner, intake, "stage/inquiry");
          jdbc.update(
              "UPDATE audit_pack_engagements SET intake_note=?,checklist_note=? WHERE id=?",
              intake,
              checklist,
              input.requestId());
          return engagement(owner, input.requestId());
        });
  }

  public Map<String, Object> finding(long owner, UUID id, Finding input) {
    requireActive(owner);
    if (input == null
        || input.requestId() == null
        || input.severity() == null
        || !Set.of("critical", "high", "medium", "low", "informational").contains(input.severity()))
      throw bad("INVALID_FINDING");
    String title = text(input.title(), 200);
    if (title.contains("\n") || title.contains("\r")) throw bad("INVALID_FINDING_TITLE");
    String description = text(input.description(), 16000),
        recommendation = text(input.recommendation(), 16000);
    String cls = Objects.toString(input.vulnerabilityClass(), "unclassified");
    if (!cls.matches("[a-z][a-z0-9-]{0,63}")) throw bad("INVALID_VULNERABILITY_CLASS");
    return tx.execute(
        status -> {
          lock(owner);
          var engagement = engagement(owner, id);
          String origin = "finding:" + input.requestId();
          var previous =
              jdbc.queryForList(
                  "SELECT n.note_id FROM application.notes n JOIN application.note_metadata m ON"
                      + " m.note_id=n.note_id WHERE n.user_id=? AND m.metadata_key='audit.request'"
                      + " AND m.metadata_value=?",
                  Long.class,
                  owner,
                  origin);
          if (!previous.isEmpty()) return engagement(owner, id);
          String body =
              "```finding\nid: "
                  + input.requestId()
                  + "\ntitle: "
                  + title
                  + "\nseverity: "
                  + input.severity()
                  + "\nstatus: open\nclass: vuln/"
                  + cls
                  + "\n\n"
                  + description
                  + "\n\n## Recommendation\n"
                  + recommendation
                  + "\n```\n";
          String severity =
              Character.toUpperCase(input.severity().charAt(0)) + input.severity().substring(1);
          if ("Informational".equals(severity)) severity = "Low";
          long note =
              createNote(
                  owner,
                  id,
                  engagement.get("engagement_key").toString(),
                  "finding",
                  title,
                  body,
                  Map.of("severity", json.valueToTree(severity)));
          jdbc.update(
              "INSERT INTO application.note_metadata(note_id,metadata_key,metadata_value) VALUES"
                  + " (?,'audit.request',?)",
              note,
              origin);
          long knowledge =
              createNote(
                  owner,
                  id,
                  engagement.get("engagement_key").toString(),
                  "knowledge",
                  "Knowledge — " + cls,
                  "# " + cls + "\n\n" + recommendation + "\n",
                  Map.of("evidence", json.valueToTree(note)));
          tag(owner, knowledge, "vuln/" + cls);
          return engagement(owner, id);
        });
  }

  public Map<String, Object> report(long owner, UUID id) {
    requireActive(owner);
    return tx.execute(
        status -> {
          lock(owner);
          var engagement = engagement(owner, id);
          StringBuilder body =
              new StringBuilder(
                  "# Audit report — "
                      + engagement.get("title")
                      + "\n\n"
                      + "This report is a snapshot of the linked engagement records. Approval and"
                      + " signature status are recorded separately.\n\n");
          for (var row :
              jdbc.queryForList(
                  "SELECT n.note_id,n.title,n.version,COALESCE(n.markdown_content,n.content,'') AS"
                      + " markdown,x.kind FROM audit_pack_engagement_records x JOIN"
                      + " application.notes n ON n.note_id=x.note_id WHERE x.engagement_id=? AND"
                      + " n.user_id=? AND x.kind<>'report' ORDER BY x.kind,n.note_id FOR SHARE OF"
                      + " n",
                  id,
                  owner)) {
            body.append("## ")
                .append(row.get("title"))
                .append("\n\nSource note #")
                .append(row.get("note_id"))
                .append(", version ")
                .append(row.get("version"))
                .append("\n\n")
                .append(row.get("markdown").toString().replace("```finding", "```text"))
                .append("\n\n");
            if (body.length() > 500000) throw bad("REPORT_TOO_LARGE");
          }
          long note =
              createNote(
                  owner,
                  id,
                  engagement.get("engagement_key").toString(),
                  "report",
                  "Audit report — " + engagement.get("title"),
                  body.toString(),
                  Map.of());
          jdbc.update(
              "UPDATE audit_pack_engagements SET report_note=?,review_run=NULL WHERE id=? AND"
                  + " owner_id=?",
              note,
              id,
              owner);
          return engagement(owner, id);
        });
  }

  public Map<String, Object> submit(long owner, UUID id, UUID requestId, boolean confirmed, Long expectedReport, Long expectedVersion) {
    requireActive(owner);
    if (!confirmed || requestId == null) throw bad("REPORT_SHARING_CONFIRMATION_REQUIRED");
    var engagement = engagement(owner, id);
    if (engagement.get("report_note") == null) throw bad("REPORT_REQUIRED");
    var report =
        notes
            .findById(((Number) engagement.get("report_note")).longValue())
            .orElseThrow(AuditPackService::unavailable);
    if(!Objects.equals(report.getId(),expectedReport)||!Objects.equals(report.getVersion(),expectedVersion))throw bad("REPORT_PREVIEW_CHANGED");
    String canonical =
        encode(
            Arrays.asList(
                report.getId(),
                report.getUserId(),
                report.getVersion(),
                report.getTitle(),
                report.getContent(),
                report.getMarkdownContent()));
    if (canonical.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 2097152)
      throw bad("REPORT_TOO_LARGE");
    var blueprint =
        blueprints.findByName(PACK + ".review").orElseThrow(AuditPackService::unavailable);
    UUID run = interpreter.fireManual(blueprint, "manual-review", report, requestId);
    return tx.execute(
        status -> {
          var requests =
              jdbc.queryForList(
                  "SELECT id,evidence_checks::text,evidence_digest FROM approval_requests WHERE"
                      + " run_id=? AND owner_id=?",
                  run,
                  owner);
          if (requests.size() != 1) throw bad("REPORT_REVIEW_DID_NOT_START");
          var request = requests.get(0);
          String evidence = request.get("evidence_checks").toString();
          JsonNode checks = tree(evidence);
          if (!checks.path("notes").isArray()
              || checks.path("notes").size() != 1
              || !ApprovalService.hash(canonical)
                  .equals(checks.path("notes").get(0).path("digest").asText()))
            throw bad("REPORT_CHANGED");
          String canonicalEvidence = encode(json.convertValue(checks, Map.class));
          if (!ApprovalService.hash(canonicalEvidence).equals(request.get("evidence_digest")))
            throw bad("EVIDENCE_BINDING_CHANGED");
          jdbc.update(
              "INSERT INTO"
                  + " approval_report_artifacts(request_id,engagement_id,report_canonical,evidence_canonical)"
                  + " VALUES (?,?,?,?) ON CONFLICT(request_id) DO NOTHING",
              request.get("id"),
              id,
              canonical,
              canonicalEvidence);
          jdbc.update(
              "UPDATE audit_pack_engagements SET review_run=? WHERE id=? AND owner_id=? AND"
                  + " report_note=?",
              run,
              id,
              owner,
              report.getId());
          return Map.of("runId", run, "requestId", request.get("id"));
        });
  }

  public Map<String, Object> reviewedReport(long actor, UUID request) {
    approvals.view(request, actor);
    var rows =
        jdbc.queryForList(
            "SELECT report_canonical,evidence_canonical FROM approval_report_artifacts WHERE"
                + " request_id=?",
            request);
    if (rows.isEmpty()) throw unavailable();
    var row = rows.get(0);
    JsonNode note = tree(row.get("report_canonical").toString());
    var result = new LinkedHashMap<String, Object>();
    result.put("format", "modulo.audit-report.v1");
    result.put("reportCanonical", row.get("report_canonical"));
    result.put("evidenceCanonical", row.get("evidence_canonical"));
    result.put("title", note.get(3).asText());
    result.put("markdown", note.get(5).isNull() ? note.get(4).asText() : note.get(5).asText());
    result.put("anchoring", "NOT_ANCHORED");
    var decisions =
        jdbc.queryForList(
            "SELECT id FROM approval_decisions WHERE request_id=? ORDER BY decided_at DESC LIMIT 1",
            UUID.class,
            request);
    if (!decisions.isEmpty())
      result.put("signature", approvals.signature(request, decisions.get(0), actor));
    return result;
  }

  private long createNote(
      long owner,
      UUID engagement,
      String key,
      String kind,
      String title,
      String markdown,
      Map<String, JsonNode> extra) {
    title = title.substring(0, Math.min(title.length(), 255));
    long id = jdbc.queryForObject("SELECT nextval('hibernate_sequence')", Long.class);
    jdbc.update(
        "INSERT INTO"
            + " application.notes(note_id,user_id,title,content,markdown_content,version,created_at,updated_at)"
            + " VALUES (?,?,?,?,?,0,clock_timestamp(),clock_timestamp())",
        id,
        owner,
        title,
        markdown,
        markdown);
    var values = new HashMap<String, JsonNode>();
    values.put(
        PackKnowledgeResources.key(PACK, "record-schema", "record-kind"), json.valueToTree(kind));
    values.put(
        PackKnowledgeResources.key(PACK, "record-schema", "engagement"), json.valueToTree(key));
    values.put(
        PackKnowledgeResources.key(PACK, "record-schema", "status"), json.valueToTree("Open"));
    extra.forEach(
        (field, value) ->
            values.put(PackKnowledgeResources.key(PACK, "record-schema", field), value));
    properties.write(owner, List.of(new NotePropertyService.Change(id, 0, values, List.of())));
    tag(owner, id, "engagement/" + key);
    tag(owner, id, "audit/record/" + kind);
    jdbc.update(
        "INSERT INTO audit_pack_engagement_records(engagement_id,note_id,kind) VALUES (?,?,?)",
        engagement,
        id,
        kind);
    return id;
  }

  private void tag(long owner, long note, String name) {
    UUID id =
        jdbc.queryForObject(
            "INSERT INTO application.tags(tag_id,user_id,name) VALUES (?,?,?) ON"
                + " CONFLICT(user_id,name) DO UPDATE SET name=excluded.name RETURNING tag_id",
            UUID.class,
            UUID.randomUUID(),
            owner,
            name);
    jdbc.update(
        "INSERT INTO application.note_tags(note_id,tag_id) VALUES (?,?) ON CONFLICT DO NOTHING",
        note,
        id);
  }

  private String template(long owner, String key) {
    var rows =
        jdbc.queryForList(
            "SELECT r.spec::text FROM workspace_pack_resources r JOIN workspace_pack_installations"
                + " i ON i.id=r.installation_id WHERE i.owner_id=? AND i.pack_key=? AND"
                + " i.state='ACTIVE' AND r.resource_key=?",
            String.class,
            owner,
            PACK,
            key);
    if (rows.isEmpty()) throw unavailable();
    return tree(rows.get(0)).path("markdown").asText();
  }

  private boolean active(long owner) {
    return jdbc.queryForObject(
            "SELECT count(*) FROM workspace_pack_installations WHERE owner_id=? AND pack_key=? AND"
                + " state='ACTIVE'",
            Integer.class,
            owner,
            PACK)
        == 1;
  }

  private void requireActive(long owner) {
    if (!active(owner)) throw bad("AUDIT_PACK_NOT_INSTALLED");
  }

  private void lock(long owner) {
    jdbc.execute(
        "SELECT pg_advisory_xact_lock(hashtextextended('audit-engagement:" + owner + "',0))");
  }

  private String encode(Object value) {
    try {
      return json.writeValueAsString(value);
    } catch (Exception failure) {
      throw bad("INVALID_REPORT");
    }
  }

  private JsonNode tree(String value) {
    try {
      return json.readTree(value);
    } catch (Exception failure) {
      throw bad("INVALID_REPORT");
    }
  }

  private static String text(String value, int max) {
    if (value == null || value.isBlank() || value.length() > max || value.indexOf('\0') >= 0)
      throw bad("INVALID_AUDIT_INPUT");
    return value.trim();
  }

  private static ResponseStatusException bad(String code) {
    return new ResponseStatusException(HttpStatus.CONFLICT, code);
  }

  private static ResponseStatusException unavailable() {
    return new ResponseStatusException(HttpStatus.NOT_FOUND, "AUDIT_RECORD_UNAVAILABLE");
  }
}
