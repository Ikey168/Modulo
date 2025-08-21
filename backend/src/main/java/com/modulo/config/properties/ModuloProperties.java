package com.modulo.config.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Pattern;

/**
 * Application-specific configuration properties with validation
 */
@ConfigurationProperties(prefix = "modulo")
@Validated
public class ModuloProperties {

    @NotNull(message = "Security configuration is required")
    private Security security = new Security();

    @NotNull(message = "Feature flags configuration is required")
    private Features features = new Features();

    @NotNull(message = "Performance configuration is required")
    private Performance performance = new Performance();

    @NotNull(message = "Integration configuration is required")
    private Integrations integrations = new Integrations();

    public static class Security {
        @NotBlank(message = "JWT secret is required")
        @Pattern(regexp = "^[A-Za-z0-9+/=]{32,}$", message = "JWT secret must be a valid base64 string with minimum 32 characters")
        private String jwtSecret;

        @Min(value = 300, message = "JWT expiration must be at least 5 minutes (300 seconds)")
        @Max(value = 86400, message = "JWT expiration must be at most 24 hours (86400 seconds)")
        private Integer jwtExpirationSeconds = 3600;

        @NotBlank(message = "API key is required")
        @Pattern(regexp = "^mod_[a-zA-Z0-9]{16,}$", message = "API key must start with 'mod_' followed by at least 16 alphanumeric characters")
        private String apiKey;

        @NotBlank(message = "Encryption key is required")
        private String encryptionKey;

        private boolean enableCsrf = true;
        private boolean enableCors = true;

        @Min(value = 1, message = "Max login attempts must be at least 1")
        @Max(value = 10, message = "Max login attempts must be at most 10")
        private Integer maxLoginAttempts = 3;

        @Min(value = 60, message = "Account lockout duration must be at least 1 minute (60 seconds)")
        private Integer accountLockoutDurationSeconds = 900;

        // Getters and setters
        public String getJwtSecret() {
            return jwtSecret;
        }

        public void setJwtSecret(String jwtSecret) {
            this.jwtSecret = jwtSecret;
        }

        public Integer getJwtExpirationSeconds() {
            return jwtExpirationSeconds;
        }

        public void setJwtExpirationSeconds(Integer jwtExpirationSeconds) {
            this.jwtExpirationSeconds = jwtExpirationSeconds;
        }

        public String getApiKey() {
            return apiKey;
        }

        public void setApiKey(String apiKey) {
            this.apiKey = apiKey;
        }

        public String getEncryptionKey() {
            return encryptionKey;
        }

        public void setEncryptionKey(String encryptionKey) {
            this.encryptionKey = encryptionKey;
        }

        public boolean isEnableCsrf() {
            return enableCsrf;
        }

        public void setEnableCsrf(boolean enableCsrf) {
            this.enableCsrf = enableCsrf;
        }

        public boolean isEnableCors() {
            return enableCors;
        }

        public void setEnableCors(boolean enableCors) {
            this.enableCors = enableCors;
        }

        public Integer getMaxLoginAttempts() {
            return maxLoginAttempts;
        }

        public void setMaxLoginAttempts(Integer maxLoginAttempts) {
            this.maxLoginAttempts = maxLoginAttempts;
        }

        public Integer getAccountLockoutDurationSeconds() {
            return accountLockoutDurationSeconds;
        }

        public void setAccountLockoutDurationSeconds(Integer accountLockoutDurationSeconds) {
            this.accountLockoutDurationSeconds = accountLockoutDurationSeconds;
        }

        @Override
        public String toString() {
            return "Security{" +
                    "jwtSecret='***'" +
                    ", jwtExpirationSeconds=" + jwtExpirationSeconds +
                    ", apiKey='***'" +
                    ", encryptionKey='***'" +
                    ", enableCsrf=" + enableCsrf +
                    ", enableCors=" + enableCors +
                    ", maxLoginAttempts=" + maxLoginAttempts +
                    ", accountLockoutDurationSeconds=" + accountLockoutDurationSeconds +
                    '}';
        }
    }

    public static class Features {
        private boolean enableBlockchain = true;
        private boolean enableWebsockets = true;
        private boolean enableGrpc = true;
        private boolean enableOfflineMode = true;
        private boolean enablePluginSystem = true;
        private boolean enableFileUpload = true;
        private boolean enableSearch = true;
        private boolean enableNotifications = true;

        // Getters and setters
        public boolean isEnableBlockchain() {
            return enableBlockchain;
        }

        public void setEnableBlockchain(boolean enableBlockchain) {
            this.enableBlockchain = enableBlockchain;
        }

        public boolean isEnableWebsockets() {
            return enableWebsockets;
        }

        public void setEnableWebsockets(boolean enableWebsockets) {
            this.enableWebsockets = enableWebsockets;
        }

