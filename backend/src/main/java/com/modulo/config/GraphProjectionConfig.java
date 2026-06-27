package com.modulo.config;

import org.neo4j.driver.AuthTokens;
import org.neo4j.driver.Driver;
import org.neo4j.driver.GraphDatabase;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Wires the Neo4j Java driver used by the knowledge-graph projection.
 *
 * <p>The driver is created lazily — constructing it does not open a connection, so the
 * application starts cleanly even when Neo4j is unreachable (e.g. the dev compose stack
 * does not run Neo4j). Actual connection failures are handled per-query in
 * {@link com.modulo.graph.GraphProjectionService}, which degrades to no-ops / empty
 * results rather than failing note writes.</p>
 *
 * <p>The bean is only created when {@code modulo.graph.enabled=true} (the default). When
 * disabled, no {@link Driver} bean exists and the projection service skips silently.</p>
 */
@Configuration
@ConditionalOnProperty(name = "modulo.graph.enabled", havingValue = "true", matchIfMissing = true)
public class GraphProjectionConfig {

    private static final Logger logger = LoggerFactory.getLogger(GraphProjectionConfig.class);

    @Value("${spring.neo4j.uri:bolt://localhost:7687}")
    private String uri;

    @Value("${spring.neo4j.authentication.username:neo4j}")
    private String username;

    @Value("${spring.neo4j.authentication.password:test}")
    private String password;

    @Bean(destroyMethod = "close")
    public Driver neo4jGraphDriver() {
        logger.info("Initializing Neo4j graph-projection driver for {} (lazy connect)", uri);
        // GraphDatabase.driver(...) does not connect until a session runs, so this is
        // safe even if Neo4j is down. verifyConnectivity() is intentionally NOT called.
        return GraphDatabase.driver(uri, AuthTokens.basic(username, password));
    }
}
