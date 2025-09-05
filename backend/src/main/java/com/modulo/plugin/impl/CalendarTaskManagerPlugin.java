package com.modulo.plugin.impl;

import com.modulo.plugin.api.Plugin;
import com.modulo.plugin.api.PluginInfo;
import com.modulo.plugin.api.PluginException;
import com.modulo.plugin.api.PluginType;
import com.modulo.plugin.api.HealthCheck;
import com.modulo.plugin.api.NotePluginAPI;
import com.modulo.service.TaskService;
import com.modulo.service.GoogleCalendarService;
import com.modulo.entity.Task;
import com.modulo.entity.Note;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.*;
import java.time.LocalDateTime;

/**
 * Calendar & Task Manager Plugin
 * Provides task management capabilities with Google Calendar integration
 */
@Component
public class CalendarTaskManagerPlugin implements Plugin {
    
    private static final Logger logger = LoggerFactory.getLogger(CalendarTaskManagerPlugin.class);
    
    @Autowired
    private TaskService taskService;
    
    @Autowired
    private GoogleCalendarService googleCalendarService;
    
    @Autowired
    private NotePluginAPI notePluginAPI;
    
    private boolean initialized = false;
    private boolean started = false;
    private Map<String, Object> configuration = new HashMap<>();
    
    private static final String PLUGIN_ID = "calendar-task-manager";
    private static final String PLUGIN_NAME = "Calendar & Task Manager";
    private static final String PLUGIN_VERSION = "1.0.0";
    private static final String PLUGIN_DESCRIPTION = "Task management with Google Calendar integration and note linking capabilities";
    private static final String PLUGIN_AUTHOR = "Modulo Team";
    
    @Override
    public PluginInfo getInfo() {
        return new PluginInfo(
            PLUGIN_ID,
            PLUGIN_NAME,
            PLUGIN_VERSION,
            PLUGIN_DESCRIPTION,
            PLUGIN_AUTHOR,
            PluginType.TASK_MANAGER,
            Arrays.asList("task-management", "calendar-integration", "note-linking")
        );
    }
    
    @Override
    public void initialize(Map<String, Object> config) throws PluginException {
        try {
            logger.info("Initializing Calendar & Task Manager Plugin...");
            
            this.configuration = new HashMap<>(config);
            
            // Validate required dependencies
            if (taskService == null) {
                throw new PluginException("TaskService dependency not available");
            }
            
            if (notePluginAPI == null) {
                throw new PluginException("NotePluginAPI dependency not available");
            }
            
            // Initialize Google Calendar integration if configured
            boolean googleCalendarEnabled = Boolean.parseBoolean(
                config.getOrDefault("googleCalendarEnabled", "false").toString()
            );
            
            if (googleCalendarEnabled && googleCalendarService == null) {
                logger.warn("Google Calendar integration enabled but GoogleCalendarService not available");
            }
            
            this.initialized = true;
            logger.info("Calendar & Task Manager Plugin initialized successfully");
            
        } catch (Exception e) {
            logger.error("Failed to initialize Calendar & Task Manager Plugin", e);
            throw new PluginException("Initialization failed: " + e.getMessage(), e);
        }
    }
    
    @Override
    public void start() throws PluginException {
        try {
            if (!initialized) {
                throw new PluginException("Plugin not initialized");
            }
            
            logger.info("Starting Calendar & Task Manager Plugin...");
            
            // Start any background services if needed
            scheduleRecurringTaskProcessing();
            scheduleCalendarSync();
            
            this.started = true;
            logger.info("Calendar & Task Manager Plugin started successfully");
            
        } catch (Exception e) {
            logger.error("Failed to start Calendar & Task Manager Plugin", e);
            throw new PluginException("Start failed: " + e.getMessage(), e);
        }
    }
    
    @Override
    public void stop() throws PluginException {
        try {
            logger.info("Stopping Calendar & Task Manager Plugin...");
            
            // Stop any background services
            
            this.started = false;
            logger.info("Calendar & Task Manager Plugin stopped successfully");
            
        } catch (Exception e) {
            logger.error("Failed to stop Calendar & Task Manager Plugin", e);
            throw new PluginException("Stop failed: " + e.getMessage(), e);
        }
    }
    
