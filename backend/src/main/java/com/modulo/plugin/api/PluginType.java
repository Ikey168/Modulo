package com.modulo.plugin.api;

/**
 * Plugin types supported by the system
 */
public enum PluginType {
    /**
     * Internal plugins that run within the main application process
     * as JAR libraries or Spring components
     */
    INTERNAL,
    
    /**
     * External plugins that run as separate services/processes
     * and communicate via gRPC, REST, or message queues
     */
    EXTERNAL
}
