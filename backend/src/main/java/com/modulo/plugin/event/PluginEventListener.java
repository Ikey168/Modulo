package com.modulo.plugin.event;

/**
 * Interface for plugin event listeners
 */
@FunctionalInterface
public interface PluginEventListener<T extends PluginEvent> {
    
    /**
     * Handle a plugin event
     * @param event The event to handle
     */
    void handleEvent(T event);
}
