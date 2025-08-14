package com.modulo.plugin.event;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Event bus for plugin events
 * Handles event publishing and subscription
 */
@Component
public class PluginEventBus {
    
    private static final Logger logger = LoggerFactory.getLogger(PluginEventBus.class);
    
    private final Map<String, List<PluginEventListener<? extends PluginEvent>>> listeners = new ConcurrentHashMap<>();
    private final ExecutorService executorService = Executors.newCachedThreadPool(r -> {
        Thread t = new Thread(r, "plugin-event-" + System.currentTimeMillis());
        t.setDaemon(true);
        return t;
    });
    
    /**
     * Subscribe to events of a specific type
     * @param eventType Event type to subscribe to
     * @param listener Event listener
     */
    public <T extends PluginEvent> void subscribe(String eventType, PluginEventListener<T> listener) {
        listeners.computeIfAbsent(eventType, k -> new CopyOnWriteArrayList<>()).add(listener);
        logger.debug("Subscribed listener for event type: {}", eventType);
    }
    
    /**
     * Subscribe to events of a specific class
     * @param eventClass Event class to subscribe to
     * @param listener Event listener
     */
    public <T extends PluginEvent> void subscribe(Class<T> eventClass, PluginEventListener<T> listener) {
        String eventType = getEventType(eventClass);
        subscribe(eventType, listener);
    }
    
    /**
     * Unsubscribe from events
     * @param eventType Event type to unsubscribe from
     * @param listener Event listener to remove
     */
    public <T extends PluginEvent> void unsubscribe(String eventType, PluginEventListener<T> listener) {
        List<PluginEventListener<? extends PluginEvent>> eventListeners = listeners.get(eventType);
        if (eventListeners != null) {
            eventListeners.remove(listener);
            logger.debug("Unsubscribed listener for event type: {}", eventType);
        }
    }
    
    /**
     * Publish an event synchronously
     * @param event Event to publish
     */
    public void publish(PluginEvent event) {
        String eventType = event.getType();
        List<PluginEventListener<? extends PluginEvent>> eventListeners = listeners.get(eventType);
        
        if (eventListeners != null && !eventListeners.isEmpty()) {
            logger.debug("Publishing event: {} to {} listeners", eventType, eventListeners.size());
            
            for (PluginEventListener<? extends PluginEvent> listener : eventListeners) {
                try {
                    @SuppressWarnings("unchecked")
                    PluginEventListener<PluginEvent> typedListener = (PluginEventListener<PluginEvent>) listener;
                    typedListener.handleEvent(event);
                } catch (Exception e) {
                    logger.error("Error handling event {} with listener {}", eventType, listener.getClass().getName(), e);
                }
            }
        } else {
            logger.debug("No listeners found for event type: {}", eventType);
        }
    }
    
    /**
     * Publish an event asynchronously
     * @param event Event to publish
     */
    public void publishAsync(PluginEvent event) {
        executorService.submit(() -> publish(event));
    }
    
    /**
     * Get event type from event class
     * @param eventClass Event class
     * @return Event type string
     */
    private String getEventType(Class<? extends PluginEvent> eventClass) {
        // Convert class name to event type (e.g., NoteCreated -> note.created)
        String className = eventClass.getSimpleName();
        StringBuilder eventType = new StringBuilder();
        
        for (int i = 0; i < className.length(); i++) {
            char c = className.charAt(i);
            if (Character.isUpperCase(c) && i > 0) {
                eventType.append('.');
            }
            eventType.append(Character.toLowerCase(c));
        }
        
        return eventType.toString();
    }
    
    /**
     * Get all subscribed event types
     * @return Set of event types
     */
    public java.util.Set<String> getSubscribedEventTypes() {
        return listeners.keySet();
    }
    
    /**
     * Get listener count for an event type
     * @param eventType Event type
     * @return Number of listeners
     */
    public int getListenerCount(String eventType) {
        List<PluginEventListener<? extends PluginEvent>> eventListeners = listeners.get(eventType);
        return eventListeners != null ? eventListeners.size() : 0;
    }
    
    /**
     * Clear all listeners (used for testing or shutdown)
     */
    public void clearAllListeners() {
        listeners.clear();
        logger.info("Cleared all event listeners");
    }
    
    /**
     * Shutdown the event bus
     */
    public void shutdown() {
        executorService.shutdown();
        clearAllListeners();
        logger.info("Plugin event bus shutdown");
    }
}
