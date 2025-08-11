package com.modulo.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.jdbc.DataSourceBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.orm.jpa.JpaTransactionManager;
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean;
import org.springframework.orm.jpa.vendor.HibernateJpaVendorAdapter;
import org.springframework.transaction.PlatformTransactionManager;

import javax.sql.DataSource;
import java.io.File;
import java.util.Properties;

/**
 * Configuration for SQLite offline database
 * This runs alongside the main H2/PostgreSQL database
 */
@Configuration
@ConditionalOnProperty(name = "app.offline.database.enabled", havingValue = "true", matchIfMissing = true)
@EnableJpaRepositories(
    basePackages = "com.modulo.repository.offline",
    entityManagerFactoryRef = "offlineEntityManagerFactory",
    transactionManagerRef = "offlineTransactionManager"
)
public class OfflineDataSourceConfig {

    @Value("${app.offline.database.path:./data/offline.db}")
    private String offlineDatabasePath;

    @Value("${app.offline.database.enabled:true}")
    private boolean offlineEnabled;

    /**
     * SQLite DataSource for offline storage
     */
    @Bean(name = "offlineDataSource")
    @ConditionalOnProperty(name = "app.offline.database.enabled", havingValue = "true", matchIfMissing = true)
    public DataSource offlineDataSource() {
        // Ensure directory exists
        File dbFile = new File(offlineDatabasePath);
        File parentDir = dbFile.getParentFile();
        if (parentDir != null && !parentDir.exists()) {
            parentDir.mkdirs();
        }

        return DataSourceBuilder.create()
                .driverClassName("org.sqlite.JDBC")
                .url("jdbc:sqlite:" + offlineDatabasePath)
                .build();
    }

    /**
     * Entity Manager Factory for offline entities
     */
    @Bean(name = "offlineEntityManagerFactory")
    @ConditionalOnProperty(name = "app.offline.database.enabled", havingValue = "true", matchIfMissing = true)
    public LocalContainerEntityManagerFactoryBean offlineEntityManagerFactory() {
        LocalContainerEntityManagerFactoryBean em = new LocalContainerEntityManagerFactoryBean();
        em.setDataSource(offlineDataSource());
        em.setPackagesToScan("com.modulo.entity.offline");

        HibernateJpaVendorAdapter vendorAdapter = new HibernateJpaVendorAdapter();
        em.setJpaVendorAdapter(vendorAdapter);

        Properties properties = new Properties();
        properties.setProperty("hibernate.dialect", "org.sqlite.hibernate.dialect.SQLiteDialect");
        properties.setProperty("hibernate.hbm2ddl.auto", "update");
        properties.setProperty("hibernate.show_sql", "false");
        properties.setProperty("hibernate.format_sql", "true");
        
        // SQLite-specific optimizations
        properties.setProperty("hibernate.connection.provider_disables_autocommit", "true");
        properties.setProperty("hibernate.cache.use_second_level_cache", "false");
        properties.setProperty("hibernate.cache.use_query_cache", "false");
        properties.setProperty("hibernate.jdbc.batch_size", "25");
        properties.setProperty("hibernate.order_inserts", "true");
        properties.setProperty("hibernate.order_updates", "true");
        
        em.setJpaProperties(properties);
        return em;
    }

    /**
     * Transaction Manager for offline database
     */
    @Bean(name = "offlineTransactionManager")
    @ConditionalOnProperty(name = "app.offline.database.enabled", havingValue = "true", matchIfMissing = true)
    public PlatformTransactionManager offlineTransactionManager() {
        JpaTransactionManager transactionManager = new JpaTransactionManager();
        transactionManager.setEntityManagerFactory(offlineEntityManagerFactory().getObject());
        return transactionManager;
    }
}
