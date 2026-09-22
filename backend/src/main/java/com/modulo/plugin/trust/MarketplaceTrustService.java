package com.modulo.plugin.trust;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.modulo.plugin.submission.PluginSubmission;
import com.modulo.security.AuthenticatedUserService;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.OffsetDateTime;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MarketplaceTrustService {
  public record PermissionDiff(List<String> added,List<String> removed,boolean renewedConsentRequired){}
  private final JdbcTemplate jdbc; private final ObjectMapper json; private final ArtifactTrustVerifier verifier; private final AuthenticatedUserService users;
  public MarketplaceTrustService(JdbcTemplate jdbc,ObjectMapper json,ArtifactTrustVerifier verifier,AuthenticatedUserService users){this.jdbc=jdbc;this.json=json;this.verifier=verifier;this.users=users;}

  @Transactional public UUID recordSubmission(PluginSubmission submission){
    long actor=users.requireUserId();
    jdbc.queryForList("SELECT pg_advisory_xact_lock(hashtext(?))",submission.getPluginName());
    CliArtifactTrustVerifier.pinned(submission.getImageReference(),submission.getImageDigest());
    List<Map<String,Object>> claimed=jdbc.queryForList("SELECT p.owner_id FROM marketplace_releases r JOIN marketplace_publishers p ON p.id=r.publisher_id WHERE r.plugin_key=?",submission.getPluginName());
    if(claimed.stream().anyMatch(row->!(row.get("owner_id") instanceof Number owner)||owner.longValue()!=actor))
      throw new IllegalStateException("Plugin releases belong to a different publisher account");
    UUID release=UUID.nameUUIDFromBytes((submission.getPluginName()+":"+submission.getVersion()).getBytes(StandardCharsets.UTF_8));
    String permissions=toJson(split(submission.getRequiredPermissions()));
    String runtimeMetadata=toJson(Map.of("minPlatformVersion",Objects.toString(submission.getMinPlatformVersion(),""),"maxPlatformVersion",Objects.toString(submission.getMaxPlatformVersion(),"")));
    String immutable=sha256(String.join("|",Objects.toString(submission.getImageReference(),""),Objects.toString(submission.getImageDigest(),""),permissions,runtimeMetadata));
    List<Map<String,Object>> existing=jdbc.queryForList("SELECT immutable_digest FROM marketplace_releases WHERE plugin_key=? AND version=?",submission.getPluginName(),submission.getVersion());
    if(!existing.isEmpty()&&!immutable.equals(existing.get(0).get("immutable_digest")))throw new IllegalStateException("Published release metadata is immutable; use a new version");
    String email=Objects.toString(submission.getDeveloperEmail(),"").trim().toLowerCase(Locale.ROOT);
    List<Map<String,Object>> owned=jdbc.queryForList("SELECT id FROM marketplace_publishers WHERE owner_id=? ORDER BY id LIMIT 1",actor);
    UUID publisher=owned.isEmpty()?UUID.nameUUIDFromBytes(("publisher-account:"+actor).getBytes(StandardCharsets.UTF_8)):UUID.fromString(owned.get(0).get("id").toString());
    jdbc.update("INSERT INTO marketplace_publishers(id,owner_id,display_name,verification_level,evidence) VALUES(?,?,?, 'UNVERIFIED', ?::jsonb) ON CONFLICT(id) DO NOTHING",publisher,actor,Objects.toString(submission.getDeveloperName(),submission.getPluginName()),toJson(Map.of("submittedEmail",email)));
    jdbc.update("INSERT INTO marketplace_releases(id,plugin_key,version,image_reference,image_digest,publisher_id,permissions,immutable_digest,runtime_metadata) VALUES(?,?,?,?,?,?,?::jsonb,?,?::jsonb) ON CONFLICT(plugin_key,version) DO NOTHING",release,submission.getPluginName(),submission.getVersion(),submission.getImageReference(),submission.getImageDigest(),publisher,permissions,immutable,runtimeMetadata);
    return release;
  }

  @Transactional public Map<String,Object> verifySubmission(PluginSubmission submission){UUID release=recordSubmission(submission);return verifyRelease(release);}
  public Optional<UUID> releaseFor(String plugin,String version){List<Map<String,Object>> rows=jdbc.queryForList("SELECT id FROM marketplace_releases WHERE plugin_key=? AND version=?",plugin,version);return rows.isEmpty()?Optional.empty():Optional.of(UUID.fromString(rows.get(0).get("id").toString()));}
  public void assertRuntimeRelease(String plugin,String version,Object runtimeDigest){Optional<UUID> found=releaseFor(plugin,version);if(found.isEmpty()){if(!releases(plugin).isEmpty())throw new IllegalStateException("Unknown version of marketplace plugin");return;}long owner=users.requireUserId();Optional<UUID> desired=currentRelease(owner,plugin);if(desired.isEmpty()||!desired.get().equals(found.get()))throw new IllegalStateException("Runtime version is not the owner's approved active release");Map<String,Object> release=one("SELECT image_digest FROM marketplace_releases WHERE id=?",found.get());String expected=Objects.toString(release.get("image_digest"),"");if(runtimeDigest==null||!expected.equals(runtimeDigest.toString()))throw new IllegalStateException("Runtime digest does not match the reviewed marketplace release");installCheck(found.get());}
  @Transactional public Map<String,Object> verifyRelease(UUID release){Map<String,Object> row=one("SELECT r.*,p.signing_identity,p.verification_level FROM marketplace_releases r LEFT JOIN marketplace_publishers p ON p.id=r.publisher_id WHERE r.id=?",release);String image=Objects.toString(row.get("image_reference"),null),digest=Objects.toString(row.get("image_digest"),null),signingIdentity=Objects.toString(row.get("release_signing_identity"),Objects.toString(row.get("signing_identity"),null));
    if(signingIdentity!=null && !"UNVERIFIED".equals(row.get("verification_level"))) jdbc.update("UPDATE marketplace_releases SET release_signing_identity=? WHERE id=? AND release_signing_identity IS NULL",signingIdentity,release);
    List<ArtifactTrustVerifier.Evidence> checks=List.of(verifier.signature(image,digest,signingIdentity),verifier.provenance(image,digest,signingIdentity),verifier.sbom(image,digest,signingIdentity),verifier.vulnerabilities(image,digest));for(var evidence:checks)saveEvidence(release,evidence);return detail(release);}
  public Map<String,Object> detail(UUID release){Map<String,Object> result=new LinkedHashMap<>(one("SELECT r.*,p.display_name AS publisher,p.verification_level,p.signing_identity,p.expires_at AS publisher_expires_at,p.revoked_at AS publisher_revoked_at FROM marketplace_releases r LEFT JOIN marketplace_publishers p ON p.id=r.publisher_id WHERE r.id=?",release));List<Map<String,Object>> evidence=jdbc.queryForList("SELECT DISTINCT ON (evidence_type) evidence_type,status,source,summary,payload,evaluated_at,expires_at FROM marketplace_trust_evidence WHERE release_id=? ORDER BY evidence_type,evaluated_at DESC,id DESC",release);result.put("permissions",new ArrayList<>(permissions(release)));evidence.forEach(this::normalize);result.put("evidence",evidence);result.put("trustStatus",trustStatus(evidence,result));return result;}
  public List<Map<String,Object>> evidenceHistory(UUID release){return jdbc.queryForList("SELECT evidence_type,status,source,summary,payload,evaluated_at,expires_at FROM marketplace_trust_evidence WHERE release_id=? ORDER BY evaluated_at DESC,id DESC",release);}
  public List<Map<String,Object>> releases(String plugin){return jdbc.queryForList("SELECT r.id,r.plugin_key,r.version,r.image_digest,r.permissions,r.created_at,p.display_name AS publisher,p.verification_level FROM marketplace_releases r LEFT JOIN marketplace_publishers p ON p.id=r.publisher_id WHERE r.plugin_key=? ORDER BY r.created_at DESC",plugin);}
  public List<Map<String,Object>> catalog(){List<Map<String,Object>> result=new ArrayList<>();Set<String> seen=new HashSet<>();for(Map<String,Object> row:jdbc.queryForList("SELECT name,version,type,runtime,status,updated_at FROM plugin_registry ORDER BY name")){String plugin=Objects.toString(row.get("name"),"");seen.add(plugin);List<Map<String,Object>> rel=releases(plugin);Map<String,Object> item=new LinkedHashMap<>(row);item.put("plugin",plugin);if(rel.isEmpty()){item.put("trustStatus","BUILT_IN".equalsIgnoreCase(Objects.toString(row.get("type"),""))?"BUNDLED":"UNKNOWN");item.put("evidence",List.of());}else{Map<String,Object> latest=detail(UUID.fromString(rel.get(0).get("id").toString()));item.put("trustStatus",latest.get("trustStatus"));item.put("release",latest);}result.add(item);}for(Map<String,Object> row:jdbc.queryForList("SELECT DISTINCT plugin_key FROM marketplace_releases ORDER BY plugin_key")){String plugin=Objects.toString(row.get("plugin_key"),"");if(seen.add(plugin)){Map<String,Object> latest=detail(UUID.fromString(releases(plugin).get(0).get("id").toString()));result.add(new LinkedHashMap<>(Map.of("plugin",plugin,"trustStatus",latest.get("trustStatus"),"release",latest)));}}return result;}

  /** Install-time recheck fails closed on missing, failed, unavailable or stale evidence. */
  @Transactional public Map<String,Object> installCheck(UUID release){verifyRelease(release);Map<String,Object> detail=detail(release);if(!"VERIFIED".equals(detail.get("trustStatus")))throw new IllegalStateException("Release is not installable: trust evidence is incomplete or failed");return detail;}

  @Transactional public UUID approveInstall(String plugin,UUID release,boolean consented){
    long owner=users.requireUserId();requirePluginRelease(plugin,release);
    jdbc.queryForList("SELECT pg_advisory_xact_lock(hashtext(?))",owner+":"+plugin);
    if(!consented)throw new IllegalArgumentException("Explicit release and permission consent is required");
    Optional<UUID> active=currentRelease(owner,plugin);
    if(active.isPresent())return recordUpgrade(plugin,active.get(),release,true);
    installCheck(release);UUID id=UUID.randomUUID();
    jdbc.update("INSERT INTO marketplace_installations(id,owner_id,plugin_key,release_id,action,permission_diff,consented,status) VALUES(?,?,?,?,'INSTALL',?::jsonb,TRUE,'APPLIED')",id,owner,plugin,release,toJson(new PermissionDiff(new ArrayList<>(permissions(release)),List.of(),true)));
    return id;
  }

  public void assertRuntimePermissions(String plugin,String version,Collection<String> requested){
    Optional<UUID> release=releaseFor(plugin,version);
    if(release.isPresent()&&!permissions(release.get()).containsAll(requested))throw new IllegalStateException("Runtime requested permissions outside the approved release");
  }

  @Transactional public UUID recordDeployment(String plugin,UUID release,String outcome){
    requirePluginRelease(plugin,release);long owner=users.requireUserId();
    if(!Set.of("SUCCEEDED","FAILED").contains(outcome))throw new IllegalArgumentException("Invalid deployment outcome");
    UUID id=UUID.randomUUID();
    jdbc.update("INSERT INTO marketplace_installations(id,owner_id,plugin_key,release_id,action,permission_diff,consented,status) VALUES(?,?,?,?,'DEPLOYMENT','{}'::jsonb,TRUE,?)",id,owner,plugin,release,outcome);
    return id;
  }

  public PermissionDiff permissionDiff(UUID from,UUID to){Set<String>a=new TreeSet<>(permissions(from)),b=new TreeSet<>(permissions(to));List<String>added=b.stream().filter(x->!a.contains(x)).toList(),removed=a.stream().filter(x->!b.contains(x)).toList();Map<String,Object> oldRelease=one("SELECT image_digest,publisher_id,runtime_metadata FROM marketplace_releases WHERE id=?",from),newRelease=one("SELECT image_digest,publisher_id,runtime_metadata FROM marketplace_releases WHERE id=?",to);
    return new PermissionDiff(added,removed,!added.isEmpty()||!oldRelease.equals(newRelease));}
  @Transactional public UUID recordUpgrade(String plugin,UUID from,UUID to,boolean consented){long owner=users.requireUserId();jdbc.queryForList("SELECT pg_advisory_xact_lock(hashtext(?))",owner+":"+plugin);requirePluginRelease(plugin,from);requirePluginRelease(plugin,to);Optional<UUID> active=currentRelease(owner,plugin);if(active.isEmpty()||!active.get().equals(from))throw new IllegalStateException("Upgrade source is not the active release");PermissionDiff diff=permissionDiff(from,to);UUID id=UUID.randomUUID();if(diff.renewedConsentRequired()&&!consented){jdbc.update("INSERT INTO marketplace_installations(id,owner_id,plugin_key,release_id,previous_release_id,action,permission_diff,consented,status,failure) VALUES(?,?,?,?,?,'UPGRADE',?::jsonb,FALSE,'DECLINED','Release changes require renewed consent')",id,owner,plugin,to,from,toJson(diff));return id;}installCheck(to);jdbc.update("INSERT INTO marketplace_installations(id,owner_id,plugin_key,release_id,previous_release_id,action,permission_diff,consented,status) VALUES(?,?,?,?,?,'UPGRADE',?::jsonb,?,'APPLIED')",id,owner,plugin,to,from,toJson(diff),consented);return id;}
  @Transactional public UUID rollback(String plugin,UUID target){long owner=users.requireUserId();jdbc.queryForList("SELECT pg_advisory_xact_lock(hashtext(?))",owner+":"+plugin);requirePluginRelease(plugin,target);Optional<UUID> active=currentRelease(owner,plugin);UUID from=active.orElse(null);installCheck(target);PermissionDiff diff=from==null?new PermissionDiff(List.of(),List.of(),false):permissionDiff(from,target);UUID id=UUID.randomUUID();jdbc.update("INSERT INTO marketplace_installations(id,owner_id,plugin_key,release_id,previous_release_id,action,permission_diff,consented,status) VALUES(?,?,?,?,?,'ROLLBACK',?::jsonb,TRUE,'APPLIED')",id,owner,plugin,target,from,toJson(diff));return id;}
  public List<Map<String,Object>> history(String plugin){return jdbc.queryForList("SELECT * FROM marketplace_installations WHERE owner_id=? AND plugin_key=? ORDER BY created_at DESC",users.requireUserId(),plugin);}
  public Map<String,Object> health(String plugin){long owner=users.requireUserId();List<Map<String,Object>> releases=releases(plugin);Map<String,Object> result=new LinkedHashMap<>();result.put("plugin",plugin);result.put("releaseCount",releases.size());result.put("releases",releases);if(!releases.isEmpty()){UUID newest=UUID.fromString(releases.get(0).get("id").toString());result.put("latest",detail(newest));}Optional<UUID> active=currentRelease(owner,plugin);if(active.isPresent()){Map<String,Object> desired=detail(active.get());result.put("desired",desired);result.put("trustStatus",desired.get("trustStatus"));}else if(result.get("latest") instanceof Map<?,?> latest){result.put("trustStatus",latest.get("trustStatus"));}List<Map<String,Object>> runtime=jdbc.queryForList("SELECT status,endpoint,updated_at FROM plugin_registry WHERE name=? ORDER BY updated_at DESC LIMIT 1",plugin);result.put("runtime",runtime.isEmpty()?Map.of("status","NOT_DEPLOYED"):runtime.get(0));result.put("history",history(plugin));
    result.put("recentRuns",jdbc.queryForList("SELECT r.id,r.state,r.error_class,r.created_at FROM workflow_runs r WHERE r.owner_id=? AND (EXISTS (SELECT 1 FROM plugin_registry p WHERE p.id=r.blueprint_id AND p.name=?) OR EXISTS (SELECT 1 FROM workflow_steps s WHERE s.run_id=r.id AND (s.input_metadata->>'pluginId'=? OR left(s.node_type,length(?)+1)=?||'.'))) ORDER BY r.created_at DESC LIMIT 10",owner,plugin,plugin,plugin,plugin));
    return result;}
  @Transactional public UUID report(String plugin,UUID release,String reason,String detail){long owner=users.requireUserId();UUID id=UUID.randomUUID();jdbc.update("INSERT INTO marketplace_trust_reports(id,owner_id,plugin_key,release_id,reason,detail) VALUES(?,?,?,?,?,?)",id,owner,plugin,release,Objects.toString(reason,"OTHER").substring(0,Math.min(80,Objects.toString(reason,"OTHER").length())),detail==null?null:detail.substring(0,Math.min(4000,detail.length())));return id;}

  @Transactional public void verifyPublisher(UUID publisher,String level,String signingIdentity,String reason,long actor){Map<String,Object> row=one("SELECT owner_id,verification_level,display_name FROM marketplace_publishers WHERE id=?",publisher);Long owner=row.get("owner_id")==null?null:((Number)row.get("owner_id")).longValue();if(owner!=null&&owner==actor)throw new IllegalStateException("Publishers cannot self-assign verification");if(!Set.of("UNVERIFIED","DOMAIN","IDENTITY","ORGANIZATION").contains(level))throw new IllegalArgumentException("Invalid verification level");if(!"UNVERIFIED".equals(level)&&(signingIdentity==null||signingIdentity.isBlank()))throw new IllegalArgumentException("Verified publishers require a signing identity");if(!"UNVERIFIED".equals(level)){String name=Objects.toString(row.get("display_name"),"");if(jdbc.queryForObject("SELECT count(*) FROM marketplace_publishers WHERE id<>? AND verification_level<>'UNVERIFIED' AND revoked_at IS NULL AND lower(display_name)=lower(?)",Integer.class,publisher,name)>0)throw new IllegalStateException("Verified publisher name is already in use");if(jdbc.queryForObject("SELECT count(*) FROM marketplace_publishers WHERE id<>? AND revoked_at IS NULL AND signing_identity=?",Integer.class,publisher,signingIdentity)>0)throw new IllegalStateException("Signing identity is already bound to another publisher");}jdbc.update("UPDATE marketplace_publishers SET verification_level=?,signing_identity=?,evidence=jsonb_set(evidence,'{reviewReason}',to_jsonb(?::text),true),verified_at=now(),expires_at=CASE WHEN ?='UNVERIFIED' THEN NULL ELSE now()+interval '365 days' END,revoked_at=NULL,reviewed_by=?,updated_at=now() WHERE id=?",level,signingIdentity,Objects.toString(reason,"reviewed"),level,actor,publisher);jdbc.update("INSERT INTO marketplace_publisher_history(id,publisher_id,actor_id,old_level,new_level,reason) VALUES(?,?,?,?,?,?)",UUID.randomUUID(),publisher,actor,row.get("verification_level"),level,Objects.toString(reason,"reviewed"));}
  @Transactional public void revokePublisher(UUID publisher,String reason,long actor){Map<String,Object> row=one("SELECT verification_level FROM marketplace_publishers WHERE id=?",publisher);jdbc.update("UPDATE marketplace_publishers SET verification_level='UNVERIFIED',revoked_at=now(),reviewed_by=?,updated_at=now() WHERE id=?",actor,publisher);jdbc.update("INSERT INTO marketplace_publisher_history(id,publisher_id,actor_id,old_level,new_level,reason) VALUES(?,?,?,?,?,?)",UUID.randomUUID(),publisher,actor,row.get("verification_level"),"UNVERIFIED",reason);}
  public List<Map<String,Object>> publisherHistory(UUID publisher){return jdbc.queryForList("SELECT actor_id,old_level,new_level,reason,created_at FROM marketplace_publisher_history WHERE publisher_id=? ORDER BY created_at DESC",publisher);}

  private void saveEvidence(UUID release,ArtifactTrustVerifier.Evidence e){jdbc.update("INSERT INTO marketplace_trust_evidence(id,release_id,evidence_type,status,source,summary,payload,evaluated_at,expires_at) VALUES(?,?,?,?,?,?,?::jsonb,now(),now()+interval '24 hours')",UUID.randomUUID(),release,e.type(),e.status(),e.source(),e.summary(),toJson(e.payload()));}
  @Transactional public UUID applyPublisher(String name,String signingIdentity,String evidence){
    long owner=users.requireUserId();
    if(name==null||name.isBlank()||name.length()>160||signingIdentity==null||signingIdentity.isBlank()||signingIdentity.length()>500||evidence==null||evidence.isBlank()||evidence.length()>4000)throw new IllegalArgumentException("Provide a publisher name, signing identity and ownership evidence");
    jdbc.queryForList("SELECT pg_advisory_xact_lock(?)",owner);
    List<Map<String,Object>> existing=jdbc.queryForList("SELECT id FROM marketplace_publishers WHERE owner_id=? ORDER BY id LIMIT 1",owner);
    UUID id=existing.isEmpty()?UUID.nameUUIDFromBytes(("publisher-account:"+owner).getBytes(StandardCharsets.UTF_8)):UUID.fromString(existing.get(0).get("id").toString());
    String application=toJson(Map.of("application",Map.of("name",name,"requestedSigningIdentity",signingIdentity,"ownershipEvidence",evidence,"submittedAt",OffsetDateTime.now().toString())));
    jdbc.update("INSERT INTO marketplace_publishers(id,owner_id,display_name,evidence) VALUES(?,?,?,?::jsonb) ON CONFLICT(id) DO UPDATE SET evidence=marketplace_publishers.evidence||excluded.evidence,updated_at=now()",id,owner,name,application);
    jdbc.update("INSERT INTO marketplace_publisher_history(id,publisher_id,actor_id,old_level,new_level,reason) VALUES(?,?,?,NULL,'APPLICATION','Publisher submitted ownership evidence for independent review')",UUID.randomUUID(),id,owner);
    return id;
  }
  public List<Map<String,Object>> publisherApplications(){return jdbc.queryForList("SELECT id,owner_id,display_name,verification_level,evidence::text AS evidence,updated_at FROM marketplace_publishers WHERE evidence ? 'application' ORDER BY updated_at DESC LIMIT 100");}
  static String trustStatus(List<Map<String,Object>> evidence,Map<String,Object> release){if(evidence.size()<4)return "UNKNOWN";if(release.get("publisher_revoked_at")!=null)return "FAILED";if(expired(release.get("publisher_expires_at")))return "STALE";Set<String> types=new HashSet<>();for(Map<String,Object> entry:evidence)types.add(Objects.toString(entry.get("evidence_type"),""));
    if(!types.containsAll(Set.of("SIGNATURE","PROVENANCE","SBOM","VULNERABILITY")))return "UNKNOWN";
    if(release.get("release_signing_identity")!=null&&!Objects.equals(release.get("release_signing_identity"),release.get("signing_identity")))return "PARTIAL";
    String publisherLevel=Objects.toString(release.get("verification_level"),"UNVERIFIED");if("UNVERIFIED".equals(publisherLevel)||release.get("signing_identity")==null)return "PARTIAL";boolean stale=evidence.stream().anyMatch(e->expired(e.get("expires_at")));if(stale)return "STALE";if(evidence.stream().anyMatch(e->"FAILED".equals(e.get("status"))))return "FAILED";if(evidence.stream().anyMatch(e->"UNAVAILABLE".equals(e.get("status"))))return "UNAVAILABLE";return evidence.stream().allMatch(e->"VERIFIED".equals(e.get("status")))?"VERIFIED":"PARTIAL";}
  static boolean expired(Object value){if(value==null)return false;if(value instanceof OffsetDateTime)return ((OffsetDateTime)value).isBefore(OffsetDateTime.now());if(value instanceof java.sql.Timestamp)return ((java.sql.Timestamp)value).toInstant().isBefore(java.time.Instant.now());if(value instanceof java.time.Instant)return ((java.time.Instant)value).isBefore(java.time.Instant.now());try{return OffsetDateTime.parse(value.toString()).isBefore(OffsetDateTime.now());}catch(Exception ignored){return true;}}
  private Map<String,Object> one(String sql,Object...args){List<Map<String,Object>> rows=jdbc.queryForList(sql,args);if(rows.isEmpty())throw new NoSuchElementException("Trust resource not found");return normalize(rows.get(0));}
  private Map<String,Object> normalize(Map<String,Object> row){
    for(String key:List.of("permissions","runtime_metadata","payload","permission_diff","evidence")){
      Object value=row.get(key);
      if(value!=null&&!(value instanceof Map<?,?>)&&!(value instanceof Collection<?>))
        try{row.put(key,json.readValue(value.toString(),Object.class));}catch(Exception invalid){throw new IllegalStateException("Invalid trust metadata: "+key);}
    }
    return row;
  }
  private void requirePluginRelease(String plugin,UUID release){Map<String,Object> row=one("SELECT plugin_key FROM marketplace_releases WHERE id=?",release);if(!plugin.equals(row.get("plugin_key")))throw new IllegalArgumentException("Release does not belong to plugin");}
  private Optional<UUID> currentRelease(long owner,String plugin){List<Map<String,Object>> rows=jdbc.queryForList("SELECT release_id FROM marketplace_installations WHERE owner_id=? AND plugin_key=? AND status='APPLIED' ORDER BY created_at DESC,id DESC LIMIT 1",owner,plugin);return rows.isEmpty()?Optional.empty():Optional.of(UUID.fromString(rows.get(0).get("release_id").toString()));}
  @SuppressWarnings("unchecked") private Set<String> permissions(UUID id){Object value=one("SELECT permissions FROM marketplace_releases WHERE id=?",id).get("permissions");try{if(value instanceof Collection<?>)return new TreeSet<>(((Collection<?>)value).stream().map(Object::toString).toList());return new TreeSet<>((List<String>)json.readValue(value.toString(),List.class));}catch(Exception e){throw new IllegalStateException("Invalid permission metadata",e);}}
  static List<String> split(String value){if(value==null||value.isBlank())return List.of();return Arrays.stream(value.split(",")).map(String::trim).filter(s->!s.isEmpty()).sorted().toList();}
  String toJson(Object value){try{return json.writeValueAsString(value);}catch(Exception e){throw new IllegalStateException(e);}}
  static String sha256(String value){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));}catch(Exception e){throw new IllegalStateException(e);}}
}
