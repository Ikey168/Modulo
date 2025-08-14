package com.modulo.service;

import com.modulo.entity.User;
import com.modulo.plugin.event.PluginEventBus;
import com.modulo.plugin.event.UserEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.persistence.EntityManager;
import javax.persistence.NoResultException;
import javax.persistence.Query;
import java.time.LocalDateTime;
import java.util.*;

/**
 * Service for user operations with plugin integration
 */
@Service
@Transactional
public class UserService {
    
    private static final Logger logger = LoggerFactory.getLogger(UserService.class);
    
    @Autowired
    private EntityManager entityManager;
    
    @Autowired
    private PluginEventBus eventBus;
    
    /**
     * Find user by ID
     */
    public Optional<User> findById(Long id) {
        try {
            User user = entityManager.find(User.class, id);
            return Optional.ofNullable(user);
        } catch (Exception e) {
            logger.error("Error finding user by ID: " + id, e);
            return Optional.empty();
        }
    }
    
    /**
     * Find user by username
     */
    public Optional<User> findByUsername(String username) {
        try {
            String jpql = "SELECT u FROM User u WHERE u.username = :username";
            User user = (User) entityManager.createQuery(jpql)
                    .setParameter("username", username)
                    .getSingleResult();
            return Optional.of(user);
        } catch (NoResultException e) {
            return Optional.empty();
        } catch (Exception e) {
            logger.error("Error finding user by username: " + username, e);
            return Optional.empty();
        }
    }
    
    /**
     * Find user by email
     */
    public Optional<User> findByEmail(String email) {
        try {
            String jpql = "SELECT u FROM User u WHERE u.email = :email";
            User user = (User) entityManager.createQuery(jpql)
                    .setParameter("email", email)
                    .getSingleResult();
            return Optional.of(user);
        } catch (NoResultException e) {
            return Optional.empty();
        } catch (Exception e) {
            logger.error("Error finding user by email: " + email, e);
            return Optional.empty();
        }
    }
    
    /**
     * Save user (create or update)
     */
    public User save(User user) {
        boolean isNew = user.getId() == null;
        
        // Set timestamps
        LocalDateTime now = LocalDateTime.now();
        if (isNew) {
            user.setCreatedAt(now);
        }
        user.setUpdatedAt(now);
        
        // Save user
        User savedUser = entityManager.merge(user);
        entityManager.flush();
        
        // Publish events
        if (isNew) {
            eventBus.publishAsync(new UserEvent.UserRegistered(savedUser));
        }
        
        logger.debug("User {} saved: {}", isNew ? "created" : "updated", savedUser.getId());
        return savedUser;
    }
    
