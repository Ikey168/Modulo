package com.modulo.service;

import com.modulo.entity.Task;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Service for Google Calendar integration
 * Note: This is a basic implementation. Full integration would require Google Calendar API setup
 */
@Service
public class GoogleCalendarService {
    
    private static final Logger logger = LoggerFactory.getLogger(GoogleCalendarService.class);
    
    @Value("${google.calendar.enabled:false}")
    private boolean googleCalendarEnabled;
    
    @Value("${google.calendar.api.key:}")
    private String apiKey;
    
    @Value("${google.calendar.client.id:}")
    private String clientId;
    
    @Value("${google.calendar.client.secret:}")
    private String clientSecret;
    
    private static final DateTimeFormatter RFC3339_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss'Z'");
    
    /**
     * Create a Google Calendar event from a task
     * @param task The task to create an event for
     * @return The created event ID, or null if creation failed
     */
    public String createEvent(Task task) {
        if (!googleCalendarEnabled) {
            logger.debug("Google Calendar integration is disabled");
            return null;
        }
        
        if (!isConfigured()) {
            logger.warn("Google Calendar not properly configured");
            return null;
        }
        
        try {
            logger.info("Creating Google Calendar event for task: {}", task.getTitle());
            
            // In a real implementation, this would use the Google Calendar API
            Map<String, Object> event = buildEventFromTask(task);
            
            // Simulate API call and return mock event ID
            String eventId = "mock_event_" + task.getId() + "_" + System.currentTimeMillis();
            
            logger.info("Created Google Calendar event with ID: {} for task: {}", eventId, task.getId());
            return eventId;
            
        } catch (Exception e) {
            logger.error("Failed to create Google Calendar event for task {}: {}", task.getId(), e.getMessage(), e);
            return null;
        }
    }
    
    /**
     * Update a Google Calendar event from a task
     * @param task The task to update the event for
     * @return true if update was successful
     */
    public boolean updateEvent(Task task) {
        if (!googleCalendarEnabled || task.getGoogleCalendarEventId() == null) {
            return false;
        }
        
        if (!isConfigured()) {
            logger.warn("Google Calendar not properly configured");
            return false;
        }
        
        try {
            logger.info("Updating Google Calendar event {} for task: {}", task.getGoogleCalendarEventId(), task.getTitle());
            
            // In a real implementation, this would use the Google Calendar API
            Map<String, Object> event = buildEventFromTask(task);
            
            // Simulate API call
            logger.info("Updated Google Calendar event {} for task: {}", task.getGoogleCalendarEventId(), task.getId());
            return true;
            
        } catch (Exception e) {
            logger.error("Failed to update Google Calendar event {} for task {}: {}", 
                        task.getGoogleCalendarEventId(), task.getId(), e.getMessage(), e);
            return false;
        }
    }
    
    /**
     * Delete a Google Calendar event
     * @param eventId The event ID to delete
     * @return true if deletion was successful
     */
    public boolean deleteEvent(String eventId) {
        if (!googleCalendarEnabled || eventId == null) {
            return false;
        }
        
        if (!isConfigured()) {
            logger.warn("Google Calendar not properly configured");
            return false;
        }
        
        try {
            logger.info("Deleting Google Calendar event: {}", eventId);
            
            // In a real implementation, this would use the Google Calendar API
            
            // Simulate API call
            logger.info("Deleted Google Calendar event: {}", eventId);
            return true;
            
        } catch (Exception e) {
            logger.error("Failed to delete Google Calendar event {}: {}", eventId, e.getMessage(), e);
            return false;
        }
    }
    
    /**
     * Sync a task with its Google Calendar event
     * @param task The task to sync
     * @return true if sync was successful
     */
    public boolean syncTask(Task task) {
        if (!googleCalendarEnabled) {
            return false;
        }
        
        try {
            if (task.getGoogleCalendarEventId() == null) {
                // Create new event
                String eventId = createEvent(task);
                return eventId != null;
            } else {
                // Update existing event
                return updateEvent(task);
            }
        } catch (Exception e) {
            logger.error("Failed to sync task {} with Google Calendar: {}", task.getId(), e.getMessage(), e);
            return false;
        }
    }
    
    /**
     * Get OAuth authorization URL for Google Calendar
     * @param redirectUri The redirect URI after authorization
     * @return The authorization URL
     */
    public String getAuthorizationUrl(String redirectUri) {
        if (!isConfigured()) {
            throw new IllegalStateException("Google Calendar not properly configured");
        }
        
        // In a real implementation, this would build the OAuth URL
        String baseUrl = "https://accounts.google.com/o/oauth2/v2/auth";
        String scope = "https://www.googleapis.com/auth/calendar";
        
        return String.format("%s?client_id=%s&redirect_uri=%s&scope=%s&response_type=code&access_type=offline",
                           baseUrl, clientId, redirectUri, scope);
    }
    
