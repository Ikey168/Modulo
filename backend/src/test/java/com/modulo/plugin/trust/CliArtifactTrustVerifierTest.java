package com.modulo.plugin.trust;

import static org.assertj.core.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;
import org.junit.jupiter.api.Test;

class CliArtifactTrustVerifierTest {
  @Test void contradictoryDigestIsRejectedBeforeInvokingVerifier(){
    String digest="sha256:"+"a".repeat(64);
    assertThatThrownBy(()->CliArtifactTrustVerifier.pinned("ghcr.io/a/p@sha256:"+"b".repeat(64),digest)).isInstanceOf(IllegalArgumentException.class);
    assertThat(CliArtifactTrustVerifier.pinned("ghcr.io/a/p@"+digest,digest)).isEqualTo("ghcr.io/a/p@"+digest);
    assertThatThrownBy(()->CliArtifactTrustVerifier.pinned("--help",digest)).isInstanceOf(IllegalArgumentException.class);
  }
  @Test void successfulProcessWithoutStructuredEvidenceIsNotVerification(){
    for(String type:List.of("SIGNATURE","PROVENANCE","SBOM","VULNERABILITY")){
      assertThat(CliArtifactTrustVerifier.validPayload(type,Map.of())).isFalse();
      assertThat(CliArtifactTrustVerifier.validPayload(type,Map.of("output","success"))).isFalse();
      assertThat(CliArtifactTrustVerifier.validPayload(type,Map.of("result",List.of(Map.of())))).isFalse();
    }
    assertThat(CliArtifactTrustVerifier.validPayload("VULNERABILITY",Map.of("matches",List.of(),"source",Map.of("type","image")))).isTrue();
    assertThat(CliArtifactTrustVerifier.validPayload("SBOM",Map.of("spdxVersion","SPDX-2.3","packages",List.of()))).isTrue();
  }
  @Test void requiresExactDigestPin(){assertThatThrownBy(()->CliArtifactTrustVerifier.pinned("ghcr.io/a/p","latest")).isInstanceOf(IllegalArgumentException.class);assertThat(CliArtifactTrustVerifier.pinned("ghcr.io/a/p","sha256:"+"a".repeat(64))).contains("@sha256:");}
  @Test void criticalScannerMatchesFailPolicy(){Map<String,Object> payload=Map.of("matches",java.util.List.of(Map.of("vulnerability",Map.of("severity","Critical"))));assertThat(CliArtifactTrustVerifier.criticalCount(payload)).isEqualTo(1);}
  @Test void missingEvidenceCannotBeCalledVerified(){assertThat(MarketplaceTrustService.trustStatus(java.util.List.of(),Map.of())).isEqualTo("UNKNOWN");}
  @Test void publisherIdentityAndTrustRootAreAppliedToExactDigest() {
    class Recording extends CliArtifactTrustVerifier {
      List<String> command;
      Recording(String issuer){super(new ObjectMapper(),".*",issuer);}
      @Override Evidence run(String type,List<String> value){command=value;return new Evidence(type,"VERIFIED","fixture","ok",Map.of());}
    }
    String digest="sha256:"+"a".repeat(64), identity="https://github.com/acme/plugin/.github/workflows/release.yml@refs/heads/main";
    Recording first=new Recording("https://issuer.one");
    ArtifactTrustVerifier.Evidence oldEvidence=first.signature("ghcr.io/acme/plugin",digest,identity);
    assertThat(first.command).contains("--certificate-identity",identity,"--certificate-oidc-issuer","https://issuer.one","ghcr.io/acme/plugin@"+digest);
    Recording rotated=new Recording("https://issuer.two");
    ArtifactTrustVerifier.Evidence newEvidence=rotated.signature("ghcr.io/acme/plugin",digest,identity);
    assertThat(newEvidence.payload()).isNotEqualTo(oldEvidence.payload());
    assertThat(rotated.command).contains("https://issuer.two");
    rotated.sbom("ghcr.io/acme/plugin",digest,identity);
    assertThat(rotated.command).contains("verify-attestation","--type","spdxjson","--certificate-identity",identity);
    assertThat(rotated.command).doesNotContain("download");
  }
  @Test void signedSbomPayloadMustContainAnActualSpdxDocument(){
    String valid=Base64.getEncoder().encodeToString("{\"subject\":[{\"name\":\"image\"}],\"predicate\":{\"spdxVersion\":\"SPDX-2.3\",\"packages\":[]}}".getBytes(java.nio.charset.StandardCharsets.UTF_8));
    assertThat(CliArtifactTrustVerifier.validPayload("SBOM",Map.of("result",List.of(Map.of("payload",valid))))).isTrue();
    assertThat(CliArtifactTrustVerifier.validPayload("SBOM",Map.of("result",List.of(Map.of("payload","invalid base64"))))).isFalse();
  }
}
