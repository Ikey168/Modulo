package com.modulo.repository;

import com.modulo.entity.Task;
import com.modulo.entity.Task.TaskStatus;
import com.modulo.entity.Task.TaskPriority;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Nested;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.test.context.TestPropertySource;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;

@DataJpaTest
@TestPropertySource(locations = "classpath:application-test.properties")
@DisplayName("Task Repository Tests")
class TaskRepositoryTest {

    @Autowired
    private TestEntityManager entityManager;

    @Autowired
    private TaskRepository taskRepository;

    private Task task1;
    private Task task2;
    private Task task3;
    private Task overdueTask;
    private Task completedTask;

    @BeforeEach
    void setUp() {
        LocalDateTime now = LocalDateTime.now();

        // Create test tasks for user 1
        task1 = new Task();
        task1.setTitle("Important Task 1");
        task1.setDescription("This is an important task");
        task1.setUserId(1L);
        task1.setStatus(TaskStatus.PENDING);
        task1.setPriority(TaskPriority.HIGH);
        task1.setDueDate(now.plusDays(3));
        task1.setCreatedAt(now.minusDays(1));
        task1.setUpdatedAt(now.minusDays(1));

        task2 = new Task();
        task2.setTitle("Medium Priority Task");
        task2.setDescription("This is a medium priority task");
        task2.setUserId(1L);
        task2.setStatus(TaskStatus.IN_PROGRESS);
        task2.setPriority(TaskPriority.MEDIUM);
        task2.setDueDate(now.plusDays(7));
        task2.setCreatedAt(now.minusDays(2));
        task2.setUpdatedAt(now.minusDays(1));

        // Create task for user 2
        task3 = new Task();
        task3.setTitle("Low Priority Task");
        task3.setDescription("This is a low priority task");
        task3.setUserId(2L);
        task3.setStatus(TaskStatus.PENDING);
        task3.setPriority(TaskPriority.LOW);
        task3.setDueDate(now.plusDays(14));
        task3.setCreatedAt(now.minusDays(3));
        task3.setUpdatedAt(now.minusDays(2));

        // Create overdue task
        overdueTask = new Task();
        overdueTask.setTitle("Overdue Task");
        overdueTask.setDescription("This task is overdue");
        overdueTask.setUserId(1L);
        overdueTask.setStatus(TaskStatus.PENDING);
        overdueTask.setPriority(TaskPriority.HIGH);
        overdueTask.setDueDate(now.minusDays(2)); // 2 days ago
        overdueTask.setCreatedAt(now.minusDays(5));
        overdueTask.setUpdatedAt(now.minusDays(4));

        // Create completed task
        completedTask = new Task();
        completedTask.setTitle("Completed Task");
        completedTask.setDescription("This task is completed");
        completedTask.setUserId(1L);
        completedTask.setStatus(TaskStatus.COMPLETED);
        completedTask.setPriority(TaskPriority.MEDIUM);
        completedTask.setDueDate(now.minusDays(1));
        completedTask.setCreatedAt(now.minusDays(10));
        completedTask.setUpdatedAt(now.minusDays(1));
        completedTask.setCompletedAt(now.minusDays(1));

        entityManager.persist(task1);
        entityManager.persist(task2);
        entityManager.persist(task3);
        entityManager.persist(overdueTask);
        entityManager.persist(completedTask);
        entityManager.flush();
    }

    @Nested
    @DisplayName("Basic CRUD Operations")
    class BasicCrudOperations {

        @Test
        @DisplayName("Should save and find task by ID")
        void shouldSaveAndFindTaskById() {
            Task newTask = new Task();
            newTask.setTitle("New Task");
            newTask.setDescription("New task description");
            newTask.setUserId(3L);
            newTask.setStatus(TaskStatus.PENDING);
            newTask.setPriority(TaskPriority.MEDIUM);
            newTask.setDueDate(LocalDateTime.now().plusDays(5));
            newTask.setCreatedAt(LocalDateTime.now());
            newTask.setUpdatedAt(LocalDateTime.now());

            Task savedTask = taskRepository.save(newTask);
            
            assertThat(savedTask.getId()).isNotNull();
            
            Optional<Task> foundTask = taskRepository.findById(savedTask.getId());
            
            assertThat(foundTask).isPresent();
            assertThat(foundTask.get().getTitle()).isEqualTo("New Task");
            assertThat(foundTask.get().getDescription()).isEqualTo("New task description");
            assertThat(foundTask.get().getUserId()).isEqualTo(3L);
            assertThat(foundTask.get().getStatus()).isEqualTo(TaskStatus.PENDING);
        }

        @Test
        @DisplayName("Should update existing task")
        void shouldUpdateExistingTask() {
            task1.setTitle("Updated Task Title");
            task1.setStatus(TaskStatus.IN_PROGRESS);
            task1.setUpdatedAt(LocalDateTime.now());

            Task updatedTask = taskRepository.save(task1);
            
            assertThat(updatedTask.getTitle()).isEqualTo("Updated Task Title");
            assertThat(updatedTask.getStatus()).isEqualTo(TaskStatus.IN_PROGRESS);
        }

