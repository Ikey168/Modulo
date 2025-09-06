package com.modulo.service;

import com.modulo.entity.Task;
import com.modulo.entity.Task.TaskStatus;
import com.modulo.entity.Task.TaskPriority;
import com.modulo.repository.TaskRepository;
import com.modulo.repository.NoteRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.*;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("Task Service Tests")
class TaskServiceTest {

    @Mock
    private TaskRepository taskRepository;

    @Mock
    private NoteRepository noteRepository;

    @InjectMocks
    private TaskService taskService;

    @Captor
    private ArgumentCaptor<Task> taskCaptor;

    private Task testTask;
    private Task overdueTask;
    private Task completedTask;

    @BeforeEach
    void setUp() {
        LocalDateTime now = LocalDateTime.now();
        
        testTask = new Task();
        testTask.setId(1L);
        testTask.setTitle("Test Task");
        testTask.setDescription("Test task description");
        testTask.setUserId(100L);
        testTask.setStatus(TaskStatus.PENDING);
        testTask.setPriority(TaskPriority.MEDIUM);
        testTask.setDueDate(now.plusDays(1));
        testTask.setCreatedAt(now.minusDays(1));
        testTask.setUpdatedAt(now);

        overdueTask = new Task();
        overdueTask.setId(2L);
        overdueTask.setTitle("Overdue Task");
        overdueTask.setDescription("Overdue task description");
        overdueTask.setUserId(100L);
        overdueTask.setStatus(TaskStatus.PENDING);
        overdueTask.setPriority(TaskPriority.HIGH);
        overdueTask.setDueDate(now.minusDays(1));
        overdueTask.setCreatedAt(now.minusDays(2));
        overdueTask.setUpdatedAt(now);

        completedTask = new Task();
        completedTask.setId(3L);
        completedTask.setTitle("Completed Task");
        completedTask.setDescription("Completed task description");
        completedTask.setUserId(100L);
        completedTask.setStatus(TaskStatus.COMPLETED);
        completedTask.setPriority(TaskPriority.LOW);
        completedTask.setDueDate(now.plusDays(1));
        completedTask.setCreatedAt(now.minusDays(1));
        completedTask.setUpdatedAt(now);
    }

    @Nested
    @DisplayName("Task Creation")
    class TaskCreation {

        @Test
        @DisplayName("Should create new task successfully")
        void shouldCreateNewTaskSuccessfully() {
            // Arrange
            Task newTask = new Task();
            newTask.setTitle("New Task");
            newTask.setDescription("New task description");
            newTask.setUserId(100L);
            newTask.setStatus(TaskStatus.PENDING);
            newTask.setPriority(TaskPriority.HIGH);

            when(taskRepository.save(any(Task.class))).thenReturn(testTask);

            // Act
            Task result = taskService.createTask(newTask);

            // Assert
            assertThat(result).isNotNull();
            assertThat(result).isEqualTo(testTask);
            
            verify(taskRepository).save(taskCaptor.capture());
            Task capturedTask = taskCaptor.getValue();
            assertThat(capturedTask.getCreatedAt()).isNotNull();
            assertThat(capturedTask.getUpdatedAt()).isNotNull();
        }

        @Test
        @DisplayName("Should set creation timestamps on new task")
        void shouldSetCreationTimestampsOnNewTask() {
            // Arrange
            Task newTask = new Task();
            newTask.setTitle("Timestamp Test");
            newTask.setUserId(100L);

            when(taskRepository.save(any(Task.class))).thenAnswer(invocation -> invocation.getArgument(0));

            // Act
            Task result = taskService.createTask(newTask);

            // Assert
            assertThat(result.getCreatedAt()).isNotNull();
            assertThat(result.getUpdatedAt()).isNotNull();
            assertThat(result.getCreatedAt()).isEqualTo(result.getUpdatedAt());
        }
    }

    @Nested
    @DisplayName("Task Updates")
    class TaskUpdates {

