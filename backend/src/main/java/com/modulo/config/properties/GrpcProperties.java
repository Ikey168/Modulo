package com.modulo.config.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Pattern;

/**
 * GRPC configuration properties with validation
 */
@ConfigurationProperties(prefix = "grpc")
@Validated
public class GrpcProperties {

    @NotNull(message = "Server configuration is required")
    private Server server = new Server();

    @NotNull(message = "Client configuration is required")
    private Client client = new Client();

    @NotNull(message = "Security configuration is required")
    private Security security = new Security();

    public static class Server {
        @Min(value = 1024, message = "GRPC server port must be at least 1024")
        @Max(value = 65535, message = "GRPC server port must be at most 65535")
        private Integer port = 9090;

        @Pattern(regexp = "^(0\\.0\\.0\\.0|127\\.0\\.0\\.1|localhost|[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+)$", 
                 message = "Address must be a valid IP address or localhost")
        private String address = "0.0.0.0";

        @Min(value = 1, message = "Max inbound message size must be at least 1 byte")
        @Max(value = 67108864, message = "Max inbound message size must be at most 64MB")
        private Integer maxInboundMessageSize = 4194304; // 4MB

        @Min(value = 1, message = "Max inbound metadata size must be at least 1 byte")
        @Max(value = 8192, message = "Max inbound metadata size must be at most 8KB")
        private Integer maxInboundMetadataSize = 8192; // 8KB

        @Min(value = 1, message = "Max connection idle timeout must be at least 1 second")
        @Max(value = 3600, message = "Max connection idle timeout must be at most 1 hour")
        private Integer maxConnectionIdleTimeoutSeconds = 300; // 5 minutes

        @Min(value = 1, message = "Max connection age must be at least 1 second")
        @Max(value = 86400, message = "Max connection age must be at most 24 hours")
        private Integer maxConnectionAgeSeconds = 7200; // 2 hours

        @Min(value = 1, message = "Max connection age grace must be at least 1 second")
        @Max(value = 300, message = "Max connection age grace must be at most 5 minutes")
        private Integer maxConnectionAgeGraceSeconds = 30;

        @Min(value = 1, message = "Keep alive time must be at least 1 second")
        @Max(value = 300, message = "Keep alive time must be at most 5 minutes")
        private Integer keepAliveTimeSeconds = 60;

        @Min(value = 1, message = "Keep alive timeout must be at least 1 second")
        @Max(value = 60, message = "Keep alive timeout must be at most 1 minute")
        private Integer keepAliveTimeoutSeconds = 5;

        private boolean keepAliveWithoutCalls = false;
        private boolean enableReflection = false;

        // Getters and setters
        public Integer getPort() {
            return port;
        }

        public void setPort(Integer port) {
            this.port = port;
        }

        public String getAddress() {
            return address;
        }

        public void setAddress(String address) {
            this.address = address;
        }

        public Integer getMaxInboundMessageSize() {
            return maxInboundMessageSize;
        }

        public void setMaxInboundMessageSize(Integer maxInboundMessageSize) {
            this.maxInboundMessageSize = maxInboundMessageSize;
        }

        public Integer getMaxInboundMetadataSize() {
            return maxInboundMetadataSize;
        }

        public void setMaxInboundMetadataSize(Integer maxInboundMetadataSize) {
            this.maxInboundMetadataSize = maxInboundMetadataSize;
        }

        public Integer getMaxConnectionIdleTimeoutSeconds() {
            return maxConnectionIdleTimeoutSeconds;
        }

        public void setMaxConnectionIdleTimeoutSeconds(Integer maxConnectionIdleTimeoutSeconds) {
            this.maxConnectionIdleTimeoutSeconds = maxConnectionIdleTimeoutSeconds;
        }

        public Integer getMaxConnectionAgeSeconds() {
            return maxConnectionAgeSeconds;
        }

