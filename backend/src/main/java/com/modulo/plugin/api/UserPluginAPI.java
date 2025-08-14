package com.modulo.plugin.api;

import com.modulo.entity.User;
import java.util.Optional;

/**
 * Plugin API for user operations
 * Provides plugins with access to user management functionality
 */
public interface UserPluginAPI {
    
    /**
     * Get the currently authenticated user
     * @return Optional containing the current user if authenticated
     */
    Optional<User> getCurrentUser();
    
    /**
     * Find a user by username
     * @param username Username to search for
     * @return Optional containing the user if found
     */
    Optional<User> findByUsername(String username);
    
    /**
     * Find a user by email
     * @param email Email to search for
     * @return Optional containing the user if found
     */
    Optional<User> findByEmail(String email);
    
    /**
     * Find a user by ID
     * @param id User ID
     * @return Optional containing the user if found
     */
    Optional<User> findById(Long id);
    
    /**
     * Check if current user has a specific permission
     * @param permission Permission to check
     * @return true if user has permission, false otherwise
     */
    boolean hasPermission(String permission);
    
    /**
     * Check if user has a specific role
     * @param role Role to check
     * @return true if user has role, false otherwise
     */
    boolean hasRole(String role);
    
    /**
     * Add custom attribute to current user
     * @param key Attribute key
     * @param value Attribute value
     */
    void addCustomAttribute(String key, Object value);
    
    /**
     * Get custom attribute for current user
     * @param key Attribute key
     * @return Attribute value or null if not found
     */
    Object getCustomAttribute(String key);
    
    /**
     * Remove custom attribute from current user
     * @param key Attribute key to remove
     */
    void removeCustomAttribute(String key);
    
    /**
     * Check if current user can access a specific note
     * @param noteId Note ID to check access for
     * @return true if user can access the note, false otherwise
     */
    boolean canAccessNote(Long noteId);
    
    /**
     * Get user preferences
     * @return UserPreferences object
     */
    UserPreferences getPreferences();
    
    /**
     * Update user preferences
     * @param preferences New preferences
     */
    void updatePreferences(UserPreferences preferences);
}
