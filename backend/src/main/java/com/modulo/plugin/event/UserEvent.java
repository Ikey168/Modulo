package com.modulo.plugin.event;

import com.modulo.entity.User;
import java.util.Map;

/**
 * Events related to user operations
 */
public abstract class UserEvent extends PluginEvent {
    
    private final User user;
    
    protected UserEvent(String type, User user, Map<String, Object> metadata) {
        super(type, user, metadata);
        this.user = user;
    }
    
    protected UserEvent(String type, User user) {
        super(type, user);
        this.user = user;
    }
    
    public User getUser() { return user; }
    
    /**
     * Event fired when a user logs in
     */
    public static class UserLoggedIn extends UserEvent {
        private final String sessionId;
        private final String ipAddress;
        
        public UserLoggedIn(User user, String sessionId, String ipAddress) {
            super("user.logged_in", user);
            this.sessionId = sessionId;
            this.ipAddress = ipAddress;
            addMetadata("sessionId", sessionId);
            addMetadata("ipAddress", ipAddress);
        }
        
        public String getSessionId() { return sessionId; }
        public String getIpAddress() { return ipAddress; }
    }
    
    /**
     * Event fired when a user logs out
     */
    public static class UserLoggedOut extends UserEvent {
        private final String sessionId;
        
        public UserLoggedOut(User user, String sessionId) {
            super("user.logged_out", user);
            this.sessionId = sessionId;
            addMetadata("sessionId", sessionId);
        }
        
        public String getSessionId() { return sessionId; }
    }
    
    /**
     * Event fired when a user registers
     */
    public static class UserRegistered extends UserEvent {
        public UserRegistered(User user) {
            super("user.registered", user);
        }
    }
    
    /**
     * Event fired when a user profile is updated
     */
    public static class UserProfileUpdated extends UserEvent {
        private final Map<String, Object> changes;
        
        public UserProfileUpdated(User user, Map<String, Object> changes) {
            super("user.profile_updated", user);
            this.changes = changes;
            addMetadata("changes", changes);
        }
        
        public Map<String, Object> getChanges() { return changes; }
    }
    
    /**
     * Event fired when user preferences are updated
     */
    public static class UserPreferencesUpdated extends UserEvent {
        private final Map<String, Object> preferences;
        
        public UserPreferencesUpdated(User user, Map<String, Object> preferences) {
            super("user.preferences_updated", user);
            this.preferences = preferences;
            addMetadata("preferences", preferences);
        }
        
        public Map<String, Object> getPreferences() { return preferences; }
    }
}
