package com.modulo.plugin.trust;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.TimeUnit;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Uses standard Sigstore/SBOM scanners when available. Missing tools are reported as UNAVAILABLE, never as success. */
@Component
public class CliArtifactTrustVerifier implements ArtifactTrustVerifier {
  private final ObjectMapper json;
  private final String identityRegexp;
  private final String issuer;
  public CliArtifactTrustVerifier(ObjectMapper json,
      @Value("${modulo.marketplace.trust.identity-regexp:.*}") String identityRegexp,
      @Value("${modulo.marketplace.trust.oidc-issuer:https://token.actions.githubusercontent.com}") String issuer) {
    this.json=json; this.identityRegexp=identityRegexp; this.issuer=issuer;
  }
  @Override public Evidence signature(String image,String digest,String signingIdentity){return withPolicy(run("SIGNATURE",cosign("verify",null,image,digest,signingIdentity)),signingIdentity);}
  @Override public Evidence provenance(String image,String digest,String signingIdentity){return withPolicy(run("PROVENANCE",cosign("verify-attestation","slsaprovenance",image,digest,signingIdentity)),signingIdentity);}
  @Override public Evidence sbom(String image,String digest){return sbom(image,digest,null);}
  @Override public Evidence sbom(String image,String digest,String signingIdentity){return withPolicy(run("SBOM",cosign("verify-attestation","spdxjson",image,digest,signingIdentity)),signingIdentity);}
  @Override public Evidence vulnerabilities(String image,String digest){return run("VULNERABILITY",List.of("grype",pinned(image,digest),"-o","json"));}
  static String pinned(String image,String digest){
    if(image==null||image.isBlank()||image.startsWith("-")||image.chars().anyMatch(Character::isWhitespace)
        ||digest==null||!digest.matches("sha256:[0-9a-f]{64}"))throw new IllegalArgumentException("Digest-pinned image required");
    int separator=image.indexOf('@');
    if(separator>=0){
      if(separator==0||!image.substring(separator+1).equals(digest))throw new IllegalArgumentException("Image reference differs from the approved digest");
      return image;
    }
    return image+"@"+digest;
  }
  Evidence run(String type,List<String> command){
    try{
      Process process=new ProcessBuilder(command).redirectError(ProcessBuilder.Redirect.DISCARD).start();
      ByteArrayOutputStream out=new ByteArrayOutputStream();
      var input=process.getInputStream();
      Thread reader=new Thread(()->{try(input){out.write(input.readNBytes(8*1024*1024+1));}catch(Exception ignored){}});reader.setDaemon(true);reader.start();
      if(!process.waitFor(Duration.ofSeconds(20).toMillis(),TimeUnit.MILLISECONDS)){process.destroyForcibly();return new Evidence(type,"FAILED",command.get(0),"verification timed out",Map.of());}
      reader.join(1000);String text=out.toString(StandardCharsets.UTF_8);Map<String,Object> payload=parse(text);
      if(reader.isAlive()||out.size()>8*1024*1024)return new Evidence(type,"FAILED",command.get(0),"Verification evidence exceeds the output limit",Map.of());
      if(process.exitValue()!=0)return new Evidence(type,"FAILED",command.get(0),compact(text),payload);
      if(!validPayload(type,payload))return new Evidence(type,"FAILED",command.get(0),"Malformed or missing verification evidence",payload);
      if("VULNERABILITY".equals(type)&&criticalCount(payload)>0)return new Evidence(type,"FAILED",command.get(0),"critical vulnerabilities detected",payload);
      return new Evidence(type,"VERIFIED",command.get(0),"verified",payload);
    }catch(java.io.IOException unavailable){return new Evidence(type,"UNAVAILABLE",command.get(0),command.get(0)+" is not installed",Map.of());}
    catch(Exception failure){return new Evidence(type,"FAILED",command.get(0),compact(failure.getMessage()),Map.of());}
  }
  static boolean validPayload(String type,Map<String,Object> payload){
    if("VULNERABILITY".equals(type))return payload.get("matches") instanceof List<?> && payload.get("source") instanceof Map<?,?>;
    if("SBOM".equals(type)){
      if((payload.get("spdxVersion") instanceof String && payload.get("packages") instanceof List<?>)
        || ("CycloneDX".equals(payload.get("bomFormat")) && payload.get("components") instanceof List<?>))return true;
      if(payload.get("result") instanceof List<?> list)for(Object item:list)if(item instanceof Map<?,?> envelope && envelope.get("payload") instanceof String encoded){
        try{var statement=new ObjectMapper().readTree(Base64.getDecoder().decode(encoded));var predicate=statement.path("predicate");if(predicate.path("spdxVersion").isTextual()&&predicate.path("packages").isArray()&&statement.path("subject").isArray())return true;}catch(Exception invalid){return false;}
      }
      return false;
    }
    if("SIGNATURE".equals(type))return payload.get("result") instanceof List<?> list && !list.isEmpty()
        && list.stream().allMatch(item->item instanceof Map<?,?> map && map.get("critical") instanceof Map<?,?> critical && critical.get("image") instanceof Map<?,?> image && image.get("docker-manifest-digest") instanceof String);
    if("PROVENANCE".equals(type)&&payload.get("result") instanceof List<?> list){
      for(Object item:list)if(item instanceof Map<?,?> envelope&&envelope.get("payload") instanceof String encoded){
        try{var statement=new ObjectMapper().readTree(Base64.getDecoder().decode(encoded));if(statement.path("predicateType").asText().startsWith("https://slsa.dev/provenance/")&&statement.path("predicate").isObject()&&statement.path("subject").isArray()&&!statement.path("subject").isEmpty())return true;}catch(Exception invalid){return false;}
      }
    }
    return false;
  }
  private List<String> cosign(String operation,String type,String image,String digest,String signingIdentity){List<String> command=new ArrayList<>(List.of("cosign",operation));if(type!=null){command.add("--type");command.add(type);}if(signingIdentity!=null&&!signingIdentity.isBlank()){command.add("--certificate-identity");command.add(signingIdentity);}else{command.add("--certificate-identity-regexp");command.add(identityRegexp);}command.add("--certificate-oidc-issuer");command.add(issuer);command.add(pinned(image,digest));return command;}
  private Evidence withPolicy(Evidence evidence,String signingIdentity){Map<String,Object> payload=new LinkedHashMap<>(evidence.payload());Map<String,Object> policy=new LinkedHashMap<>();policy.put("oidcIssuer",issuer);if(signingIdentity!=null&&!signingIdentity.isBlank())policy.put("signingIdentity",signingIdentity);else policy.put("identityRegexp",identityRegexp);payload.put("verificationPolicy",policy);return new Evidence(evidence.type(),evidence.status(),evidence.source(),evidence.summary(),payload);}
  @SuppressWarnings("unchecked") private Map<String,Object> parse(String text){try{
    var values=json.readerFor(Object.class).readValues(text).readAll();
    if(values.size()!=1)return Map.of("result",values);
    Object value=values.get(0);
    if(value instanceof Map<?,?> map)return map.containsKey("payload")?Map.of("result",List.of(value)):(Map<String,Object>)value;
    return Map.of("result",value);
  }catch(Exception ignored){return text.isBlank()?Map.of():Map.of("output",compact(text));}}
  @SuppressWarnings("unchecked") static int criticalCount(Map<String,Object> payload){Object matches=payload.get("matches");if(!(matches instanceof List))return 0;int total=0;for(Object item:(List<?>)matches)if(item instanceof Map){Object vuln=((Map<String,Object>)item).get("vulnerability");if(vuln instanceof Map&&"Critical".equalsIgnoreCase(Objects.toString(((Map<?,?>)vuln).get("severity"),"")))total++;}return total;}
  static String compact(String value){if(value==null||value.isBlank())return "verification failed";String normalized=value.replaceAll("\\s+"," ").trim();return normalized.substring(0,Math.min(normalized.length(),1000));}
}
