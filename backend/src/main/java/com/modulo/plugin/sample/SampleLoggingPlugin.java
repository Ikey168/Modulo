package com.modulo.plugin.sample;

import com.modulo.plugin.api.*;
import com.modulo.plugin.event.PluginEvent;
import com.modulo.plugin.event.NoteEvent;
import com.modulo.plugin.manager.PluginEventHandler;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

/**
 * Sample plugin that demonstrates plugin system capabilities
 * This plugin logs note events and provides basic note statistics
 */
public class SampleLoggingPlugin implements Plugin, PluginEventHandler {
    
    private static final Logger logger = LoggerFactory.getLogger(SampleLoggingPlugin.class);
    
    private Map<String, Object> config;
    private boolean initialized = false;
    private boolean running = false;
    private int noteCreatedCount = 0;
    private int noteUpdatedCount = 0;
    private int noteDeletedCount = 0;
    
    @Override
    public PluginInfo getInfo() {
        return new PluginInfo(
            "sample-logging-plugin",
            "1.0.0",
            "A sample plugin that logs note events and provides statistics",
            "Modulo Team",
            PluginType.INTERNAL,
            PluginRuntime.JAR
        );
    }
    
    @Override
    public void initialize(Map<String, Object> config) throws PluginException {
        logger.info("Initializing Sample Logging Plugin");
        
        this.config = config;
        
        // Validate configuration
        if (config != null) {
            Object logLevel = config.get("log_level");
            if (logLevel != null && !Arrays.asList("DEBUG", "INFO", "WARN", "ERROR").contains(logLevel)) {
                throw new PluginException("Invalid log level: " + logLevel);
            }
        }
        
        initialized = true;
        logger.info("Sample Logging Plugin initialized successfully");
    }
    
    @Override
    public void start() throws PluginException {
        if (!initialized) {
            throw new PluginException("Plugin not initialized");
        }
        
        logger.info("Starting Sample Logging Plugin");
        running = true;
        
        // Reset counters
        noteCreatedCount = 0;
        noteUpdatedCount = 0;
        noteDeletedCount = 0;
        
        logger.info("Sample Logging Plugin started successfully");
    }
    
    @Override
    public void stop() throws PluginException {
        logger.info("Stopping Sample Logging Plugin");
        
        // Log final statistics
        logger.info("Final Statistics - Created: {}, Updated: {}, Deleted: {}", 
                   noteCreatedCount, noteUpdatedCount, noteDeletedCount);
        
        running = false;
        logger.info("Sample Logging Plugin stopped");
    }
    
    @Override
    public HealthCheck healthCheck() {
        if (!initialized) {
            return HealthCheck.unhealthy("Plugin not initialized");
        }
        
        if (!running) {
            return HealthCheck.unhealthy("Plugin not running");
        }
        
        return HealthCheck.healthy("Plugin is running normally. Stats - Created: " + 
                                 noteCreatedCount + ", Updated: " + noteUpdatedCount + 
                                 ", Deleted: " + noteDeletedCount);
    }
    
    @Override
    public List<String> getCapabilities() {
        return Arrays.asList(
            "event.logging",
            "note.statistics",
            "activity.monitoring"
        );
    }
    
    @Override
    public List<String> getRequiredPermissions() {
        return Arrays.asList(
            "notes.read",
            "system.events.subscribe"
        );
    }
    
    @Override
    public List<String> getSubscribedEvents() {
        return Arrays.asList(
            "note.created",
            "note.updated",
            "note.deleted",
            "note.shared",
            "note.viewed"
        );
    }
    
    @Override
    public List<String> getPublishedEvents() {
        return Arrays.asList(
            "statistics.updated"
        );
    }
    
    @Override
    public void handleEvent(PluginEvent event) {
        if (!running) {
            return;
        }
        
        try {
            String logLevel = getLogLevel();
            
            switch (event.getType()) {
                case "note.created":
                    if (event instanceof NoteEvent.NoteCreated) {
                        NoteEvent.NoteCreated noteCreated = (NoteEvent.NoteCreated) event;
                        noteCreatedCount++;
                        logEvent(logLevel, "Note created: ID={}, Title={}", 
                               noteCreated.getNote().getId(), 
                               noteCreated.getNote().getTitle());
                    }
                    break;
                    
                case "note.updated":
                    if (event instanceof NoteEvent.NoteUpdated) {
                        NoteEvent.NoteUpdated noteUpdated = (NoteEvent.NoteUpdated) event;
                        noteUpdatedCount++;
                        logEvent(logLevel, "Note updated: ID={}, Title={}", 
                               noteUpdated.getNote().getId(), 
                               noteUpdated.getNote().getTitle());
                    }
                    break;
                    
                case "note.deleted":
                    if (event instanceof NoteEvent.NoteDeleted) {
                        NoteEvent.NoteDeleted noteDeleted = (NoteEvent.NoteDeleted) event;
                        noteDeletedCount++;
                        logEvent(logLevel, "Note deleted: ID={}, Title={}", 
                               noteDeleted.getNote().getId(), 
                               noteDeleted.getNote().getTitle());
                    }
                    break;
                    
                case "note.shared":
                    if (event instanceof NoteEvent.NoteShared) {
                        NoteEvent.NoteShared noteShared = (NoteEvent.NoteShared) event;
                        logEvent(logLevel, "Note shared: ID={}, ShareType={}, Recipient={}", 
                               noteShared.getNote().getId(), 
                               noteShared.getShareType(),
                               noteShared.getRecipient());
                    }
                    break;
                    
                case "note.viewed":
                    if (event instanceof NoteEvent.NoteViewed) {
                        NoteEvent.NoteViewed noteViewed = (NoteEvent.NoteViewed) event;
                        logEvent(logLevel, "Note viewed: ID={}, ViewerID={}", 
                               noteViewed.getNote().getId(), 
                               noteViewed.getViewerId());
                    }
                    break;
                    
                default:
                    logEvent(logLevel, "Received event: {}", event.getType());
                    break;
            }
            
            // Log statistics every 10 events
            int totalEvents = noteCreatedCount + noteUpdatedCount + noteDeletedCount;
            if (totalEvents > 0 && totalEvents % 10 == 0) {
                logger.info("Plugin Statistics - Total Events: {}, Created: {}, Updated: {}, Deleted: {}", 
                           totalEvents, noteCreatedCount, noteUpdatedCount, noteDeletedCount);
            }
            
        } catch (Exception e) {
            logger.error("Error handling event: " + event.getType(), e);
        }
    }
    
    /**
     * Get configured log level
     */
    private String getLogLevel() {
        if (config != null && config.containsKey("log_level")) {
            return (String) config.get("log_level");
        }
        return "INFO";
    }
    
    /**
     * Log event based on configured log level
     */
    private void logEvent(String logLevel, String message, Object... args) {
        switch (logLevel) {
            case "DEBUG":
                logger.debug(message, args);
                break;
            case "INFO":
                logger.info(message, args);
                break;
            case "WARN":
                logger.warn(message, args);
                break;
            case "ERROR":
                logger.error(message, args);
                break;
            default:
                logger.info(message, args);
                break;
        }
    }
    
    /**
     * Get current statistics
     * @return Statistics map
     */
    public Map<String, Integer> getStatistics() {
        return Map.of(
            "created", noteCreatedCount,
            "updated", noteUpdatedCount,
            "deleted", noteDeletedCount,
            "total", noteCreatedCount + noteUpdatedCount + noteDeletedCount
        );
    }
}