        @Test
        @DisplayName("Should delete task")
        void shouldDeleteTask() {
            Long taskId = task1.getId();
            
            taskRepository.delete(task1);
            entityManager.flush();
            
            Optional<Task> deletedTask = taskRepository.findById(taskId);
            assertThat(deletedTask).isEmpty();
        }

        @Test
        @DisplayName("Should check if task exists")
        void shouldCheckIfTaskExists() {
            assertThat(taskRepository.existsById(task1.getId())).isTrue();
            assertThat(taskRepository.existsById(999L)).isFalse();
        }

        @Test
        @DisplayName("Should find all tasks")
        void shouldFindAllTasks() {
            List<Task> allTasks = taskRepository.findAll();
            
            assertThat(allTasks).hasSize(5);
            assertThat(allTasks).extracting(Task::getTitle)
                .containsExactlyInAnyOrder(
                    "Important Task 1", 
                    "Medium Priority Task", 
                    "Low Priority Task",
                    "Overdue Task",
                    "Completed Task"
                );
        }

        @Test
        @DisplayName("Should count all tasks")
        void shouldCountAllTasks() {
            long count = taskRepository.count();
            assertThat(count).isEqualTo(5);
        }
    }

    @Nested
    @DisplayName("User-Based Queries")
    class UserBasedQueries {

        @Test
        @DisplayName("Should find tasks by user ID ordered by created date")
        void shouldFindTasksByUserIdOrderedByCreatedDate() {
            List<Task> user1Tasks = taskRepository.findByUserIdOrderByCreatedAtDesc(1L);
            
            assertThat(user1Tasks).hasSize(4); // task1, task2, overdueTask, completedTask
            
            // Should be ordered by created date descending (most recent first)
            assertThat(user1Tasks.get(0).getTitle()).isEqualTo("Important Task 1"); // Created 1 day ago
            assertThat(user1Tasks.get(1).getTitle()).isEqualTo("Medium Priority Task"); // Created 2 days ago
            assertThat(user1Tasks.get(2).getTitle()).isEqualTo("Overdue Task"); // Created 5 days ago
            assertThat(user1Tasks.get(3).getTitle()).isEqualTo("Completed Task"); // Created 10 days ago
        }

        @Test
        @DisplayName("Should find tasks for different users")
        void shouldFindTasksForDifferentUsers() {
            List<Task> user2Tasks = taskRepository.findByUserIdOrderByCreatedAtDesc(2L);
            
            assertThat(user2Tasks).hasSize(1);
            assertThat(user2Tasks.get(0).getTitle()).isEqualTo("Low Priority Task");
        }

        @Test
        @DisplayName("Should return empty list for user with no tasks")
        void shouldReturnEmptyListForUserWithNoTasks() {
            List<Task> user3Tasks = taskRepository.findByUserIdOrderByCreatedAtDesc(3L);
            
            assertThat(user3Tasks).isEmpty();
        }

        @Test
        @DisplayName("Should find tasks by user and status ordered by due date")
        void shouldFindTasksByUserAndStatusOrderedByDueDate() {
            List<Task> pendingTasks = taskRepository.findByUserIdAndStatusOrderByDueDateAsc(1L, TaskStatus.PENDING);
            
            assertThat(pendingTasks).hasSize(2); // task1 and overdueTask
            
            // Should be ordered by due date ascending (earliest first)
            assertThat(pendingTasks.get(0).getTitle()).isEqualTo("Overdue Task"); // Due 2 days ago
            assertThat(pendingTasks.get(1).getTitle()).isEqualTo("Important Task 1"); // Due in 3 days
        }

        @Test
        @DisplayName("Should find tasks by user and different statuses")
        void shouldFindTasksByUserAndDifferentStatuses() {
            List<Task> inProgressTasks = taskRepository.findByUserIdAndStatusOrderByDueDateAsc(1L, TaskStatus.IN_PROGRESS);
            List<Task> completedTasks = taskRepository.findByUserIdAndStatusOrderByDueDateAsc(1L, TaskStatus.COMPLETED);
            
            assertThat(inProgressTasks).hasSize(1);
            assertThat(inProgressTasks.get(0).getTitle()).isEqualTo("Medium Priority Task");
            
            assertThat(completedTasks).hasSize(1);
            assertThat(completedTasks.get(0).getTitle()).isEqualTo("Completed Task");
        }

        @Test
        @DisplayName("Should return empty list for user-status combination with no tasks")
        void shouldReturnEmptyListForUserStatusCombinationWithNoTasks() {
            List<Task> cancelledTasks = taskRepository.findByUserIdAndStatusOrderByDueDateAsc(1L, TaskStatus.CANCELLED);
            
            assertThat(cancelledTasks).isEmpty();
        }
    }

    @Nested
    @DisplayName("Priority-Based Queries")
    class PriorityBasedQueries {