    @Override
    public HealthCheck healthCheck() {
        HealthCheck.Builder builder = new HealthCheck.Builder(PLUGIN_NAME);
        
        try {
            if (!initialized) {
                return builder.status(HealthCheck.Status.DOWN)
                             .message("Plugin not initialized")
                             .build();
            }
            
            if (!started) {
                return builder.status(HealthCheck.Status.DOWN)
                             .message("Plugin not started")
                             .build();
            }
            
            // Check TaskService health
            if (taskService == null) {
                return builder.status(HealthCheck.Status.DOWN)
                             .message("TaskService unavailable")
                             .build();
            }
            
            // Check if we can access a test user's tasks (using userId 1 as test)
            try {
                taskService.findByUserId(1L);
            } catch (Exception e) {
                return builder.status(HealthCheck.Status.DOWN)
                             .message("TaskService not responding: " + e.getMessage())
                             .build();
            }
            
            // Check Google Calendar integration if enabled
            boolean googleCalendarEnabled = Boolean.parseBoolean(
                configuration.getOrDefault("googleCalendarEnabled", "false").toString()
            );
            
            if (googleCalendarEnabled) {
                if (googleCalendarService == null) {
                    return builder.status(HealthCheck.Status.WARNING)
                                 .message("Google Calendar enabled but service unavailable")
                                 .build();
                }
                // Could add more Google Calendar health checks here
            }
            
            return builder.status(HealthCheck.Status.UP)
                         .message("All systems operational")
                         .build();
            
        } catch (Exception e) {
            logger.error("Health check failed", e);
            return builder.status(HealthCheck.Status.DOWN)
                         .message("Health check failed: " + e.getMessage())
                         .build();
        }
    }
    
    @Override
    public List<String> getCapabilities() {
        return Arrays.asList(
            "CREATE_TASK",
            "UPDATE_TASK",
            "DELETE_TASK",
            "LINK_TASK_TO_NOTE",
            "UNLINK_TASK_FROM_NOTE",
            "SEARCH_TASKS",
            "TASK_STATISTICS",
            "GOOGLE_CALENDAR_SYNC",
            "RECURRING_TASKS",
            "SUBTASKS",
            "TASK_PROGRESS_TRACKING",
            "OVERDUE_TASK_DETECTION",
            "TASK_NOTIFICATIONS"
        );
    }
    
    // Plugin-specific task management methods
    
    /**
     * Create a task and optionally link it to a note
     */
    public Task createTaskWithNoteLink(Task task, Long noteId) throws PluginException {
        try {
            Task savedTask = taskService.createTask(task);
            
            if (noteId != null) {
                taskService.linkTaskToNote(savedTask.getId(), noteId);
            }
            
            // Sync to Google Calendar if enabled
            syncTaskToGoogleCalendar(savedTask);
            
            return savedTask;
            
        } catch (Exception e) {
            throw new PluginException("Failed to create task: " + e.getMessage(), e);
        }
    }
    
    /**
     * Get tasks linked to a note with additional filtering
     */
    public List<Task> getTasksForNote(Long noteId, Map<String, Object> filters) throws PluginException {
        try {
            List<Task> tasks = taskService.findTasksLinkedToNote(noteId);
            
            // Apply filters if provided
            if (filters != null) {
                tasks = filterTasks(tasks, filters);
            }
            
            return tasks;
            
        } catch (Exception e) {
            throw new PluginException("Failed to get tasks for note: " + e.getMessage(), e);
        }
    }
    
    /**
     * Get task dashboard for a user
     */
    public Map<String, Object> getTaskDashboard(Long userId) throws PluginException {
        try {
            Map<String, Object> dashboard = new HashMap<>();
            
            // Get statistics
            TaskService.TaskStatistics stats = taskService.getTaskStatistics(userId);
            dashboard.put("statistics", stats);
            
            // Get overdue tasks
            List<Task> overdueTasks = taskService.findOverdueTasksByUserId(userId);
            dashboard.put("overdueTasks", overdueTasks);
            
            // Get tasks due today
            List<Task> dueTodayTasks = taskService.findTasksDueTodayByUserId(userId);
            dashboard.put("dueTodayTasks", dueTodayTasks);
            
            // Get high priority tasks
            List<Task> highPriorityTasks = taskService.findHighPriorityIncompleteTasks(userId);
            dashboard.put("highPriorityTasks", highPriorityTasks);
            
            // Get recently completed tasks
            List<Task> recentlyCompleted = taskService.findRecentlyCompletedTasks(userId, 7);
            dashboard.put("recentlyCompletedTasks", recentlyCompleted);
            
            return dashboard;
            
        } catch (Exception e) {
            throw new PluginException("Failed to get task dashboard: " + e.getMessage(), e);
        }
    }
    
