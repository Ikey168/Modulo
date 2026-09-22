package com.modulo.research;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;

/** Compact public evidence snapshots and deterministic, order-independent deltas. */
public final class ResearchEvidence {
  private static final ObjectMapper JSON = new ObjectMapper();
  private ResearchEvidence() {}
  public static String canonical(JsonNode node) {
    if (node.isObject()) {
      TreeMap<String, JsonNode> fields = new TreeMap<>(); node.fields().forEachRemaining(e -> fields.put(e.getKey(), e.getValue()));
      ObjectNode sorted = JSON.createObjectNode(); fields.forEach((k, v) -> { try { sorted.set(k, JSON.readTree(canonical(v))); } catch (Exception e) { throw new IllegalStateException(e); } });
      return sorted.toString();
    }
    if (node.isArray()) {
      ArrayNode array = JSON.createArrayNode(); node.forEach(v -> { try { array.add(JSON.readTree(canonical(v))); } catch (Exception e) { throw new IllegalStateException(e); } });
      return array.toString();
    }
    return node.toString();
  }
  public static String hash(String value) {
    try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
    catch (Exception e) { throw new IllegalStateException(e); }
  }
  public static String canonicalUrl(String value) {
    try {
      URI u = URI.create(value);
      if (!Set.of("http", "https").contains(u.getScheme()) || u.getHost() == null || u.getUserInfo() != null) return "";
      var query = new ArrayList<String>();
      if (u.getRawQuery() != null) for (String part : u.getRawQuery().split("&")) {
        String key = part.split("=", 2)[0].toLowerCase(Locale.ROOT);
        if (!key.startsWith("utm_") && !Set.of("fbclid", "gclid", "mc_cid", "mc_eid").contains(key)) query.add(part);
      }
      Collections.sort(query);
      String port = u.getPort() < 0 || (u.getScheme().equals("https") && u.getPort() == 443) || (u.getScheme().equals("http") && u.getPort() == 80) ? "" : ":" + u.getPort();
      return u.getScheme() + "://" + u.getHost().toLowerCase(Locale.ROOT) + port + (u.getRawPath().isEmpty() ? "/" : u.getRawPath()) + (query.isEmpty() ? "" : "?" + String.join("&", query));
    } catch (Exception e) { return ""; }
  }
  private static String text(JsonNode n, String key, int max) { String s = n.path(key).asText(""); return s.substring(0, Math.min(max, s.length())); }
  public static ObjectNode snapshot(JsonNode envelope, JsonNode policy) {
    JsonNode answer = envelope.path("data");
    if (!"noesis-answer-v1".equals(answer.path("answer_contract").asText()) || !answer.path("statements").isArray()) throw new IllegalArgumentException("Unsupported Noesis answer");
    ObjectNode result = JSON.createObjectNode();
    result.put("status", answer.path("answer_status").asText("refused"));
    result.put("asOf", envelope.path("as_of_ms").asLong());
    ArrayNode findings = result.putArray("findings"), sources = result.putArray("sources"), gaps = result.putArray("coverageGaps");
    Map<String, ObjectNode> unique = new TreeMap<>();
    int excluded = 0;
    for (JsonNode statement : answer.path("statements")) {
      if (findings.size() >= 20) break;
      ObjectNode finding = JSON.createObjectNode();
      finding.put("id", text(statement, "id", 160)); finding.put("text", text(statement, "text", 4000));
      finding.put("verdict", text(statement, "verdict", 80));
      finding.put("citationState", text(statement, "citation_state", 100));
      finding.put("method", text(statement, "prediction_mode", 200));
      ArrayNode support = finding.putArray("support"), contradictions = finding.putArray("contradictions");
      for (String field : List.of("supporting_evidence", "contradicting_evidence")) {
        int count = 0;
        for (JsonNode evidence : statement.path(field)) {
          if (++count > 40) break;
          if (!evidence.path("cited").asBoolean() || "private".equals(evidence.path("visibility").asText())) continue;
          String url = canonicalUrl(text(evidence, "url", 4000));
          String host = url.isEmpty() ? "" : URI.create(url).getHost();
          if (policy.path("allowedHosts").size() > 0 && !contains(policy.path("allowedHosts"), host)) { excluded++; continue; }
          String identity = url.isEmpty() ? text(evidence, "document_id", 200) : url;
          if (identity.isBlank()) continue;
          String id = "source-" + hash(identity).substring(0, 24);
          ObjectNode source = JSON.createObjectNode(); source.put("id", id); source.put("url", url);
          source.put("documentId", text(evidence, "document_id", 200)); source.put("path", text(evidence, "path", 1000));
          source.put("title", text(evidence, "title", 500)); source.put("excerpt", text(evidence, "excerpt", 2000));
          source.put("authority", contains(policy.path("primaryHosts"), host) ? "configured-primary" : "unassessed");
          source.put("host", host); unique.merge(id, source, (a, b) -> canonical(a).compareTo(canonical(b)) <= 0 ? a : b);
          ArrayNode refs = field.equals("supporting_evidence") ? support : contradictions;
          if (!contains(refs, id)) refs.add(id);
        }
      }
      if (support.isEmpty() && !"refused".equals(result.path("status").asText())) { excluded++; continue; }
      if (contradictions.size() > 0) finding.put("verdict", "contradicted");
      findings.add(finding);
    }
    unique.values().forEach(sources::add);
    if (findings.isEmpty() || sources.isEmpty()) result.put("status", "refused");
    result.put("refusal", text(answer.path("refusal"), "message", 2000));
    if (excluded > 0) gaps.add(excluded + " evidence items or findings excluded by source policy or missing citations.");
    if (sources.isEmpty()) gaps.add("No cited evidence. Acquire relevant public sources in Noesis before refreshing.");
    gaps.add("Search covers the selected Noesis corpus, not the whole web. A refresh does not acquire new documents.");
    if (policy.path("languages").size() > 0 || policy.path("regions").size() > 0 || policy.path("maxAgeDays").asInt() > 0)
      gaps.add("Language, geography and publication recency require source review: this Noesis answer contract does not expose those fields.");
    if (policy.path("primaryHosts").size() > 0 && unique.values().stream().noneMatch(s -> s.path("authority").asText().equals("configured-primary"))) gaps.add("No configured primary source found.");
    result.set("assumptions", answer.path("assumptions").deepCopy());
    return result;
  }
  private static boolean contains(JsonNode values, String value) { for (JsonNode v : values) if (v.asText().equals(value)) return true; return false; }
  private static Map<String, String> index(JsonNode items) {
    Map<String, String> result = new TreeMap<>();
    for (JsonNode n : items) {
      ObjectNode normalized = n.deepCopy();
      for (String field : List.of("support", "contradictions")) if (n.has(field)) {
        TreeSet<String> sorted = new TreeSet<>(); n.path(field).forEach(x -> sorted.add(x.asText()));
        ArrayNode a = normalized.putArray(field); sorted.forEach(a::add);
      }
      result.put(n.path("id").asText(), hash(canonical(normalized)));
    }
    return result;
  }
  public static ObjectNode delta(JsonNode previous, JsonNode next) {
    ObjectNode delta = JSON.createObjectNode();
    boolean changed = false;
    for (String field : List.of("findings", "sources")) {
      Map<String, String> before = index(previous.path(field)), after = index(next.path(field));
      ObjectNode part = delta.putObject(field); ArrayNode added = part.putArray("added"), removed = part.putArray("removed"), edited = part.putArray("changed");
      after.forEach((id, digest) -> { if (!before.containsKey(id)) added.add(id); else if (!before.get(id).equals(digest)) edited.add(id); });
      before.keySet().stream().filter(id -> !after.containsKey(id)).forEach(removed::add);
      changed |= added.size() + removed.size() + edited.size() > 0;
    }
    boolean statusChanged = !previous.path("status").asText().equals(next.path("status").asText());
    delta.put("statusChanged", statusChanged);
    delta.put("material", !previous.isMissingNode() && (changed || statusChanged));
    delta.put("kind", previous.isMissingNode() ? "baseline" : changed || statusChanged ? "changed" : "unchanged");
    delta.put("reason", "Evidence or verdict changes require review; delivery timestamps and source order do not create work.");
    return delta;
  }
}
