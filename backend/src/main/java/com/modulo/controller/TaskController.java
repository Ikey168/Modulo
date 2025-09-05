package com.modulo.controller;

import com.modulo.entity.Task;
import com.modulo.entity.Task.TaskStatus;
import com.modulo.entity.Task.TaskPriority;
import com.modulo.service.TaskService;
import com.modulo.service.TaskService.TaskStatistics;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * REST Controller for task operations
 */
@RestController
@RequestMapping("/api/tasks")
@CrossOrigin(origins = "*")
public class TaskController {
    
    @Autowired
    private TaskService taskService;
    
    /**
     * Get all tasks for a user
     */
    @GetMapping
    public ResponseEntity<List<Task>> getAllTasks(
            @RequestParam Long userId,
            @RequestParam(required = false) TaskStatus status,
            @RequestParam(required = false) TaskPriority priority) {
        try {
            List<Task> tasks;
            
            if (status != null) {
                tasks = taskService.findByUserIdAndStatus(userId, status);
            } else if (priority != null) {
                tasks = taskService.findByUserIdAndPriority(userId, priority);
            } else {
                tasks = taskService.findByUserId(userId);
            }
            
            return ResponseEntity.ok(tasks);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(null);
        }
    }
    
    /**
     * Get a task by ID
     */
    @GetMapping("/{id}")
    public ResponseEntity<Task> getTaskById(@PathVariable Long id) {
        try {
            Optional<Task> task = taskService.findById(id);
            return task.map(ResponseEntity::ok)
                      .orElseGet(() -> ResponseEntity.notFound().build());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(null);
        }
    }
    
    /**
     * Create a new task
     */
    @PostMapping
    public ResponseEntity<Task> createTask(@RequestBody Task task) {
        try {
            Task savedTask = taskService.createTask(task);
            return ResponseEntity.status(HttpStatus.CREATED).body(savedTask);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(null);
        }
    }
    
    /**
     * Update an existing task
     */
    @PutMapping("/{id}")
    public ResponseEntity<Task> updateTask(@PathVariable Long id, @RequestBody Task task) {
        try {
            task.setId(id);
            Task updatedTask = taskService.updateTask(task);
            return ResponseEntity.ok(updatedTask);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(null);
        }
    }
    
    /**
     * Delete a task
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> deleteTask(@PathVariable Long id) {
        try {
            taskService.deleteTask(id);
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Task deleted successfully");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("error", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
        }
    }
    
    /**
     * Mark a task as completed
     */
    @PutMapping("/{id}/complete")
    public ResponseEntity<Task> completeTask(@PathVariable Long id) {
        try {
            Task completedTask = taskService.completeTask(id);
            return ResponseEntity.ok(completedTask);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(null);
        }
    }
    
    /**
     * Update task progress
     */
    @PutMapping("/{id}/progress")
    public ResponseEntity<Task> updateProgress(@PathVariable Long id, @RequestBody Map<String, Integer> request) {
        try {
            Integer progressPercentage = request.get("progressPercentage");
            if (progressPercentage == null || progressPercentage < 0 || progressPercentage > 100) {
                return ResponseEntity.badRequest().body(null);
            }
            
            Task updatedTask = taskService.updateProgress(id, progressPercentage);
            return ResponseEntity.ok(updatedTask);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(null);
        }
    }
    
    /**
     * Get overdue tasks for a user
     */
    @GetMapping("/overdue")
    public ResponseEntity<List<Task>> getOverdueTasks(@RequestParam Long userId) {
        try {
            List<Task> tasks = taskService.findOverdueTasksByUserId(userId);
            return ResponseEntity.ok(tasks);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(null);
        }
    }
    
    /**
     * Get tasks due today for a user
     */
    @GetMapping("/due-today")
    public ResponseEntity<List<Task>> getTasksDueToday(@RequestParam Long userId) {
        try {
            List<Task> tasks = taskService.findTasksDueTodayByUserId(userId);
            return ResponseEntity.ok(tasks);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(null);
        }
    }
    
    /**
     * Get tasks due this week for a user
     */
    @GetMapping("/due-this-week")
    public ResponseEntity<List<Task>> getTasksDueThisWeek(@RequestParam Long userId) {
        try {
            List<Task> tasks = taskService.findTasksDueThisWeekByUserId(userId);
            return ResponseEntity.ok(tasks);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(null);
        }
    }
    
    /**
     * Link a task to a note
     */
    @PostMapping("/{taskId}/link-note/{noteId}")
    public ResponseEntity<Map<String, Object>> linkTaskToNote(
            @PathVariable Long taskId, 
            @PathVariable Long noteId) {
        try {
            taskService.linkTaskToNote(taskId, noteId);
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Task linked to note successfully");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("error", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
        }
    }
    
    /**
     * Unlink a task from a note
     */
    @DeleteMapping("/{taskId}/unlink-note/{noteId}")
    public ResponseEntity<Map<String, Object>> unlinkTaskFromNote(
            @PathVariable Long taskId, 
            @PathVariable Long noteId) {
        try {
            taskService.unlinkTaskFromNote(taskId, noteId);
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Task unlinked from note successfully");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("error", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
        }
    }
    
