package com.modulo.plugin.manager;

/**
 * Plugin status enumeration
 */
public enum PluginStatus {
    /**
     * Plugin is active and running
     */
    ACTIVE,
    
    /**
     * Plugin is installed but not running
     */
    INACTIVE,
    
    /**
     * Plugin is in error state
     */
    ERROR,
    
    /**
     * Plugin is being installed
     */
    INSTALLING,
    
    /**
     * Plugin is being uninstalled
     */
    UNINSTALLING,
    
    /**
     * Plugin status is unknown
     */
    UNKNOWN
}
