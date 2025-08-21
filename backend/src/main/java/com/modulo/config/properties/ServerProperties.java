package com.modulo.config.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

/**
 * Server configuration properties with validation
 */
@ConfigurationProperties(prefix = "server")
@Validated
public class ServerProperties {

    @Min(value = 1024, message = "Server port must be at least 1024")
    @Max(value = 65535, message = "Server port must be at most 65535")
    private Integer port = 8080;

    @NotNull(message = "Servlet configuration is required")
    private Servlet servlet = new Servlet();

    @NotNull(message = "Error configuration is required")
    private Error error = new Error();

    // Connection and performance settings
    @Min(value = 1, message = "Max connections must be at least 1")
    @Max(value = 10000, message = "Max connections must be at most 10000")
    private Integer maxConnections = 8192;

    @Min(value = 1, message = "Accept count must be at least 1")
    @Max(value = 1000, message = "Accept count must be at most 1000")
    private Integer acceptCount = 100;

    @Min(value = 1, message = "Max threads must be at least 1")
    @Max(value = 1000, message = "Max threads must be at most 1000")
    private Integer maxThreads = 200;

    @Min(value = 1, message = "Min spare threads must be at least 1")
    private Integer minSpareThreads = 10;

    @Min(value = 1000, message = "Connection timeout must be at least 1000ms")
    private Integer connectionTimeout = 20000;

    public static class Servlet {
        @NotBlank(message = "Context path is required")
        private String contextPath = "/api";

        public String getContextPath() {
            return contextPath;
        }

        public void setContextPath(String contextPath) {
            this.contextPath = contextPath;
        }

        @Override
        public String toString() {
            return "Servlet{contextPath='" + contextPath + "'}";
        }
    }

    public static class Error {
        @NotBlank(message = "Error path is required")
        private String path = "/error";

        private boolean includeStacktrace = false;
        private boolean includeMessage = true;

        public String getPath() {
            return path;
        }

        public void setPath(String path) {
            this.path = path;
        }

        public boolean isIncludeStacktrace() {
            return includeStacktrace;
        }

        public void setIncludeStacktrace(boolean includeStacktrace) {
            this.includeStacktrace = includeStacktrace;
        }

        public boolean isIncludeMessage() {
            return includeMessage;
        }

        public void setIncludeMessage(boolean includeMessage) {
            this.includeMessage = includeMessage;
        }

        @Override
        public String toString() {
            return "Error{" +
                    "path='" + path + '\'' +
                    ", includeStacktrace=" + includeStacktrace +
                    ", includeMessage=" + includeMessage +
                    '}';
        }
    }

    // Getters and setters
    public Integer getPort() {
        return port;
    }

    public void setPort(Integer port) {
        this.port = port;
    }

    public Servlet getServlet() {
        return servlet;
    }

    public void setServlet(Servlet servlet) {
        this.servlet = servlet;
    }

    public Error getError() {
        return error;
    }

    public void setError(Error error) {
        this.error = error;
    }

    public Integer getMaxConnections() {
        return maxConnections;
    }

    public void setMaxConnections(Integer maxConnections) {
        this.maxConnections = maxConnections;
    }

    public Integer getAcceptCount() {
        return acceptCount;
    }

    public void setAcceptCount(Integer acceptCount) {
        this.acceptCount = acceptCount;
    }

    public Integer getMaxThreads() {
        return maxThreads;
    }

    public void setMaxThreads(Integer maxThreads) {
        this.maxThreads = maxThreads;
    }

    public Integer getMinSpareThreads() {
        return minSpareThreads;
    }

    public void setMinSpareThreads(Integer minSpareThreads) {
        this.minSpareThreads = minSpareThreads;
    }

    public Integer getConnectionTimeout() {
        return connectionTimeout;
    }

    public void setConnectionTimeout(Integer connectionTimeout) {
        this.connectionTimeout = connectionTimeout;
    }

    @Override
    public String toString() {
        return "ServerProperties{" +
                "port=" + port +
                ", servlet=" + servlet +
                ", error=" + error +
                ", maxConnections=" + maxConnections +
                ", acceptCount=" + acceptCount +
                ", maxThreads=" + maxThreads +
                ", minSpareThreads=" + minSpareThreads +
                ", connectionTimeout=" + connectionTimeout +
                '}';
    }
}
