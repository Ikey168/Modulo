package com.modulo;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.info.Info;

@SpringBootApplication
@OpenAPIDefinition(
    info = @Info(
        title = "Modulo API",
        version = "1.0",
        description = "REST API for Modulo application"
    )
)
public class ModuloApplication {
    public static void main(String[] args) {
        SpringApplication.run(ModuloApplication.class, args);
    }
}