package com.modulo.plugin.api;

/**
 * Plugin-specific exception
 */
public class PluginException extends Exception {
    
    public PluginException(String message) {
        super(message);
    }
    
    public PluginException(String message, Throwable cause) {
        super(message, cause);
    }
    
    public PluginException(Throwable cause) {
        super(cause);
    }
}