        public void setMaxConnectionAgeSeconds(Integer maxConnectionAgeSeconds) {
            this.maxConnectionAgeSeconds = maxConnectionAgeSeconds;
        }

        public Integer getMaxConnectionAgeGraceSeconds() {
            return maxConnectionAgeGraceSeconds;
        }

        public void setMaxConnectionAgeGraceSeconds(Integer maxConnectionAgeGraceSeconds) {
            this.maxConnectionAgeGraceSeconds = maxConnectionAgeGraceSeconds;
        }

        public Integer getKeepAliveTimeSeconds() {
            return keepAliveTimeSeconds;
        }

        public void setKeepAliveTimeSeconds(Integer keepAliveTimeSeconds) {
            this.keepAliveTimeSeconds = keepAliveTimeSeconds;
        }

        public Integer getKeepAliveTimeoutSeconds() {
            return keepAliveTimeoutSeconds;
        }

        public void setKeepAliveTimeoutSeconds(Integer keepAliveTimeoutSeconds) {
            this.keepAliveTimeoutSeconds = keepAliveTimeoutSeconds;
        }

        public boolean isKeepAliveWithoutCalls() {
            return keepAliveWithoutCalls;
        }

        public void setKeepAliveWithoutCalls(boolean keepAliveWithoutCalls) {
            this.keepAliveWithoutCalls = keepAliveWithoutCalls;
        }

        public boolean isEnableReflection() {
            return enableReflection;
        }

        public void setEnableReflection(boolean enableReflection) {
            this.enableReflection = enableReflection;
        }

        @Override
        public String toString() {
            return "Server{" +
                    "port=" + port +
                    ", address='" + address + '\'' +
                    ", maxInboundMessageSize=" + maxInboundMessageSize +
                    ", maxInboundMetadataSize=" + maxInboundMetadataSize +
                    ", maxConnectionIdleTimeoutSeconds=" + maxConnectionIdleTimeoutSeconds +
                    ", maxConnectionAgeSeconds=" + maxConnectionAgeSeconds +
                    ", maxConnectionAgeGraceSeconds=" + maxConnectionAgeGraceSeconds +
                    ", keepAliveTimeSeconds=" + keepAliveTimeSeconds +
                    ", keepAliveTimeoutSeconds=" + keepAliveTimeoutSeconds +
                    ", keepAliveWithoutCalls=" + keepAliveWithoutCalls +
                    ", enableReflection=" + enableReflection +
                    '}';
        }
    }

    public static class Client {
        @NotBlank(message = "Client target is required")
        @Pattern(regexp = "^[a-zA-Z0-9.-]+:[0-9]+$", message = "Target must be in format host:port")
        private String target = "localhost:9090";

        @Min(value = 1, message = "Max inbound message size must be at least 1 byte")
        @Max(value = 67108864, message = "Max inbound message size must be at most 64MB")
        private Integer maxInboundMessageSize = 4194304; // 4MB

        @Min(value = 1, message = "Max inbound metadata size must be at least 1 byte")
        @Max(value = 8192, message = "Max inbound metadata size must be at most 8KB")
        private Integer maxInboundMetadataSize = 8192; // 8KB

        @Min(value = 1, message = "Keep alive time must be at least 1 second")
        @Max(value = 300, message = "Keep alive time must be at most 5 minutes")
        private Integer keepAliveTimeSeconds = 30;

        @Min(value = 1, message = "Keep alive timeout must be at least 1 second")
        @Max(value = 60, message = "Keep alive timeout must be at most 1 minute")
        private Integer keepAliveTimeoutSeconds = 5;

        private boolean keepAliveWithoutCalls = true;

        @Min(value = 1, message = "Deadline must be at least 1 second")
        @Max(value = 300, message = "Deadline must be at most 5 minutes")
        private Integer deadlineSeconds = 30;

        @Min(value = 1, message = "Max retry attempts must be at least 1")
        @Max(value = 5, message = "Max retry attempts must be at most 5")
        private Integer maxRetryAttempts = 3;

