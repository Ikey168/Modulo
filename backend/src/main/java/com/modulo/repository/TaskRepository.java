package com.modulo.repository;

import com.modulo.entity.Task;
import com.modulo.entity.Task.TaskStatus;
import com.modulo.entity.Task.TaskPriority;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Repository interface for Task entity operations
 */
@Repository
public interface TaskRepository extends JpaRepository<Task, Long> {
    
    /**
     * Find all tasks for a specific user
     */
    List<Task> findByUserIdOrderByCreatedAtDesc(Long userId);
    
    /**
     * Find tasks by user and status
     */
    List<Task> findByUserIdAndStatusOrderByDueDateAsc(Long userId, TaskStatus status);
    
    /**
     * Find tasks by user and priority
     */
    List<Task> findByUserIdAndPriorityOrderByDueDateAsc(Long userId, TaskPriority priority);
    
    /**
     * Find overdue tasks for a user
     */
    @Query("SELECT t FROM Task t WHERE t.userId = :userId AND t.dueDate < :now AND t.status != 'COMPLETED' AND t.status != 'CANCELLED'")
    List<Task> findOverdueTasksByUserId(@Param("userId") Long userId, @Param("now") LocalDateTime now);
    
    /**
     * Find tasks due today for a user
     */
    @Query("SELECT t FROM Task t WHERE t.userId = :userId AND DATE(t.dueDate) = DATE(:today) AND t.status != 'COMPLETED' AND t.status != 'CANCELLED'")
    List<Task> findTasksDueTodayByUserId(@Param("userId") Long userId, @Param("today") LocalDateTime today);
    
    /**
     * Find tasks due this week for a user
     */
    @Query("SELECT t FROM Task t WHERE t.userId = :userId AND t.dueDate BETWEEN :startOfWeek AND :endOfWeek AND t.status != 'COMPLETED' AND t.status != 'CANCELLED'")
    List<Task> findTasksDueThisWeekByUserId(@Param("userId") Long userId, @Param("startOfWeek") LocalDateTime startOfWeek, @Param("endOfWeek") LocalDateTime endOfWeek);
    
    /**
     * Find tasks by Google Calendar event ID
     */
    Optional<Task> findByGoogleCalendarEventId(String eventId);
    
    /**
     * Find all tasks with Google Calendar integration for a user
     */
    List<Task> findByUserIdAndGoogleCalendarEventIdIsNotNull(Long userId);
    
    /**
     * Find tasks linked to a specific note
     */
    @Query("SELECT t FROM Task t JOIN t.linkedNotes n WHERE n.id = :noteId")
    List<Task> findByLinkedNoteId(@Param("noteId") Long noteId);
    
    /**
     * Find tasks containing specific text in title or description
     */
    @Query("SELECT t FROM Task t WHERE t.userId = :userId AND (LOWER(t.title) LIKE LOWER(CONCAT('%', :searchText, '%')) OR LOWER(t.description) LIKE LOWER(CONCAT('%', :searchText, '%')))")
    List<Task> findByUserIdAndTitleOrDescriptionContaining(@Param("userId") Long userId, @Param("searchText") String searchText);
    
    /**
     * Find recurring tasks for a user
     */
    List<Task> findByUserIdAndIsRecurringTrue(Long userId);
    
    /**
     * Find subtasks (tasks with parent)
     */
    List<Task> findByParentTaskIdOrderByCreatedAtAsc(Long parentTaskId);
    
    /**
     * Find root tasks (tasks without parent) for a user
     */
    List<Task> findByUserIdAndParentTaskIdIsNullOrderByCreatedAtDesc(Long userId);
    
    /**
     * Count tasks by status for a user
     */
    long countByUserIdAndStatus(Long userId, TaskStatus status);
    
    /**
     * Count overdue tasks for a user
     */
    @Query("SELECT COUNT(t) FROM Task t WHERE t.userId = :userId AND t.dueDate < :now AND t.status != 'COMPLETED' AND t.status != 'CANCELLED'")
    long countOverdueTasksByUserId(@Param("userId") Long userId, @Param("now") LocalDateTime now);
    
    /**
     * Find tasks by date range for calendar view
     */
    @Query("SELECT t FROM Task t WHERE t.userId = :userId AND ((t.dueDate BETWEEN :startDate AND :endDate) OR (t.startDate BETWEEN :startDate AND :endDate))")
    List<Task> findTasksByDateRange(@Param("userId") Long userId, @Param("startDate") LocalDateTime startDate, @Param("endDate") LocalDateTime endDate);
    
    /**
     * Find recently completed tasks
     */
    @Query("SELECT t FROM Task t WHERE t.userId = :userId AND t.status = 'COMPLETED' AND t.completionDate >= :since ORDER BY t.completionDate DESC")
    List<Task> findRecentlyCompletedTasks(@Param("userId") Long userId, @Param("since") LocalDateTime since);
    
    /**
     * Find tasks by tags
     */
    @Query("SELECT t FROM Task t WHERE t.userId = :userId AND t.tags LIKE CONCAT('%', :tag, '%')")
    List<Task> findByUserIdAndTagsContaining(@Param("userId") Long userId, @Param("tag") String tag);
    
    /**
     * Find tasks in progress for a user
     */
    List<Task> findByUserIdAndStatusOrderByUpdatedAtDesc(Long userId, TaskStatus status);
    
    /**
     * Find high priority tasks that are not completed
     */
    @Query("SELECT t FROM Task t WHERE t.userId = :userId AND t.priority = 'HIGH' AND t.status != 'COMPLETED' AND t.status != 'CANCELLED' ORDER BY t.dueDate ASC")
    List<Task> findHighPriorityIncompleteTasks(@Param("userId") Long userId);
}
