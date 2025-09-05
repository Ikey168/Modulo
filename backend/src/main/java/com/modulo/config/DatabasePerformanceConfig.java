package com.modulo.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.scheduling.annotation.EnableAsync;

import javax.sql.DataSource;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.springframework.beans.factory.annotation.Value;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Database performance optimization configuration
 * Addresses Issue #50: Optimize API Response Times - Database Query Performance
 */
@Configuration
@EnableTransactionManagement
@EnableAsync
public class DatabasePerformanceConfig {

    private static final Logger logger = LoggerFactory.getLogger(DatabasePerformanceConfig.class);

    @Value("${spring.datasource.url:jdbc:h2:mem:testdb}")
    private String databaseUrl;

    @Value("${spring.datasource.username:sa}")
    private String username;

    @Value("${spring.datasource.password:}")
    private String password;

    @Value("${spring.datasource.driver-class-name:org.h2.Driver}")
    private String driverClassName;

    /**
     * Configure high-performance connection pool
     */
    @Bean
    @ConfigurationProperties("spring.datasource.hikari")
    public HikariConfig hikariConfig() {
        HikariConfig config = new HikariConfig();
        
        // Basic connection settings
        config.setJdbcUrl(databaseUrl);
        config.setUsername(username);
        config.setPassword(password);
        config.setDriverClassName(driverClassName);
        
        // Performance optimizations for API response times
        config.setMaximumPoolSize(20); // Increase for concurrent requests
        config.setMinimumIdle(5); // Keep connections ready
        config.setConnectionTimeout(30000); // 30 seconds
        config.setIdleTimeout(600000); // 10 minutes
        config.setMaxLifetime(1800000); // 30 minutes
        config.setLeakDetectionThreshold(60000); // 1 minute
        
        // Connection validation for reliability
        config.setConnectionTestQuery("SELECT 1");
        config.setValidationTimeout(5000); // 5 seconds
        
        // Prepare statement caching for query performance
        config.addDataSourceProperty("cachePrepStmts", "true");
        config.addDataSourceProperty("prepStmtCacheSize", "250");
        config.addDataSourceProperty("prepStmtCacheSqlLimit", "2048");
        config.addDataSourceProperty("useServerPrepStmts", "true");
        config.addDataSourceProperty("rewriteBatchedStatements", "true");
        config.addDataSourceProperty("cacheResultSetMetadata", "true");
        config.addDataSourceProperty("cacheServerConfiguration", "true");
        config.addDataSourceProperty("elideSetAutoCommits", "true");
        config.addDataSourceProperty("maintainTimeStats", "false");
        
        // Database-specific optimizations
        if (databaseUrl.contains("postgresql")) {
            // PostgreSQL specific optimizations
            config.addDataSourceProperty("tcpKeepAlive", "true");
            config.addDataSourceProperty("socketTimeout", "30");
            config.addDataSourceProperty("loginTimeout", "10");
            config.addDataSourceProperty("prepareThreshold", "1");
            config.addDataSourceProperty("defaultRowFetchSize", "100");
        } else if (databaseUrl.contains("h2")) {
            // H2 specific optimizations for development
            config.addDataSourceProperty("DB_CLOSE_DELAY", "-1");
            config.addDataSourceProperty("DATABASE_TO_UPPER", "false");
        }
        
        logger.info("HikariCP configured for optimal API performance - Max Pool Size: {}, Min Idle: {}", 
                   config.getMaximumPoolSize(), config.getMinimumIdle());
        
        return config;
    }

    @Bean
    public DataSource dataSource() {
        return new HikariDataSource(hikariConfig());
    }
}