    /**
     * Suggest tasks based on note content
     */
    public List<Task> suggestTasksFromNote(Long noteId) throws PluginException {
        try {
            Optional<Note> noteOpt = notePluginAPI.findById(noteId);
            if (noteOpt.isEmpty()) {
                throw new PluginException("Note not found");
            }
            
            Note note = noteOpt.get();
            List<Task> suggestedTasks = new ArrayList<>();
            
            // Simple task extraction from note content
            String content = note.getContent();
            if (content != null) {
                // Look for TODO patterns
                String[] lines = content.split("\n");
                for (String line : lines) {
                    line = line.trim();
                    if (line.startsWith("- [ ]") || line.startsWith("* [ ]") || 
                        line.toLowerCase().contains("todo:") || 
                        line.toLowerCase().contains("task:")) {
                        
                        String taskTitle = extractTaskTitle(line);
                        if (!taskTitle.isEmpty()) {
                            Task suggestedTask = new Task(taskTitle, "Extracted from note: " + note.getTitle(), note.getUserId());
                            suggestedTasks.add(suggestedTask);
                        }
                    }
                }
            }
            
            return suggestedTasks;
            
        } catch (Exception e) {
            throw new PluginException("Failed to suggest tasks from note: " + e.getMessage(), e);
        }
    }
    
    // Private helper methods
    
    private void scheduleRecurringTaskProcessing() {
        // TODO: Implement recurring task processing
        logger.info("Recurring task processing scheduled");
    }
    
    private void scheduleCalendarSync() {
        // TODO: Implement calendar synchronization scheduling
        logger.info("Calendar sync scheduled");
    }
    
    private void syncTaskToGoogleCalendar(Task task) {
        try {
            boolean googleCalendarEnabled = Boolean.parseBoolean(
                configuration.getOrDefault("googleCalendarEnabled", "false").toString()
            );
            
            if (googleCalendarEnabled && googleCalendarService != null && task.getDueDate() != null) {
                String eventId = googleCalendarService.createEvent(task);
                if (eventId != null) {
                    taskService.setGoogleCalendarEventId(task.getId(), eventId);
                    logger.info("Task {} synced to Google Calendar with event ID: {}", task.getId(), eventId);
                }
            }
        } catch (Exception e) {
            logger.warn("Failed to sync task {} to Google Calendar: {}", task.getId(), e.getMessage());
        }
    }
    
    private List<Task> filterTasks(List<Task> tasks, Map<String, Object> filters) {
        return tasks.stream()
            .filter(task -> {
                // Apply status filter
                if (filters.containsKey("status")) {
                    Task.TaskStatus status = Task.TaskStatus.valueOf(filters.get("status").toString());
                    if (task.getStatus() != status) return false;
                }
                
                // Apply priority filter
                if (filters.containsKey("priority")) {
                    Task.TaskPriority priority = Task.TaskPriority.valueOf(filters.get("priority").toString());
                    if (task.getPriority() != priority) return false;
                }
                
                // Apply date range filter
                if (filters.containsKey("startDate") && filters.containsKey("endDate")) {
                    LocalDateTime start = (LocalDateTime) filters.get("startDate");
                    LocalDateTime end = (LocalDateTime) filters.get("endDate");
                    if (task.getDueDate() != null && 
                        (task.getDueDate().isBefore(start) || task.getDueDate().isAfter(end))) {
                        return false;
                    }
                }
                
                return true;
            })
            .toList();
    }
    
    private String extractTaskTitle(String line) {
        // Remove common task markers
        line = line.replaceAll("^[\\s\\-\\*]*\\[\\s?\\]\\s*", "");
        line = line.replaceAll("^[\\s]*todo:\\s*", "");
        line = line.replaceAll("^[\\s]*task:\\s*", "");
        line = line.trim();
        
        // Return first reasonable length for task title
        if (line.length() > 100) {
            line = line.substring(0, 97) + "...";
        }
        
        return line;
    }
    
    // Getters for plugin state
    public boolean isInitialized() { return initialized; }
    public boolean isStarted() { return started; }
    public Map<String, Object> getConfiguration() { return new HashMap<>(configuration); }
}
