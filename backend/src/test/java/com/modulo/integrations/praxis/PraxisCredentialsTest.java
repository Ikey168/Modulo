package com.modulo.integrations.praxis;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.security.KeyPairGenerator;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class PraxisCredentialsTest {
  @TempDir Path dir;

  private PraxisProperties properties() {
    PraxisProperties properties = new PraxisProperties();
    properties.setTokenEnv("PRAXIS_MODULO_TOKEN");
    return properties;
  }

  @Test
  void tokenComesFromTheEnvironmentWhenNoFileIsMounted() {
    PraxisCredentials credentials = new PraxisCredentials(properties(), Map.of("PRAXIS_MODULO_TOKEN", " praxis_abcdefghijklmnop \n")::get);
    assertThat(credentials.token()).isEqualTo("praxis_abcdefghijklmnop");
  }

  @Test
  void missingOrUnsafeTokensFailAtStartup() {
    assertThatThrownBy(() -> new PraxisCredentials(properties(), name -> null)).hasMessageContaining("missing or malformed");
    assertThatThrownBy(() -> new PraxisCredentials(properties(), Map.of("PRAXIS_MODULO_TOKEN", "praxis_abc\r\nX-Evil: 1")::get))
        .hasMessageContaining("missing or malformed");
  }

  @Test
  void aRotatedTokenFileIsPickedUpWithoutARestart() throws Exception {
    Path file = dir.resolve("praxis-token");
    Files.writeString(file, "praxis_first-token-000000\n");
    PraxisProperties properties = properties();
    properties.setTokenFile(file.toString());
    PraxisCredentials credentials = new PraxisCredentials(properties, name -> "praxis_env-token-is-ignored");
    assertThat(credentials.token()).isEqualTo("praxis_first-token-000000");

    Files.writeString(file, "praxis_second-token-11111\n");
    Files.setLastModifiedTime(file, FileTime.from(Instant.now().plusSeconds(5)));
    assertThat(credentials.token()).isEqualTo("praxis_second-token-11111");

    Files.delete(file); // a secret being replaced keeps the last good token
    assertThat(credentials.token()).isEqualTo("praxis_second-token-11111");
  }

  @Test
  void acceptsPkcs8KeysAndExplainsHowToConvertOthers() throws Exception {
    for (String algorithm : new String[] {"RSA", "EC"}) {
      KeyPairGenerator generator = KeyPairGenerator.getInstance(algorithm);
      byte[] der = generator.generateKeyPair().getPrivate().getEncoded();
      String pem = "-----BEGIN PRIVATE KEY-----\n" + Base64.getMimeEncoder(64, "\n".getBytes()).encodeToString(der)
          + "\n-----END PRIVATE KEY-----\n";
      assertThat(PraxisCredentials.privateKey(pem).getAlgorithm()).isEqualTo(algorithm);
    }
    assertThatThrownBy(() -> PraxisCredentials.privateKey("-----BEGIN RSA PRIVATE KEY-----\nAAAA\n-----END RSA PRIVATE KEY-----"))
        .hasMessageContaining("openssl pkcs8 -topk8 -nocrypt");
  }

  @Test
  void httpsNeedsTheCaTheClientCertificateAndItsKey() {
    PraxisProperties properties = properties();
    properties.setBaseUrl("https://praxis.internal:8443");
    assertThatThrownBy(() -> PraxisCredentials.sslContext(properties)).hasMessageContaining("modulo.praxis.ca-file is required");
  }
}
