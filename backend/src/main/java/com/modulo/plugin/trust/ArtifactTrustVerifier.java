package com.modulo.plugin.trust;

import java.util.Map;

/** Verifies OCI evidence without mutating the artifact. */
public interface ArtifactTrustVerifier {
  record Evidence(String type, String status, String source, String summary, Map<String,Object> payload) {}
  Evidence signature(String image, String digest, String signingIdentity);
  Evidence provenance(String image, String digest, String signingIdentity);
  default Evidence signature(String image, String digest) { return signature(image, digest, null); }
  default Evidence provenance(String image, String digest) { return provenance(image, digest, null); }
  Evidence sbom(String image, String digest);
  default Evidence sbom(String image,String digest,String signingIdentity){return sbom(image,digest);}
  Evidence vulnerabilities(String image, String digest);
}
