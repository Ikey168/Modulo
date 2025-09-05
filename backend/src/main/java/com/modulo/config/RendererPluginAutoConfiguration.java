package com.modulo.config;

import com.modulo.plugin.impl.MindMapRenderer;
import com.modulo.plugin.registry.RendererPluginRegistry;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Configuration class to auto-register built-in renderer plugins
 */
@Component
public class RendererPluginAutoConfiguration {
    
    private static final Logger logger = LoggerFactory.getLogger(RendererPluginAutoConfiguration.class);
    
    @Autowired
    private RendererPluginRegistry rendererRegistry;
    
    @Autowired
    private MindMapRenderer mindMapRenderer;
    
    /**
     * Auto-register built-in renderer plugins on application startup
     */
    @EventListener(ApplicationReadyEvent.class)
    public void registerBuiltInRenderers() {
        logger.info("Auto-registering built-in renderer plugins");
        
        try {
            // Initialize and register MindMap renderer
            mindMapRenderer.initialize();
            boolean registered = rendererRegistry.registerRenderer(mindMapRenderer);
            
            if (registered) {
                logger.info("Successfully registered MindMap renderer");
            } else {
                logger.warn("Failed to register MindMap renderer");
            }
            
            // Register other built-in renderers here in the future
            // kanbanRenderer, timelineRenderer, etc.
            
            logger.info("Built-in renderer registration completed");
            
        } catch (Exception e) {
            logger.error("Failed to register built-in renderers", e);
        }
    }
}
