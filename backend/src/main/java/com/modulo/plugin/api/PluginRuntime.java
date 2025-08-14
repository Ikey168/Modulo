package com.modulo.plugin.api;

/**
 * Plugin runtime environments
 */
public enum PluginRuntime {
    /**
     * JAR-based plugins loaded into the JVM
     */
    JAR,
    
    /**
     * gRPC-based microservice plugins
     */
    GRPC,
    
    /**
     * REST API-based plugins
     */
    REST,
    
    /**
     * Message queue-based plugins
     */
    MESSAGE_QUEUE
}
