package com.modulo.research;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import com.modulo.state.PluginStateStore;
import com.modulo.security.AuthenticatedUserService;
import com.modulo.service.NoteService;
import com.modulo.entity.Note;
import java.time.Instant;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class NoesisResearchService {
  public static final String NS = "workspace-noesis-research";
  private final PluginStateStore store;
  private final NoesisGateway noesis;
  private final AuthenticatedUserService users;
  private final NoteService notes;
  private final ObjectMapper json;
  public NoesisResearchService(PluginStateStore store, NoesisGateway noesis, AuthenticatedUserService users, NoteService notes, ObjectMapper json) {
    this.store = store; this.noesis = noesis; this.users = users; this.notes = notes; this.json = json;
  }
  public JsonNode domains() {
    users.requireUserId();
    ArrayNode result = json.createArrayNode();
    for (JsonNode domain : noesis.domains()) if (!domain.path("name").asText().equals("local")) result.add(domain);
    return result;
  }
  public PluginStateStore.Page list(String cursor) { return store.list("personal", NS, cursor, 100); }
  public PluginStateStore.StateRecord get(String id) { return store.get("personal", NS, id); }
  private PluginStateStore.StateRecord find(String id) {
    try { return get(id); } catch (RuntimeException e) {
      // Oracle's service instrumentation wraps store errors; preserve all errors except an expected missing key.
      for (Throwable cause = e; cause != null; cause = cause.getCause())
        if (cause instanceof ResponseStatusException status && status.getStatus() == HttpStatus.NOT_FOUND && "STATE_NOT_FOUND".equals(status.getReason())) return null;
      throw e;
    }
  }
  private PluginStateStore.StateRecord save(String id, long version, JsonNode value) {
    return store.put("personal", NS, id, version, "modulo.workspace.noesis-research", 1, value.toString());
  }
  private static String required(JsonNode value, String name, int max) {
    String s = value.path(name).asText("").trim();
    if (s.isEmpty() || s.length() > max) throw bad("Invalid " + name); return s;
  }
  private static ResponseStatusException bad(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }
  private static void key(String id) { if (!id.matches("[A-Za-z0-9_-]{8,100}")) throw bad("Invalid request ID"); }
  private ObjectNode policy(JsonNode raw) {
    ObjectNode p = json.createObjectNode();
    for (String field : List.of("allowedHosts", "primaryHosts", "languages", "regions")) {
      ArrayNode a = p.putArray(field); TreeSet<String> unique = new TreeSet<>();
      if (raw.has(field) && !raw.path(field).isArray()) throw bad("Invalid source policy");
      if (raw.path(field).size() > 30) throw bad("Too many policy entries");
      for (JsonNode value : raw.path(field)) {
        String s = value.asText().trim().toLowerCase(Locale.ROOT);
        if (s.isEmpty() || s.length() > 100 || (field.endsWith("Hosts") && !s.matches("[a-z0-9.-]+"))) throw bad("Invalid source policy entry");
        unique.add(s);
      }
      unique.forEach(a::add);
    }
    int age = raw.path("maxAgeDays").asInt(0);
    if (age < 0 || age > 3650) throw bad("Invalid recency"); p.put("maxAgeDays", age);
    p.put("discovery", "Public Noesis corpus; official publishers preferred; independent corroboration reviewed separately.");
    return p;
  }
  private ObjectNode reference(JsonNode raw) {
    ObjectNode ref = json.createObjectNode();
    String id = required(raw, "id", 250), kind = required(raw, "kind", 80);
    if (!Set.of("project", "area", "resource", "task", "note", "question", "idea", "decision", "record").contains(kind)) throw bad("Invalid reference kind");
    ref.put("id", id); ref.put("kind", kind); ref.put("title", required(raw, "title", 500));
    String route = raw.path("route").asText("");
    if (!route.startsWith("/") || route.startsWith("//") || route.contains("\\") || route.length() > 1000) throw bad("Local object route required");
    ref.put("route", route); return ref;
  }
  /** The id is a client-generated request key: a retry cannot start a second research result. */
  public PluginStateStore.StateRecord create(String id, JsonNode request) {
    users.requireUserId(); key(id);
    if (!request.path("publicQuestionConfirmed").asBoolean()) throw bad("Review and confirm a public research question");
    String question = required(request, "question", 5000), domain = required(request, "domain", 80);
    ObjectNode p = policy(request.path("policy"));
    ObjectNode ref = request.has("reference") && !request.path("reference").isNull() ? reference(request.path("reference")) : null;
    String signature = ResearchEvidence.hash(question + "\n" + domain + "\n" + p + "\n" + ref);
    var existing = find(id);
    if (existing != null) {
      if (!signature.equals(existing.value().path("requestSignature").asText())) throw new ResponseStatusException(HttpStatus.CONFLICT, "Request ID already used for different research");
      return existing;
    }
    ObjectNode result = json.createObjectNode(); result.put("id", id); result.put("question", question); result.put("domain", domain);
    result.put("requestSignature", signature); result.set("policy", p);
    ArrayNode refs = result.putArray("references"); if (ref != null) refs.add(ref);
    result.putArray("history"); result.putArray("outputs"); result.putArray("ignoredRuns");
    result.put("createdAt", Instant.now().toString());
    run(result, "initial-" + id);
    try { return save(id, 0, result); }
    catch (PluginStateStore.VersionConflict e) {
      var winner = get(id); if (signature.equals(winner.value().path("requestSignature").asText())) return winner; throw e;
    }
  }
  private void run(ObjectNode result, String requestId) {
    JsonNode envelope = noesis.answer(result.path("domain").asText(), result.path("question").asText());
    ObjectNode next;
    try { next = ResearchEvidence.snapshot(envelope, result.path("policy")); }
    catch (IllegalArgumentException e) { throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Unsupported Noesis response; previous result preserved"); }
    JsonNode previous = result.path("snapshot");
    if (!previous.isMissingNode()) {
      ArrayNode history = (ArrayNode) result.path("history");
      ObjectNode old = json.createObjectNode(); old.put("runId", result.path("runId").asText()); old.set("snapshot", previous.deepCopy()); history.add(old);
      while (history.size() > 8) history.remove(0);
    }
    result.set("delta", ResearchEvidence.delta(previous, next)); result.set("snapshot", next);
    result.put("runId", "noesis-kb:" + result.path("domain").asText() + ":" + envelope.path("as_of_ms").asLong() + ":" + ResearchEvidence.hash(next.toString()).substring(0, 20));
    result.put("lastRequestId", requestId); result.put("refreshedAt", Instant.now().toString());
    result.put("runReference", "/api/v1/kb/cross-domain/answer (domain: " + result.path("domain").asText() + ")");
  }
  public PluginStateStore.StateRecord refresh(String id, JsonNode request) {
    key(required(request, "requestId", 100)); var current = get(id);
    if (current.value().path("lastRequestId").asText().equals(request.path("requestId").asText())) return current;
    if (current.version() != request.path("expectedVersion").asLong(-1)) throw new ResponseStatusException(HttpStatus.CONFLICT, "Research changed; reload before retrying");
    ObjectNode result = current.value().deepCopy(); run(result, request.path("requestId").asText());
    return save(id, current.version(), result);
  }
  public PluginStateStore.StateRecord link(String id, JsonNode request) {
    var current = get(id); ObjectNode ref = reference(request.path("reference"));
    ObjectNode result = current.value().deepCopy(); ArrayNode refs = (ArrayNode) result.path("references");
    for (JsonNode old : refs) if (old.path("id").equals(ref.path("id")) && old.path("kind").equals(ref.path("kind"))) return current;
    if (refs.size() >= 50) throw bad("Reference limit reached"); refs.add(ref);
    return save(id, request.path("expectedVersion").asLong(-1), result);
  }
  /** Work and its provenance receipt commit together; repeated clicks return the original receipt. */
  @Transactional
  public PluginStateStore.StateRecord output(String id, JsonNode request) {
    var current = get(id); ObjectNode result = current.value().deepCopy();
    String kind = required(request, "kind", 30), runId = required(request, "runId", 200);
    if (!Set.of("note", "task", "decision", "project-update", "ignore").contains(kind)) throw bad("Invalid output kind");
    String findingId = request.path("findingId").asText("");
    String selectedProject = request.path("projectId").asText("");
    if (selectedProject.isEmpty()) for (JsonNode ref : result.path("references")) if (ref.path("kind").asText().equals("project")) { selectedProject = ref.path("id").asText(); break; }
    String target = selectedProject;
    JsonNode selectedFinding = null;
    for (JsonNode f : result.path("snapshot").path("findings")) if (f.path("id").asText().equals(findingId)) selectedFinding = f;
    // An unchanged refresh must not create the same task/note again.
    String evidenceIdentity = kind.equals("ignore") ? runId : selectedFinding == null ? "" : ResearchEvidence.canonical(selectedFinding);
    String outputId = "research-" + ResearchEvidence.hash(id + "|" + evidenceIdentity + "|" + kind + "|" + target).substring(0, 32);
    for (JsonNode output : result.path("outputs")) if (output.path("id").asText().equals(outputId)) return current;
    if (!result.path("runId").asText().equals(runId)) throw new ResponseStatusException(HttpStatus.CONFLICT, "Research changed; review the current result");
    if (current.version() != request.path("expectedVersion").asLong(-1)) throw new ResponseStatusException(HttpStatus.CONFLICT, "Research changed; reload before retrying");
    ObjectNode receipt = json.createObjectNode(); receipt.put("id", outputId); receipt.put("kind", kind); receipt.put("runId", runId); receipt.put("createdAt", Instant.now().toString());
    if (!kind.equals("ignore")) {
      if (result.path("snapshot").path("status").asText().equals("refused")) throw bad("Insufficient evidence cannot become work");
      JsonNode finding = selectedFinding;
      if (finding == null) throw bad("Select a finding");
      String title = required(request, "title", 300);
      String rationale = required(request, "rationale", 2000);
      String body = markdown(result, finding) + "\n\nReview / action rationale: " + rationale;
      var paraRecord = store.get("personal", "workspace-para", "data"); ObjectNode para = paraRecord.value().deepCopy();
      String projectId = target, areaId = "";
      for (JsonNode ref : result.path("references")) { if (projectId.isEmpty() && ref.path("kind").asText().equals("project")) projectId = ref.path("id").asText(); if (ref.path("kind").asText().equals("area")) areaId = ref.path("id").asText(); }
      JsonNode project = null;
      for (JsonNode p : para.path("projects")) if (p.path("id").asText().equals(projectId)) project = p;
      if (!projectId.isEmpty() && project == null) throw bad("Linked project is no longer available");
      ObjectNode ref = json.createObjectNode(); ref.put("pluginId", "noesis-research"); ref.put("entityType", "research-result"); ref.put("entityId", id);
      if (kind.equals("project-update")) {
        if (project == null) throw bad("Choose a linked project");
        ((ObjectNode) project).put("notes", project.path("notes").asText("") + "\n\n### " + title + "\n" + body);
        receipt.put("targetId", projectId);
      } else if (kind.equals("task")) {
        ObjectNode task = json.createObjectNode(); task.put("id", outputId); task.put("title", title); task.put("status", "Inbox"); task.put("priority", "P3"); task.put("energy", "Medium"); task.put("context", body);
        if (!projectId.isEmpty()) task.put("projectId", projectId); if (!areaId.isEmpty()) task.put("areaId", areaId);
        task.putArray("externalRefs").add(ref); ((ArrayNode) para.path("tasks")).add(task); receipt.put("targetId", outputId);
      } else {
        Note note = new Note(); note.setTitle(title); note.setContent(body); note.setMarkdownContent(body);
        Note saved = notes.save(note); receipt.put("noteId", saved.getId());
        ObjectNode resource = json.createObjectNode(); resource.put("id", outputId); resource.put("title", title); resource.put("type", kind.equals("decision") ? "Idea" : "Note"); resource.put("status", "Inbox"); resource.put("noteId", saved.getId());
        ArrayNode projects = resource.putArray("projectIds"); if (!projectId.isEmpty()) projects.add(projectId);
        ArrayNode areas = resource.putArray("areaIds"); if (!areaId.isEmpty()) areas.add(areaId);
        resource.putArray("externalRefs").add(ref); ((ArrayNode) para.path("resources")).add(resource); receipt.put("targetId", outputId);
      }
      store.put("personal", "workspace-para", "data", paraRecord.version(), paraRecord.schemaId(), paraRecord.schemaVersion(), para.toString());
    }
    ((ArrayNode) result.path("outputs")).add(receipt);
    if (result.path("outputs").size() > 200) throw bad("Output history limit reached");
    return save(id, current.version(), result);
  }
  private String markdown(JsonNode result, JsonNode finding) {
    StringBuilder body = new StringBuilder("Research question: ").append(result.path("question").asText()).append("\n\n").append(finding.path("text").asText());
    body.append("\n\nVerdict: ").append(finding.path("verdict").asText()).append(". Method: ").append(finding.path("method").asText()).append(".\n\nEvidence:\n");
    Set<String> refs = new HashSet<>(); finding.path("support").forEach(x -> refs.add(x.asText())); finding.path("contradictions").forEach(x -> refs.add(x.asText()));
    for (JsonNode source : result.path("snapshot").path("sources")) if (refs.contains(source.path("id").asText())) body.append("- ").append(source.path("title").asText()).append(" ").append(source.path("url").asText()).append(" (Noesis ").append(source.path("documentId").asText()).append(")\n");
    body.append("\nUncertainty / coverage:\n"); result.path("snapshot").path("coverageGaps").forEach(g -> body.append("- ").append(g.asText()).append("\n"));
    result.path("snapshot").path("assumptions").forEach(g -> body.append("- ").append(g.asText()).append("\n"));
    return body.append("\nNoesis run: ").append(result.path("runId").asText()).append("\nModulo research: /app/research-noesis?research=").append(result.path("id").asText()).toString();
  }
}
