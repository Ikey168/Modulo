package com.modulo.contract;

import com.atlassian.oai.validator.OpenApiInteractionValidator;
import com.atlassian.oai.validator.restassured.OpenApiValidationFilter;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.modulo.ModuloApplication;
import com.modulo.dto.NoteDto;
import com.modulo.dto.TaskDto;
import com.modulo.dto.UserDto;
import com.modulo.entity.User;
import com.modulo.repository.jpa.UserRepository;
import io.restassured.RestAssured;
import io.restassured.http.ContentType;
import io.restassured.specification.RequestSpecification;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.LocalDateTime;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

/**
 * OpenAPI Contract Tests - Validates API endpoints against OpenAPI specification
 * Ensures that all API responses conform to the documented contract
 */
@SpringBootTest(
    classes = ModuloApplication.class,
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT
)
@Testcontainers
@DisplayName("OpenAPI Contract Tests")
class OpenApiContractTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:13")
            .withDatabaseName("modulo_contract_test")
            .withUsername("contract_test_user")
            .withPassword("contract_test_pass");

    @LocalServerPort
    private int port;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    private static OpenApiValidationFilter validationFilter;
    private User testUser;

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "create-drop");
        
        // Test security configuration
        registry.add("modulo.security.jwt-secret", () -> "dGVzdC1vcGVuYXBpLWNvbnRyYWN0LXRlc3RpbmctMTIzNDU2Nzg5MA==");
        registry.add("modulo.security.api-key", () -> "contract_test_api_key");
        registry.add("logging.level.com.modulo", () -> "WARN");
    }

    @BeforeAll
    static void setUpOpenApiValidator() {
        // Initialize OpenAPI validation filter
        OpenApiInteractionValidator validator = OpenApiInteractionValidator
            .createForSpecificationUrl("classpath:api-contract.yaml")
            .build();
        validationFilter = new OpenApiValidationFilter(validator);
    }

    @BeforeEach
    void setUp() {
        RestAssured.port = port;
        RestAssured.enableLoggingOfRequestAndResponseIfValidationFails();

        // Create test user
        testUser = new User();
        testUser.setUsername("contract-test-user");
        testUser.setEmail("contract@test.com");
        testUser.setProviderUserId("contract-provider-123");
        testUser.setProvider("contract-test");
        testUser.setCreatedAt(LocalDateTime.now());
        testUser = userRepository.save(testUser);
    }

    private RequestSpecification givenWithContract() {
        return given()
            .filter(validationFilter)
            .contentType(ContentType.JSON)
            .accept(ContentType.JSON);
    }

    @Nested
    @DisplayName("Note API Contract Tests")
    class NoteApiContractTests {

        @Test
        @WithMockUser(username = "contract-test-user")
        @Transactional
        @DisplayName("Should validate note creation contract")
        void shouldValidateNoteCreationContract() {
            NoteDto newNote = new NoteDto();
            newNote.setTitle("Contract Test Note");
            newNote.setContent("This note validates the API contract for note creation");
            newNote.setUserId(testUser.getId());

            givenWithContract()
                .body(newNote)
            .when()
                .post("/api/notes")
            .then()
                .statusCode(201)
                .body("id", notNullValue())
                .body("title", equalTo("Contract Test Note"))
                .body("content", equalTo(newNote.getContent()))
                .body("userId", equalTo(testUser.getId().intValue()))
                .body("createdAt", notNullValue())
                .body("updatedAt", nullValue());
        }

        @Test
        @WithMockUser(username = "contract-test-user")
        @Transactional
        @DisplayName("Should validate note retrieval contract")
        void shouldValidateNoteRetrievalContract() {
            // First create a note
            NoteDto createNote = new NoteDto();
            createNote.setTitle("Test Note for Retrieval");
            createNote.setContent("Content for retrieval testing");
            createNote.setUserId(testUser.getId());

            Integer noteId = givenWithContract()
                .body(createNote)
            .when()
                .post("/api/notes")
            .then()
                .statusCode(201)
                .extract()
                .path("id");

            // Then retrieve it
            givenWithContract()
            .when()
                .get("/api/notes/{id}", noteId)
            .then()
                .statusCode(200)
                .body("id", equalTo(noteId))
                .body("title", equalTo("Test Note for Retrieval"))
                .body("content", equalTo("Content for retrieval testing"))
                .body("userId", equalTo(testUser.getId().intValue()))
                .body("createdAt", notNullValue());
        }

        @Test
        @WithMockUser(username = "contract-test-user")
        @DisplayName("Should validate note update contract")
        void shouldValidateNoteUpdateContract() {
            // Create a note first
            NoteDto createNote = new NoteDto();
            createNote.setTitle("Original Title");
            createNote.setContent("Original content");
            createNote.setUserId(testUser.getId());

            Integer noteId = givenWithContract()
                .body(createNote)
                .post("/api/notes")
                .then()
                .statusCode(201)
                .extract()
                .path("id");

            // Update the note
            NoteDto updateNote = new NoteDto();
            updateNote.setId(noteId.longValue());
            updateNote.setTitle("Updated Title");
            updateNote.setContent("Updated content for contract validation");
            updateNote.setUserId(testUser.getId());

            givenWithContract()
                .body(updateNote)
            .when()
                .put("/api/notes/{id}", noteId)
            .then()
                .statusCode(200)
                .body("id", equalTo(noteId))
                .body("title", equalTo("Updated Title"))
                .body("content", equalTo("Updated content for contract validation"))
                .body("userId", equalTo(testUser.getId().intValue()))
                .body("updatedAt", notNullValue());
        }

        @Test
        @WithMockUser(username = "contract-test-user")
        @DisplayName("Should validate note deletion contract")
        void shouldValidateNoteDeletionContract() {
            // Create a note first
            NoteDto createNote = new NoteDto();
            createNote.setTitle("Note to Delete");
            createNote.setContent("This note will be deleted");
            createNote.setUserId(testUser.getId());

            Integer noteId = givenWithContract()
                .body(createNote)
                .post("/api/notes")
                .then()
                .statusCode(201)
                .extract()
                .path("id");

            // Delete the note
            givenWithContract()
            .when()
                .delete("/api/notes/{id}", noteId)
            .then()
                .statusCode(204)
                .body(emptyString());
        }

        @Test
        @WithMockUser(username = "contract-test-user")
        @DisplayName("Should validate note search contract")
        void shouldValidateNoteSearchContract() {
            // Create some notes for searching
            for (int i = 1; i <= 3; i++) {
                NoteDto note = new NoteDto();
                note.setTitle("Searchable Note " + i);
                note.setContent("Content for search testing " + i);
                note.setUserId(testUser.getId());

                givenWithContract()
                    .body(note)
                    .post("/api/notes")
                    .then()
                    .statusCode(201);
            }

            // Search for notes
            givenWithContract()
                .queryParam("query", "Searchable")
                .queryParam("userId", testUser.getId())
            .when()
                .get("/api/notes/search")
            .then()
                .statusCode(200)
                .body("$", hasSize(greaterThan(0)))
                .body("[0].title", containsString("Searchable"))
                .body("[0].userId", equalTo(testUser.getId().intValue()));
        }

        @Test
        @WithMockUser(username = "contract-test-user")
        @DisplayName("Should validate note list contract")
        void shouldValidateNoteListContract() {
            // Create some notes
            for (int i = 1; i <= 2; i++) {
                NoteDto note = new NoteDto();
                note.setTitle("List Note " + i);
                note.setContent("Content " + i);
                note.setUserId(testUser.getId());

                givenWithContract()
                    .body(note)
                    .post("/api/notes")
                    .then()
                    .statusCode(201);
            }

            // Get notes list
            givenWithContract()
                .queryParam("userId", testUser.getId())
            .when()
                .get("/api/notes")
            .then()
                .statusCode(200)
                .body("$", hasSize(greaterThanOrEqualTo(2)))
                .body("[0].id", notNullValue())
                .body("[0].title", notNullValue())
                .body("[0].content", notNullValue())
                .body("[0].userId", equalTo(testUser.getId().intValue()));
        }
    }

    @Nested
    @DisplayName("Task API Contract Tests")
    class TaskApiContractTests {

        @Test
        @WithMockUser(username = "contract-test-user")
        @Transactional
        @DisplayName("Should validate task creation contract")
        void shouldValidateTaskCreationContract() {
            TaskDto newTask = new TaskDto();
            newTask.setTitle("Contract Test Task");
            newTask.setDescription("This task validates the API contract");
            newTask.setUserId(testUser.getId());
            newTask.setPriority("HIGH");
            newTask.setDueDate(LocalDateTime.now().plusDays(7));

            givenWithContract()
                .body(newTask)
            .when()
                .post("/api/tasks")
            .then()
                .statusCode(201)
                .body("id", notNullValue())
                .body("title", equalTo("Contract Test Task"))
                .body("description", equalTo("This task validates the API contract"))
                .body("userId", equalTo(testUser.getId().intValue()))
                .body("priority", equalTo("HIGH"))
                .body("completed", equalTo(false))
                .body("createdAt", notNullValue());
        }

        @Test
        @WithMockUser(username = "contract-test-user")
        @DisplayName("Should validate task completion contract")
        void shouldValidateTaskCompletionContract() {
            // Create a task first
            TaskDto createTask = new TaskDto();
            createTask.setTitle("Task to Complete");
            createTask.setDescription("This task will be marked complete");
            createTask.setUserId(testUser.getId());
            createTask.setPriority("MEDIUM");

            Integer taskId = givenWithContract()
                .body(createTask)
                .post("/api/tasks")
                .then()
                .statusCode(201)
                .extract()
                .path("id");

            // Complete the task
            givenWithContract()
            .when()
                .put("/api/tasks/{id}/complete", taskId)
            .then()
                .statusCode(200)
                .body("id", equalTo(taskId))
                .body("completed", equalTo(true))
                .body("updatedAt", notNullValue());
        }

        @Test
        @WithMockUser(username = "contract-test-user")
        @DisplayName("Should validate task list contract")
        void shouldValidateTaskListContract() {
            // Create some tasks
            for (int i = 1; i <= 2; i++) {
                TaskDto task = new TaskDto();
                task.setTitle("List Task " + i);
                task.setDescription("Description " + i);
                task.setUserId(testUser.getId());
                task.setPriority(i == 1 ? "HIGH" : "LOW");

                givenWithContract()
                    .body(task)
                    .post("/api/tasks")
                    .then()
                    .statusCode(201);
            }

            // Get tasks list
            givenWithContract()
                .queryParam("userId", testUser.getId())
            .when()
                .get("/api/tasks")
            .then()
                .statusCode(200)
                .body("$", hasSize(greaterThanOrEqualTo(2)))
                .body("[0].id", notNullValue())
                .body("[0].title", notNullValue())
                .body("[0].userId", equalTo(testUser.getId().intValue()))
                .body("[0].priority", anyOf(equalTo("HIGH"), equalTo("MEDIUM"), equalTo("LOW"), equalTo("URGENT")));
        }
    }

    @Nested
    @DisplayName("Error Response Contract Tests")
    class ErrorResponseContractTests {

        @Test
        @WithMockUser(username = "contract-test-user")
        @DisplayName("Should validate 404 error response contract")
        void shouldValidate404ErrorResponseContract() {
            givenWithContract()
            .when()
                .get("/api/notes/999999")
            .then()
                .statusCode(404)
                .body("error", notNullValue())
                .body("message", notNullValue())
                .body("timestamp", notNullValue());
        }

        @Test
        @WithMockUser(username = "contract-test-user")
        @DisplayName("Should validate 400 error response contract for invalid data")
        void shouldValidate400ErrorResponseContract() {
            // Create invalid note (missing required fields)
            NoteDto invalidNote = new NoteDto();
            invalidNote.setTitle(""); // Invalid empty title
            // Missing content and userId

            givenWithContract()
                .body(invalidNote)
            .when()
                .post("/api/notes")
            .then()
                .statusCode(400)
                .body("error", notNullValue())
                .body("message", notNullValue())
                .body("timestamp", notNullValue());
        }

        @Test
        @DisplayName("Should validate 401 error response contract for unauthorized access")
        void shouldValidate401ErrorResponseContract() {
            // Make request without authentication
            given()
                .filter(validationFilter)
                .contentType(ContentType.JSON)
            .when()
                .get("/api/notes")
            .then()
                .statusCode(401)
                .body("error", notNullValue())
                .body("message", notNullValue())
                .body("timestamp", notNullValue());
        }
    }

    @Nested
    @DisplayName("User API Contract Tests")
    class UserApiContractTests {

        @Test
        @WithMockUser(username = "contract-test-user")
        @DisplayName("Should validate user profile retrieval contract")
        void shouldValidateUserProfileRetrievalContract() {
            givenWithContract()
            .when()
                .get("/api/users/profile")
            .then()
                .statusCode(200)
                .body("id", notNullValue())
                .body("username", equalTo("contract-test-user"))
                .body("email", notNullValue())
                .body("provider", notNullValue())
                .body("createdAt", notNullValue());
        }

        @Test
        @WithMockUser(username = "contract-test-user")
        @DisplayName("Should validate user profile update contract")
        void shouldValidateUserProfileUpdateContract() {
            UserDto updateUser = new UserDto();
            updateUser.setId(testUser.getId());
            updateUser.setUsername("updated-contract-user");
            updateUser.setEmail("updated-contract@test.com");

            givenWithContract()
                .body(updateUser)
            .when()
                .put("/api/users/profile")
            .then()
                .statusCode(200)
                .body("id", equalTo(testUser.getId().intValue()))
                .body("username", equalTo("updated-contract-user"))
                .body("email", equalTo("updated-contract@test.com"));
        }
    }
}
