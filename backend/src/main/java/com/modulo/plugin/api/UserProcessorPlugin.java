package com.modulo.plugin.api;

import com.modulo.entity.User;
import java.util.Map;

/**
 * Extended interface for plugins that provide user processing capabilities
 * This is used by the gRPC plugin service to interact with plugins
 */
public interface UserProcessorPlugin extends Plugin {
    
    /**
     * Handle user created event
     * @param user The created user
     */
    default void onUserCreated(User user) {
        // Default implementation does nothing
    }
    
    /**
     * Handle user updated event
     * @param user The updated user
     */
    default void onUserUpdated(User user) {
        // Default implementation does nothing
    }
    
    /**
     * Handle user deleted event
     * @param userId The ID of the deleted user
     */
    default void onUserDeleted(Long userId) {
        // Default implementation does nothing
    }
    
    /**
     * Handle user login event
     * @param userId The ID of the user who logged in
     * @param sessionId The session ID
     * @param ipAddress The IP address of the user
     */
    default void onUserLogin(Long userId, String sessionId, String ipAddress) {
        // Default implementation does nothing
    }
    
    /**
     * Handle user logout event
     * @param userId The ID of the user who logged out
     * @param sessionId The session ID
     */
    default void onUserLogout(Long userId, String sessionId) {
        // Default implementation does nothing
    }
    
    /**
     * Get user insights
     * @param userId The user ID to get insights for
     * @return Map of user insights
     */
    default Map<String, Object> getUserInsights(Long userId) {
        return Map.of(); // Default implementation returns empty map
    }
    
    /**
     * Generate user report
     * @param userId The user ID to generate report for
     * @return Map containing report data
     */
    default Map<String, Object> generateUserReport(Long userId) {
        return Map.of(); // Default implementation returns empty map
    }
}
