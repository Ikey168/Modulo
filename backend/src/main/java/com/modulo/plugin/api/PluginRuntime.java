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
    MESSAGE_QUEUE,

    /**
     * Blueprint graph programs stored in plugin_registry and executed by the blueprint interpreter.
     */
    BLUEPRINT
}