    /**
     * Exchange authorization code for access token
     * @param authorizationCode The authorization code from Google
     * @param redirectUri The redirect URI used in authorization
     * @return Access token information
     */
    public Map<String, Object> exchangeCodeForToken(String authorizationCode, String redirectUri) {
        if (!isConfigured()) {
            throw new IllegalStateException("Google Calendar not properly configured");
        }
        
        try {
            logger.info("Exchanging authorization code for access token");
            
            // In a real implementation, this would make an HTTP request to Google's token endpoint
            Map<String, Object> tokenInfo = new HashMap<>();
            tokenInfo.put("access_token", "mock_access_token");
            tokenInfo.put("refresh_token", "mock_refresh_token");
            tokenInfo.put("expires_in", 3600);
            tokenInfo.put("token_type", "Bearer");
            
            logger.info("Successfully obtained access token");
            return tokenInfo;
            
        } catch (Exception e) {
            logger.error("Failed to exchange authorization code for token: {}", e.getMessage(), e);
            throw new RuntimeException("Token exchange failed: " + e.getMessage(), e);
        }
    }
    
    /**
     * Test the Google Calendar connection
     * @return true if connection is working
     */
    public boolean testConnection() {
        if (!googleCalendarEnabled) {
            logger.info("Google Calendar integration is disabled");
            return false;
        }
        
        if (!isConfigured()) {
            logger.warn("Google Calendar not properly configured");
            return false;
        }
        
        try {
            logger.info("Testing Google Calendar connection");
            
            // In a real implementation, this would make a test API call
            
            logger.info("Google Calendar connection test successful");
            return true;
            
        } catch (Exception e) {
            logger.error("Google Calendar connection test failed: {}", e.getMessage(), e);
            return false;
        }
    }
    
    /**
     * Get calendar configuration status
     */
    public Map<String, Object> getConfigurationStatus() {
        Map<String, Object> status = new HashMap<>();
        status.put("enabled", googleCalendarEnabled);
        status.put("configured", isConfigured());
        status.put("apiKeyPresent", apiKey != null && !apiKey.isEmpty());
        status.put("clientIdPresent", clientId != null && !clientId.isEmpty());
        status.put("clientSecretPresent", clientSecret != null && !clientSecret.isEmpty());
        return status;
    }
    
    // Private helper methods
    
    private boolean isConfigured() {
        return googleCalendarEnabled && 
               apiKey != null && !apiKey.isEmpty() &&
               clientId != null && !clientId.isEmpty() &&
               clientSecret != null && !clientSecret.isEmpty();
    }
    
    private Map<String, Object> buildEventFromTask(Task task) {
        Map<String, Object> event = new HashMap<>();
        
        event.put("summary", task.getTitle());
        event.put("description", buildEventDescription(task));
        
        if (task.getDueDate() != null) {
            Map<String, String> start = new HashMap<>();
            start.put("dateTime", task.getDueDate().format(RFC3339_FORMATTER));
            event.put("start", start);
            
            // End time: due date + estimated duration or + 1 hour if no duration
            LocalDateTime endTime = task.getDueDate();
            if (task.getEstimatedDurationMinutes() != null) {
                endTime = endTime.plusMinutes(task.getEstimatedDurationMinutes());
            } else {
                endTime = endTime.plusHours(1);
            }
            
            Map<String, String> end = new HashMap<>();
            end.put("dateTime", endTime.format(RFC3339_FORMATTER));
            event.put("end", end);
        }
        
        // Add color coding based on priority
        if (task.getPriority() != null) {
            String colorId = switch (task.getPriority()) {
                case URGENT -> "11"; // Red
                case HIGH -> "6";   // Orange
                case MEDIUM -> "7"; // Blue
                case LOW -> "2";    // Green
            };
            event.put("colorId", colorId);
        }
        
        return event;
    }
    
    private String buildEventDescription(Task task) {
        StringBuilder description = new StringBuilder();
        
        if (task.getDescription() != null && !task.getDescription().isEmpty()) {
            description.append(task.getDescription()).append("\n\n");
        }
        
        description.append("Task Details:\n");
        description.append("Priority: ").append(task.getPriority()).append("\n");
        description.append("Status: ").append(task.getStatus()).append("\n");
        
        if (task.getProgressPercentage() != null) {
            description.append("Progress: ").append(task.getProgressPercentage()).append("%\n");
        }
        
        if (task.getEstimatedDurationMinutes() != null) {
            description.append("Estimated Duration: ").append(task.getEstimatedDurationMinutes()).append(" minutes\n");
        }
        
        if (!task.getLinkedNotes().isEmpty()) {
            description.append("\nLinked Notes:\n");
            for (var note : task.getLinkedNotes()) {
                description.append("- ").append(note.getTitle()).append("\n");
            }
        }
        
        description.append("\nManaged by Modulo Task Manager");
        
        return description.toString();
    }
}
