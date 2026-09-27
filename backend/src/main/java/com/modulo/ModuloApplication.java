package com.modulo;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.context.annotation.EnableAspectJAutoProxy;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableJpaRepositories(basePackages = "com.modulo")
@EntityScan("com.modulo")
@EnableAsync
@EnableScheduling
@EnableAspectJAutoProxy
public class ModuloApplication {

    public static void main(String[] args) {
        SpringApplication.run(ModuloApplication.class, args);
    }

}