        @Test
        @DisplayName("Should find tasks by user and priority ordered by due date")
        void shouldFindTasksByUserAndPriorityOrderedByDueDate() {
            List<Task> highPriorityTasks = taskRepository.findByUserIdAndPriorityOrderByDueDateAsc(1L, TaskPriority.HIGH);
            
            assertThat(highPriorityTasks).hasSize(2); // task1 and overdueTask
            
            // Should be ordered by due date ascending
            assertThat(highPriorityTasks.get(0).getTitle()).isEqualTo("Overdue Task"); // Due earlier
            assertThat(highPriorityTasks.get(1).getTitle()).isEqualTo("Important Task 1"); // Due later
        }

        @Test
        @DisplayName("Should find tasks by different priorities")
        void shouldFindTasksByDifferentPriorities() {
            List<Task> mediumPriorityTasks = taskRepository.findByUserIdAndPriorityOrderByDueDateAsc(1L, TaskPriority.MEDIUM);
            List<Task> lowPriorityTasks = taskRepository.findByUserIdAndPriorityOrderByDueDateAsc(2L, TaskPriority.LOW);
            
            assertThat(mediumPriorityTasks).hasSize(2); // task2 and completedTask
            assertThat(mediumPriorityTasks).extracting(Task::getTitle)
                .containsExactlyInAnyOrder("Medium Priority Task", "Completed Task");
            
            assertThat(lowPriorityTasks).hasSize(1);
            assertThat(lowPriorityTasks.get(0).getTitle()).isEqualTo("Low Priority Task");
        }

        @Test
        @DisplayName("Should return empty list for user-priority combination with no tasks")
        void shouldReturnEmptyListForUserPriorityCombinationWithNoTasks() {
            List<Task> criticalTasks = taskRepository.findByUserIdAndPriorityOrderByDueDateAsc(1L, TaskPriority.CRITICAL);
            
            assertThat(criticalTasks).isEmpty();
        }

        @Test
        @DisplayName("Should handle all priority levels")
        void shouldHandleAllPriorityLevels() {
            // Create tasks with all priority levels
            Task criticalTask = new Task();
            criticalTask.setTitle("Critical Task");
            criticalTask.setDescription("Critical priority task");
            criticalTask.setUserId(3L);
            criticalTask.setStatus(TaskStatus.PENDING);
            criticalTask.setPriority(TaskPriority.CRITICAL);
            criticalTask.setDueDate(LocalDateTime.now().plusDays(1));
            criticalTask.setCreatedAt(LocalDateTime.now());
            criticalTask.setUpdatedAt(LocalDateTime.now());

            entityManager.persist(criticalTask);
            entityManager.flush();

            // Test finding tasks of each priority
            assertThat(taskRepository.findByUserIdAndPriorityOrderByDueDateAsc(3L, TaskPriority.CRITICAL)).hasSize(1);
            assertThat(taskRepository.findByUserIdAndPriorityOrderByDueDateAsc(1L, TaskPriority.HIGH)).hasSize(2);
            assertThat(taskRepository.findByUserIdAndPriorityOrderByDueDateAsc(1L, TaskPriority.MEDIUM)).hasSize(2);
            assertThat(taskRepository.findByUserIdAndPriorityOrderByDueDateAsc(2L, TaskPriority.LOW)).hasSize(1);
        }
    }

    @Nested
    @DisplayName("Overdue Tasks Queries")
    class OverdueTasksQueries {

        @Test
        @DisplayName("Should find overdue tasks for user")
        void shouldFindOverdueTasksForUser() {
            LocalDateTime now = LocalDateTime.now();
            List<Task> overdueTasks = taskRepository.findOverdueTasksByUserId(1L, now);
            
            assertThat(overdueTasks).hasSize(1);
            assertThat(overdueTasks.get(0).getTitle()).isEqualTo("Overdue Task");
        }

        @Test
        @DisplayName("Should not include completed tasks in overdue results")
        void shouldNotIncludeCompletedTasksInOverdueResults() {
            LocalDateTime now = LocalDateTime.now();
            List<Task> overdueTasks = taskRepository.findOverdueTasksByUserId(1L, now);
            
            // Should not include the completed task even though its due date is in the past
            assertThat(overdueTasks).noneMatch(task -> task.getStatus() == TaskStatus.COMPLETED);
            assertThat(overdueTasks).noneMatch(task -> "Completed Task".equals(task.getTitle()));
        }

