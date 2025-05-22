package com.modulo;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
// import org.springframework.boot.autoconfigure.data.neo4j.Neo4jDataAutoConfiguration; // No longer needed
// import org.springframework.boot.autoconfigure.data.neo4j.Neo4jRepositoriesAutoConfiguration; // No longer needed
// import org.springframework.boot.autoconfigure.neo4j.Neo4jAutoConfiguration; // No longer needed
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

@SpringBootApplication
@EnableJpaRepositories(basePackages = "com.modulo.repository.jpa")
public class ModuloApplication {

    public static void main(String[] args) {
        SpringApplication.run(ModuloApplication.class, args);
    }

}