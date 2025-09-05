package com.modulo.entity;

import javax.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Entity representing a task that can be linked to notes
 */
@Entity
@Table(name = "tasks")
public class Task {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false)
    private String title;
    
    @Column(length = 2000)
    private String description;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TaskStatus status = TaskStatus.TODO;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TaskPriority priority = TaskPriority.MEDIUM;
    
    @Column(name = "due_date")
    private LocalDateTime dueDate;
    
    @Column(name = "start_date")
    private LocalDateTime startDate;
    
    @Column(name = "completion_date")
    private LocalDateTime completionDate;
    
    @Column(name = "estimated_duration")
    private Integer estimatedDurationMinutes;
    
    @Column(name = "actual_duration")
    private Integer actualDurationMinutes;
    
    @Column(name = "google_calendar_event_id")
    private String googleCalendarEventId;
    
    @ManyToMany(mappedBy = "tasks", fetch = FetchType.LAZY)
    private List<Note> linkedNotes = new ArrayList<>();
    
    @Column(name = "user_id", nullable = false)
    private Long userId;
    
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
    
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();
    
    // Tags as JSON array or comma-separated string
    @Column(name = "tags")
    private String tags;
    
    @Column(name = "is_recurring")
    private Boolean isRecurring = false;
    
    @Column(name = "recurrence_pattern")
    private String recurrencePattern; // JSON string for complex recurrence
    
    @Column(name = "parent_task_id")
    private Long parentTaskId;
    
    @Column(name = "progress_percentage")
    private Integer progressPercentage = 0;
    
    public enum TaskStatus {
        TODO,
        IN_PROGRESS,
        BLOCKED,
        COMPLETED,
        CANCELLED,
        ON_HOLD
    }
    
    public enum TaskPriority {
        LOW,
        MEDIUM,
        HIGH,
        URGENT
    }
    
    // Constructors
    public Task() {}
    
    public Task(String title, String description, Long userId) {
        this.title = title;
        this.description = description;
        this.userId = userId;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }
    
    // Getters and Setters
    public Long getId() {
        return id;
    }
    
    public void setId(Long id) {
        this.id = id;
    }
    
    public String getTitle() {
        return title;
    }
    
    public void setTitle(String title) {
        this.title = title;
        this.updatedAt = LocalDateTime.now();
    }
    
    public String getDescription() {
        return description;
    }
    
    public void setDescription(String description) {
        this.description = description;
        this.updatedAt = LocalDateTime.now();
    }
    
    public TaskStatus getStatus() {
        return status;
    }
    
    public void setStatus(TaskStatus status) {
        this.status = status;
        if (status == TaskStatus.COMPLETED && this.completionDate == null) {
            this.completionDate = LocalDateTime.now();
        }
        this.updatedAt = LocalDateTime.now();
    }
    
    public TaskPriority getPriority() {
        return priority;
    }
    
    public void setPriority(TaskPriority priority) {
        this.priority = priority;
        this.updatedAt = LocalDateTime.now();
    }
    
    public LocalDateTime getDueDate() {
        return dueDate;
    }
    
    public void setDueDate(LocalDateTime dueDate) {
        this.dueDate = dueDate;
        this.updatedAt = LocalDateTime.now();
    }
    
    public LocalDateTime getStartDate() {
        return startDate;
    }
    
    public void setStartDate(LocalDateTime startDate) {
        this.startDate = startDate;
        this.updatedAt = LocalDateTime.now();
    }
    
    public LocalDateTime getCompletionDate() {
        return completionDate;
    }
    
    public void setCompletionDate(LocalDateTime completionDate) {
        this.completionDate = completionDate;
        this.updatedAt = LocalDateTime.now();
    }
    
    public Integer getEstimatedDurationMinutes() {
        return estimatedDurationMinutes;
    }
    
    public void setEstimatedDurationMinutes(Integer estimatedDurationMinutes) {
        this.estimatedDurationMinutes = estimatedDurationMinutes;
        this.updatedAt = LocalDateTime.now();
    }
    
    public Integer getActualDurationMinutes() {
        return actualDurationMinutes;
    }
    
    public void setActualDurationMinutes(Integer actualDurationMinutes) {
        this.actualDurationMinutes = actualDurationMinutes;
        this.updatedAt = LocalDateTime.now();
    }
    
    public String getGoogleCalendarEventId() {
        return googleCalendarEventId;
    }
    
    public void setGoogleCalendarEventId(String googleCalendarEventId) {
        this.googleCalendarEventId = googleCalendarEventId;
        this.updatedAt = LocalDateTime.now();
    }
    
    public List<Note> getLinkedNotes() {
        return linkedNotes;
    }
    
    public void setLinkedNotes(List<Note> linkedNotes) {
        this.linkedNotes = linkedNotes;
    }
    
    public Long getUserId() {
        return userId;
    }
    
    public void setUserId(Long userId) {
        this.userId = userId;
    }
    
    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
    
    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
    
    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
    
    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
    
    public String getTags() {
        return tags;
    }
    
    public void setTags(String tags) {
        this.tags = tags;
        this.updatedAt = LocalDateTime.now();
    }
    
    public Boolean getIsRecurring() {
        return isRecurring;
    }
    
    public void setIsRecurring(Boolean isRecurring) {
        this.isRecurring = isRecurring;
        this.updatedAt = LocalDateTime.now();
    }
    
    public String getRecurrencePattern() {
        return recurrencePattern;
    }
    
    public void setRecurrencePattern(String recurrencePattern) {
        this.recurrencePattern = recurrencePattern;
        this.updatedAt = LocalDateTime.now();
    }
    
    public Long getParentTaskId() {
        return parentTaskId;
    }
    
    public void setParentTaskId(Long parentTaskId) {
        this.parentTaskId = parentTaskId;
        this.updatedAt = LocalDateTime.now();
    }
    
    public Integer getProgressPercentage() {
        return progressPercentage;
    }
    
    public void setProgressPercentage(Integer progressPercentage) {
        this.progressPercentage = Math.max(0, Math.min(100, progressPercentage));
        this.updatedAt = LocalDateTime.now();
    }
    
    // Helper methods
    public boolean isCompleted() {
        return status == TaskStatus.COMPLETED;
    }
    
    public boolean isOverdue() {
        return dueDate != null && !isCompleted() && LocalDateTime.now().isAfter(dueDate);
    }
    
    public boolean isDueToday() {
        if (dueDate == null) return false;
        LocalDateTime now = LocalDateTime.now();
        return dueDate.toLocalDate().equals(now.toLocalDate());
    }
    
    public void linkNote(Note note) {
        if (!linkedNotes.contains(note)) {
            linkedNotes.add(note);
            note.getTasks().add(this);
        }
    }
    
    public void unlinkNote(Note note) {
        linkedNotes.remove(note);
        note.getTasks().remove(this);
    }
    
    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
    
    @Override
    public String toString() {
        return "Task{" +
                "id=" + id +
                ", title='" + title + '\'' +
                ", status=" + status +
                ", priority=" + priority +
                ", dueDate=" + dueDate +
                ", userId=" + userId +
                '}';
    }
}
