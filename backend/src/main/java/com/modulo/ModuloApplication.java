package com.modulo;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
// import org.springframework.boot.autoconfigure.data.neo4j.Neo4jDataAutoConfiguration; // No longer needed
// import org.springframework.boot.autoconfigure.data.neo4j.Neo4jRepositoriesAutoConfiguration; // No longer needed
// import org.springframework.boot.autoconfigure.neo4j.Neo4jAutoConfiguration; // No longer needed
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableJpaRepositories(basePackages = "com.modulo.repository")
@EnableAsync
@EnableScheduling
public class ModuloApplication {

    public static void main(String[] args) {
        SpringApplication.run(ModuloApplication.class, args);
    }

}