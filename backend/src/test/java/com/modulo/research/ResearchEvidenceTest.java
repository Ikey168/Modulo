package com.modulo.research;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
class ResearchEvidenceTest {
  static final ObjectMapper JSON = new ObjectMapper();
  static ObjectNode envelope(String text, String url) {
    ObjectNode root = JSON.createObjectNode(); root.put("as_of_ms", 123); ObjectNode data = root.putObject("data");
    data.put("answer_contract", "noesis-answer-v1"); data.put("answer_status", "answered"); data.putArray("assumptions").add("Citation is not truth");
    ObjectNode f = data.putArray("statements").addObject(); f.put("id", "finding-1"); f.put("text", text); f.put("verdict", "supported"); f.put("citation_state", "single-source");
    ObjectNode e = f.putArray("supporting_evidence").addObject(); e.put("cited", true); e.put("url", url); e.put("document_id", "doc-1"); e.put("title", "Official source"); e.put("visibility", "public");
    f.putArray("contradicting_evidence"); return root;
  }
  @Test void canonicalizationPreservesSemanticQueryAndRejectsExecutableLinks() {
    assertEquals("https://example.org/a?id=2", ResearchEvidence.canonicalUrl("https://example.org/a?utm_source=mail&id=2#top"));
    assertEquals("", ResearchEvidence.canonicalUrl("javascript:alert(1)"));
    assertEquals("", ResearchEvidence.canonicalUrl("https://password@example.org/"));
    assertNotEquals(ResearchEvidence.canonicalUrl("https://example.org/?id=1"), ResearchEvidence.canonicalUrl("https://example.org/?id=2"));
  }
  @Test void refreshDetectsEvidenceChangesNotRetrievalTimestamps() {
    var policy = JSON.createObjectNode(); var first = envelope("Finding", "https://example.org/a");
    var a = ResearchEvidence.snapshot(first, policy); first.put("as_of_ms", 456); var b = ResearchEvidence.snapshot(first, policy);
    assertEquals("unchanged", ResearchEvidence.delta(a, b).path("kind").asText());
    assertFalse(ResearchEvidence.delta(a, b).path("material").asBoolean());
    var changed = ResearchEvidence.snapshot(envelope("Corrected finding", "https://example.org/a"), policy);
    assertTrue(ResearchEvidence.delta(a, changed).path("material").asBoolean());
    assertEquals("finding-1", ResearchEvidence.delta(a, changed).path("findings").path("changed").get(0).asText());
  }
  @Test void sourcePolicyFailsClosedAndMakesCoverageGapsVisible() {
    ObjectNode policy = JSON.createObjectNode(); policy.putArray("allowedHosts").add("official.test"); policy.putArray("languages").add("de"); policy.put("maxAgeDays", 30);
    var denied = ResearchEvidence.snapshot(envelope("Finding", "https://other.test/"), policy);
    assertEquals("refused", denied.path("status").asText()); assertTrue(denied.path("sources").isEmpty());
    assertTrue(denied.path("coverageGaps").toString().contains("Language"));
    policy.putArray("primaryHosts").add("official.test");
    var allowed = ResearchEvidence.snapshot(envelope("Finding", "https://official.test/"), policy);
    assertEquals("configured-primary", allowed.path("sources").get(0).path("authority").asText());
  }
  @Test void refusesPrivateOrUncitedEvidenceAndReportsRemoval() {
    var original = envelope("Finding", "https://example.org/a"); var before = ResearchEvidence.snapshot(original, JSON.createObjectNode());
    ((ObjectNode) original.path("data").path("statements").get(0).path("supporting_evidence").get(0)).put("visibility", "private");
    var after = ResearchEvidence.snapshot(original, JSON.createObjectNode());
    assertEquals("refused", after.path("status").asText()); assertTrue(after.path("sources").isEmpty());
    assertTrue(ResearchEvidence.delta(before, after).path("statusChanged").asBoolean());
    assertEquals(1, ResearchEvidence.delta(before, after).path("sources").path("removed").size());
  }
  @Test void contradictionBecomesReviewableDelta() {
    var original = envelope("Finding", "https://example.org/a"); var before = ResearchEvidence.snapshot(original, JSON.createObjectNode());
    ObjectNode conflicting = ((ArrayNode) original.path("data").path("statements").get(0).path("contradicting_evidence")).addObject();
    conflicting.put("cited", true).put("url", "https://other.test/correction").put("document_id", "doc-2");
    var after = ResearchEvidence.snapshot(original, JSON.createObjectNode());
    assertEquals("contradicted", after.path("findings").get(0).path("verdict").asText());
    assertTrue(ResearchEvidence.delta(before, after).path("material").asBoolean());
    assertEquals(2, after.path("sources").size());
  }
}