    /**
     * Get tasks linked to a specific note
     */
    @GetMapping("/note/{noteId}")
    public ResponseEntity<List<Task>> getTasksLinkedToNote(@PathVariable Long noteId) {
        try {
            List<Task> tasks = taskService.findTasksLinkedToNote(noteId);
            return ResponseEntity.ok(tasks);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(null);
        }
    }
    
    /**
     * Search tasks by text
     */
    @GetMapping("/search")
    public ResponseEntity<List<Task>> searchTasks(
            @RequestParam Long userId,
            @RequestParam String query) {
        try {
            List<Task> tasks = taskService.searchTasks(userId, query);
            return ResponseEntity.ok(tasks);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(null);
        }
    }
    
    /**
     * Get recurring tasks
     */
    @GetMapping("/recurring")
    public ResponseEntity<List<Task>> getRecurringTasks(@RequestParam Long userId) {
        try {
            List<Task> tasks = taskService.findRecurringTasks(userId);
            return ResponseEntity.ok(tasks);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(null);
        }
    }
    
    /**
     * Get subtasks for a parent task
     */
    @GetMapping("/{parentId}/subtasks")
    public ResponseEntity<List<Task>> getSubtasks(@PathVariable Long parentId) {
        try {
            List<Task> tasks = taskService.findSubtasks(parentId);
            return ResponseEntity.ok(tasks);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(null);
        }
    }
    
    /**
     * Get root tasks (no parent) for a user
     */
    @GetMapping("/root")
    public ResponseEntity<List<Task>> getRootTasks(@RequestParam Long userId) {
        try {
            List<Task> tasks = taskService.findRootTasks(userId);
            return ResponseEntity.ok(tasks);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(null);
        }
    }
    
    /**
     * Get task statistics for a user
     */
    @GetMapping("/statistics")
    public ResponseEntity<TaskStatistics> getTaskStatistics(@RequestParam Long userId) {
        try {
            TaskStatistics stats = taskService.getTaskStatistics(userId);
            return ResponseEntity.ok(stats);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(null);
        }
    }
    
    /**
     * Get tasks by date range for calendar view
     */
    @GetMapping("/calendar")
    public ResponseEntity<List<Task>> getTasksForCalendar(
            @RequestParam Long userId,
            @RequestParam String startDate,
            @RequestParam String endDate) {
        try {
            DateTimeFormatter formatter = DateTimeFormatter.ISO_LOCAL_DATE_TIME;
            LocalDateTime start = LocalDateTime.parse(startDate, formatter);
            LocalDateTime end = LocalDateTime.parse(endDate, formatter);
            
            List<Task> tasks = taskService.findTasksByDateRange(userId, start, end);
            return ResponseEntity.ok(tasks);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(null);
        }
    }
    
    /**
     * Get recently completed tasks
     */
    @GetMapping("/recently-completed")
    public ResponseEntity<List<Task>> getRecentlyCompletedTasks(
            @RequestParam Long userId,
            @RequestParam(defaultValue = "7") int days) {
        try {
            List<Task> tasks = taskService.findRecentlyCompletedTasks(userId, days);
            return ResponseEntity.ok(tasks);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(null);
        }
    }
    
    /**
     * Get high priority incomplete tasks
     */
    @GetMapping("/high-priority")
    public ResponseEntity<List<Task>> getHighPriorityTasks(@RequestParam Long userId) {
        try {
            List<Task> tasks = taskService.findHighPriorityIncompleteTasks(userId);
            return ResponseEntity.ok(tasks);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(null);
        }
    }
    
    /**
     * Get tasks by tag
     */
    @GetMapping("/tag/{tag}")
    public ResponseEntity<List<Task>> getTasksByTag(
            @RequestParam Long userId,
            @PathVariable String tag) {
        try {
            List<Task> tasks = taskService.findTasksByTag(userId, tag);
            return ResponseEntity.ok(tasks);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(null);
        }
    }
    
    /**
     * Set Google Calendar event ID for a task
     */
    @PutMapping("/{id}/google-calendar")
    public ResponseEntity<Task> setGoogleCalendarEventId(
            @PathVariable Long id,
            @RequestBody Map<String, String> request) {
        try {
            String eventId = request.get("eventId");
            Task updatedTask = taskService.setGoogleCalendarEventId(id, eventId);
            return ResponseEntity.ok(updatedTask);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(null);
        }
    }
    
    /**
     * Get task by Google Calendar event ID
     */
    @GetMapping("/google-calendar/{eventId}")
    public ResponseEntity<Task> getTaskByGoogleCalendarEventId(@PathVariable String eventId) {
        try {
            Optional<Task> task = taskService.findByGoogleCalendarEventId(eventId);
            return task.map(ResponseEntity::ok)
                      .orElseGet(() -> ResponseEntity.notFound().build());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(null);
        }
    }
}
