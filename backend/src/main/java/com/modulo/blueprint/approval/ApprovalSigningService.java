package com.modulo.blueprint.approval;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.*;
import java.security.spec.*;
import java.sql.Timestamp;
import java.time.format.DateTimeFormatterBuilder;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class ApprovalSigningService {
  private final JdbcTemplate jdbc;
  private final ObjectMapper json;
  private final PrivateKey privateKey;
  private final PublicKey publicKey;
  private final String keyId;

  public ApprovalSigningService(
      JdbcTemplate jdbc,
      ObjectMapper json,
      @Value("${modulo.approvals.signing.private-key-file:}") String privatePath,
      @Value("${modulo.approvals.signing.public-key-file:}") String publicPath,
      @Value("${modulo.approvals.signing.required:false}") boolean required) {
    this.jdbc = jdbc;
    this.json = json;
    if (privatePath.isBlank() && publicPath.isBlank() && !required) {
      privateKey = null;
      publicKey = null;
      keyId = null;
      return;
    }
    try {
      byte[] secret = readKey(privatePath);
      byte[] visible = readKey(publicPath);
      try {
        var factory = KeyFactory.getInstance("Ed25519");
        privateKey = factory.generatePrivate(new PKCS8EncodedKeySpec(secret));
        publicKey = factory.generatePublic(new X509EncodedKeySpec(visible));
      } finally {
        Arrays.fill(secret, (byte) 0);
      }
      keyId = ApprovalService.hash(publicKey.getEncoded());
      byte[] challenge = "modulo-key-pair-check".getBytes(StandardCharsets.UTF_8);
      if (!verify(publicKey, challenge, sign(challenge))) throw new IllegalArgumentException();
    } catch (Exception failure) {
      throw new IllegalStateException(
          "Approval signing requires a valid matching Ed25519 DER key pair");
    }
  }

  private static byte[] readKey(String path) throws Exception {
    if (path.isBlank() || Files.size(Path.of(path)) > 32768) throw new IllegalArgumentException();
    return Files.readAllBytes(Path.of(path));
  }

  public boolean configured() { return privateKey!=null; }

  public String signDecision(UUID decision) {
    if (privateKey == null) return "UNSIGNED";
    try {
      var row = jdbc.queryForMap("SELECT * FROM approval_decisions WHERE id=?", decision);
      @SuppressWarnings("unchecked")
      Map<String, Object> binding = json.readValue(row.get("binding").toString(), Map.class);
      var fields = new LinkedHashMap<String, String>();
      fields.put("format", "modulo.approval.decision.v1");
      fields.put("keyId", keyId);
      fields.put("decisionId", decision.toString());
      for (String key :
          List.of(
              "requestId",
              "runId",
              "runAttempt",
              "nodeId",
              "blueprintDigest",
              "evidenceDigest",
              "policyDigest",
              "nonceDigest",
              "checkpoint")) fields.put(key, binding.get(key).toString());
      fields.put("requestRevision", row.get("request_revision").toString());
      fields.put("actor", row.get("actor_ref").toString());
      fields.put("outcome", row.get("outcome").toString());
      fields.put("comment", Objects.toString(row.get("comment_text"), ""));
      fields.put("commentDigest", row.get("comment_digest").toString());
      fields.put("idempotencyKey", row.get("idempotency_key").toString());
      fields.put(
          "decidedAt",
          new DateTimeFormatterBuilder()
              .appendInstant(3)
              .toFormatter()
              .format(((Timestamp) row.get("decided_at")).toInstant()));
      String statement = DecisionStatement.canonical(fields);
      String encoded = Base64.getEncoder().encodeToString(publicKey.getEncoded());
      jdbc.update(
          "INSERT INTO approval_signing_keys(key_id,algorithm,key_version,public_key) VALUES"
              + " (?,'Ed25519',1,?) ON CONFLICT DO NOTHING",
          keyId,
          encoded);
      if (!encoded.equals(
          jdbc.queryForObject(
              "SELECT public_key FROM approval_signing_keys WHERE key_id=?", String.class, keyId)))
        throw new IllegalStateException();
      jdbc.update(
          "INSERT INTO"
              + " approval_signatures(decision_id,key_id,format_version,statement,statement_digest,signature)"
              + " VALUES (?,?,1,?,?,?)",
          decision,
          keyId,
          statement,
          ApprovalService.hash(statement),
          Base64.getEncoder().encodeToString(sign(statement.getBytes(StandardCharsets.UTF_8))));
      return "SERVER_SIGNED";
    } catch (Exception failure) {
      throw new ApprovalFailure(
          org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE, "APPROVAL_SIGNING_FAILED");
    }
  }

  public String state(UUID decision) {
    return jdbc.queryForObject(
                "SELECT count(*) FROM approval_signatures WHERE decision_id=?",
                Long.class,
                decision)
            == 1
        ? "SERVER_SIGNED"
        : "UNSIGNED";
  }

  public Map<String, Object> envelope(UUID decision) {
    var rows =
        jdbc.queryForList(
            "SELECT s.*,k.algorithm,k.key_version,k.public_key,k.first_used_at FROM"
                + " approval_signatures s JOIN approval_signing_keys k ON k.key_id=s.key_id WHERE"
                + " s.decision_id=?",
            decision);
    if (rows.isEmpty()) return Map.of("decisionId", decision, "signatureState", "UNSIGNED");
    var row = rows.get(0);
    return Map.of(
        "decisionId",
        decision,
        "signatureState",
        "SERVER_SIGNED",
        "formatVersion",
        1,
        "algorithm",
        "Ed25519",
        "keyId",
        row.get("key_id"),
        "publicKey",
        row.get("public_key"),
        "statement",
        row.get("statement"),
        "digest",
        row.get("statement_digest"),
        "signature",
        row.get("signature"),
        "anchored",
        false);
  }

  private byte[] sign(byte[] bytes) throws GeneralSecurityException {
    var signer = Signature.getInstance("Ed25519");
    signer.initSign(privateKey);
    signer.update(bytes);
    return signer.sign();
  }

  public static boolean verify(PublicKey key, byte[] statement, byte[] signature)
      throws GeneralSecurityException {
    var verifier = Signature.getInstance("Ed25519");
    verifier.initVerify(key);
    verifier.update(statement);
    return verifier.verify(signature);
  }
}