        @Test
        @DisplayName("Should update existing task successfully")
        void shouldUpdateExistingTaskSuccessfully() {
            // Arrange
            testTask.setTitle("Updated Task Title");
            testTask.setDescription("Updated description");
            
            when(taskRepository.save(any(Task.class))).thenReturn(testTask);

            // Act
            Task result = taskService.updateTask(testTask);

            // Assert
            assertThat(result).isNotNull();
            assertThat(result.getTitle()).isEqualTo("Updated Task Title");
            
            verify(taskRepository).save(taskCaptor.capture());
            Task capturedTask = taskCaptor.getValue();
            assertThat(capturedTask.getUpdatedAt()).isNotNull();
        }

        @Test
        @DisplayName("Should update task status")
        void shouldUpdateTaskStatus() {
            // Arrange
            when(taskRepository.findById(1L)).thenReturn(Optional.of(testTask));
            when(taskRepository.save(any(Task.class))).thenReturn(testTask);

            // Act
            Task result = taskService.updateTaskStatus(1L, TaskStatus.IN_PROGRESS);

            // Assert
            assertThat(result.getStatus()).isEqualTo(TaskStatus.IN_PROGRESS);
            verify(taskRepository).findById(1L);
            verify(taskRepository).save(testTask);
        }

        @Test
        @DisplayName("Should handle update of non-existent task")
        void shouldHandleUpdateOfNonExistentTask() {
            // Arrange
            when(taskRepository.findById(999L)).thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> taskService.updateTaskStatus(999L, TaskStatus.COMPLETED))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Task not found");
        }
    }

    @Nested
    @DisplayName("Task Retrieval")
    class TaskRetrieval {

        @Test
        @DisplayName("Should find task by ID")
        void shouldFindTaskById() {
            // Arrange
            when(taskRepository.findById(1L)).thenReturn(Optional.of(testTask));

            // Act
            Optional<Task> result = taskService.findById(1L);

            // Assert
            assertThat(result).isPresent();
            assertThat(result.get()).isEqualTo(testTask);
            verify(taskRepository).findById(1L);
        }

        @Test
        @DisplayName("Should return empty for non-existent task ID")
        void shouldReturnEmptyForNonExistentTaskId() {
            // Arrange
            when(taskRepository.findById(999L)).thenReturn(Optional.empty());

            // Act
            Optional<Task> result = taskService.findById(999L);

            // Assert
            assertThat(result).isEmpty();
            verify(taskRepository).findById(999L);
        }

        @Test
        @DisplayName("Should find tasks by user ID")
        void shouldFindTasksByUserId() {
            // Arrange
            List<Task> userTasks = Arrays.asList(testTask, overdueTask);
            when(taskRepository.findByUserIdOrderByCreatedAtDesc(100L)).thenReturn(userTasks);

            // Act
            List<Task> result = taskService.findByUserId(100L);

            // Assert
            assertThat(result).hasSize(2);
            assertThat(result).containsExactly(testTask, overdueTask);
            verify(taskRepository).findByUserIdOrderByCreatedAtDesc(100L);
        }

        @Test
        @DisplayName("Should find tasks by status")
        void shouldFindTasksByStatus() {
            // Arrange
            List<Task> pendingTasks = Arrays.asList(testTask, overdueTask);
            when(taskRepository.findByUserIdAndStatusOrderByDueDateAsc(100L, TaskStatus.PENDING))
                    .thenReturn(pendingTasks);

            // Act
            List<Task> result = taskService.findByUserIdAndStatus(100L, TaskStatus.PENDING);

            // Assert
            assertThat(result).hasSize(2);
            assertThat(result).containsExactly(testTask, overdueTask);
            verify(taskRepository).findByUserIdAndStatusOrderByDueDateAsc(100L, TaskStatus.PENDING);
        }

        @Test
        @DisplayName("Should find tasks by priority")
        void shouldFindTasksByPriority() {
            // Arrange
            List<Task> highPriorityTasks = Arrays.asList(overdueTask);
            when(taskRepository.findByUserIdAndPriorityOrderByDueDateAsc(100L, TaskPriority.HIGH))
                    .thenReturn(highPriorityTasks);

            // Act
            List<Task> result = taskService.findByUserIdAndPriority(100L, TaskPriority.HIGH);

            // Assert
            assertThat(result).hasSize(1);
            assertThat(result.get(0)).isEqualTo(overdueTask);
            verify(taskRepository).findByUserIdAndPriorityOrderByDueDateAsc(100L, TaskPriority.HIGH);
        }
    }

    @Nested
    @DisplayName("Overdue Tasks")
    class OverdueTasks {

        @Test
        @DisplayName("Should find overdue tasks for user")
        void shouldFindOverdueTasksForUser() {
            // Arrange
            List<Task> overdueTasks = Arrays.asList(overdueTask);
            when(taskRepository.findOverdueTasksByUserId(eq(100L), any(LocalDateTime.class)))
                    .thenReturn(overdueTasks);

            // Act
            List<Task> result = taskService.findOverdueTasksByUserId(100L);

            // Assert
            assertThat(result).hasSize(1);
            assertThat(result.get(0)).isEqualTo(overdueTask);
            verify(taskRepository).findOverdueTasksByUserId(eq(100L), any(LocalDateTime.class));
        }

        @Test
        @DisplayName("Should count overdue tasks")
        void shouldCountOverdueTasks() {
            // Arrange
            when(taskRepository.countOverdueTasksByUserId(eq(100L), any(LocalDateTime.class)))
                    .thenReturn(2L);

            // Act
            long result = taskService.countOverdueTasksByUserId(100L);

            // Assert
            assertThat(result).isEqualTo(2L);
            verify(taskRepository).countOverdueTasksByUserId(eq(100L), any(LocalDateTime.class));
        }

        @Test
        @DisplayName("Should return empty list when no overdue tasks")
        void shouldReturnEmptyListWhenNoOverdueTasks() {
            // Arrange
            when(taskRepository.findOverdueTasksByUserId(eq(100L), any(LocalDateTime.class)))
                    .thenReturn(Collections.emptyList());

            // Act
            List<Task> result = taskService.findOverdueTasksByUserId(100L);

            // Assert
            assertThat(result).isEmpty();
        }
    }

    @Nested
    @DisplayName("Task Deletion")
    class TaskDeletion {

        @Test
        @DisplayName("Should delete task by ID")
        void shouldDeleteTaskById() {
            // Arrange
            when(taskRepository.existsById(1L)).thenReturn(true);

            // Act
            taskService.deleteById(1L);

            // Assert
            verify(taskRepository).existsById(1L);
            verify(taskRepository).deleteById(1L);
        }

        @Test
        @DisplayName("Should handle delete of non-existent task")
        void shouldHandleDeleteOfNonExistentTask() {
            // Arrange
            when(taskRepository.existsById(999L)).thenReturn(false);

            // Act & Assert
            assertThatThrownBy(() -> taskService.deleteById(999L))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Task not found");
        }

        @Test
        @DisplayName("Should delete all tasks for user")
        void shouldDeleteAllTasksForUser() {
            // Arrange
            List<Task> userTasks = Arrays.asList(testTask, overdueTask);
            when(taskRepository.findByUserIdOrderByCreatedAtDesc(100L)).thenReturn(userTasks);

            // Act
            taskService.deleteAllByUserId(100L);

            // Assert
            verify(taskRepository).findByUserIdOrderByCreatedAtDesc(100L);
            verify(taskRepository).deleteAll(userTasks);
        }
    }

    @Nested
    @DisplayName("Task Statistics")
    class TaskStatistics {

        @Test
        @DisplayName("Should get task statistics for user")
        void shouldGetTaskStatisticsForUser() {
            // Arrange
            when(taskRepository.countByUserIdAndStatus(100L, TaskStatus.PENDING)).thenReturn(5L);
            when(taskRepository.countByUserIdAndStatus(100L, TaskStatus.IN_PROGRESS)).thenReturn(3L);
            when(taskRepository.countByUserIdAndStatus(100L, TaskStatus.COMPLETED)).thenReturn(10L);
            when(taskRepository.countOverdueTasksByUserId(eq(100L), any(LocalDateTime.class))).thenReturn(2L);

            // Act
            Map<String, Long> result = taskService.getTaskStatistics(100L);

            // Assert
            assertThat(result).isNotNull();
            assertThat(result.get("pending")).isEqualTo(5L);
            assertThat(result.get("inProgress")).isEqualTo(3L);
            assertThat(result.get("completed")).isEqualTo(10L);
            assertThat(result.get("overdue")).isEqualTo(2L);
        }

        @Test
        @DisplayName("Should count tasks by priority for user")
        void shouldCountTasksByPriorityForUser() {
            // Arrange
            when(taskRepository.countByUserIdAndPriority(100L, TaskPriority.HIGH)).thenReturn(3L);
            when(taskRepository.countByUserIdAndPriority(100L, TaskPriority.MEDIUM)).thenReturn(5L);
            when(taskRepository.countByUserIdAndPriority(100L, TaskPriority.LOW)).thenReturn(2L);

            // Act
            Map<TaskPriority, Long> result = taskService.countTasksByPriority(100L);

            // Assert
            assertThat(result).isNotNull();
            assertThat(result.get(TaskPriority.HIGH)).isEqualTo(3L);
            assertThat(result.get(TaskPriority.MEDIUM)).isEqualTo(5L);
            assertThat(result.get(TaskPriority.LOW)).isEqualTo(2L);
        }
    }

    @Nested
    @DisplayName("Task Search and Filtering")
    class TaskSearchAndFiltering {

        @Test
        @DisplayName("Should find tasks due today")
        void shouldFindTasksDueToday() {
            // Arrange
            LocalDateTime startOfDay = LocalDateTime.now().toLocalDate().atStartOfDay();
            LocalDateTime endOfDay = startOfDay.plusDays(1).minusNanos(1);
            List<Task> todayTasks = Arrays.asList(testTask);
            
            when(taskRepository.findTasksDueToday(100L, startOfDay, endOfDay))
                    .thenReturn(todayTasks);

            // Act
            List<Task> result = taskService.findTasksDueToday(100L);

            // Assert
            assertThat(result).hasSize(1);
            assertThat(result.get(0)).isEqualTo(testTask);
        }

        @Test
        @DisplayName("Should find tasks due this week")
        void shouldFindTasksDueThisWeek() {
            // Arrange
            List<Task> weekTasks = Arrays.asList(testTask, overdueTask);
            when(taskRepository.findTasksDueThisWeek(eq(100L), any(LocalDateTime.class), any(LocalDateTime.class)))
                    .thenReturn(weekTasks);

            // Act
            List<Task> result = taskService.findTasksDueThisWeek(100L);

            // Assert
            assertThat(result).hasSize(2);
            verify(taskRepository).findTasksDueThisWeek(eq(100L), any(LocalDateTime.class), any(LocalDateTime.class));
        }

        @Test
        @DisplayName("Should search tasks by title and description")
        void shouldSearchTasksByTitleAndDescription() {
            // Arrange
            List<Task> searchResults = Arrays.asList(testTask);
            when(taskRepository.findByUserIdAndTitleContainingIgnoreCaseOrDescriptionContainingIgnoreCase(
                    100L, "test", "test"))
                    .thenReturn(searchResults);

            // Act
            List<Task> result = taskService.searchTasks(100L, "test");

            // Assert
            assertThat(result).hasSize(1);
            assertThat(result.get(0)).isEqualTo(testTask);
        }

        @Test
        @DisplayName("Should find tasks by date range")
        void shouldFindTasksByDateRange() {
            // Arrange
            LocalDateTime startDate = LocalDateTime.now().minusDays(7);
            LocalDateTime endDate = LocalDateTime.now().plusDays(7);
            List<Task> rangeTasks = Arrays.asList(testTask, overdueTask);
            
            when(taskRepository.findByUserIdAndDueDateBetween(100L, startDate, endDate))
                    .thenReturn(rangeTasks);

            // Act
            List<Task> result = taskService.findTasksByDateRange(100L, startDate, endDate);

            // Assert
            assertThat(result).hasSize(2);
            verify(taskRepository).findByUserIdAndDueDateBetween(100L, startDate, endDate);
        }
    }

    @Nested
    @DisplayName("Task Completion")
    class TaskCompletion {

        @Test
        @DisplayName("Should mark task as completed")
        void shouldMarkTaskAsCompleted() {
            // Arrange
            when(taskRepository.findById(1L)).thenReturn(Optional.of(testTask));
            when(taskRepository.save(any(Task.class))).thenReturn(testTask);

            // Act
            Task result = taskService.completeTask(1L);

            // Assert
            assertThat(result.getStatus()).isEqualTo(TaskStatus.COMPLETED);
            assertThat(result.getUpdatedAt()).isNotNull();
            verify(taskRepository).findById(1L);
            verify(taskRepository).save(testTask);
        }

        @Test
        @DisplayName("Should reopen completed task")
        void shouldReopenCompletedTask() {
            // Arrange
            when(taskRepository.findById(3L)).thenReturn(Optional.of(completedTask));
            when(taskRepository.save(any(Task.class))).thenReturn(completedTask);

            // Act
            Task result = taskService.reopenTask(3L);

            // Assert
            assertThat(result.getStatus()).isEqualTo(TaskStatus.PENDING);
            assertThat(result.getUpdatedAt()).isNotNull();
            verify(taskRepository).findById(3L);
            verify(taskRepository).save(completedTask);
        }

        @Test
        @DisplayName("Should find recently completed tasks")
        void shouldFindRecentlyCompletedTasks() {
            // Arrange
            List<Task> recentlyCompleted = Arrays.asList(completedTask);
            when(taskRepository.findRecentlyCompletedTasks(eq(100L), any(LocalDateTime.class)))
                    .thenReturn(recentlyCompleted);

            // Act
            List<Task> result = taskService.findRecentlyCompletedTasks(100L, 7);

            // Assert
            assertThat(result).hasSize(1);
            assertThat(result.get(0)).isEqualTo(completedTask);
        }
    }

    @Nested
    @DisplayName("Error Handling")
    class ErrorHandling {

        @Test
        @DisplayName("Should handle null task creation")
        void shouldHandleNullTaskCreation() {
            // Act & Assert
            assertThatThrownBy(() -> taskService.createTask(null))
                    .isInstanceOf(Exception.class);
        }

        @Test
        @DisplayName("Should handle database exceptions")
        void shouldHandleDatabaseExceptions() {
            // Arrange
            when(taskRepository.save(any(Task.class)))
                    .thenThrow(new RuntimeException("Database error"));

            Task newTask = new Task();
            newTask.setTitle("Test");
            newTask.setUserId(100L);

            // Act & Assert
            assertThatThrownBy(() -> taskService.createTask(newTask))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessage("Database error");
        }

        @Test
        @DisplayName("Should validate required fields")
        void shouldValidateRequiredFields() {
            // Arrange
            Task invalidTask = new Task();
            // Missing required fields like title, userId

            // Act & Assert
            assertThatThrownBy(() -> taskService.createTask(invalidTask))
                    .isInstanceOf(Exception.class);
        }
    }

    @Nested
    @DisplayName("Batch Operations")
    class BatchOperations {

        @Test
        @DisplayName("Should update multiple tasks status")
        void shouldUpdateMultipleTasksStatus() {
            // Arrange
            List<Long> taskIds = Arrays.asList(1L, 2L, 3L);
            List<Task> tasks = Arrays.asList(testTask, overdueTask, completedTask);
            
            when(taskRepository.findAllById(taskIds)).thenReturn(tasks);
            when(taskRepository.saveAll(any())).thenReturn(tasks);

            // Act
            List<Task> result = taskService.updateMultipleTasksStatus(taskIds, TaskStatus.IN_PROGRESS);

            // Assert
            assertThat(result).hasSize(3);
            assertThat(result).allMatch(task -> task.getStatus() == TaskStatus.IN_PROGRESS);
            verify(taskRepository).findAllById(taskIds);
            verify(taskRepository).saveAll(any());
        }

        @Test
        @DisplayName("Should delete multiple tasks")
        void shouldDeleteMultipleTasks() {
            // Arrange
            List<Long> taskIds = Arrays.asList(1L, 2L);

            // Act
            taskService.deleteMultipleTasks(taskIds);

            // Assert
            verify(taskRepository).deleteAllById(taskIds);
        }
    }
}
