package com.modulo.service;

import com.modulo.entity.Task;
import com.modulo.entity.Note;
import com.modulo.entity.Task.TaskStatus;
import com.modulo.entity.Task.TaskPriority;
import com.modulo.repository.TaskRepository;
import com.modulo.repository.NoteRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;

/**
 * Service class for task operations
 */
@Service
@Transactional
public class TaskService {
    
    @Autowired
    private TaskRepository taskRepository;
    
    @Autowired
    private NoteRepository noteRepository;
    
    /**
     * Create a new task
     */
    public Task createTask(Task task) {
        task.setCreatedAt(LocalDateTime.now());
        task.setUpdatedAt(LocalDateTime.now());
        return taskRepository.save(task);
    }
    
    /**
     * Update an existing task
     */
    public Task updateTask(Task task) {
        task.setUpdatedAt(LocalDateTime.now());
        return taskRepository.save(task);
    }
    
    /**
     * Find task by ID
     */
    @Transactional(readOnly = true)
    public Optional<Task> findById(Long id) {
        return taskRepository.findById(id);
    }
    
    /**
     * Find all tasks for a user
     */
    @Transactional(readOnly = true)
    public List<Task> findByUserId(Long userId) {
        return taskRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }
    
    /**
     * Find tasks by user and status
     */
    @Transactional(readOnly = true)
    public List<Task> findByUserIdAndStatus(Long userId, TaskStatus status) {
        return taskRepository.findByUserIdAndStatusOrderByDueDateAsc(userId, status);
    }
    
    /**
     * Find tasks by user and priority
     */
    @Transactional(readOnly = true)
    public List<Task> findByUserIdAndPriority(Long userId, TaskPriority priority) {
        return taskRepository.findByUserIdAndPriorityOrderByDueDateAsc(userId, priority);
    }
    
    /**
     * Find overdue tasks for a user
     */
    @Transactional(readOnly = true)
    public List<Task> findOverdueTasksByUserId(Long userId) {
        return taskRepository.findOverdueTasksByUserId(userId, LocalDateTime.now());
    }
    
    /**
     * Find tasks due today for a user
     */
    @Transactional(readOnly = true)
    public List<Task> findTasksDueTodayByUserId(Long userId) {
        return taskRepository.findTasksDueTodayByUserId(userId, LocalDateTime.now());
    }
    
    /**
     * Find tasks due this week for a user
     */
    @Transactional(readOnly = true)
    public List<Task> findTasksDueThisWeekByUserId(Long userId) {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime startOfWeek = now.truncatedTo(ChronoUnit.DAYS).minusDays(now.getDayOfWeek().getValue() - 1);
        LocalDateTime endOfWeek = startOfWeek.plusDays(6).withHour(23).withMinute(59).withSecond(59);
        
        return taskRepository.findTasksDueThisWeekByUserId(userId, startOfWeek, endOfWeek);
    }
    
    /**
     * Mark task as completed
     */
    public Task completeTask(Long taskId) {
        Optional<Task> taskOpt = taskRepository.findById(taskId);
        if (taskOpt.isPresent()) {
            Task task = taskOpt.get();
            task.setStatus(TaskStatus.COMPLETED);
            task.setCompletionDate(LocalDateTime.now());
            task.setProgressPercentage(100);
            return taskRepository.save(task);
        }
        throw new IllegalArgumentException("Task not found with id: " + taskId);
    }
    
    /**
     * Update task progress
     */
    public Task updateProgress(Long taskId, int progressPercentage) {
        Optional<Task> taskOpt = taskRepository.findById(taskId);
        if (taskOpt.isPresent()) {
            Task task = taskOpt.get();
            task.setProgressPercentage(progressPercentage);
            
            if (progressPercentage == 100 && task.getStatus() != TaskStatus.COMPLETED) {
                task.setStatus(TaskStatus.COMPLETED);
                task.setCompletionDate(LocalDateTime.now());
            } else if (progressPercentage > 0 && task.getStatus() == TaskStatus.TODO) {
                task.setStatus(TaskStatus.IN_PROGRESS);
            }
            
            return taskRepository.save(task);
        }
        throw new IllegalArgumentException("Task not found with id: " + taskId);
    }
    
    /**
     * Delete a task
     */
    public void deleteTask(Long taskId) {
        Optional<Task> taskOpt = taskRepository.findById(taskId);
        if (taskOpt.isPresent()) {
            Task task = taskOpt.get();
            
            // Remove task links from all linked notes
            for (Note note : task.getLinkedNotes()) {
                note.removeTask(task);
            }
            task.getLinkedNotes().clear();
            
            taskRepository.delete(task);
        } else {
            throw new IllegalArgumentException("Task not found with id: " + taskId);
        }
    }
    
    /**
     * Link a task to a note
     */
    public void linkTaskToNote(Long taskId, Long noteId) {
        Optional<Task> taskOpt = taskRepository.findById(taskId);
        Optional<Note> noteOpt = noteRepository.findById(noteId);
        
        if (taskOpt.isPresent() && noteOpt.isPresent()) {
            Task task = taskOpt.get();
            Note note = noteOpt.get();
            
            note.addTask(task);
            noteRepository.save(note);
            taskRepository.save(task);
        } else {
            throw new IllegalArgumentException("Task or Note not found");
        }
    }
    
