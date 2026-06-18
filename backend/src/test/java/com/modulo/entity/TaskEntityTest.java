package com.modulo.entity;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("Task Entity Tests")
class TaskEntityTest {

    @Test
    @DisplayName("constructor sets core fields and timestamps")
    void constructor() {
        Task task = new Task("Title", "Desc", 100L);

        assertThat(task.getTitle()).isEqualTo("Title");
        assertThat(task.getDescription()).isEqualTo("Desc");
        assertThat(task.getUserId()).isEqualTo(100L);
        assertThat(task.getCreatedAt()).isNotNull();
        assertThat(task.getUpdatedAt()).isNotNull();
    }

    @Test
    @DisplayName("scalar getters/setters round-trip")
    void scalarFields() {
        Task t = new Task();
        LocalDateTime now = LocalDateTime.now();

        t.setId(1L);
        t.setTitle("t");
        t.setDescription("d");
        t.setPriority(Task.TaskPriority.HIGH);
        t.setDueDate(now);
        t.setStartDate(now);
        t.setCompletionDate(now);
        t.setEstimatedDurationMinutes(30);
        t.setActualDurationMinutes(45);
        t.setGoogleCalendarEventId("evt");
        t.setUserId(2L);
        t.setCreatedAt(now);
        t.setUpdatedAt(now);
        t.setTags("a,b");
        t.setIsRecurring(true);
        t.setRecurrencePattern("WEEKLY");
        t.setParentTaskId(9L);

        assertThat(t.getId()).isEqualTo(1L);
        assertThat(t.getTitle()).isEqualTo("t");
        assertThat(t.getDescription()).isEqualTo("d");
        assertThat(t.getPriority()).isEqualTo(Task.TaskPriority.HIGH);
        assertThat(t.getDueDate()).isEqualTo(now);
        assertThat(t.getStartDate()).isEqualTo(now);
        assertThat(t.getCompletionDate()).isEqualTo(now);
        assertThat(t.getEstimatedDurationMinutes()).isEqualTo(30);
        assertThat(t.getActualDurationMinutes()).isEqualTo(45);
        assertThat(t.getGoogleCalendarEventId()).isEqualTo("evt");
        assertThat(t.getUserId()).isEqualTo(2L);
        assertThat(t.getTags()).isEqualTo("a,b");
        assertThat(t.getIsRecurring()).isTrue();
        assertThat(t.getRecurrencePattern()).isEqualTo("WEEKLY");
        assertThat(t.getParentTaskId()).isEqualTo(9L);
        assertThat(t.toString()).contains("Task{");
    }

    @Test
    @DisplayName("setStatus to COMPLETED records completion date")
    void completionStatus() {
        Task t = new Task("x", "y", 1L);
        assertThat(t.isCompleted()).isFalse();

        t.setStatus(Task.TaskStatus.COMPLETED);

        assertThat(t.isCompleted()).isTrue();
        assertThat(t.getCompletionDate()).isNotNull();
    }

    @Test
    @DisplayName("progress percentage is clamped to 0..100")
    void progressClamped() {
        Task t = new Task();
        t.setProgressPercentage(150);
        assertThat(t.getProgressPercentage()).isEqualTo(100);
        t.setProgressPercentage(-10);
        assertThat(t.getProgressPercentage()).isEqualTo(0);
        t.setProgressPercentage(55);
        assertThat(t.getProgressPercentage()).isEqualTo(55);
    }

    @Test
    @DisplayName("overdue and due-today helpers reflect the due date")
    void dueDateHelpers() {
        Task overdue = new Task("o", "", 1L);
        overdue.setDueDate(LocalDateTime.now().minusDays(1));
        assertThat(overdue.isOverdue()).isTrue();

        Task dueToday = new Task("d", "", 1L);
        dueToday.setDueDate(java.time.LocalDate.now().atTime(12, 0)); // midday today, deterministic
        assertThat(dueToday.isDueToday()).isTrue();

        Task noDue = new Task("n", "", 1L);
        assertThat(noDue.isOverdue()).isFalse();
        assertThat(noDue.isDueToday()).isFalse();
    }

    @Test
    @DisplayName("linkNote / unlinkNote keep both sides in sync")
    void linkNote() {
        Task t = new Task("t", "", 1L);
        Note note = new Note("n", "c");

        t.linkNote(note);
        assertThat(t.getLinkedNotes()).contains(note);
        assertThat(note.getTasks()).contains(t);

        // linking again is idempotent
        t.linkNote(note);
        assertThat(t.getLinkedNotes()).hasSize(1);

        t.unlinkNote(note);
        assertThat(t.getLinkedNotes()).doesNotContain(note);
        assertThat(note.getTasks()).doesNotContain(t);
    }

    @Test
    @DisplayName("enums expose their values")
    void enums() {
        assertThat(Task.TaskStatus.values()).contains(Task.TaskStatus.COMPLETED);
        assertThat(Task.TaskPriority.values()).contains(Task.TaskPriority.HIGH);
        assertThat(Task.TaskStatus.valueOf("COMPLETED")).isEqualTo(Task.TaskStatus.COMPLETED);
    }
}