        @Min(value = 100, message = "Initial retry delay must be at least 100ms")
        @Max(value = 5000, message = "Initial retry delay must be at most 5 seconds")
        private Integer initialRetryDelayMs = 1000;

        @Min(value = 1000, message = "Max retry delay must be at least 1 second")
        @Max(value = 30000, message = "Max retry delay must be at most 30 seconds")
        private Integer maxRetryDelayMs = 10000;

        @Min(value = 1, message = "Retry delay multiplier must be at least 1.1")
        @Max(value = 3, message = "Retry delay multiplier must be at most 3.0")
        private Double retryDelayMultiplier = 2.0;

        // Getters and setters
        public String getTarget() {
            return target;
        }

        public void setTarget(String target) {
            this.target = target;
        }

        public Integer getMaxInboundMessageSize() {
            return maxInboundMessageSize;
        }

        public void setMaxInboundMessageSize(Integer maxInboundMessageSize) {
            this.maxInboundMessageSize = maxInboundMessageSize;
        }

        public Integer getMaxInboundMetadataSize() {
            return maxInboundMetadataSize;
        }

        public void setMaxInboundMetadataSize(Integer maxInboundMetadataSize) {
            this.maxInboundMetadataSize = maxInboundMetadataSize;
        }

        public Integer getKeepAliveTimeSeconds() {
            return keepAliveTimeSeconds;
        }

        public void setKeepAliveTimeSeconds(Integer keepAliveTimeSeconds) {
            this.keepAliveTimeSeconds = keepAliveTimeSeconds;
        }

        public Integer getKeepAliveTimeoutSeconds() {
            return keepAliveTimeoutSeconds;
        }

        public void setKeepAliveTimeoutSeconds(Integer keepAliveTimeoutSeconds) {
            this.keepAliveTimeoutSeconds = keepAliveTimeoutSeconds;
        }

        public boolean isKeepAliveWithoutCalls() {
            return keepAliveWithoutCalls;
        }

        public void setKeepAliveWithoutCalls(boolean keepAliveWithoutCalls) {
            this.keepAliveWithoutCalls = keepAliveWithoutCalls;
        }

        public Integer getDeadlineSeconds() {
            return deadlineSeconds;
        }

        public void setDeadlineSeconds(Integer deadlineSeconds) {
            this.deadlineSeconds = deadlineSeconds;
        }

        public Integer getMaxRetryAttempts() {
            return maxRetryAttempts;
        }

        public void setMaxRetryAttempts(Integer maxRetryAttempts) {
            this.maxRetryAttempts = maxRetryAttempts;
        }

        public Integer getInitialRetryDelayMs() {
            return initialRetryDelayMs;
        }

        public void setInitialRetryDelayMs(Integer initialRetryDelayMs) {
            this.initialRetryDelayMs = initialRetryDelayMs;
        }

        public Integer getMaxRetryDelayMs() {
            return maxRetryDelayMs;
        }

        public void setMaxRetryDelayMs(Integer maxRetryDelayMs) {
            this.maxRetryDelayMs = maxRetryDelayMs;
        }

        public Double getRetryDelayMultiplier() {
            return retryDelayMultiplier;
        }

        public void setRetryDelayMultiplier(Double retryDelayMultiplier) {
            this.retryDelayMultiplier = retryDelayMultiplier;
        }

        @Override
        public String toString() {
            return "Client{" +
                    "target='" + target + '\'' +
                    ", maxInboundMessageSize=" + maxInboundMessageSize +
                    ", maxInboundMetadataSize=" + maxInboundMetadataSize +
                    ", keepAliveTimeSeconds=" + keepAliveTimeSeconds +
                    ", keepAliveTimeoutSeconds=" + keepAliveTimeoutSeconds +
                    ", keepAliveWithoutCalls=" + keepAliveWithoutCalls +
                    ", deadlineSeconds=" + deadlineSeconds +
                    ", maxRetryAttempts=" + maxRetryAttempts +
                    ", initialRetryDelayMs=" + initialRetryDelayMs +
                    ", maxRetryDelayMs=" + maxRetryDelayMs +
                    ", retryDelayMultiplier=" + retryDelayMultiplier +
                    '}';
        }
    }

