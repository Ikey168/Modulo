package com.modulo.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.modulo.ModuloApplication;
import com.modulo.dto.NoteDto;
import com.modulo.dto.TaskDto;
import com.modulo.dto.UserDto;
import com.modulo.entity.User;
import com.modulo.repository.jpa.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.containers.MockServerContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import java.time.LocalDateTime;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Comprehensive end-to-end integration tests covering full-stack workflows
 * Uses TestContainers for real database interactions and external service mocking
 */
@SpringBootTest(
    classes = ModuloApplication.class,
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT
)
@AutoConfigureMockMvc
@Testcontainers
@DisplayName("Full Stack Integration Tests")
class FullStackIntegrationTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:13")
            .withDatabaseName("modulo_integration_test")
            .withUsername("test_user")
            .withPassword("test_pass");

    @Container
    static MockServerContainer mockServer = new MockServerContainer(DockerImageName.parse("mockserver/mockserver:5.15.0"));

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    private User testUser;

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        
        // Configure external service URLs to point to MockServer
        registry.add("modulo.external.openai-api-url", () -> "http://localhost:" + mockServer.getServerPort());
        registry.add("modulo.external.blockchain-rpc-url", () -> "http://localhost:" + mockServer.getServerPort());
        registry.add("modulo.external.ipfs-api-url", () -> "http://localhost:" + mockServer.getServerPort());
        
        // Test configuration
        registry.add("modulo.security.jwt-secret", () -> "dGVzdC1qd3Qtc2VjcmV0LWZvci1pbnRlZ3JhdGlvbi10ZXN0aW5nLTEyMzQ1Njc4OTA=");
        registry.add("modulo.security.api-key", () -> "test_api_key_integration");
        registry.add("logging.level.com.modulo", () -> "DEBUG");
    }

    @BeforeEach
    void setUp() {
        // Create a test user for authenticated operations
        testUser = new User();
        testUser.setUsername("integration-test-user");
        testUser.setEmail("test@integration.com");
        testUser.setProviderUserId("test-provider-id");
        testUser.setProvider("integration-test");
        testUser.setCreatedAt(LocalDateTime.now());
        testUser = userRepository.save(testUser);
    }

    @Nested
    @DisplayName("Complete Note Workflow Integration")
    class NoteWorkflowIntegration {

        @Test
        @WithMockUser(username = "integration-test-user")
        @Transactional
        @DisplayName("Should complete full note creation and management workflow")
        void shouldCompleteFullNoteWorkflow() throws Exception {
            // Step 1: Create a new note
            NoteDto newNote = new NoteDto();
            newNote.setTitle("Integration Test Note");
            newNote.setContent("This is a comprehensive integration test note with **markdown** formatting.");
            newNote.setUserId(testUser.getId());

            String noteResponse = mockMvc.perform(post("/api/notes")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(newNote))
                    .with(csrf()))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.title").value("Integration Test Note"))
                    .andExpect(jsonPath("$.content").value(newNote.getContent()))
                    .andExpect(jsonPath("$.userId").value(testUser.getId()))
                    .andExpect(jsonPath("$.id").exists())
                    .andReturn()
                    .getResponse()
                    .getContentAsString();

            NoteDto createdNote = objectMapper.readValue(noteResponse, NoteDto.class);
            Long noteId = createdNote.getId();

            // Step 2: Retrieve the created note
            mockMvc.perform(get("/api/notes/" + noteId))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value(noteId))
                    .andExpect(jsonPath("$.title").value("Integration Test Note"))
                    .andExpect(jsonPath("$.content").value(newNote.getContent()));

            // Step 3: Update the note
            newNote.setId(noteId);
            newNote.setTitle("Updated Integration Test Note");
            newNote.setContent("Updated content with additional **formatting** and `code blocks`.");

            mockMvc.perform(put("/api/notes/" + noteId)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(newNote))
                    .with(csrf()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.title").value("Updated Integration Test Note"))
                    .andExpect(jsonPath("$.content").value(newNote.getContent()));

            // Step 4: Search for the note
            mockMvc.perform(get("/api/notes/search")
                    .param("query", "Updated Integration")
                    .param("userId", testUser.getId().toString()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$").isArray())
                    .andExpect(jsonPath("$.length()").value(1))
                    .andExpect(jsonPath("$[0].id").value(noteId));

            // Step 5: Delete the note
            mockMvc.perform(delete("/api/notes/" + noteId)
                    .with(csrf()))
                    .andExpect(status().isNoContent());

            // Step 6: Verify note is deleted
            mockMvc.perform(get("/api/notes/" + noteId))
                    .andExpect(status().isNotFound());
        }

        @Test
        @WithMockUser(username = "integration-test-user")
        @Transactional
        @DisplayName("Should handle note with tags integration")
        void shouldHandleNoteWithTagsIntegration() throws Exception {
            // Create note with tags
            NoteDto noteWithTags = new NoteDto();
            noteWithTags.setTitle("Tagged Note");
            noteWithTags.setContent("Note with multiple tags");
            noteWithTags.setUserId(testUser.getId());

            String response = mockMvc.perform(post("/api/notes")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(noteWithTags))
                    .with(csrf()))
                    .andExpect(status().isCreated())
                    .andReturn()
                    .getResponse()
                    .getContentAsString();

            NoteDto createdNote = objectMapper.readValue(response, NoteDto.class);

            // Add tags to the note
            mockMvc.perform(post("/api/notes/" + createdNote.getId() + "/tags")
                    .param("tagName", "integration")
                    .param("color", "#FF5733")
                    .with(csrf()))
                    .andExpect(status().isOk());

            mockMvc.perform(post("/api/notes/" + createdNote.getId() + "/tags")
                    .param("tagName", "testing")
                    .param("color", "#33FF57")
                    .with(csrf()))
                    .andExpect(status().isOk());

            // Verify tags are associated
            mockMvc.perform(get("/api/notes/" + createdNote.getId() + "/tags"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$").isArray())
                    .andExpect(jsonPath("$.length()").value(2));
        }
    }

    @Nested
    @DisplayName("Task Management Integration")
    class TaskManagementIntegration {

        @Test
        @WithMockUser(username = "integration-test-user")
        @Transactional
        @DisplayName("Should complete full task lifecycle")
        void shouldCompleteFullTaskLifecycle() throws Exception {
            // Create a task
            TaskDto newTask = new TaskDto();
            newTask.setTitle("Integration Test Task");
            newTask.setDescription("Comprehensive task testing");
            newTask.setUserId(testUser.getId());
            newTask.setPriority("HIGH");
            newTask.setDueDate(LocalDateTime.now().plusDays(7));

            String taskResponse = mockMvc.perform(post("/api/tasks")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(newTask))
                    .with(csrf()))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.title").value("Integration Test Task"))
                    .andExpect(jsonPath("$.priority").value("HIGH"))
                    .andExpect(jsonPath("$.completed").value(false))
                    .andReturn()
                    .getResponse()
                    .getContentAsString();

            TaskDto createdTask = objectMapper.readValue(taskResponse, TaskDto.class);
            Long taskId = createdTask.getId();

            // Update task status to in progress
            createdTask.setStatus("IN_PROGRESS");
            mockMvc.perform(put("/api/tasks/" + taskId)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(createdTask))
                    .with(csrf()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("IN_PROGRESS"));

            // Complete the task
            mockMvc.perform(put("/api/tasks/" + taskId + "/complete")
                    .with(csrf()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.completed").value(true));

            // Get user's task statistics
            mockMvc.perform(get("/api/tasks/statistics")
                    .param("userId", testUser.getId().toString()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.completedTasks").exists())
                    .andExpect(jsonPath("$.totalTasks").exists());
        }

        @Test
        @WithMockUser(username = "integration-test-user")
        @Transactional
        @DisplayName("Should handle overdue task detection")
        void shouldHandleOverdueTaskDetection() throws Exception {
            // Create an overdue task
            TaskDto overdueTask = new TaskDto();
            overdueTask.setTitle("Overdue Task");
            overdueTask.setDescription("This task is already overdue");
            overdueTask.setUserId(testUser.getId());
            overdueTask.setDueDate(LocalDateTime.now().minusDays(1)); // Past due date
            overdueTask.setPriority("MEDIUM");

            mockMvc.perform(post("/api/tasks")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(overdueTask))
                    .with(csrf()))
                    .andExpect(status().isCreated());

            // Get overdue tasks
            mockMvc.perform(get("/api/tasks/overdue")
                    .param("userId", testUser.getId().toString()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$").isArray())
                    .andExpect(jsonPath("$.length()").value(1))
                    .andExpect(jsonPath("$[0].title").value("Overdue Task"));
        }
    }

    @Nested
    @DisplayName("User Management Integration")
    class UserManagementIntegration {

        @Test
        @WithMockUser(username = "integration-test-user")
        @DisplayName("Should handle user profile operations")
        void shouldHandleUserProfileOperations() throws Exception {
            // Get user profile
            mockMvc.perform(get("/api/users/profile"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.username").value("integration-test-user"))
                    .andExpect(jsonPath("$.email").value("test@integration.com"));

            // Update user profile
            UserDto updatedUser = new UserDto();
            updatedUser.setId(testUser.getId());
            updatedUser.setUsername("updated-integration-user");
            updatedUser.setEmail("updated@integration.com");

            mockMvc.perform(put("/api/users/profile")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(updatedUser))
                    .with(csrf()))
                    .andExpected status().isOk())
                    .andExpect(jsonPath("$.username").value("updated-integration-user"))
                    .andExpect(jsonPath("$.email").value("updated@integration.com"));
        }

        @Test
        @WithMockUser(username = "integration-test-user", authorities = {"ADMIN"})
        @DisplayName("Should handle admin user operations")
        void shouldHandleAdminUserOperations() throws Exception {
            // Get all users (admin operation)
            mockMvc.perform(get("/api/users"))
                    .andExpect(status().isOk())
                    .andExpected jsonPath("$").isArray())
                    .andExpect(jsonPath("$.length()").isNumber());

            // Search users
            mockMvc.perform(get("/api/users/search")
                    .param("query", "integration"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$").isArray());
        }
    }

    @Nested
    @DisplayName("Cross-Component Integration")
    class CrossComponentIntegration {

        @Test
        @WithMockUser(username = "integration-test-user")
        @Transactional
        @DisplayName("Should integrate notes and tasks")
        void shouldIntegrateNotesAndTasks() throws Exception {
            // Create a note
            NoteDto note = new NoteDto();
            note.setTitle("Project Planning Note");
            note.setContent("Planning for the integration project");
            note.setUserId(testUser.getId());

            String noteResponse = mockMvc.perform(post("/api/notes")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(note))
                    .with(csrf()))
                    .andExpect(status().isCreated())
                    .andReturn()
                    .getResponse()
                    .getContentAsString();

            NoteDto createdNote = objectMapper.readValue(noteResponse, NoteDto.class);

            // Create a task related to the note
            TaskDto task = new TaskDto();
            task.setTitle("Review Project Planning");
            task.setDescription("Review the planning note: " + createdNote.getTitle());
            task.setUserId(testUser.getId());
            task.setPriority("HIGH");
            task.setDueDate(LocalDateTime.now().plusDays(3));

            mockMvc.perform(post("/api/tasks")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(task))
                    .with(csrf()))
                    .andExpected status().isCreated())
                    .andExpect(jsonPath("$.title").value("Review Project Planning"));

            // Search across both notes and tasks
            mockMvc.perform(get("/api/search/global")
                    .param("query", "Project Planning")
                    .param("userId", testUser.getId().toString()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$").exists());
        }

        @Test
        @WithMockUser(username = "integration-test-user")
        @Transactional
        @DisplayName("Should handle data consistency across operations")
        void shouldHandleDataConsistencyAcrossOperations() throws Exception {
            // Create multiple notes and tasks in a transaction
            for (int i = 1; i <= 3; i++) {
                NoteDto note = new NoteDto();
                note.setTitle("Batch Note " + i);
                note.setContent("Content for batch note " + i);
                note.setUserId(testUser.getId());

                mockMvc.perform(post("/api/notes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(note))
                        .with(csrf()))
                        .andExpect(status().isCreated());

                TaskDto task = new TaskDto();
                task.setTitle("Batch Task " + i);
                task.setDescription("Task for batch operation " + i);
                task.setUserId(testUser.getId());
                task.setPriority("MEDIUM");

                mockMvc.perform(post("/api/tasks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(task))
                        .with(csrf()))
                        .andExpect(status().isCreated());
            }

            // Verify all data was created consistently
            mockMvc.perform(get("/api/notes")
                    .param("userId", testUser.getId().toString()))
                    .andExpect(status().isOk())
                    .andExpected jsonPath("$.length()").value(3));

            mockMvc.perform(get("/api/tasks")
                    .param("userId", testUser.getId().toString()))
                    .andExpect(status().isOk())
                    .andExpected jsonPath("$.length()").value(3));
        }
    }

    @Nested
    @DisplayName("Error Handling Integration")
    class ErrorHandlingIntegration {

        @Test
        @WithMockUser(username = "integration-test-user")
        @DisplayName("Should handle validation errors consistently")
        void shouldHandleValidationErrorsConsistently() throws Exception {
            // Test invalid note creation
            NoteDto invalidNote = new NoteDto();
            invalidNote.setTitle(""); // Invalid empty title
            invalidNote.setContent("Valid content");
            invalidNote.setUserId(testUser.getId());

            mockMvc.perform(post("/api/notes")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(invalidNote))
                    .with(csrf()))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").exists());

            // Test invalid task creation
            TaskDto invalidTask = new TaskDto();
            invalidTask.setTitle(""); // Invalid empty title
            invalidTask.setUserId(testUser.getId());

            mockMvc.perform(post("/api/tasks")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(invalidTask))
                    .with(csrf()))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").exists());
        }

        @Test
        @WithMockUser(username = "integration-test-user")
        @DisplayName("Should handle not found errors properly")
        void shouldHandleNotFoundErrorsProperly() throws Exception {
            // Test accessing non-existent note
            mockMvc.perform(get("/api/notes/99999"))
                    .andExpect(status().isNotFound());

            // Test accessing non-existent task
            mockMvc.perform(get("/api/tasks/99999"))
                    .andExpected status().isNotFound());

            // Test deleting non-existent resources
            mockMvc.perform(delete("/api/notes/99999")
                    .with(csrf()))
                    .andExpect(status().isNotFound());
        }
    }
}
