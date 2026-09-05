package com.modulo.pack;

import com.fasterxml.jackson.databind.*;
import com.modulo.blueprint.approval.ApprovalService;
import com.modulo.service.IpfsService;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

@Service
public class PackAuthoringService {
  private final JdbcTemplate jdbc;
  private final ObjectMapper json;
  private final IpfsService ipfs;
  private final TransactionTemplate tx;

  public PackAuthoringService(
      JdbcTemplate jdbc, ObjectMapper json, IpfsService ipfs, PlatformTransactionManager manager) {
    this.jdbc = jdbc;
    this.json =
        json.copy()
            .enable(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS)
            .enable(com.fasterxml.jackson.core.JsonParser.Feature.STRICT_DUPLICATE_DETECTION);
    this.ipfs = ipfs;
    tx = new TransactionTemplate(manager);
    tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
  }

  public Map<String, Object> preview(String source) {
    var manifest = parse(source);
    var validation = PackManifestValidator.validate(manifest);
    if (!validation.ok()) return Map.of("ok", false, "reason", validation.reason());
    if (!Integer.valueOf(2).equals(manifest.getManifestVersion()))
      return Map.of("ok", false, "reason", "MANIFEST_V2_REQUIRED");
    String canonical = canonical(manifest);
    var resources = new ArrayList<Map<String, Object>>();
    for (String id : validation.order())
      for (var resource : manifest.getResources())
        if (id.equals(resource.get("id")))
          resources.add(
              Map.of(
                  "id",
                  id,
                  "kind",
                  resource.get("kind"),
                  "title",
                  resource.get("title"),
                  "requires",
                  resource.get("requires")));
    return Map.of(
        "ok",
        true,
        "canonicalSource",
        canonical,
        "contentHash",
        ApprovalService.hash(canonical),
        "resources",
        resources,
        "capabilities",
        new TreeSet<>(manifest.getCapabilities()),
        "installsResources",
        false,
        "anchoring",
        "NOT_ANCHORED");
  }

  public Map<String, Object> saveDraft(long owner, UUID id, long revision, String source) {
    if (source == null || source.getBytes(StandardCharsets.UTF_8).length > 2097152)
      throw invalid("DRAFT_TOO_LARGE");
    JsonNode tree = tree(source);
    if (!tree.isObject()) throw invalid("DRAFT_MUST_BE_OBJECT");
    String title = tree.path("name").asText("Untitled pack");
    if (title.length() > 128) title = title.substring(0, 128);
    final String label = title;
    return tx.execute(
        status -> {
          jdbc.execute(
              "SELECT pg_advisory_xact_lock(hashtextextended('pack-drafts:" + owner + "',0))");
          if (id == null) {
            if (jdbc.queryForObject(
                    "SELECT count(*) FROM workspace_pack_drafts WHERE owner_id=?",
                    Long.class,
                    owner)
                >= 100) throw invalid("DRAFT_QUOTA");
            UUID created = UUID.randomUUID();
            jdbc.update(
                "INSERT INTO workspace_pack_drafts(id,owner_id,title,source) VALUES (?,?,?,?)",
                created,
                owner,
                label,
                source);
            return draft(created, owner);
          }
          if (jdbc.update(
                  "UPDATE workspace_pack_drafts SET"
                      + " title=?,source=?,revision=revision+1,updated_at=clock_timestamp() WHERE"
                      + " id=? AND owner_id=? AND revision=?",
                  label,
                  source,
                  id,
                  owner,
                  revision)
              != 1) throw conflict("DRAFT_CHANGED_OR_UNAVAILABLE");
          return draft(id, owner);
        });
  }

  public List<Map<String, Object>> drafts(long owner) {
    return jdbc.queryForList(
        "SELECT id,title,revision,updated_at FROM workspace_pack_drafts WHERE owner_id=? ORDER BY"
            + " updated_at DESC,id LIMIT 100",
        owner);
  }

  public Map<String, Object> draft(UUID id, long owner) {
    var rows =
        jdbc.queryForList(
            "SELECT id,title,source,revision,updated_at FROM workspace_pack_drafts WHERE id=? AND"
                + " owner_id=?",
            id,
            owner);
    if (rows.isEmpty()) throw unavailable();
    return rows.get(0);
  }

  public void deleteDraft(UUID id, long owner, long revision) {
    if (jdbc.update(
            "DELETE FROM workspace_pack_drafts WHERE id=? AND owner_id=? AND revision=?",
            id,
            owner,
            revision)
        != 1) throw conflict("DRAFT_CHANGED_OR_UNAVAILABLE");
  }