    public static class Security {
        private boolean enableTls = false;

        private String certChainFilePath;
        private String privateKeyFilePath;
        private String trustCertCollectionFilePath;

        @Pattern(regexp = "^(NONE|OPTIONAL|REQUIRE)$", 
                 message = "Client auth must be one of: NONE, OPTIONAL, REQUIRE")
        private String clientAuth = "NONE";

        @Pattern(regexp = "^(TLS|PLAINTEXT_UPGRADE|PLAINTEXT)$", 
                 message = "Negotiation type must be one of: TLS, PLAINTEXT_UPGRADE, PLAINTEXT")
        private String negotiationType = "PLAINTEXT";

        private String[] cipherSuites = {
            "TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384",
            "TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384",
            "TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256",
            "TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256"
        };

        private String[] protocols = {"TLSv1.3", "TLSv1.2"};

        // Getters and setters
        public boolean isEnableTls() {
            return enableTls;
        }

        public void setEnableTls(boolean enableTls) {
            this.enableTls = enableTls;
        }

        public String getCertChainFilePath() {
            return certChainFilePath;
        }

        public void setCertChainFilePath(String certChainFilePath) {
            this.certChainFilePath = certChainFilePath;
        }

        public String getPrivateKeyFilePath() {
            return privateKeyFilePath;
        }

        public void setPrivateKeyFilePath(String privateKeyFilePath) {
            this.privateKeyFilePath = privateKeyFilePath;
        }

        public String getTrustCertCollectionFilePath() {
            return trustCertCollectionFilePath;
        }

        public void setTrustCertCollectionFilePath(String trustCertCollectionFilePath) {
            this.trustCertCollectionFilePath = trustCertCollectionFilePath;
        }

        public String getClientAuth() {
            return clientAuth;
        }

        public void setClientAuth(String clientAuth) {
            this.clientAuth = clientAuth;
        }

        public String getNegotiationType() {
            return negotiationType;
        }

        public void setNegotiationType(String negotiationType) {
            this.negotiationType = negotiationType;
        }

        public String[] getCipherSuites() {
            return cipherSuites;
        }

        public void setCipherSuites(String[] cipherSuites) {
            this.cipherSuites = cipherSuites;
        }

        public String[] getProtocols() {
            return protocols;
        }

        public void setProtocols(String[] protocols) {
            this.protocols = protocols;
        }

        @Override
        public String toString() {
            return "Security{" +
                    "enableTls=" + enableTls +
                    ", certChainFilePath='" + certChainFilePath + '\'' +
                    ", privateKeyFilePath='" + privateKeyFilePath + '\'' +
                    ", trustCertCollectionFilePath='" + trustCertCollectionFilePath + '\'' +
                    ", clientAuth='" + clientAuth + '\'' +
                    ", negotiationType='" + negotiationType + '\'' +
                    ", cipherSuites=" + java.util.Arrays.toString(cipherSuites) +
                    ", protocols=" + java.util.Arrays.toString(protocols) +
                    '}';
        }
    }

    // Main class getters and setters
    public Server getServer() {
        return server;
    }

    public void setServer(Server server) {
        this.server = server;
    }

    public Client getClient() {
        return client;
    }

    public void setClient(Client client) {
        this.client = client;
    }

    public Security getSecurity() {
        return security;
    }

    public void setSecurity(Security security) {
        this.security = security;
    }

    @Override
    public String toString() {
        return "GrpcProperties{" +
                "server=" + server +
                ", client=" + client +
                ", security=" + security +
                '}';
    }
}