        @Test
        @DisplayName("Should not include cancelled tasks in overdue results")
        void shouldNotIncludeCancelledTasksInOverdueResults() {
            // Create a cancelled overdue task
            Task cancelledOverdueTask = new Task();
            cancelledOverdueTask.setTitle("Cancelled Overdue Task");
            cancelledOverdueTask.setDescription("This task was cancelled");
            cancelledOverdueTask.setUserId(1L);
            cancelledOverdueTask.setStatus(TaskStatus.CANCELLED);
            cancelledOverdueTask.setPriority(TaskPriority.MEDIUM);
            cancelledOverdueTask.setDueDate(LocalDateTime.now().minusDays(5));
            cancelledOverdueTask.setCreatedAt(LocalDateTime.now().minusDays(7));
            cancelledOverdueTask.setUpdatedAt(LocalDateTime.now().minusDays(6));

            entityManager.persist(cancelledOverdueTask);
            entityManager.flush();

            LocalDateTime now = LocalDateTime.now();
            List<Task> overdueTasks = taskRepository.findOverdueTasksByUserId(1L, now);
            
            assertThat(overdueTasks).noneMatch(task -> task.getStatus() == TaskStatus.CANCELLED);
            assertThat(overdueTasks).noneMatch(task -> "Cancelled Overdue Task".equals(task.getTitle()));
        }

        @Test
        @DisplayName("Should return empty list for user with no overdue tasks")
        void shouldReturnEmptyListForUserWithNoOverdueTasks() {
            LocalDateTime now = LocalDateTime.now();
            List<Task> overdueTasks = taskRepository.findOverdueTasksByUserId(2L, now);
            
            assertThat(overdueTasks).isEmpty();
        }

        @Test
        @DisplayName("Should handle different time references for overdue calculation")
        void shouldHandleDifferentTimeReferencesForOverdueCalculation() {
            LocalDateTime pastTime = LocalDateTime.now().minusDays(10);
            LocalDateTime futureTime = LocalDateTime.now().plusDays(10);

            List<Task> overdueFromPast = taskRepository.findOverdueTasksByUserId(1L, pastTime);
            List<Task> overdueFromFuture = taskRepository.findOverdueTasksByUserId(1L, futureTime);

            // From past perspective, fewer tasks would be overdue
            assertThat(overdueFromPast).isEmpty();

            // From future perspective, more tasks would be overdue
            assertThat(overdueFromFuture).hasSizeGreaterThan(overdueFromPast.size());
        }
    }

    @Nested
    @DisplayName("Task Status Queries")
    class TaskStatusQueries {

        @Test
        @DisplayName("Should find tasks due today")
        void shouldFindTasksDueToday() {
            // Create a task due today
            Task todayTask = new Task();
            todayTask.setTitle("Task Due Today");
            todayTask.setDescription("This task is due today");
            todayTask.setUserId(1L);
            todayTask.setStatus(TaskStatus.PENDING);
            todayTask.setPriority(TaskPriority.MEDIUM);
            todayTask.setDueDate(LocalDateTime.now().withHour(23).withMinute(59));
            todayTask.setCreatedAt(LocalDateTime.now().minusHours(2));
            todayTask.setUpdatedAt(LocalDateTime.now().minusHours(2));
            
            entityManager.persist(todayTask);
            entityManager.flush();

            List<Task> todayTasks = taskRepository.findTasksDueTodayByUserId(1L, LocalDateTime.now());
            
            assertThat(todayTasks).hasSize(1);
            assertThat(todayTasks.get(0).getTitle()).isEqualTo("Task Due Today");
        }

        @Test
        @DisplayName("Should find tasks due this week")
        void shouldFindTasksDueThisWeek() {
            LocalDateTime startOfWeek = LocalDateTime.now().withHour(0).withMinute(0).withSecond(0);
            LocalDateTime endOfWeek = startOfWeek.plusDays(7);
            
            List<Task> weekTasks = taskRepository.findTasksDueThisWeekByUserId(1L, startOfWeek, endOfWeek);
            
            assertThat(weekTasks).hasSizeGreaterThanOrEqualTo(2); // At least task1 and task2
        }

        @Test
        @DisplayName("Should find tasks by date range")
        void shouldFindTasksByDateRange() {
            LocalDateTime startDate = LocalDateTime.now();
            LocalDateTime endDate = LocalDateTime.now().plusDays(7);
            
            List<Task> tasksInRange = taskRepository.findTasksByDateRange(1L, startDate, endDate);
            
            assertThat(tasksInRange).hasSizeGreaterThanOrEqualTo(1); // At least task1
        }

        @Test
        @DisplayName("Should find recently completed tasks")
        void shouldFindRecentlyCompletedTasks() {
            LocalDateTime oneWeekAgo = LocalDateTime.now().minusDays(7);
            
            List<Task> recentlyCompleted = taskRepository.findRecentlyCompletedTasks(1L, oneWeekAgo);
            
            assertThat(recentlyCompleted).hasSize(1);
            assertThat(recentlyCompleted.get(0).getTitle()).isEqualTo("Completed Task");
        }

        @Test
        @DisplayName("Should find high priority incomplete tasks")
        void shouldFindHighPriorityIncompleteTasks() {
            List<Task> highPriorityTasks = taskRepository.findHighPriorityIncompleteTasks(1L);
            
            assertThat(highPriorityTasks).hasSize(2); // task1 and overdueTask
            assertThat(highPriorityTasks).allMatch(task -> task.getPriority() == TaskPriority.HIGH);
            assertThat(highPriorityTasks).noneMatch(task -> task.getStatus() == TaskStatus.COMPLETED);
        }
    }

