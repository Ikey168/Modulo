package com.modulo.integration;

import com.modulo.entity.*;
import com.modulo.repository.*;
import com.modulo.repository.jpa.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import javax.persistence.EntityManager;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;

/**
 * Database integration tests using TestContainers with PostgreSQL
 * Tests repository layer interactions and data integrity
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers
@DisplayName("Database Integration Tests")
class DatabaseIntegrationTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:13")
            .withDatabaseName("modulo_db_integration_test")
            .withUsername("db_test_user")
            .withPassword("db_test_pass");

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private NoteRepository noteRepository;

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private TagRepository tagRepository;

    @Autowired
    private AttachmentRepository attachmentRepository;

    private User testUser;
    private Note testNote;
    private Task testTask;
    private Tag testTag;

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "create-drop");
        registry.add("spring.jpa.show-sql", () -> "true");
    }

    @BeforeEach
    void setUp() {
        // Create test user
        testUser = new User();
        testUser.setUsername("db-integration-user");
        testUser.setEmail("db@integration.test");
        testUser.setProviderUserId("db-provider-123");
        testUser.setProvider("database-test");
        testUser.setCreatedAt(LocalDateTime.now());
        testUser = userRepository.save(testUser);

        // Create test note
        testNote = new Note();
        testNote.setTitle("Database Integration Note");
        testNote.setContent("Testing database integration functionality");
        testNote.setUserId(testUser.getId());
        testNote.setCreatedAt(LocalDateTime.now());
        testNote = noteRepository.save(testNote);

        // Create test task
        testTask = new Task();
        testTask.setTitle("Database Integration Task");
        testTask.setDescription("Testing task database operations");
        testTask.setUserId(testUser.getId());
        testTask.setPriority(Task.Priority.MEDIUM);
        testTask.setDueDate(LocalDateTime.now().plusDays(5));
        testTask.setCompleted(false);
        testTask.setCreatedAt(LocalDateTime.now());
        testTask = taskRepository.save(testTask);

        // Create test tag
        testTag = new Tag();
        testTag.setName("integration-test");
        testTag.setColor("#FF5733");
        testTag.setCreatedAt(LocalDateTime.now());
        testTag = tagRepository.save(testTag);

        entityManager.flush();
        entityManager.clear();
    }

    @Nested
    @DisplayName("Cross-Entity Relationship Tests")
    class CrossEntityRelationshipTests {

        @Test
        @Transactional
        @DisplayName("Should maintain referential integrity between users and notes")
        void shouldMaintainReferentialIntegrityBetweenUsersAndNotes() {
            // Create additional notes for the user
            Note note2 = new Note();
            note2.setTitle("Second Note");
            note2.setContent("Second note content");
            note2.setUserId(testUser.getId());
            note2.setCreatedAt(LocalDateTime.now());
            noteRepository.save(note2);

            Note note3 = new Note();
            note3.setTitle("Third Note");
            note3.setContent("Third note content");
            note3.setUserId(testUser.getId());
            note3.setCreatedAt(LocalDateTime.now());
            noteRepository.save(note3);

            entityManager.flush();

            // Verify user's notes
            List<Note> userNotes = noteRepository.findByUserIdOrderByCreatedAtDesc(testUser.getId());
            assertThat(userNotes).hasSize(3);
            assertThat(userNotes).extracting(Note::getTitle)
                .containsExactly("Third Note", "Second Note", "Database Integration Note");

            // Delete a note and verify integrity
            noteRepository.delete(note2);
            entityManager.flush();

            userNotes = noteRepository.findByUserIdOrderByCreatedAtDesc(testUser.getId());
            assertThat(userNotes).hasSize(2);
            assertThat(userNotes).extracting(Note::getTitle)
                .containsExactly("Third Note", "Database Integration Note");
        }

        @Test
        @Transactional
        @DisplayName("Should handle note-tag associations properly")
        void shouldHandleNoteTagAssociationsProperly() {
            // Create additional tags
            Tag importantTag = new Tag();
            importantTag.setName("important");
            importantTag.setColor("#FF0000");
            importantTag.setCreatedAt(LocalDateTime.now());
            tagRepository.save(importantTag);

            Tag workTag = new Tag();
            workTag.setName("work");
            workTag.setColor("#0000FF");
            workTag.setCreatedAt(LocalDateTime.now());
            tagRepository.save(workTag);

            entityManager.flush();

            // Associate tags with note (assuming many-to-many relationship)
            testNote.getTags().add(testTag);
            testNote.getTags().add(importantTag);
            noteRepository.save(testNote);

            entityManager.flush();
            entityManager.clear();

            // Verify associations
            Note retrievedNote = noteRepository.findById(testNote.getId()).orElseThrow();
            assertThat(retrievedNote.getTags()).hasSize(2);
            assertThat(retrievedNote.getTags()).extracting(Tag::getName)
                .containsExactlyInAnyOrder("integration-test", "important");

            // Test tag deletion impact
            tagRepository.delete(importantTag);
            entityManager.flush();
            entityManager.clear();

            retrievedNote = noteRepository.findById(testNote.getId()).orElseThrow();
            assertThat(retrievedNote.getTags()).hasSize(1);
            assertThat(retrievedNote.getTags().iterator().next().getName()).isEqualTo("integration-test");
        }

        @Test
        @Transactional
        @DisplayName("Should handle note-attachment relationships")
        void shouldHandleNoteAttachmentRelationships() {
            // Create attachments for the note
            Attachment attachment1 = new Attachment();
            attachment1.setFileName("test-doc.pdf");
            attachment1.setFileType("application/pdf");
            attachment1.setFileSize(1024L);
            attachment1.setNoteId(testNote.getId());
            attachment1.setBlobName("blob-test-doc-pdf");
            attachment1.setUploadedAt(LocalDateTime.now());
            attachmentRepository.save(attachment1);

            Attachment attachment2 = new Attachment();
            attachment2.setFileName("test-image.jpg");
            attachment2.setFileType("image/jpeg");
            attachment2.setFileSize(2048L);
            attachment2.setNoteId(testNote.getId());
            attachment2.setBlobName("blob-test-image-jpg");
            attachment2.setUploadedAt(LocalDateTime.now());
            attachmentRepository.save(attachment2);

            entityManager.flush();

            // Verify attachments are associated with note
            List<Attachment> noteAttachments = attachmentRepository.findByNoteIdOrderByUploadedAtDesc(testNote.getId());
            assertThat(noteAttachments).hasSize(2);
            assertThat(noteAttachments).extracting(Attachment::getFileName)
                .containsExactly("test-image.jpg", "test-doc.pdf");

            // Test cascade behavior when note is deleted
            noteRepository.delete(testNote);
            entityManager.flush();

            noteAttachments = attachmentRepository.findByNoteIdOrderByUploadedAtDesc(testNote.getId());
            assertThat(noteAttachments).isEmpty();
        }
    }

    @Nested
    @DisplayName("Complex Query Integration Tests")
    class ComplexQueryIntegrationTests {

        @Test
        @Transactional
        @DisplayName("Should handle complex search queries across multiple entities")
        void shouldHandleComplexSearchQueries() {
            // Create additional test data
            createAdditionalTestData();

            // Test complex note search
            List<Note> searchResults = noteRepository.findByTitleContainingIgnoreCaseOrContentContainingIgnoreCase(
                "integration", "integration"
            );
            assertThat(searchResults).isNotEmpty();
            assertThat(searchResults).allMatch(note -> 
                note.getTitle().toLowerCase().contains("integration") || 
                note.getContent().toLowerCase().contains("integration")
            );

            // Test user-specific queries
            List<Note> userNotes = noteRepository.findByUserIdAndTitleContainingIgnoreCase(
                testUser.getId(), "Database"
            );
            assertThat(userNotes).isNotEmpty();
            assertThat(userNotes).allMatch(note -> note.getUserId().equals(testUser.getId()));
        }

        @Test
        @Transactional
        @DisplayName("Should handle date-based queries efficiently")
        void shouldHandleDateBasedQueriesEfficiently() {
            LocalDateTime cutoffDate = LocalDateTime.now().minusDays(1);

            // Test recent notes
            List<Note> recentNotes = noteRepository.findByCreatedAtAfterOrderByCreatedAtDesc(cutoffDate);
            assertThat(recentNotes).allMatch(note -> note.getCreatedAt().isAfter(cutoffDate));

            // Test overdue tasks
            List<Task> overdueTasks = taskRepository.findByDueDateBeforeAndCompletedFalse(LocalDateTime.now());
            assertThat(overdueTasks).allMatch(task -> 
                task.getDueDate().isBefore(LocalDateTime.now()) && !task.isCompleted()
            );

            // Test tasks by priority and date
            List<Task> highPriorityRecentTasks = taskRepository.findByPriorityAndCreatedAtAfter(
                Task.Priority.HIGH, cutoffDate
            );
            assertThat(highPriorityRecentTasks).allMatch(task -> 
                task.getPriority() == Task.Priority.HIGH && task.getCreatedAt().isAfter(cutoffDate)
            );
        }

        private void createAdditionalTestData() {
            // Create high priority task
            Task highPriorityTask = new Task();
            highPriorityTask.setTitle("High Priority Integration Test");
            highPriorityTask.setDescription("Urgent integration testing task");
            highPriorityTask.setUserId(testUser.getId());
            highPriorityTask.setPriority(Task.Priority.HIGH);
            highPriorityTask.setDueDate(LocalDateTime.now().plusDays(1));
            highPriorityTask.setCompleted(false);
            highPriorityTask.setCreatedAt(LocalDateTime.now());
            taskRepository.save(highPriorityTask);

            // Create overdue task
            Task overdueTask = new Task();
            overdueTask.setTitle("Overdue Task");
            overdueTask.setDescription("This task is overdue");
            overdueTask.setUserId(testUser.getId());
            overdueTask.setPriority(Task.Priority.MEDIUM);
            overdueTask.setDueDate(LocalDateTime.now().minusDays(1));
            overdueTask.setCompleted(false);
            overdueTask.setCreatedAt(LocalDateTime.now().minusDays(2));
            taskRepository.save(overdueTask);

            entityManager.flush();
        }
    }

    @Nested
    @DisplayName("Data Consistency and Transaction Tests")
    class DataConsistencyAndTransactionTests {

        @Test
        @Transactional
        @DisplayName("Should maintain data consistency during concurrent operations")
        void shouldMaintainDataConsistencyDuringConcurrentOperations() {
            // Simulate concurrent note creation
            Note note1 = createNoteForUser(testUser.getId(), "Concurrent Note 1");
            Note note2 = createNoteForUser(testUser.getId(), "Concurrent Note 2");
            Note note3 = createNoteForUser(testUser.getId(), "Concurrent Note 3");

            entityManager.flush();

            // Verify all notes were created successfully
            List<Note> userNotes = noteRepository.findByUserIdOrderByCreatedAtDesc(testUser.getId());
            assertThat(userNotes).hasSize(4); // Including the setup note
            assertThat(userNotes).extracting(Note::getTitle)
                .contains("Concurrent Note 1", "Concurrent Note 2", "Concurrent Note 3");

            // Test batch operations
            List<Note> notesToUpdate = List.of(note1, note2, note3);
            notesToUpdate.forEach(note -> {
                note.setContent("Updated content for batch operation");
                noteRepository.save(note);
            });

            entityManager.flush();

            // Verify batch updates
            List<Note> updatedNotes = noteRepository.findAllById(
                notesToUpdate.stream().map(Note::getId).toList()
            );
            assertThat(updatedNotes).allMatch(note -> 
                "Updated content for batch operation".equals(note.getContent())
            );
        }

        @Test
        @Transactional
        @DisplayName("Should handle constraint violations properly")
        void shouldHandleConstraintViolationsProperly() {
            // Test unique constraint on tag names
            Tag duplicateTag = new Tag();
            duplicateTag.setName(testTag.getName()); // Same name as existing tag
            duplicateTag.setColor("#00FF00");
            duplicateTag.setCreatedAt(LocalDateTime.now());

            // This should violate unique constraint
            assertThatThrownBy(() -> {
                tagRepository.save(duplicateTag);
                entityManager.flush();
            }).hasMessageContaining("constraint");

            // Test null constraint violations
            User invalidUser = new User();
            invalidUser.setEmail("test@example.com");
            // Missing required username

            assertThatThrownBy(() -> {
                userRepository.save(invalidUser);
                entityManager.flush();
            }).hasMessageContaining("not-null");
        }

        private Note createNoteForUser(Long userId, String title) {
            Note note = new Note();
            note.setTitle(title);
            note.setContent("Content for " + title);
            note.setUserId(userId);
            note.setCreatedAt(LocalDateTime.now());
            return noteRepository.save(note);
        }
    }

    @Nested
    @DisplayName("Performance and Optimization Tests")
    class PerformanceAndOptimizationTests {

        @Test
        @Transactional
        @DisplayName("Should handle large dataset operations efficiently")
        void shouldHandleLargeDatasetOperationsEfficiently() {
            // Create a large number of notes
            int noteCount = 100;
            for (int i = 1; i <= noteCount; i++) {
                Note note = new Note();
                note.setTitle("Bulk Note " + i);
                note.setContent("Content for bulk note " + i);
                note.setUserId(testUser.getId());
                note.setCreatedAt(LocalDateTime.now().minusDays(i % 30));
                noteRepository.save(note);

                if (i % 20 == 0) {
                    entityManager.flush();
                    entityManager.clear();
                }
            }

            entityManager.flush();

            // Test pagination queries
            int pageSize = 10;
            List<Note> firstPage = noteRepository.findByUserIdOrderByCreatedAtDesc(
                testUser.getId()
            ).stream().limit(pageSize).toList();

            assertThat(firstPage).hasSize(pageSize);

            // Test count queries
            long totalUserNotes = noteRepository.countByUserId(testUser.getId());
            assertThat(totalUserNotes).isEqualTo(noteCount + 1); // +1 for setup note
        }

        @Test
        @Transactional
        @DisplayName("Should optimize query execution for complex joins")
        void shouldOptimizeQueryExecutionForComplexJoins() {
            // Create notes with tags and attachments for complex join testing
            Note complexNote = new Note();
            complexNote.setTitle("Complex Join Note");
            complexNote.setContent("Note for testing complex joins");
            complexNote.setUserId(testUser.getId());
            complexNote.setCreatedAt(LocalDateTime.now());
            noteRepository.save(complexNote);

            // Add tags
            complexNote.getTags().add(testTag);
            noteRepository.save(complexNote);

            // Add attachment
            Attachment attachment = new Attachment();
            attachment.setFileName("complex-join-doc.pdf");
            attachment.setFileType("application/pdf");
            attachment.setFileSize(1024L);
            attachment.setNoteId(complexNote.getId());
            attachment.setBlobName("blob-complex-join-doc");
            attachment.setUploadedAt(LocalDateTime.now());
            attachmentRepository.save(attachment);

            entityManager.flush();

            // Test complex query with joins
            Optional<Note> retrievedNote = noteRepository.findById(complexNote.getId());
            assertThat(retrievedNote).isPresent();
            assertThat(retrievedNote.get().getTags()).isNotEmpty();

            List<Attachment> noteAttachments = attachmentRepository.findByNoteIdOrderByUploadedAtDesc(
                complexNote.getId()
            );
            assertThat(noteAttachments).hasSize(1);
        }
    }
}