  public Map<String, Object> publish(
      long owner, String source, String expectedHash, boolean publicConfirmation) {
    if (!publicConfirmation) throw invalid("PUBLICATION_CONFIRMATION_REQUIRED");
    var preview = preview(source);
    if (!Boolean.TRUE.equals(preview.get("ok"))) throw invalid(preview.get("reason").toString());
    String canonical = preview.get("canonicalSource").toString();
    String hash = preview.get("contentHash").toString();
    if (!hash.equals(expectedHash)) throw conflict("PUBLICATION_SOURCE_CHANGED");
    var manifest = parse(canonical);
    UUID attempt = UUID.randomUUID();
    var reservation =
        tx.execute(
            status -> {
              jdbc.execute(
                  "SELECT pg_advisory_xact_lock(hashtextextended('pack-publish:" + owner + "',0))");
              var rows =
                  jdbc.queryForList(
                      "SELECT * FROM workspace_pack_publications WHERE owner_id=? AND pack_key=?"
                          + " AND version=? FOR UPDATE",
                      owner,
                      manifest.getId(),
                      manifest.getVersion());
              if (!rows.isEmpty()) {
                var row = rows.get(0);
                if (!hash.equals(row.get("content_hash")))
                  throw conflict("PUBLICATION_VERSION_IMMUTABLE");
                if ("PUBLISHED".equals(row.get("state"))) return row;
                if ("PUBLISHING".equals(row.get("state"))
                    && ((Timestamp) row.get("updated_at"))
                        .toInstant()
                        .isAfter(Instant.now().minusSeconds(300)))
                  throw conflict("PUBLICATION_IN_PROGRESS");
                jdbc.update(
                    "UPDATE workspace_pack_publications SET"
                        + " state='PUBLISHING',attempt_token=?,failure_code=NULL,updated_at=clock_timestamp()"
                        + " WHERE id=?",
                    attempt,
                    row.get("id"));
                row.put("attempt_token", attempt);
                return row;
              }
              if (jdbc.queryForObject(
                      "SELECT count(*) FROM workspace_pack_publications WHERE owner_id=?",
                      Long.class,
                      owner)
                  >= 1000) throw invalid("PUBLICATION_QUOTA");
              UUID id = UUID.randomUUID();
              jdbc.update(
                  "INSERT INTO"
                      + " workspace_pack_publications(id,owner_id,pack_key,version,source,content_hash,state,attempt_token)"
                      + " VALUES (?,?,?,?,?,?,'PUBLISHING',?)",
                  id,
                  owner,
                  manifest.getId(),
                  manifest.getVersion(),
                  canonical,
                  hash,
                  attempt);
              return Map.<String, Object>of("id", id, "state", "PUBLISHING");
            });
    UUID id = (UUID) reservation.get("id");
    if ("PUBLISHED".equals(reservation.get("state"))) return publication(id, owner);
    try {
      if (!ipfs.isAvailable()) throw new IllegalStateException();
      String cid = ipfs.uploadPublicContent(canonical);
      if (cid == null
          || !cid.matches("(?:Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{20,120})")
          || !ipfs.pinContent(cid)) throw new IllegalStateException();
      String retrieved = ipfs.retrievePublicContent(cid, 2097152);
      if (!hash.equals(ApprovalService.hash(retrieved))) throw new IllegalStateException();
      tx.executeWithoutResult(
          status -> {
            if (jdbc.update(
                    "UPDATE workspace_pack_publications SET"
                        + " state='PUBLISHED',cid=?,updated_at=clock_timestamp() WHERE id=? AND"
                        + " owner_id=? AND attempt_token=? AND state='PUBLISHING'",
                    cid,
                    id,
                    owner,
                    attempt)
                != 1) throw conflict("PUBLICATION_ATTEMPT_CHANGED");
          });
      return publication(id, owner);
    } catch (Exception failure) {
      tx.executeWithoutResult(
          status ->
              jdbc.update(
                  "UPDATE workspace_pack_publications SET"
                      + " state='FAILED',failure_code='IPFS_PUBLICATION_FAILED',updated_at=clock_timestamp()"
                      + " WHERE id=? AND owner_id=? AND attempt_token=? AND state='PUBLISHING'",
                  id,
                  owner,
                  attempt));
      throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "IPFS_PUBLICATION_FAILED");
    }
  }

  public List<Map<String, Object>> publications(long owner) {
    return jdbc.queryForList(
        "SELECT id,pack_key,version,content_hash,state,cid,failure_code,created_at FROM"
            + " workspace_pack_publications WHERE owner_id=? ORDER BY created_at DESC,id LIMIT 100",
        owner);
  }

  public Map<String, Object> publication(UUID id, long owner) {
    var rows =
        jdbc.queryForList(
            "SELECT id,pack_key,version,content_hash,state,cid,failure_code,created_at FROM"
                + " workspace_pack_publications WHERE id=? AND owner_id=?",
            id,
            owner);
    if (rows.isEmpty()) throw unavailable();
    var row = rows.get(0);
    row.put("anchoring", "NOT_ANCHORED");
    row.put("publisherVerification", "UNVERIFIED");
    if (row.get("cid") != null)
      row.put("gatewayUrl", ipfs.getGatewayUrl(row.get("cid").toString()));
    return row;
  }

  public String publishedSource(UUID id, long owner) {
    var rows =
        jdbc.queryForList(
            "SELECT source FROM workspace_pack_publications WHERE id=? AND owner_id=?",
            String.class,
            id,
            owner);
    if (rows.isEmpty()) throw unavailable();
    return rows.get(0);
  }

  private String canonical(PackManifest manifest) {
    try {
      return json.writeValueAsString(manifest);
    } catch (Exception invalid) {
      throw invalid("INVALID_MANIFEST");
    }
  }

  private PackManifest parse(String source) {
    if (source == null || source.getBytes(StandardCharsets.UTF_8).length > 2097152)
      throw invalid("MANIFEST_TOO_LARGE");
    try {
      return json.readValue(source, PackManifest.class);
    } catch (Exception invalid) {
      throw invalid("INVALID_MANIFEST_JSON");
    }
  }

  private JsonNode tree(String source) {
    try {
      return json.readTree(source);
    } catch (Exception invalid) {
      throw invalid("INVALID_DRAFT_JSON");
    }
  }

  private static ResponseStatusException invalid(String code) {
    return new ResponseStatusException(HttpStatus.BAD_REQUEST, code);
  }

  private static ResponseStatusException conflict(String code) {
    return new ResponseStatusException(HttpStatus.CONFLICT, code);
  }

  private static ResponseStatusException unavailable() {
    return new ResponseStatusException(HttpStatus.NOT_FOUND, "PACK_SOURCE_UNAVAILABLE");
  }
}