        public boolean isEnableGrpc() {
            return enableGrpc;
        }

        public void setEnableGrpc(boolean enableGrpc) {
            this.enableGrpc = enableGrpc;
        }

        public boolean isEnableOfflineMode() {
            return enableOfflineMode;
        }

        public void setEnableOfflineMode(boolean enableOfflineMode) {
            this.enableOfflineMode = enableOfflineMode;
        }

        public boolean isEnablePluginSystem() {
            return enablePluginSystem;
        }

        public void setEnablePluginSystem(boolean enablePluginSystem) {
            this.enablePluginSystem = enablePluginSystem;
        }

        public boolean isEnableFileUpload() {
            return enableFileUpload;
        }

        public void setEnableFileUpload(boolean enableFileUpload) {
            this.enableFileUpload = enableFileUpload;
        }

        public boolean isEnableSearch() {
            return enableSearch;
        }

        public void setEnableSearch(boolean enableSearch) {
            this.enableSearch = enableSearch;
        }

        public boolean isEnableNotifications() {
            return enableNotifications;
        }

        public void setEnableNotifications(boolean enableNotifications) {
            this.enableNotifications = enableNotifications;
        }

        @Override
        public String toString() {
            return "Features{" +
                    "enableBlockchain=" + enableBlockchain +
                    ", enableWebsockets=" + enableWebsockets +
                    ", enableGrpc=" + enableGrpc +
                    ", enableOfflineMode=" + enableOfflineMode +
                    ", enablePluginSystem=" + enablePluginSystem +
                    ", enableFileUpload=" + enableFileUpload +
                    ", enableSearch=" + enableSearch +
                    ", enableNotifications=" + enableNotifications +
                    '}';
        }
    }

    public static class Performance {
        @Min(value = 1, message = "Max file size must be at least 1MB")
        @Max(value = 100, message = "Max file size must be at most 100MB")
        private Integer maxFileSizeMb = 10;

        @Min(value = 1, message = "Thread pool size must be at least 1")
        @Max(value = 100, message = "Thread pool size must be at most 100")
        private Integer threadPoolSize = 10;

        @Min(value = 1000, message = "Request timeout must be at least 1 second")
        @Max(value = 300000, message = "Request timeout must be at most 5 minutes")
        private Integer requestTimeoutMs = 30000;

        @Min(value = 100, message = "Cache size must be at least 100")
        @Max(value = 10000, message = "Cache size must be at most 10000")
        private Integer cacheSize = 1000;

        @Min(value = 60, message = "Cache TTL must be at least 1 minute")
        @Max(value = 86400, message = "Cache TTL must be at most 24 hours")
        private Integer cacheTtlSeconds = 3600;

        // Getters and setters
        public Integer getMaxFileSizeMb() {
            return maxFileSizeMb;
        }

        public void setMaxFileSizeMb(Integer maxFileSizeMb) {
            this.maxFileSizeMb = maxFileSizeMb;
        }

        public Integer getThreadPoolSize() {
            return threadPoolSize;
        }

        public void setThreadPoolSize(Integer threadPoolSize) {
            this.threadPoolSize = threadPoolSize;
        }

        public Integer getRequestTimeoutMs() {
            return requestTimeoutMs;
        }

        public void setRequestTimeoutMs(Integer requestTimeoutMs) {
            this.requestTimeoutMs = requestTimeoutMs;
        }

        public Integer getCacheSize() {
            return cacheSize;
        }

        public void setCacheSize(Integer cacheSize) {
            this.cacheSize = cacheSize;
        }

        public Integer getCacheTtlSeconds() {
            return cacheTtlSeconds;
        }

        public void setCacheTtlSeconds(Integer cacheTtlSeconds) {
            this.cacheTtlSeconds = cacheTtlSeconds;
        }

        @Override
        public String toString() {
            return "Performance{" +
                    "maxFileSizeMb=" + maxFileSizeMb +
                    ", threadPoolSize=" + threadPoolSize +
                    ", requestTimeoutMs=" + requestTimeoutMs +
                    ", cacheSize=" + cacheSize +
                    ", cacheTtlSeconds=" + cacheTtlSeconds +
                    '}';
        }
    }

    public static class Integrations {
        private Blockchain blockchain = new Blockchain();
        private External external = new External();

        public static class Blockchain {
            @Pattern(regexp = "^(mainnet|sepolia|mumbai|polygon|localhost)$", 
                     message = "Network must be one of: mainnet, sepolia, mumbai, polygon, localhost")
            private String network = "localhost";

            @Pattern(regexp = "^https?://.*", message = "RPC URL must be a valid HTTP/HTTPS URL")
            private String rpcUrl = "http://localhost:8545";

