package com.modulo.config.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import javax.validation.Valid;
import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Pattern;

/**
 * Management and monitoring configuration properties with validation
 */
@ConfigurationProperties(prefix = "management")
@Validated
public class ManagementProperties {

    @NotNull(message = "Server configuration is required")
    @Valid
    private Server server = new Server();

    @NotNull(message = "Endpoints configuration is required")
    @Valid
    private Endpoints endpoints = new Endpoints();

    @NotNull(message = "Metrics configuration is required")
    @Valid
    private Metrics metrics = new Metrics();

    @NotNull(message = "Health configuration is required")
    @Valid
    private Health health = new Health();

    public static class Server {
        @Min(value = 1024, message = "Management port must be at least 1024")
        @Max(value = 65535, message = "Management port must be at most 65535")
        private Integer port = 8081;

        @Pattern(regexp = "^(0\\.0\\.0\\.0|127\\.0\\.0\\.1|localhost|[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+)$", 
                 message = "Address must be a valid IP address or localhost")
        private String address = "0.0.0.0";

        @Pattern(regexp = "^/[a-zA-Z0-9/_-]*$", message = "Base path must start with / and contain only alphanumeric characters, /, _, -")
        private String basePath = "/actuator";

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

        public String getBasePath() {
            return basePath;
        }

        public void setBasePath(String basePath) {
            this.basePath = basePath;
        }

        @Override
        public String toString() {
            return "Server{" +
                    "port=" + port +
                    ", address='" + address + '\'' +
                    ", basePath='" + basePath + '\'' +
                    '}';
        }
    }

    public static class Endpoints {
        private Web web = new Web();
        private Jmx jmx = new Jmx();

        public static class Web {
            @Pattern(regexp = "^\\*|[a-zA-Z0-9,/_-]+$", 
                     message = "Exposure must be '*' or comma-separated list of endpoint names")
            private String exposure = "health,info,metrics,prometheus";

            @Pattern(regexp = "^$|[a-zA-Z0-9,/_-]+$", 
                     message = "Exclude must be empty or comma-separated list of endpoint names")
            private String exclude = "";

            @Pattern(regexp = "^/[a-zA-Z0-9/_-]*$", 
                     message = "Base path must start with / and contain only alphanumeric characters, /, _, -")
            private String basePath = "/actuator";

            private boolean corsAllowCredentials = false;

            @Pattern(regexp = "^\\*|https?://[a-zA-Z0-9._-]+(:[0-9]+)?$", 
                     message = "CORS allowed origins must be '*' or valid HTTP/HTTPS URLs")
            private String corsAllowedOrigins = "*";

            // Getters and setters
            public String getExposure() {
                return exposure;
            }

            public void setExposure(String exposure) {
                this.exposure = exposure;
            }

            public String getExclude() {
                return exclude;
            }

            public void setExclude(String exclude) {
                this.exclude = exclude;
            }

            public String getBasePath() {
                return basePath;
            }

            public void setBasePath(String basePath) {
                this.basePath = basePath;
            }

            public boolean isCorsAllowCredentials() {
                return corsAllowCredentials;
            }

            public void setCorsAllowCredentials(boolean corsAllowCredentials) {
                this.corsAllowCredentials = corsAllowCredentials;
            }

            public String getCorsAllowedOrigins() {
                return corsAllowedOrigins;
            }

            public void setCorsAllowedOrigins(String corsAllowedOrigins) {
                this.corsAllowedOrigins = corsAllowedOrigins;
            }

            @Override
            public String toString() {
                return "Web{" +
                        "exposure='" + exposure + '\'' +
                        ", exclude='" + exclude + '\'' +
                        ", basePath='" + basePath + '\'' +
                        ", corsAllowCredentials=" + corsAllowCredentials +
                        ", corsAllowedOrigins='" + corsAllowedOrigins + '\'' +
                        '}';
            }
        }

        public static class Jmx {
            @Pattern(regexp = "^\\*|[a-zA-Z0-9,/_-]+$", 
                     message = "Exposure must be '*' or comma-separated list of endpoint names")
            private String exposure = "*";

