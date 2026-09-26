package com.modulo.integrations.praxis;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.SecureRandom;
import java.security.cert.Certificate;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.security.spec.PKCS8EncodedKeySpec;
import java.util.Base64;
import java.util.Collection;
import java.util.Map;
import java.util.function.Function;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.net.ssl.KeyManagerFactory;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManagerFactory;

/**
 * Mutual-TLS material and the bearer token for the Praxis host, read from files and the
 * environment mounted by the deployment. The internal CA is the only trust anchor: the
 * JVM's public roots are not consulted for the Praxis connection.
 */
final class PraxisCredentials {
  private static final Pattern PEM = Pattern.compile(
      "-----BEGIN ([A-Z ]+)-----\\s*([A-Za-z0-9+/=\\s]+?)\\s*-----END \\1-----");
  /** Visible ASCII only, so a token can never smuggle a header line. */
  private static final Pattern TOKEN = Pattern.compile("[\\x21-\\x7e]{16,512}");

  private final Path tokenFile;
  private final String tokenEnv;
  private final Function<String, String> environment;
  private String token;
  private FileTime tokenModified;

  PraxisCredentials(PraxisProperties properties, Function<String, String> environment) {
    this.tokenFile = properties.getTokenFile().isBlank() ? null : Path.of(properties.getTokenFile());
    this.tokenEnv = properties.getTokenEnv();
    this.environment = environment;
    token(); // fail at startup, not on the first user request
  }

  /**
   * The current token. A mounted token file is re-read when it changes, so the rotation
   * in Praxis' docs/host.md (both digests listed, switch the client, drop the old one)
   * needs no Modulo restart.
   */
  synchronized String token() {
    try {
      if (tokenFile != null) {
        FileTime modified = Files.getLastModifiedTime(tokenFile);
        if (token == null || !modified.equals(tokenModified)) {
          token = validToken(Files.readString(tokenFile, StandardCharsets.UTF_8), "modulo.praxis.token-file");
          tokenModified = modified;
        }
        return token;
      }
    } catch (IOException error) {
      if (token != null) return token; // keep the last good token while a secret is being replaced
      throw new IllegalStateException("modulo.praxis.token-file cannot be read", error);
    }
    if (token == null) {
      token = validToken(environment.apply(tokenEnv), "the " + tokenEnv + " environment variable");
    }
    return token;
  }

  private static String validToken(String raw, String source) {
    String value = raw == null ? "" : raw.strip();
    if (!TOKEN.matcher(value).matches()) {
      throw new IllegalStateException("Praxis token from " + source + " is missing or malformed");
    }
    return value;
  }

  /** TLS 1.2+ context presenting Modulo's client certificate and trusting only the internal CA. */
  static SSLContext sslContext(PraxisProperties properties) {
    try {
      Collection<? extends Certificate> anchors = certificates(read(properties.getCaFile(), "modulo.praxis.ca-file"));
      Collection<? extends Certificate> chain = certificates(read(properties.getClientCertFile(), "modulo.praxis.client-cert-file"));
      PrivateKey key = privateKey(read(properties.getClientKeyFile(), "modulo.praxis.client-key-file"));
      if (anchors.isEmpty() || chain.isEmpty()) throw new IllegalStateException("Praxis CA and client certificate must contain a certificate");

      KeyStore trust = KeyStore.getInstance("PKCS12");
      trust.load(null, null);
      int index = 0;
      for (Certificate anchor : anchors) trust.setCertificateEntry("praxis-ca-" + index++, anchor);
      TrustManagerFactory trustManagers = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
      trustManagers.init(trust);

      char[] password = new char[0];
      KeyStore identity = KeyStore.getInstance("PKCS12");
      identity.load(null, null);
      identity.setKeyEntry("modulo", key, password, chain.toArray(new Certificate[0]));
      KeyManagerFactory keyManagers = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm());
      keyManagers.init(identity, password);

      SSLContext context = SSLContext.getInstance("TLS");
      context.init(keyManagers.getKeyManagers(), trustManagers.getTrustManagers(), new SecureRandom());
      return context;
    } catch (GeneralSecurityException | IOException error) {
      throw new IllegalStateException("Praxis TLS material is invalid: " + error.getMessage(), error);
    }
  }

  private static String read(String file, String property) throws IOException {
    if (file == null || file.isBlank()) throw new IllegalStateException(property + " is required when modulo.praxis.enabled=true");
    return Files.readString(Path.of(file), StandardCharsets.US_ASCII);
  }

  private static Collection<? extends Certificate> certificates(String pem) throws GeneralSecurityException {
    Collection<? extends Certificate> certificates = CertificateFactory.getInstance("X.509")
        .generateCertificates(new ByteArrayInputStream(pem.getBytes(StandardCharsets.US_ASCII)));
    for (Certificate certificate : certificates) ((X509Certificate) certificate).checkValidity();
    return certificates;
  }

  static PrivateKey privateKey(String pem) throws GeneralSecurityException {
    Matcher block = PEM.matcher(pem);
    if (!block.find()) throw new IllegalStateException("Praxis client key is not PEM");
    String type = block.group(1);
    if (!"PRIVATE KEY".equals(type)) {
      // PKCS#1 ("RSA PRIVATE KEY"), SEC1 ("EC PRIVATE KEY") and encrypted keys need conversion first.
      throw new IllegalStateException("Praxis client key must be unencrypted PKCS#8 (BEGIN PRIVATE KEY); convert with "
          + "`openssl pkcs8 -topk8 -nocrypt -in modulo.key -out modulo.pk8.key`");
    }
    byte[] der = Base64.getMimeDecoder().decode(block.group(2));
    for (Map.Entry<String, String> algorithm : Map.of("RSA", "RSA", "EC", "EC", "Ed25519", "Ed25519").entrySet()) {
      try {
        return KeyFactory.getInstance(algorithm.getValue()).generatePrivate(new PKCS8EncodedKeySpec(der));
      } catch (GeneralSecurityException ignored) {
        // try the next key algorithm
      }
    }
    throw new IllegalStateException("Praxis client key algorithm is not supported (RSA, EC or Ed25519)");
  }
}