    @Nested
    @DisplayName("Data Integrity and Constraints")
    class DataIntegrityAndConstraints {

        @Test
        @DisplayName("Should handle null values appropriately")
        void shouldHandleNullValuesAppropriately() {
            Task taskWithNulls = new Task();
            taskWithNulls.setTitle("Task with Nulls");
            taskWithNulls.setUserId(4L);
            taskWithNulls.setStatus(TaskStatus.PENDING);
            taskWithNulls.setPriority(TaskPriority.MEDIUM);
            taskWithNulls.setCreatedAt(LocalDateTime.now());
            taskWithNulls.setUpdatedAt(LocalDateTime.now());
            // description, dueDate, and completedAt are null

            Task savedTask = taskRepository.save(taskWithNulls);
            
            assertThat(savedTask.getId()).isNotNull();
            assertThat(savedTask.getDescription()).isNull();
            assertThat(savedTask.getDueDate()).isNull();
            assertThat(savedTask.getCompletedAt()).isNull();
        }

        @Test
        @DisplayName("Should handle very long descriptions")
        void shouldHandleVeryLongDescriptions() {
            String longDescription = "A".repeat(5000);
            
            Task taskWithLongDescription = new Task();
            taskWithLongDescription.setTitle("Task with Long Description");
            taskWithLongDescription.setDescription(longDescription);
            taskWithLongDescription.setUserId(5L);
            taskWithLongDescription.setStatus(TaskStatus.PENDING);
            taskWithLongDescription.setPriority(TaskPriority.LOW);
            taskWithLongDescription.setCreatedAt(LocalDateTime.now());
            taskWithLongDescription.setUpdatedAt(LocalDateTime.now());

            Task savedTask = taskRepository.save(taskWithLongDescription);
            
            assertThat(savedTask.getId()).isNotNull();
            assertThat(savedTask.getDescription()).hasSize(5000);
        }

        @Test
        @DisplayName("Should handle special characters in title and description")
        void shouldHandleSpecialCharactersInTitleAndDescription() {
            Task specialCharTask = new Task();
            specialCharTask.setTitle("测试任务 🚀 Special chars: @#$%");
            specialCharTask.setDescription("Description with emojis 😀🎉 and unicode characters 测试内容");
            specialCharTask.setUserId(6L);
            specialCharTask.setStatus(TaskStatus.PENDING);
            specialCharTask.setPriority(TaskPriority.MEDIUM);
            specialCharTask.setCreatedAt(LocalDateTime.now());
            specialCharTask.setUpdatedAt(LocalDateTime.now());

            Task savedTask = taskRepository.save(specialCharTask);
            
            assertThat(savedTask.getId()).isNotNull();
            assertThat(savedTask.getTitle()).isEqualTo("测试任务 🚀 Special chars: @#$%");
            assertThat(savedTask.getDescription()).isEqualTo("Description with emojis 😀🎉 and unicode characters 测试内容");
        }

        @Test
        @DisplayName("Should handle all task statuses")
        void shouldHandleAllTaskStatuses() {
            Task[] statusTasks = new Task[TaskStatus.values().length];
            TaskStatus[] statuses = TaskStatus.values();
            
            for (int i = 0; i < statuses.length; i++) {
                statusTasks[i] = new Task();
                statusTasks[i].setTitle("Task with status " + statuses[i]);
                statusTasks[i].setDescription("Test task for status " + statuses[i]);
                statusTasks[i].setUserId(7L);
                statusTasks[i].setStatus(statuses[i]);
                statusTasks[i].setPriority(TaskPriority.MEDIUM);
                statusTasks[i].setCreatedAt(LocalDateTime.now());
                statusTasks[i].setUpdatedAt(LocalDateTime.now());
                
                if (statuses[i] == TaskStatus.COMPLETED) {
                    statusTasks[i].setCompletedAt(LocalDateTime.now());
                }
                
                entityManager.persist(statusTasks[i]);
            }
            entityManager.flush();

            // Verify all statuses can be saved and retrieved
            for (TaskStatus status : statuses) {
                List<Task> tasksWithStatus = taskRepository.findByUserIdAndStatusOrderByDueDateAsc(7L, status);
                assertThat(tasksWithStatus).hasSize(1);
                assertThat(tasksWithStatus.get(0).getStatus()).isEqualTo(status);
            }
        }