            @Pattern(regexp = "^0x[a-fA-F0-9]{40}$", message = "Contract address must be a valid Ethereum address")
            private String contractAddress;

            @Min(value = 1, message = "Gas limit must be at least 1")
            @Max(value = 10000000, message = "Gas limit must be at most 10,000,000")
            private Long gasLimit = 8000000L;

            @Min(value = 1000000000L, message = "Gas price must be at least 1 Gwei")
            @Max(value = 1000000000000L, message = "Gas price must be at most 1000 Gwei")
            private Long gasPriceWei = 20000000000L;

            // Getters and setters
            public String getNetwork() {
                return network;
            }

            public void setNetwork(String network) {
                this.network = network;
            }

            public String getRpcUrl() {
                return rpcUrl;
            }

            public void setRpcUrl(String rpcUrl) {
                this.rpcUrl = rpcUrl;
            }

            public String getContractAddress() {
                return contractAddress;
            }

            public void setContractAddress(String contractAddress) {
                this.contractAddress = contractAddress;
            }

            public Long getGasLimit() {
                return gasLimit;
            }

            public void setGasLimit(Long gasLimit) {
                this.gasLimit = gasLimit;
            }

            public Long getGasPriceWei() {
                return gasPriceWei;
            }

            public void setGasPriceWei(Long gasPriceWei) {
                this.gasPriceWei = gasPriceWei;
            }

            @Override
            public String toString() {
                return "Blockchain{" +
                        "network='" + network + '\'' +
                        ", rpcUrl='" + rpcUrl + '\'' +
                        ", contractAddress='" + contractAddress + '\'' +
                        ", gasLimit=" + gasLimit +
                        ", gasPriceWei=" + gasPriceWei +
                        '}';
            }
        }

        public static class External {
            @Pattern(regexp = "^https?://.*", message = "API base URL must be a valid HTTP/HTTPS URL")
            private String apiBaseUrl;

            @Min(value = 1000, message = "API timeout must be at least 1 second")
            @Max(value = 60000, message = "API timeout must be at most 1 minute")
            private Integer apiTimeoutMs = 10000;

            @Min(value = 1, message = "Max retries must be at least 1")
            @Max(value = 5, message = "Max retries must be at most 5")
            private Integer maxRetries = 3;

            @Min(value = 1000, message = "Retry delay must be at least 1 second")
            @Max(value = 10000, message = "Retry delay must be at most 10 seconds")
            private Integer retryDelayMs = 2000;

            // Getters and setters
            public String getApiBaseUrl() {
                return apiBaseUrl;
            }

            public void setApiBaseUrl(String apiBaseUrl) {
                this.apiBaseUrl = apiBaseUrl;
            }

            public Integer getApiTimeoutMs() {
                return apiTimeoutMs;
            }

            public void setApiTimeoutMs(Integer apiTimeoutMs) {
                this.apiTimeoutMs = apiTimeoutMs;
            }

            public Integer getMaxRetries() {
                return maxRetries;
            }

            public void setMaxRetries(Integer maxRetries) {
                this.maxRetries = maxRetries;
            }

            public Integer getRetryDelayMs() {
                return retryDelayMs;
            }

            public void setRetryDelayMs(Integer retryDelayMs) {
                this.retryDelayMs = retryDelayMs;
            }

            @Override
            public String toString() {
                return "External{" +
                        "apiBaseUrl='" + apiBaseUrl + '\'' +
                        ", apiTimeoutMs=" + apiTimeoutMs +
                        ", maxRetries=" + maxRetries +
                        ", retryDelayMs=" + retryDelayMs +
                        '}';
            }
        }

        public Blockchain getBlockchain() {
            return blockchain;
        }

        public void setBlockchain(Blockchain blockchain) {
            this.blockchain = blockchain;
        }

        public External getExternal() {
            return external;
        }

        public void setExternal(External external) {
            this.external = external;
        }

        @Override
        public String toString() {
            return "Integrations{" +
                    "blockchain=" + blockchain +
                    ", external=" + external +
                    '}';
        }
    }

    // Main class getters and setters
    public Security getSecurity() {
        return security;
    }

    public void setSecurity(Security security) {
        this.security = security;
    }

    public Features getFeatures() {
        return features;
    }

    public void setFeatures(Features features) {
        this.features = features;
    }

    public Performance getPerformance() {
        return performance;
    }

    public void setPerformance(Performance performance) {
        this.performance = performance;
    }

    public Integrations getIntegrations() {
        return integrations;
    }

    public void setIntegrations(Integrations integrations) {
        this.integrations = integrations;
    }

    @Override
    public String toString() {
        return "ModuloProperties{" +
                "security=" + security +
                ", features=" + features +
                ", performance=" + performance +
                ", integrations=" + integrations +
                '}';
    }
}
