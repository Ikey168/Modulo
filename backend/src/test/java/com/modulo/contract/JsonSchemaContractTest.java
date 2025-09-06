package com.modulo.contract;

import io.restassured.RestAssured;
import io.restassured.http.ContentType;
import io.restassured.module.jsv.JsonSchemaValidator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

/**
 * JSON Schema Contract Tests
 * Validates API responses against JSON Schema definitions
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
@DisplayName("JSON Schema Contract Tests")
class JsonSchemaContractTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:13")
            .withDatabaseName("modulo_schema_test")
            .withUsername("schema_test_user")
            .withPassword("schema_test_pass");

    @LocalServerPort
    private int port;

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "create-drop");
        registry.add("modulo.security.jwt-secret", () -> "dGVzdC1qc29uLXNjaGVtYS1jb250cmFjdC10ZXN0aW5nLTEyMzQ1Njc4OTA=");
        registry.add("logging.level.com.modulo", () -> "WARN");
    }

    @BeforeEach
    void setUp() {
        RestAssured.port = port;
        RestAssured.enableLoggingOfRequestAndResponseIfValidationFails();
    }

    @Nested
    @DisplayName("Note Schema Contract Tests")
    class NoteSchemaContractTests {

        @Test
        @WithMockUser(username = "schema-test-user")
        @DisplayName("Should validate note response schema")
        void shouldValidateNoteResponseSchema() {
            // Create a note and validate its response schema
            String noteJson = """
                {
                  "title": "Schema Test Note",
                  "content": "This note validates JSON schema contract",
                  "userId": 1
                }
                """;

            given()
                .contentType(ContentType.JSON)
                .body(noteJson)
            .when()
                .post("/api/notes")
            .then()
                .statusCode(201)
                .assertThat()
                .body(JsonSchemaValidator.matchesJsonSchemaInClasspath("schemas/note-response-schema.json"))
                .body("id", isA(Number.class))
                .body("title", isA(String.class))
                .body("content", isA(String.class))
                .body("userId", isA(Number.class))
                .body("createdAt", isA(String.class))
                .body("updatedAt", anyOf(nullValue(), isA(String.class)));
        }

        @Test
        @WithMockUser(username = "schema-test-user")
        @DisplayName("Should validate note list response schema")
        void shouldValidateNoteListResponseSchema() {
            // Create some notes first
            String noteJson1 = """
                {
                  "title": "First Schema Note",
                  "content": "First note content",
                  "userId": 1
                }
                """;
            String noteJson2 = """
                {
                  "title": "Second Schema Note",
                  "content": "Second note content",
                  "userId": 1
                }
                """;

            given().contentType(ContentType.JSON).body(noteJson1).post("/api/notes").then().statusCode(201);
            given().contentType(ContentType.JSON).body(noteJson2).post("/api/notes").then().statusCode(201);

            // Validate list response schema
            given()
                .queryParam("userId", 1)
            .when()
                .get("/api/notes")
            .then()
                .statusCode(200)
                .assertThat()
                .body(JsonSchemaValidator.matchesJsonSchemaInClasspath("schemas/note-list-response-schema.json"))
                .body("$", isA(Iterable.class))
                .body("$", hasSize(greaterThanOrEqualTo(2)));
        }
    }

    @Nested
    @DisplayName("Task Schema Contract Tests")
    class TaskSchemaContractTests {

        @Test
        @WithMockUser(username = "schema-test-user")
        @DisplayName("Should validate task response schema")
        void shouldValidateTaskResponseSchema() {
            String taskJson = """
                {
                  "title": "Schema Test Task",
                  "description": "This task validates JSON schema contract",
                  "userId": 1,
                  "priority": "HIGH",
                  "dueDate": "2024-12-31T23:59:59"
                }
                """;

            given()
                .contentType(ContentType.JSON)
                .body(taskJson)
            .when()
                .post("/api/tasks")
            .then()
                .statusCode(201)
                .assertThat()
                .body(JsonSchemaValidator.matchesJsonSchemaInClasspath("schemas/task-response-schema.json"))
                .body("id", isA(Number.class))
                .body("title", isA(String.class))
                .body("description", isA(String.class))
                .body("userId", isA(Number.class))
                .body("priority", isA(String.class))
                .body("completed", isA(Boolean.class))
                .body("dueDate", anyOf(nullValue(), isA(String.class)))
                .body("createdAt", isA(String.class));
        }

        @Test
        @WithMockUser(username = "schema-test-user")
        @DisplayName("Should validate task completion response schema")
        void shouldValidateTaskCompletionResponseSchema() {
            // Create a task first
            String taskJson = """
                {
                  "title": "Task to Complete",
                  "description": "This task will be completed",
                  "userId": 1,
                  "priority": "MEDIUM"
                }
                """;

            Integer taskId = given()
                .contentType(ContentType.JSON)
                .body(taskJson)
                .post("/api/tasks")
                .then()
                .statusCode(201)
                .extract()
                .path("id");

            // Complete the task and validate response schema
            given()
            .when()
                .put("/api/tasks/{id}/complete", taskId)
            .then()
                .statusCode(200)
                .assertThat()
                .body(JsonSchemaValidator.matchesJsonSchemaInClasspath("schemas/task-response-schema.json"))
                .body("completed", equalTo(true))
                .body("updatedAt", isA(String.class));
        }
    }

    @Nested
    @DisplayName("User Schema Contract Tests")
    class UserSchemaContractTests {

        @Test
        @WithMockUser(username = "schema-test-user")
        @DisplayName("Should validate user profile response schema")
        void shouldValidateUserProfileResponseSchema() {
            given()
            .when()
                .get("/api/users/profile")
            .then()
                .statusCode(200)
                .assertThat()
                .body(JsonSchemaValidator.matchesJsonSchemaInClasspath("schemas/user-response-schema.json"))
                .body("id", isA(Number.class))
                .body("username", isA(String.class))
                .body("email", anyOf(nullValue(), isA(String.class)))
                .body("provider", anyOf(nullValue(), isA(String.class)))
                .body("providerUserId", anyOf(nullValue(), isA(String.class)))
                .body("createdAt", isA(String.class));
        }
    }

    @Nested
    @DisplayName("Error Schema Contract Tests")
    class ErrorSchemaContractTests {

        @Test
        @WithMockUser(username = "schema-test-user")
        @DisplayName("Should validate 404 error response schema")
        void shouldValidate404ErrorResponseSchema() {
            given()
            .when()
                .get("/api/notes/999999")
            .then()
                .statusCode(404)
                .assertThat()
                .body(JsonSchemaValidator.matchesJsonSchemaInClasspath("schemas/error-response-schema.json"))
                .body("error", isA(String.class))
                .body("message", isA(String.class))
                .body("timestamp", isA(String.class))
                .body("status", isA(Number.class))
                .body("path", isA(String.class));
        }

        @Test
        @WithMockUser(username = "schema-test-user")
        @DisplayName("Should validate 400 validation error response schema")
        void shouldValidate400ValidationErrorResponseSchema() {
            String invalidNoteJson = """
                {
                  "title": "",
                  "content": null,
                  "userId": null
                }
                """;

            given()
                .contentType(ContentType.JSON)
                .body(invalidNoteJson)
            .when()
                .post("/api/notes")
            .then()
                .statusCode(400)
                .assertThat()
                .body(JsonSchemaValidator.matchesJsonSchemaInClasspath("schemas/error-response-schema.json"))
                .body("error", isA(String.class))
                .body("message", isA(String.class))
                .body("timestamp", isA(String.class))
                .body("status", equalTo(400));
        }

        @Test
        @DisplayName("Should validate 401 unauthorized error response schema")
        void shouldValidate401UnauthorizedErrorResponseSchema() {
            given()
                .contentType(ContentType.JSON)
            .when()
                .get("/api/notes")
            .then()
                .statusCode(401)
                .assertThat()
                .body(JsonSchemaValidator.matchesJsonSchemaInClasspath("schemas/error-response-schema.json"))
                .body("error", isA(String.class))
                .body("message", isA(String.class))
                .body("timestamp", isA(String.class))
                .body("status", equalTo(401));
        }
    }

    @Nested
    @DisplayName("Attachment Schema Contract Tests")
    class AttachmentSchemaContractTests {

        @Test
        @WithMockUser(username = "schema-test-user")
        @DisplayName("Should validate attachment upload response schema")
        void shouldValidateAttachmentUploadResponseSchema() {
            byte[] testContent = "Test attachment content".getBytes();

            given()
                .multiPart("file", "schema-test.txt", testContent, "text/plain")
                .multiPart("noteId", "1")
                .multiPart("description", "Schema test attachment")
            .when()
                .post("/api/attachments/upload")
            .then()
                .statusCode(201)
                .assertThat()
                .body(JsonSchemaValidator.matchesJsonSchemaInClasspath("schemas/attachment-response-schema.json"))
                .body("id", isA(Number.class))
                .body("filename", isA(String.class))
                .body("originalFilename", isA(String.class))
                .body("contentType", isA(String.class))
                .body("size", isA(Number.class))
                .body("description", anyOf(nullValue(), isA(String.class)))
                .body("noteId", anyOf(nullValue(), isA(Number.class)))
                .body("taskId", anyOf(nullValue(), isA(Number.class)))
                .body("uploadedAt", isA(String.class));
        }

        @Test
        @WithMockUser(username = "schema-test-user")
        @DisplayName("Should validate attachment list response schema")
        void shouldValidateAttachmentListResponseSchema() {
            // Upload some attachments first
            byte[] content1 = "First attachment".getBytes();
            byte[] content2 = "Second attachment".getBytes();

            given().multiPart("file", "first.txt", content1, "text/plain").multiPart("noteId", "1").post("/api/attachments/upload").then().statusCode(201);
            given().multiPart("file", "second.txt", content2, "text/plain").multiPart("noteId", "1").post("/api/attachments/upload").then().statusCode(201);

            given()
                .queryParam("noteId", "1")
            .when()
                .get("/api/attachments")
            .then()
                .statusCode(200)
                .assertThat()
                .body(JsonSchemaValidator.matchesJsonSchemaInClasspath("schemas/attachment-list-response-schema.json"))
                .body("$", isA(Iterable.class))
                .body("$", hasSize(greaterThanOrEqualTo(2)));
        }
    }
}