        @Test
        @DisplayName("Should handle all task priorities")
        void shouldHandleAllTaskPriorities() {
            Task[] priorityTasks = new Task[TaskPriority.values().length];
            TaskPriority[] priorities = TaskPriority.values();
            
            for (int i = 0; i < priorities.length; i++) {
                priorityTasks[i] = new Task();
                priorityTasks[i].setTitle("Task with priority " + priorities[i]);
                priorityTasks[i].setDescription("Test task for priority " + priorities[i]);
                priorityTasks[i].setUserId(8L);
                priorityTasks[i].setStatus(TaskStatus.PENDING);
                priorityTasks[i].setPriority(priorities[i]);
                priorityTasks[i].setCreatedAt(LocalDateTime.now());
                priorityTasks[i].setUpdatedAt(LocalDateTime.now());
                
                entityManager.persist(priorityTasks[i]);
            }
            entityManager.flush();

            // Verify all priorities can be saved and retrieved
            for (TaskPriority priority : priorities) {
                List<Task> tasksWithPriority = taskRepository.findByUserIdAndPriorityOrderByDueDateAsc(8L, priority);
                assertThat(tasksWithPriority).hasSize(1);
                assertThat(tasksWithPriority.get(0).getPriority()).isEqualTo(priority);
            }
        }
    }

    @Nested
    @DisplayName("Performance and Edge Cases")
    class PerformanceAndEdgeCases {

        @Test
        @DisplayName("Should handle large number of tasks")
        void shouldHandleLargeNumberOfTasks() {
            // Create many tasks for performance testing
            LocalDateTime baseTime = LocalDateTime.now();
            for (int i = 0; i < 100; i++) {
                Task task = new Task();
                task.setTitle("Performance Task " + i);
                task.setDescription("Performance test task number " + i);
                task.setUserId(9L);
                task.setStatus(i % 2 == 0 ? TaskStatus.PENDING : TaskStatus.IN_PROGRESS);
                task.setPriority(TaskPriority.values()[i % TaskPriority.values().length]);
                task.setDueDate(baseTime.plusDays(i % 30));
                task.setCreatedAt(baseTime.minusDays(100 - i));
                task.setUpdatedAt(baseTime.minusDays(100 - i));
                entityManager.persist(task);
            }
            entityManager.flush();

            List<Task> allTasks = taskRepository.findByUserIdOrderByCreatedAtDesc(9L);
            
            assertThat(allTasks).hasSize(100);
            // Should be ordered by created date descending
            assertThat(allTasks.get(0).getTitle()).isEqualTo("Performance Task 99");
            assertThat(allTasks.get(99).getTitle()).isEqualTo("Performance Task 0");
        }

        @Test
        @DisplayName("Should handle empty result sets efficiently")
        void shouldHandleEmptyResultSetsEfficiently() {
            // Test with non-existent user ID
            List<Task> tasks = taskRepository.findByUserIdOrderByCreatedAtDesc(999L);
            assertThat(tasks).isEmpty();

            List<Task> overdueTasks = taskRepository.findOverdueTasksByUserId(999L, LocalDateTime.now());
            assertThat(overdueTasks).isEmpty();

            List<Task> statusTasks = taskRepository.findByUserIdAndStatusOrderByDueDateAsc(999L, TaskStatus.PENDING);
            assertThat(statusTasks).isEmpty();

            List<Task> priorityTasks = taskRepository.findByUserIdAndPriorityOrderByDueDateAsc(999L, TaskPriority.HIGH);
            assertThat(priorityTasks).isEmpty();
        }

        @Test
        @DisplayName("Should handle batch operations efficiently")
        void shouldHandleBatchOperationsEfficiently() {
            // Create multiple tasks for batch testing
            Task batchTask1 = new Task();
            batchTask1.setTitle("Batch Task 1");
            batchTask1.setDescription("Batch test task 1");
            batchTask1.setUserId(10L);
            batchTask1.setStatus(TaskStatus.PENDING);
            batchTask1.setPriority(TaskPriority.HIGH);
            batchTask1.setDueDate(LocalDateTime.now().plusDays(1));
            batchTask1.setCreatedAt(LocalDateTime.now());
            batchTask1.setUpdatedAt(LocalDateTime.now());

            Task batchTask2 = new Task();
            batchTask2.setTitle("Batch Task 2");
            batchTask2.setDescription("Batch test task 2");
            batchTask2.setUserId(10L);
            batchTask2.setStatus(TaskStatus.IN_PROGRESS);
            batchTask2.setPriority(TaskPriority.MEDIUM);
            batchTask2.setDueDate(LocalDateTime.now().plusDays(2));
            batchTask2.setCreatedAt(LocalDateTime.now());
            batchTask2.setUpdatedAt(LocalDateTime.now());

            List<Task> batchTasks = List.of(batchTask1, batchTask2);
            List<Task> savedTasks = taskRepository.saveAll(batchTasks);
            
            assertThat(savedTasks).hasSize(2);
            assertThat(savedTasks).allMatch(task -> task.getId() != null);
        }

