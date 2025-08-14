package com.modulo.plugin.manager;

import com.modulo.plugin.event.PluginEvent;

/**
 * Interface for plugins that want to handle events
 */
public interface PluginEventHandler {
    
    /**
     * Handle a plugin event
     * @param event The event to handle
     */
    void handleEvent(PluginEvent event);
}
