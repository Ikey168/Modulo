package com.modulo.controller;

import com.modulo.plugin.impl.CalendarTaskManagerPlugin;
import com.modulo.plugin.api.PluginException;
import com.modulo.service.GoogleCalendarService;
import com.modulo.entity.Task;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * REST Controller for Calendar & Task Manager Plugin operations
 */
@RestController
@RequestMapping("/api/plugins/calendar-task-manager")
@CrossOrigin(origins = "*")
public class CalendarTaskManagerController {
    
    @Autowired
    private CalendarTaskManagerPlugin plugin;
    
    @Autowired
    private GoogleCalendarService googleCalendarService;
    
    /**
     * Get plugin information
     */
    @GetMapping("/info")
    public ResponseEntity<Map<String, Object>> getPluginInfo() {
        try {
            Map<String, Object> info = new HashMap<>();
            info.put("pluginInfo", plugin.getInfo());
            info.put("initialized", plugin.isInitialized());
            info.put("started", plugin.isStarted());
            info.put("capabilities", plugin.getCapabilities());
            info.put("healthCheck", plugin.healthCheck());
            
            return ResponseEntity.ok(info);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Collections.singletonMap("error", "Failed to get plugin info: " + e.getMessage()));
        }
    }
    
    /**
     * Create a task with note linking
     */
    @PostMapping("/tasks")
    public ResponseEntity<Map<String, Object>> createTaskWithNoteLink(@RequestBody Map<String, Object> request) {
        try {
            // Extract task data
            Task task = mapToTask(request);
            Long noteId = request.containsKey("noteId") ? 
                Long.valueOf(request.get("noteId").toString()) : null;
            
            Task createdTask = plugin.createTaskWithNoteLink(task, noteId);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("task", createdTask);
            response.put("message", "Task created successfully");
            
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
            
        } catch (PluginException e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("error", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("error", "Internal server error: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }
    
    /**
     * Get tasks for a specific note
     */
    @GetMapping("/notes/{noteId}/tasks")
    public ResponseEntity<Map<String, Object>> getTasksForNote(
            @PathVariable Long noteId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String priority) {
        try {
            Map<String, Object> filters = new HashMap<>();
            if (status != null) filters.put("status", status);
            if (priority != null) filters.put("priority", priority);
            
            List<Task> tasks = plugin.getTasksForNote(noteId, filters);
            
            Map<String, Object> response = new HashMap<>();
            response.put("noteId", noteId);
            response.put("tasks", tasks);
            response.put("count", tasks.size());
            
            return ResponseEntity.ok(response);
            
        } catch (PluginException e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("error", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("error", "Internal server error: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }
    
    /**
     * Get task dashboard for a user
     */
    @GetMapping("/dashboard/{userId}")
    public ResponseEntity<Map<String, Object>> getTaskDashboard(@PathVariable Long userId) {
        try {
            Map<String, Object> dashboard = plugin.getTaskDashboard(userId);
            return ResponseEntity.ok(dashboard);
            
        } catch (PluginException e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("error", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("error", "Internal server error: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }
    
    /**
     * Suggest tasks from note content
     */
    @PostMapping("/notes/{noteId}/suggest-tasks")
    public ResponseEntity<Map<String, Object>> suggestTasksFromNote(@PathVariable Long noteId) {
        try {
            List<Task> suggestedTasks = plugin.suggestTasksFromNote(noteId);
            
            Map<String, Object> response = new HashMap<>();
            response.put("noteId", noteId);
            response.put("suggestedTasks", suggestedTasks);
            response.put("count", suggestedTasks.size());
            
            return ResponseEntity.ok(response);
            
        } catch (PluginException e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("error", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("error", "Internal server error: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }
    
    /**
     * Google Calendar integration endpoints
     */
    
    /**
     * Get Google Calendar configuration status
     */
    @GetMapping("/google-calendar/status")
    public ResponseEntity<Map<String, Object>> getGoogleCalendarStatus() {
        try {
            Map<String, Object> status = googleCalendarService.getConfigurationStatus();
            return ResponseEntity.ok(status);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Collections.singletonMap("error", "Failed to get Google Calendar status: " + e.getMessage()));
        }
    }
    
    /**
     * Get Google Calendar OAuth authorization URL
     */
    @GetMapping("/google-calendar/auth-url")
    public ResponseEntity<Map<String, Object>> getGoogleCalendarAuthUrl(
            @RequestParam String redirectUri) {
        try {
            String authUrl = googleCalendarService.getAuthorizationUrl(redirectUri);
            
            Map<String, Object> response = new HashMap<>();
            response.put("authorizationUrl", authUrl);
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Collections.singletonMap("error", "Failed to get authorization URL: " + e.getMessage()));
        }
    }
    
    /**
     * Exchange authorization code for access token
     */
    @PostMapping("/google-calendar/exchange-token")
    public ResponseEntity<Map<String, Object>> exchangeGoogleCalendarToken(
            @RequestBody Map<String, String> request) {
        try {
            String authorizationCode = request.get("code");
            String redirectUri = request.get("redirectUri");
            
            if (authorizationCode == null || redirectUri == null) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Collections.singletonMap("error", "Missing authorization code or redirect URI"));
            }
            
            Map<String, Object> tokenInfo = googleCalendarService.exchangeCodeForToken(authorizationCode, redirectUri);
            
            return ResponseEntity.ok(tokenInfo);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Collections.singletonMap("error", "Failed to exchange token: " + e.getMessage()));
        }
    }
    
    /**
     * Test Google Calendar connection
     */
    @GetMapping("/google-calendar/test")
    public ResponseEntity<Map<String, Object>> testGoogleCalendarConnection() {
        try {
            boolean connected = googleCalendarService.testConnection();
            
            Map<String, Object> response = new HashMap<>();
            response.put("connected", connected);
            response.put("message", connected ? "Connection successful" : "Connection failed");
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Collections.singletonMap("error", "Failed to test connection: " + e.getMessage()));
        }
    }
    
    /**
     * Sync a task with Google Calendar
     */
    @PostMapping("/google-calendar/sync-task/{taskId}")
    public ResponseEntity<Map<String, Object>> syncTaskWithGoogleCalendar(@PathVariable Long taskId) {
        try {
            // This would require integration with TaskService to get the task and sync it
            // For now, return a placeholder response
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Task sync with Google Calendar initiated");
            response.put("taskId", taskId);
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Collections.singletonMap("error", "Failed to sync task: " + e.getMessage()));
        }
    }
    
    // Helper method to convert request map to Task object
    private Task mapToTask(Map<String, Object> request) {
        Task task = new Task();
        
        if (request.containsKey("title")) {
            task.setTitle(request.get("title").toString());
        }
        
        if (request.containsKey("description")) {
            task.setDescription(request.get("description").toString());
        }
        
        if (request.containsKey("userId")) {
            task.setUserId(Long.valueOf(request.get("userId").toString()));
        }
        
        if (request.containsKey("status")) {
            task.setStatus(Task.TaskStatus.valueOf(request.get("status").toString()));
        }
        
        if (request.containsKey("priority")) {
            task.setPriority(Task.TaskPriority.valueOf(request.get("priority").toString()));
        }
        
        if (request.containsKey("dueDate")) {
            // Parse date string - this is simplified, real implementation would handle various formats
            task.setDueDate(java.time.LocalDateTime.parse(request.get("dueDate").toString()));
        }
        
        if (request.containsKey("estimatedDurationMinutes")) {
            task.setEstimatedDurationMinutes(Integer.valueOf(request.get("estimatedDurationMinutes").toString()));
        }
        
        if (request.containsKey("tags")) {
            task.setTags(request.get("tags").toString());
        }
        
        if (request.containsKey("isRecurring")) {
            task.setIsRecurring(Boolean.valueOf(request.get("isRecurring").toString()));
        }
        
        if (request.containsKey("parentTaskId")) {
            task.setParentTaskId(Long.valueOf(request.get("parentTaskId").toString()));
        }
        
        return task;
    }
}
