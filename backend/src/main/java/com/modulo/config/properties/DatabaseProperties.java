package com.modulo.config.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Pattern;
import javax.validation.constraints.Positive;

/**
 * Database configuration properties with validation
 */
@ConfigurationProperties(prefix = "spring.datasource")
@Validated
public class DatabaseProperties {

    @NotBlank(message = "Database URL is required")
    @Pattern(regexp = "^jdbc:(h2|postgresql):.*", message = "Database URL must be a valid JDBC URL for H2 or PostgreSQL")
    private String url;

    @NotBlank(message = "Database username is required")
    private String username;

    @NotNull(message = "Database password must be provided")
    private String password;

    @NotBlank(message = "Database driver class name is required")
    @Pattern(regexp = "^(org\\.h2\\.Driver|org\\.postgresql\\.Driver)$", 
             message = "Driver must be either H2 or PostgreSQL driver")
    private String driverClassName;

    // Connection pool properties
    @Positive(message = "Maximum pool size must be positive")
    private Integer maximumPoolSize = 10;

    @Positive(message = "Minimum idle connections must be positive")
    private Integer minimumIdle = 5;

    @Positive(message = "Connection timeout must be positive")
    private Long connectionTimeout = 30000L;

    @Positive(message = "Idle timeout must be positive")
    private Long idleTimeout = 600000L;

    @Positive(message = "Max lifetime must be positive")
    private Long maxLifetime = 1800000L;

    // Getters and setters
    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        this.url = url;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getDriverClassName() {
        return driverClassName;
    }

    public void setDriverClassName(String driverClassName) {
        this.driverClassName = driverClassName;
    }

    public Integer getMaximumPoolSize() {
        return maximumPoolSize;
    }

    public void setMaximumPoolSize(Integer maximumPoolSize) {
        this.maximumPoolSize = maximumPoolSize;
    }

    public Integer getMinimumIdle() {
        return minimumIdle;
    }

    public void setMinimumIdle(Integer minimumIdle) {
        this.minimumIdle = minimumIdle;
    }

    public Long getConnectionTimeout() {
        return connectionTimeout;
    }

    public void setConnectionTimeout(Long connectionTimeout) {
        this.connectionTimeout = connectionTimeout;
    }

    public Long getIdleTimeout() {
        return idleTimeout;
    }

    public void setIdleTimeout(Long idleTimeout) {
        this.idleTimeout = idleTimeout;
    }

    public Long getMaxLifetime() {
        return maxLifetime;
    }

    public void setMaxLifetime(Long maxLifetime) {
        this.maxLifetime = maxLifetime;
    }

    @Override
    public String toString() {
        return "DatabaseProperties{" +
                "url='" + (url != null ? url.replaceAll("password=[^&;]*", "password=***") : null) + '\'' +
                ", username='" + username + '\'' +
                ", password='***'" +
                ", driverClassName='" + driverClassName + '\'' +
                ", maximumPoolSize=" + maximumPoolSize +
                ", minimumIdle=" + minimumIdle +
                ", connectionTimeout=" + connectionTimeout +
                ", idleTimeout=" + idleTimeout +
                ", maxLifetime=" + maxLifetime +
                '}';
    }
}