            @Pattern(regexp = "^$|[a-zA-Z0-9,/_-]+$", 
                     message = "Exclude must be empty or comma-separated list of endpoint names")
            private String exclude = "";

            // Getters and setters
            public String getExposure() {
                return exposure;
            }

            public void setExposure(String exposure) {
                this.exposure = exposure;
            }

            public String getExclude() {
                return exclude;
            }

            public void setExclude(String exclude) {
                this.exclude = exclude;
            }

            @Override
            public String toString() {
                return "Jmx{" +
                        "exposure='" + exposure + '\'' +
                        ", exclude='" + exclude + '\'' +
                        '}';
            }
        }

        public Web getWeb() {
            return web;
        }

        public void setWeb(Web web) {
            this.web = web;
        }

        public Jmx getJmx() {
            return jmx;
        }

        public void setJmx(Jmx jmx) {
            this.jmx = jmx;
        }

        @Override
        public String toString() {
            return "Endpoints{" +
                    "web=" + web +
                    ", jmx=" + jmx +
                    '}';
        }
    }

    public static class Metrics {
        private boolean enabled = true;
        
        @Min(value = 1, message = "Export interval must be at least 1 second")
        @Max(value = 300, message = "Export interval must be at most 300 seconds")
        private Integer exportIntervalSeconds = 30;

        private Distribution distribution = new Distribution();
        private Tags tags = new Tags();

        public static class Distribution {
            @Min(value = 50, message = "Percentiles histogram buckets must be at least 50")
            @Max(value = 1000, message = "Percentiles histogram buckets must be at most 1000")
            private Integer percentilesHistogramBuckets = 100;

            @Pattern(regexp = "^[0-9]+(\\.[0-9]+)?(,[0-9]+(\\.[0-9]+)?)*$", 
                     message = "Percentiles must be comma-separated decimal values between 0 and 1")
            private String percentiles = "0.5,0.75,0.95,0.99";

            @Min(value = 1, message = "SLA must be at least 1 millisecond")
            private String sla = "100ms,200ms,500ms,1s,2s";

            // Getters and setters
            public Integer getPercentilesHistogramBuckets() {
                return percentilesHistogramBuckets;
            }

            public void setPercentilesHistogramBuckets(Integer percentilesHistogramBuckets) {
                this.percentilesHistogramBuckets = percentilesHistogramBuckets;
            }

            public String getPercentiles() {
                return percentiles;
            }

            public void setPercentiles(String percentiles) {
                this.percentiles = percentiles;
            }

            public String getSla() {
                return sla;
            }

            public void setSla(String sla) {
                this.sla = sla;
            }

            @Override
            public String toString() {
                return "Distribution{" +
                        "percentilesHistogramBuckets=" + percentilesHistogramBuckets +
                        ", percentiles='" + percentiles + '\'' +
                        ", sla='" + sla + '\'' +
                        '}';
            }
        }

        public static class Tags {
            @Pattern(regexp = "^[a-zA-Z0-9_-]+$", message = "Application name must contain only alphanumeric characters, _, -")
            private String application = "modulo";

            @Pattern(regexp = "^(local|dev|staging|production)$", message = "Environment must be one of: local, dev, staging, production")
            private String environment = "local";

            @Pattern(regexp = "^[a-zA-Z0-9._-]+$", message = "Version must contain only alphanumeric characters, ., _, -")
            private String version = "1.0.0";

            @Pattern(regexp = "^[a-zA-Z0-9._-]+$", message = "Instance must contain only alphanumeric characters, ., _, -")
            private String instance = "default";

            // Getters and setters
            public String getApplication() {
                return application;
            }

            public void setApplication(String application) {
                this.application = application;
            }

            public String getEnvironment() {
                return environment;
            }

            public void setEnvironment(String environment) {
                this.environment = environment;
            }

            public String getVersion() {
                return version;
            }

            public void setVersion(String version) {
                this.version = version;
            }

            public String getInstance() {
                return instance;
            }

            public void setInstance(String instance) {
                this.instance = instance;
            }

