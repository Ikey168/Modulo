package com.modulo.config;

import com.modulo.plugin.api.NotePluginAPI;
import com.modulo.plugin.api.UserPluginAPI;
import com.modulo.plugin.event.PluginEventBus;
import com.modulo.plugin.manager.PluginManager;
import com.modulo.plugin.manager.PluginSecurityManager;
import com.modulo.service.NoteService;
import com.modulo.service.UserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Scope;

/**
 * Plugin system configuration
 */
@Configuration
public class PluginConfig {
    
    private static final Logger logger = LoggerFactory.getLogger(PluginConfig.class);
    
    @Autowired
    private NoteService noteService;
    
    @Autowired
    private UserService userService;
    
    @Autowired
    private PluginEventBus pluginEventBus;
    
    @Autowired
    private PluginSecurityManager pluginSecurityManager;
    
    /**
     * Note API for plugins
     */
    @Bean
    public NotePluginAPI notePluginAPI() {
        return new NotePluginAPIImpl(noteService);
    }
    
    /**
     * User API for plugins
     */
    @Bean
    public UserPluginAPI userPluginAPI() {
        return new UserPluginAPIImpl(userService);
    }
    
    /**
     * Plugin manager initialization
     */
    @Bean
    public PluginManagerInitializer pluginManagerInitializer(PluginManager pluginManager) {
        return new PluginManagerInitializer(pluginManager);
    }
    
    /**
     * Component to initialize plugin manager after all beans are ready
     */
    public static class PluginManagerInitializer {
        private final PluginManager pluginManager;
        
        public PluginManagerInitializer(PluginManager pluginManager) {
            this.pluginManager = pluginManager;
            logger.info("Plugin Manager Initializer created");
        }
    }
}
