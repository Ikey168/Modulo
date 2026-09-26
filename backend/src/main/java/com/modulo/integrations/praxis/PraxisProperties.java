package com.modulo.integrations.praxis;

import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Connection to a Praxis host (#525). Only file paths and the name of the token
 * variable live here: the client certificate, its key, the internal CA and the
 * bearer token are secrets mounted by the deployment, never configuration values.
 */
@ConfigurationProperties(prefix = "modulo.praxis")
public class PraxisProperties {
  /** Off unless a deployment points Modulo at a Praxis host. */
  private boolean enabled = false;
  /** Praxis origin, e.g. https://praxis.internal:8443. Must be https unless loopback. */
  private String baseUrl = "";
  /** PEM bundle of the internal CA that issued the Praxis server certificate. */
  private String caFile = "";
  /** PEM certificate (chain) Modulo presents; issued by the CA Praxis trusts via server.tls_client_ca. */
  private String clientCertFile = "";
  /** Unencrypted PKCS#8 PEM private key for the client certificate. */
  private String clientKeyFile = "";
  /** File holding the bearer token from `python -m praxis.host token --client modulo`. */
  private String tokenFile = "";
  /** Environment variable holding the token when no token file is mounted. */
  private String tokenEnv = "PRAXIS_MODULO_TOKEN";
  private Duration connectTimeout = Duration.ofSeconds(5);
  /** Non-streaming calls; the host answers 503 request_timeout after its own deadline (30s by default). */
  private Duration requestTimeout = Duration.ofSeconds(35);
  /** Longest a proxied event stream stays open before the UI reconnects with its cursor. */
  private Duration streamTimeout = Duration.ofMinutes(10);
  /**
   * Executor features as Praxis declares them (ExecutorFeatures), so the UI can grey
   * out controls an adapter does not support instead of letting them fail. Modulo's
   * client has no health role, so it cannot read these from the host.
   */
  private Map<String, List<String>> executorFeatures = new LinkedHashMap<>(Map.of(
      "fake", List.of("cancel"),
      "local", List.of("cancel", "signal", "suspend"),
      "codex", List.of("cancel", "streaming"),
      "claude", List.of(),
      "deepseek", List.of(),
      "remote", List.of("streaming")));

  public boolean isEnabled() { return enabled; }
  public void setEnabled(boolean enabled) { this.enabled = enabled; }
  public String getBaseUrl() { return baseUrl; }
  public void setBaseUrl(String baseUrl) { this.baseUrl = baseUrl; }
  public String getCaFile() { return caFile; }
  public void setCaFile(String caFile) { this.caFile = caFile; }
  public String getClientCertFile() { return clientCertFile; }
  public void setClientCertFile(String clientCertFile) { this.clientCertFile = clientCertFile; }
  public String getClientKeyFile() { return clientKeyFile; }
  public void setClientKeyFile(String clientKeyFile) { this.clientKeyFile = clientKeyFile; }
  public String getTokenFile() { return tokenFile; }
  public void setTokenFile(String tokenFile) { this.tokenFile = tokenFile; }
  public String getTokenEnv() { return tokenEnv; }
  public void setTokenEnv(String tokenEnv) { this.tokenEnv = tokenEnv; }
  public Duration getConnectTimeout() { return connectTimeout; }
  public void setConnectTimeout(Duration connectTimeout) { this.connectTimeout = connectTimeout; }
  public Duration getRequestTimeout() { return requestTimeout; }
  public void setRequestTimeout(Duration requestTimeout) { this.requestTimeout = requestTimeout; }
  public Duration getStreamTimeout() { return streamTimeout; }
  public void setStreamTimeout(Duration streamTimeout) { this.streamTimeout = streamTimeout; }
  public Map<String, List<String>> getExecutorFeatures() { return executorFeatures; }
  public void setExecutorFeatures(Map<String, List<String>> executorFeatures) { this.executorFeatures = executorFeatures; }
}