    /**
     * Update user profile
     */
    public User updateProfile(Long userId, Map<String, Object> updates) {
        Optional<User> userOpt = findById(userId);
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            
            // Apply updates (this is a simplified implementation)
            if (updates.containsKey("firstName")) {
                user.setFirstName((String) updates.get("firstName"));
            }
            if (updates.containsKey("lastName")) {
                user.setLastName((String) updates.get("lastName"));
            }
            if (updates.containsKey("email")) {
                user.setEmail((String) updates.get("email"));
            }
            
            user.setUpdatedAt(LocalDateTime.now());
            User updatedUser = entityManager.merge(user);
            entityManager.flush();
            
            // Publish event
            eventBus.publishAsync(new UserEvent.UserProfileUpdated(updatedUser, updates));
            
            logger.debug("User profile updated: {}", userId);
            return updatedUser;
        }
        throw new RuntimeException("User not found: " + userId);
    }
    
    /**
     * Add custom attribute to user
     */
    public void addCustomAttribute(Long userId, String key, String value) {
        Optional<User> userOpt = findById(userId);
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            
            // Initialize custom attributes if null
            if (user.getCustomAttributes() == null) {
                user.setCustomAttributes(new HashMap<>());
            }
            
            user.getCustomAttributes().put(key, value);
            user.setUpdatedAt(LocalDateTime.now());
            
            entityManager.merge(user);
            entityManager.flush();
            
            logger.debug("Added custom attribute to user {}: {} = {}", userId, key, value);
        }
    }
    
    /**
     * Get custom attribute for user
     */
    public Object getCustomAttribute(Long userId, String key) {
        Optional<User> user = findById(userId);
        if (user.isPresent() && user.get().getCustomAttributes() != null) {
            return user.get().getCustomAttributes().get(key);
        }
        return null;
    }
    
    /**
     * Remove custom attribute from user
     */
    public void removeCustomAttribute(Long userId, String key) {
        Optional<User> userOpt = findById(userId);
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            
            if (user.getCustomAttributes() != null) {
                user.getCustomAttributes().remove(key);
                user.setUpdatedAt(LocalDateTime.now());
                
                entityManager.merge(user);
                entityManager.flush();
                
                logger.debug("Removed custom attribute from user {}: {}", userId, key);
            }
        }
    }
    
    /**
     * Check if user can access a note
     */
    public boolean canAccessNote(Long userId, Long noteId) {
        try {
            // This is a simplified implementation - extend based on your access control logic
            String jpql = "SELECT COUNT(n) FROM Note n WHERE n.id = :noteId AND (n.userId = :userId OR n.isPublic = true)";
            Long count = (Long) entityManager.createQuery(jpql)
                    .setParameter("noteId", noteId)
                    .setParameter("userId", userId)
                    .getSingleResult();
            return count > 0;
        } catch (Exception e) {
            logger.error("Error checking note access for user {} and note {}", userId, noteId, e);
            return false;
        }
    }
    
    /**
     * Get user preferences
     */
    public Map<String, Object> getUserPreferences(Long userId) {
        Optional<User> user = findById(userId);
        if (user.isPresent() && user.get().getPreferences() != null) {
            return new HashMap<>(user.get().getPreferences());
        }
        return new HashMap<>();
    }
    
    /**
     * Update user preferences
     */
    public void updateUserPreferences(Long userId, Map<String, Object> preferences) {
        Optional<User> userOpt = findById(userId);
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            
            // Initialize preferences if null
            if (user.getPreferences() == null) {
                user.setPreferences(new HashMap<>());
            }
            
            // Convert Object values to String (JSON serialization can be added here)
            Map<String, String> stringPreferences = new HashMap<>();
            for (Map.Entry<String, Object> entry : preferences.entrySet()) {
                stringPreferences.put(entry.getKey(), entry.getValue() != null ? entry.getValue().toString() : null);
            }
            
            // Update preferences
            user.getPreferences().putAll(stringPreferences);
            user.setUpdatedAt(LocalDateTime.now());
            
            entityManager.merge(user);
            entityManager.flush();
            
            // Publish event
            eventBus.publishAsync(new UserEvent.UserPreferencesUpdated(user, preferences));
            
            logger.debug("Updated preferences for user {}: {}", userId, preferences.keySet());
        }
    }
    
    /**
     * Record user login
     */
    public void recordLogin(Long userId, String sessionId, String ipAddress) {
        Optional<User> userOpt = findById(userId);
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            
            user.setLastLoginAt(LocalDateTime.now());
            entityManager.merge(user);
            
            // Publish event
            eventBus.publishAsync(new UserEvent.UserLoggedIn(user, sessionId, ipAddress));
            
            logger.debug("User login recorded: {} from {}", userId, ipAddress);
        }
    }
    
    /**
     * Record user logout
     */
    public void recordLogout(Long userId, String sessionId) {
        Optional<User> userOpt = findById(userId);
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            
            // Publish event
            eventBus.publishAsync(new UserEvent.UserLoggedOut(user, sessionId));
            
            logger.debug("User logout recorded: {}", userId);
        }
    }
    
    /**
     * Get all users (with pagination)
     */
    @SuppressWarnings("unchecked")
    public List<User> findAll(int page, int size) {
        String jpql = "SELECT u FROM User u ORDER BY u.createdAt DESC";
        return entityManager.createQuery(jpql)
                .setFirstResult(page * size)
                .setMaxResults(size)
                .getResultList();
    }
    
    /**
     * Count total users
     */
    public long count() {
        String jpql = "SELECT COUNT(u) FROM User u";
        return (Long) entityManager.createQuery(jpql).getSingleResult();
    }
    
    /**
     * Search users by criteria
     */
    @SuppressWarnings("unchecked")
    public List<User> searchUsers(String query, int limit, int offset) {
        String jpql = "SELECT u FROM User u WHERE " +
                     "LOWER(u.username) LIKE :query OR " +
                     "LOWER(u.firstName) LIKE :query OR " +
                     "LOWER(u.lastName) LIKE :query OR " +
                     "LOWER(u.email) LIKE :query " +
                     "ORDER BY u.createdAt DESC";
        
        return entityManager.createQuery(jpql)
                .setParameter("query", "%" + query.toLowerCase() + "%")
                .setFirstResult(offset)
                .setMaxResults(limit)
                .getResultList();
    }
}
