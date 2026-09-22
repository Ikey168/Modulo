package com.modulo.blueprint.approval;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.*;
import java.security.spec.*;
import java.util.*;
import org.junit.jupiter.api.Test;

class DecisionStatementTest {
  @Test
  void sharedCanonicalAndSignatureVectors() throws Exception {
    var json = new ObjectMapper();
    var vectors = json.readTree(Files.readString(Path.of("../shared/approval/vectors.json")));
    for (var vector : vectors) {
      @SuppressWarnings("unchecked")
      Map<String, String> fields = json.convertValue(vector.get("fields"), Map.class);
      String canonical = DecisionStatement.canonical(fields);
      assertEquals(vector.get("canonical").asText(), canonical);
      var envelope = vector.get("envelope");
      assertEquals(envelope.get("digest").asText(), ApprovalService.hash(canonical));
      var key =
          KeyFactory.getInstance("Ed25519")
              .generatePublic(
                  new X509EncodedKeySpec(
                      Base64.getDecoder().decode(envelope.get("publicKey").asText())));
      assertTrue(
          ApprovalSigningService.verify(
              key,
              canonical.getBytes(StandardCharsets.UTF_8),
              Base64.getDecoder().decode(envelope.get("signature").asText())));
      fields.put("comment", "e\u0301");
      assertThrows(IllegalArgumentException.class, () -> DecisionStatement.canonical(fields));
      fields.put("comment", "\uD800");
      assertThrows(IllegalArgumentException.class, () -> DecisionStatement.canonical(fields));
    }
  }
}