    /**
     * Unlink a task from a note
     */
    public void unlinkTaskFromNote(Long taskId, Long noteId) {
        Optional<Task> taskOpt = taskRepository.findById(taskId);
        Optional<Note> noteOpt = noteRepository.findById(noteId);
        
        if (taskOpt.isPresent() && noteOpt.isPresent()) {
            Task task = taskOpt.get();
            Note note = noteOpt.get();
            
            note.removeTask(task);
            noteRepository.save(note);
            taskRepository.save(task);
        } else {
            throw new IllegalArgumentException("Task or Note not found");
        }
    }
    
    /**
     * Find tasks linked to a specific note
     */
    @Transactional(readOnly = true)
    public List<Task> findTasksLinkedToNote(Long noteId) {
        return taskRepository.findByLinkedNoteId(noteId);
    }
    
    /**
     * Search tasks by text
     */
    @Transactional(readOnly = true)
    public List<Task> searchTasks(Long userId, String searchText) {
        return taskRepository.findByUserIdAndTitleOrDescriptionContaining(userId, searchText);
    }
    
    /**
     * Find recurring tasks for a user
     */
    @Transactional(readOnly = true)
    public List<Task> findRecurringTasks(Long userId) {
        return taskRepository.findByUserIdAndIsRecurringTrue(userId);
    }
    
    /**
     * Find subtasks for a parent task
     */
    @Transactional(readOnly = true)
    public List<Task> findSubtasks(Long parentTaskId) {
        return taskRepository.findByParentTaskIdOrderByCreatedAtAsc(parentTaskId);
    }
    
    /**
     * Find root tasks (no parent) for a user
     */
    @Transactional(readOnly = true)
    public List<Task> findRootTasks(Long userId) {
        return taskRepository.findByUserIdAndParentTaskIdIsNullOrderByCreatedAtDesc(userId);
    }
    
    /**
     * Get task statistics for a user
     */
    @Transactional(readOnly = true)
    public TaskStatistics getTaskStatistics(Long userId) {
        TaskStatistics stats = new TaskStatistics();
        stats.setTotalTasks(taskRepository.countByUserIdAndStatus(userId, null));
        stats.setCompletedTasks(taskRepository.countByUserIdAndStatus(userId, TaskStatus.COMPLETED));
        stats.setInProgressTasks(taskRepository.countByUserIdAndStatus(userId, TaskStatus.IN_PROGRESS));
        stats.setTodoTasks(taskRepository.countByUserIdAndStatus(userId, TaskStatus.TODO));
        stats.setOverdueTasks(taskRepository.countOverdueTasksByUserId(userId, LocalDateTime.now()));
        return stats;
    }
    
    /**
     * Find tasks by date range for calendar view
     */
    @Transactional(readOnly = true)
    public List<Task> findTasksByDateRange(Long userId, LocalDateTime startDate, LocalDateTime endDate) {
        return taskRepository.findTasksByDateRange(userId, startDate, endDate);
    }
    
    /**
     * Find recently completed tasks
     */
    @Transactional(readOnly = true)
    public List<Task> findRecentlyCompletedTasks(Long userId, int days) {
        LocalDateTime since = LocalDateTime.now().minusDays(days);
        return taskRepository.findRecentlyCompletedTasks(userId, since);
    }
    
    /**
     * Find high priority incomplete tasks
     */
    @Transactional(readOnly = true)
    public List<Task> findHighPriorityIncompleteTasks(Long userId) {
        return taskRepository.findHighPriorityIncompleteTasks(userId);
    }
    
    /**
     * Find tasks by tag
     */
    @Transactional(readOnly = true)
    public List<Task> findTasksByTag(Long userId, String tag) {
        return taskRepository.findByUserIdAndTagsContaining(userId, tag);
    }
    
    /**
     * Set Google Calendar event ID for a task
     */
    public Task setGoogleCalendarEventId(Long taskId, String eventId) {
        Optional<Task> taskOpt = taskRepository.findById(taskId);
        if (taskOpt.isPresent()) {
            Task task = taskOpt.get();
            task.setGoogleCalendarEventId(eventId);
            return taskRepository.save(task);
        }
        throw new IllegalArgumentException("Task not found with id: " + taskId);
    }
    
    /**
     * Find task by Google Calendar event ID
     */
    @Transactional(readOnly = true)
    public Optional<Task> findByGoogleCalendarEventId(String eventId) {
        return taskRepository.findByGoogleCalendarEventId(eventId);
    }
    
    /**
     * Task statistics inner class
     */
    public static class TaskStatistics {
        private long totalTasks;
        private long completedTasks;
        private long inProgressTasks;
        private long todoTasks;
        private long overdueTasks;
        
        // Getters and setters
        public long getTotalTasks() { return totalTasks; }
        public void setTotalTasks(long totalTasks) { this.totalTasks = totalTasks; }
        
        public long getCompletedTasks() { return completedTasks; }
        public void setCompletedTasks(long completedTasks) { this.completedTasks = completedTasks; }
        
        public long getInProgressTasks() { return inProgressTasks; }
        public void setInProgressTasks(long inProgressTasks) { this.inProgressTasks = inProgressTasks; }
        
        public long getTodoTasks() { return todoTasks; }
        public void setTodoTasks(long todoTasks) { this.todoTasks = todoTasks; }
        
        public long getOverdueTasks() { return overdueTasks; }
        public void setOverdueTasks(long overdueTasks) { this.overdueTasks = overdueTasks; }
    }
}