        @Test
        @DisplayName("Should handle concurrent task updates")
        void shouldHandleConcurrentTaskUpdates() {
            // Simulate concurrent access to the same task
            Optional<Task> taskInstance1 = taskRepository.findById(task1.getId());
            Optional<Task> taskInstance2 = taskRepository.findById(task1.getId());

            assertThat(taskInstance1).isPresent();
            assertThat(taskInstance2).isPresent();

            // Update both instances
            taskInstance1.get().setTitle("Updated by instance 1");
            taskInstance1.get().setStatus(TaskStatus.IN_PROGRESS);
            taskInstance2.get().setTitle("Updated by instance 2");
            taskInstance2.get().setPriority(TaskPriority.LOW);

            taskRepository.save(taskInstance1.get());
            taskRepository.save(taskInstance2.get());
            entityManager.flush();

            // The last update should win
            Optional<Task> finalTask = taskRepository.findById(task1.getId());
            assertThat(finalTask).isPresent();
            assertThat(finalTask.get().getTitle()).isEqualTo("Updated by instance 2");
            assertThat(finalTask.get().getPriority()).isEqualTo(TaskPriority.LOW);
        }
    }

    @Nested
    @DisplayName("Complex Query Scenarios")
    class ComplexQueryScenarios {

        @Test
        @DisplayName("Should handle tasks with edge case due dates")
        void shouldHandleTasksWithEdgeCaseDueDates() {
            LocalDateTime now = LocalDateTime.now();
            
            // Task due exactly now
            Task taskDueNow = new Task();
            taskDueNow.setTitle("Task Due Now");
            taskDueNow.setDescription("Task due exactly now");
            taskDueNow.setUserId(11L);
            taskDueNow.setStatus(TaskStatus.PENDING);
            taskDueNow.setPriority(TaskPriority.HIGH);
            taskDueNow.setDueDate(now);
            taskDueNow.setCreatedAt(now.minusHours(1));
            taskDueNow.setUpdatedAt(now.minusHours(1));

            // Task due in 1 second
            Task taskDueInOneSecond = new Task();
            taskDueInOneSecond.setTitle("Task Due In One Second");
            taskDueInOneSecond.setDescription("Task due in 1 second");
            taskDueInOneSecond.setUserId(11L);
            taskDueInOneSecond.setStatus(TaskStatus.PENDING);
            taskDueInOneSecond.setPriority(TaskPriority.MEDIUM);
            taskDueInOneSecond.setDueDate(now.plusSeconds(1));
            taskDueInOneSecond.setCreatedAt(now.minusHours(2));
            taskDueInOneSecond.setUpdatedAt(now.minusHours(2));

            entityManager.persist(taskDueNow);
            entityManager.persist(taskDueInOneSecond);
            entityManager.flush();

            // Test overdue calculation with different time references
            List<Task> overdueExactly = taskRepository.findOverdueTasksByUserId(11L, now);
            List<Task> overdueAfterOneSecond = taskRepository.findOverdueTasksByUserId(11L, now.plusSeconds(2));

            assertThat(overdueExactly).isEmpty(); // taskDueNow is not overdue yet
            assertThat(overdueAfterOneSecond).hasSize(2); // Both tasks are now overdue
        }

        @Test
        @DisplayName("Should handle task status transitions correctly")
        void shouldHandleTaskStatusTransitionsCorrectly() {
            // Test task lifecycle: PENDING -> IN_PROGRESS -> COMPLETED
            task1.setStatus(TaskStatus.IN_PROGRESS);
            task1.setUpdatedAt(LocalDateTime.now());
            taskRepository.save(task1);

            List<Task> inProgressTasks = taskRepository.findByUserIdAndStatusOrderByDueDateAsc(1L, TaskStatus.IN_PROGRESS);
            assertThat(inProgressTasks).hasSize(2); // task1 and task2

            // Complete the task
            task1.setStatus(TaskStatus.COMPLETED);
            task1.setCompletedAt(LocalDateTime.now());
            task1.setUpdatedAt(LocalDateTime.now());
            taskRepository.save(task1);

            List<Task> completedTasks = taskRepository.findByUserIdAndStatusOrderByDueDateAsc(1L, TaskStatus.COMPLETED);
            assertThat(completedTasks).hasSize(2); // task1 and completedTask

            // Should no longer appear in overdue results
            List<Task> overdueTasks = taskRepository.findOverdueTasksByUserId(1L, LocalDateTime.now());
            assertThat(overdueTasks).noneMatch(task -> task.getId().equals(task1.getId()));
        }
    }

    @Nested
    @DisplayName("Additional Repository Methods")
    class AdditionalRepositoryMethods {

        @Test
        @DisplayName("Should find tasks by Google Calendar event ID")
        void shouldFindTasksByGoogleCalendarEventId() {
            task1.setGoogleCalendarEventId("calendar-event-123");
            taskRepository.save(task1);
            entityManager.flush();

            Optional<Task> foundTask = taskRepository.findByGoogleCalendarEventId("calendar-event-123");
            
            assertThat(foundTask).isPresent();
            assertThat(foundTask.get().getTitle()).isEqualTo("Important Task 1");
        }

