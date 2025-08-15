package com.modulo.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.ComponentScan;

/**
 * Configuration for gRPC services
 * Enables automatic discovery of gRPC service implementations
 */
@Configuration
@ComponentScan(basePackages = "com.modulo.grpc.service")
public class GrpcConfig {
    
    // The @GrpcService annotation on service implementations will automatically
    // register them with the gRPC server through the grpc-spring-boot-starter
    
}