            @Override
            public String toString() {
                return "Tags{" +
                        "application='" + application + '\'' +
                        ", environment='" + environment + '\'' +
                        ", version='" + version + '\'' +
                        ", instance='" + instance + '\'' +
                        '}';
            }
        }

        public boolean isEnabled() {
            return enabled;
        }

        public void setEnabled(boolean enabled) {
            this.enabled = enabled;
        }

        public Integer getExportIntervalSeconds() {
            return exportIntervalSeconds;
        }

        public void setExportIntervalSeconds(Integer exportIntervalSeconds) {
            this.exportIntervalSeconds = exportIntervalSeconds;
        }

        public Distribution getDistribution() {
            return distribution;
        }

        public void setDistribution(Distribution distribution) {
            this.distribution = distribution;
        }

        public Tags getTags() {
            return tags;
        }

        public void setTags(Tags tags) {
            this.tags = tags;
        }

        @Override
        public String toString() {
            return "Metrics{" +
                    "enabled=" + enabled +
                    ", exportIntervalSeconds=" + exportIntervalSeconds +
                    ", distribution=" + distribution +
                    ", tags=" + tags +
                    '}';
        }
    }

    public static class Health {
        private boolean showDetails = true;
        private boolean showComponents = true;

        @Min(value = 1000, message = "Database timeout must be at least 1 second")
        @Max(value = 30000, message = "Database timeout must be at most 30 seconds")
        private Integer dbTimeoutMs = 5000;

        @Min(value = 1000, message = "Disk space threshold must be at least 1MB")
        private Long diskSpaceThresholdBytes = 1048576L; // 1MB

        private Cache cache = new Cache();

        public static class Cache {
            @Min(value = 1000, message = "Cache timeout must be at least 1 second")
            @Max(value = 10000, message = "Cache timeout must be at most 10 seconds")
            private Integer timeoutMs = 3000;

            // Getters and setters
            public Integer getTimeoutMs() {
                return timeoutMs;
            }

            public void setTimeoutMs(Integer timeoutMs) {
                this.timeoutMs = timeoutMs;
            }

            @Override
            public String toString() {
                return "Cache{" +
                        "timeoutMs=" + timeoutMs +
                        '}';
            }
        }

        public boolean isShowDetails() {
            return showDetails;
        }

        public void setShowDetails(boolean showDetails) {
            this.showDetails = showDetails;
        }

        public boolean isShowComponents() {
            return showComponents;
        }

        public void setShowComponents(boolean showComponents) {
            this.showComponents = showComponents;
        }

        public Integer getDbTimeoutMs() {
            return dbTimeoutMs;
        }

        public void setDbTimeoutMs(Integer dbTimeoutMs) {
            this.dbTimeoutMs = dbTimeoutMs;
        }

        public Long getDiskSpaceThresholdBytes() {
            return diskSpaceThresholdBytes;
        }

        public void setDiskSpaceThresholdBytes(Long diskSpaceThresholdBytes) {
            this.diskSpaceThresholdBytes = diskSpaceThresholdBytes;
        }

        public Cache getCache() {
            return cache;
        }

        public void setCache(Cache cache) {
            this.cache = cache;
        }

        @Override
        public String toString() {
            return "Health{" +
                    "showDetails=" + showDetails +
                    ", showComponents=" + showComponents +
                    ", dbTimeoutMs=" + dbTimeoutMs +
                    ", diskSpaceThresholdBytes=" + diskSpaceThresholdBytes +
                    ", cache=" + cache +
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

    public Endpoints getEndpoints() {
        return endpoints;
    }

    public void setEndpoints(Endpoints endpoints) {
        this.endpoints = endpoints;
    }

    public Metrics getMetrics() {
        return metrics;
    }

    public void setMetrics(Metrics metrics) {
        this.metrics = metrics;
    }

    public Health getHealth() {
        return health;
    }

    public void setHealth(Health health) {
        this.health = health;
    }

    @Override
    public String toString() {
        return "ManagementProperties{" +
                "server=" + server +
                ", endpoints=" + endpoints +
                ", metrics=" + metrics +
                ", health=" + health +
                '}';
    }
}