        @Test
        @DisplayName("Should find tasks with Google Calendar integration")
        void shouldFindTasksWithGoogleCalendarIntegration() {
            task1.setGoogleCalendarEventId("calendar-event-123");
            task2.setGoogleCalendarEventId("calendar-event-456");
            taskRepository.save(task1);
            taskRepository.save(task2);
            entityManager.flush();

            List<Task> googleCalendarTasks = taskRepository.findByUserIdAndGoogleCalendarEventIdIsNotNull(1L);
            
            assertThat(googleCalendarTasks).hasSize(2);
            assertThat(googleCalendarTasks).extracting(Task::getTitle)
                .containsExactlyInAnyOrder("Important Task 1", "Medium Priority Task");
        }

        @Test
        @DisplayName("Should find tasks by text search")
        void shouldFindTasksByTextSearch() {
            List<Task> foundTasks = taskRepository.findByUserIdAndTitleOrDescriptionContaining(1L, "important");
            
            assertThat(foundTasks).hasSize(2); // task1 and overdueTask (both have "important" in title/description)
        }

        @Test
        @DisplayName("Should find recurring tasks")
        void shouldFindRecurringTasks() {
            task1.setIsRecurring(true);
            taskRepository.save(task1);
            entityManager.flush();

            List<Task> recurringTasks = taskRepository.findByUserIdAndIsRecurringTrue(1L);
            
            assertThat(recurringTasks).hasSize(1);
            assertThat(recurringTasks.get(0).getTitle()).isEqualTo("Important Task 1");
        }

        @Test
        @DisplayName("Should find subtasks by parent task ID")
        void shouldFindSubtasksByParentTaskId() {
            // Create a subtask
            Task subtask = new Task();
            subtask.setTitle("Subtask 1");
            subtask.setDescription("This is a subtask");
            subtask.setUserId(1L);
            subtask.setStatus(TaskStatus.PENDING);
            subtask.setPriority(TaskPriority.MEDIUM);
            subtask.setDueDate(LocalDateTime.now().plusDays(2));
            subtask.setCreatedAt(LocalDateTime.now());
            subtask.setUpdatedAt(LocalDateTime.now());
            subtask.setParentTaskId(task1.getId());

            entityManager.persist(subtask);
            entityManager.flush();

            List<Task> subtasks = taskRepository.findByParentTaskIdOrderByCreatedAtAsc(task1.getId());
            
            assertThat(subtasks).hasSize(1);
            assertThat(subtasks.get(0).getTitle()).isEqualTo("Subtask 1");
        }

        @Test
        @DisplayName("Should find root tasks (without parent)")
        void shouldFindRootTasks() {
            List<Task> rootTasks = taskRepository.findByUserIdAndParentTaskIdIsNullOrderByCreatedAtDesc(1L);
            
            assertThat(rootTasks).hasSize(4); // All original tasks have no parent
            assertThat(rootTasks).allMatch(task -> task.getParentTaskId() == null);
        }

        @Test
        @DisplayName("Should count tasks by status")
        void shouldCountTasksByStatus() {
            long pendingCount = taskRepository.countByUserIdAndStatus(1L, TaskStatus.PENDING);
            long inProgressCount = taskRepository.countByUserIdAndStatus(1L, TaskStatus.IN_PROGRESS);
            long completedCount = taskRepository.countByUserIdAndStatus(1L, TaskStatus.COMPLETED);
            
            assertThat(pendingCount).isEqualTo(2L); // task1 and overdueTask
            assertThat(inProgressCount).isEqualTo(1L); // task2
            assertThat(completedCount).isEqualTo(1L); // completedTask
        }

        @Test
        @DisplayName("Should count overdue tasks")
        void shouldCountOverdueTasks() {
            LocalDateTime now = LocalDateTime.now();
            long overdueCount = taskRepository.countOverdueTasksByUserId(1L, now);
            
            assertThat(overdueCount).isEqualTo(1L); // overdueTask
        }

        @Test
        @DisplayName("Should find tasks by tags")
        void shouldFindTasksByTags() {
            task1.setTags("important,work");
            task2.setTags("work,meeting");
            taskRepository.save(task1);
            taskRepository.save(task2);
            entityManager.flush();

            List<Task> workTasks = taskRepository.findByUserIdAndTagsContaining(1L, "work");
            List<Task> importantTasks = taskRepository.findByUserIdAndTagsContaining(1L, "important");
            
            assertThat(workTasks).hasSize(2);
            assertThat(importantTasks).hasSize(1);
            assertThat(importantTasks.get(0).getTitle()).isEqualTo("Important Task 1");
        }

        @Test
        @DisplayName("Should find tasks by status ordered by updated date")
        void shouldFindTasksByStatusOrderedByUpdatedDate() {
            List<Task> inProgressTasks = taskRepository.findByUserIdAndStatusOrderByUpdatedAtDesc(1L, TaskStatus.IN_PROGRESS);
            
            assertThat(inProgressTasks).hasSize(1);
            assertThat(inProgressTasks.get(0).getTitle()).isEqualTo("Medium Priority Task");
        }
    }
}
