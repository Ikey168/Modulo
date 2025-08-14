package com.modulo.config;

import com.modulo.entity.User;
import com.modulo.plugin.api.UserPluginAPI;
import com.modulo.plugin.api.UserPreferences;
import com.modulo.service.UserService;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Map;
import java.util.Optional;

/**
 * Implementation of UserPluginAPI that bridges plugin calls to the UserService
 */
public class UserPluginAPIImpl implements UserPluginAPI {
    
    private final UserService userService;
    
    public UserPluginAPIImpl(UserService userService) {
        this.userService = userService;
    }
    
    @Override
    public Optional<User> getCurrentUser() {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.isAuthenticated()) {
                String username = auth.getName();
                return userService.findByUsername(username);
            }
            return Optional.empty();
        } catch (Exception e) {
            return Optional.empty();
        }
    }
    
    @Override
    public Optional<User> findByUsername(String username) {
        try {
            return userService.findByUsername(username);
        } catch (Exception e) {
            return Optional.empty();
        }
    }
    
    @Override
    public Optional<User> findByEmail(String email) {
        try {
            return userService.findByEmail(email);
        } catch (Exception e) {
            return Optional.empty();
        }
    }
    
    @Override
    public Optional<User> findById(Long id) {
        try {
            return userService.findById(id);
        } catch (Exception e) {
            return Optional.empty();
        }
    }
    
    @Override
    public boolean hasPermission(String permission) {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth == null || !auth.isAuthenticated()) {
                return false;
            }
            
            // Check if user has the required permission
            return auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(authority -> authority.equals(permission) || authority.equals("ROLE_ADMIN"));
        } catch (Exception e) {
            return false;
        }
    }
    
    @Override
    public boolean hasRole(String role) {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth == null || !auth.isAuthenticated()) {
                return false;
            }
            
            String roleWithPrefix = role.startsWith("ROLE_") ? role : "ROLE_" + role;
            return auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(authority -> authority.equals(roleWithPrefix));
        } catch (Exception e) {
            return false;
        }
    }
    
    @Override
    public void addCustomAttribute(String key, Object value) {
        try {
            Optional<User> currentUser = getCurrentUser();
            if (currentUser.isPresent()) {
                // Convert Object to String for compatibility with entity mapping
                String stringValue = value != null ? value.toString() : null;
                userService.addCustomAttribute(currentUser.get().getId(), key, stringValue);
            }
        } catch (Exception e) {
            throw new RuntimeException("Failed to add custom attribute: " + e.getMessage());
        }
    }
    
    @Override
    public Object getCustomAttribute(String key) {
        try {
            Optional<User> currentUser = getCurrentUser();
            if (currentUser.isPresent()) {
                return userService.getCustomAttribute(currentUser.get().getId(), key);
            }
            return null;
        } catch (Exception e) {
            return null;
        }
    }
    
    @Override
    public void removeCustomAttribute(String key) {
        try {
            Optional<User> currentUser = getCurrentUser();
            if (currentUser.isPresent()) {
                userService.removeCustomAttribute(currentUser.get().getId(), key);
            }
        } catch (Exception e) {
            throw new RuntimeException("Failed to remove custom attribute: " + e.getMessage());
        }
    }
    
    @Override
    public boolean canAccessNote(Long noteId) {
        try {
            Optional<User> currentUser = getCurrentUser();
            if (currentUser.isEmpty()) {
                return false;
            }
            
            // Check if user can access the note
            return userService.canAccessNote(currentUser.get().getId(), noteId);
        } catch (Exception e) {
            return false;
        }
    }
    
    @Override
    public UserPreferences getPreferences() {
        try {
            Optional<User> currentUser = getCurrentUser();
            if (currentUser.isPresent()) {
                Map<String, Object> preferences = userService.getUserPreferences(currentUser.get().getId());
                UserPreferences userPrefs = new UserPreferences(preferences);
                
                // Set additional preference fields if available
                Object theme = preferences.get("theme");
                if (theme instanceof String) {
                    userPrefs.setTheme((String) theme);
                }
                
                Object language = preferences.get("language");
                if (language instanceof String) {
                    userPrefs.setLanguage((String) language);
                }
                
                @SuppressWarnings("unchecked")
                Map<String, Object> pluginSettings = (Map<String, Object>) preferences.get("pluginSettings");
                if (pluginSettings != null) {
                    userPrefs.setPluginSettings(pluginSettings);
                }
                
                return userPrefs;
            }
            return new UserPreferences();
        } catch (Exception e) {
            return new UserPreferences();
        }
    }
    
    @Override
    public void updatePreferences(UserPreferences preferences) {
        try {
            Optional<User> currentUser = getCurrentUser();
            if (currentUser.isPresent()) {
                Map<String, Object> prefsMap = preferences.getPreferences();
                
                // Add theme and language to preferences map
                if (preferences.getTheme() != null) {
                    prefsMap.put("theme", preferences.getTheme());
                }
                if (preferences.getLanguage() != null) {
                    prefsMap.put("language", preferences.getLanguage());
                }
                if (preferences.getPluginSettings() != null) {
                    prefsMap.put("pluginSettings", preferences.getPluginSettings());
                }
                
                userService.updateUserPreferences(currentUser.get().getId(), prefsMap);
            }
        } catch (Exception e) {
            throw new RuntimeException("Failed to update preferences: " + e.getMessage());
        }
    }
}
