package com.modulo.contract;

import au.com.dius.pact.consumer.MockServer;
import au.com.dius.pact.consumer.dsl.PactDslJsonBody;
import au.com.dius.pact.consumer.dsl.PactDslWithProvider;
import au.com.dius.pact.consumer.junit5.PactConsumerTestExt;
import au.com.dius.pact.consumer.junit5.PactTestFor;
import au.com.dius.pact.core.model.RequestResponsePact;
import au.com.dius.pact.core.model.annotations.Pact;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.modulo.dto.NoteDto;
import com.modulo.dto.TaskDto;
import com.modulo.dto.UserDto;
import io.restassured.RestAssured;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;

/**
 * Consumer-Driven Contract Tests using Pact
 * These tests define the contract between the frontend (consumer) and backend (provider)
 */
@ExtendWith(PactConsumerTestExt.class)
@DisplayName("Pact Consumer Contract Tests")
class PactConsumerContractTest {

    private ObjectMapper objectMapper = new ObjectMapper();
    private final String CONSUMER = "modulo-frontend";
    private final String PROVIDER = "modulo-backend";

    @BeforeEach
    void setUp() {
        RestAssured.enableLoggingOfRequestAndResponseIfValidationFails();
    }

    // Note API Contract Tests

    @Pact(consumer = CONSUMER, provider = PROVIDER)
    public RequestResponsePact createNoteContract(PactDslWithProvider builder) {
        PactDslJsonBody requestBody = new PactDslJsonBody()
            .stringType("title", "Test Note")
            .stringType("content", "This is a test note content")
            .numberType("userId", 1);

        PactDslJsonBody responseBody = new PactDslJsonBody()
            .numberType("id", 1)
            .stringType("title", "Test Note")
            .stringType("content", "This is a test note content")
            .numberType("userId", 1)
            .stringType("createdAt", "2024-01-15T10:30:00")
            .nullValue("updatedAt");

        return builder
            .given("user exists with ID 1")
            .uponReceiving("a request to create a note")
                .method("POST")
                .path("/api/notes")
                .headers(Map.of(
                    "Content-Type", "application/json",
                    "Authorization", "Bearer valid-jwt-token"
                ))
                .body(requestBody)
            .willRespondWith()
                .status(201)
                .headers(Map.of("Content-Type", "application/json"))
                .body(responseBody)
            .toPact();
    }

    @Test
    @PactTestFor(pactMethod = "createNoteContract")
    @DisplayName("Should create note according to contract")
    void shouldCreateNoteAccordingToContract(MockServer mockServer) {
        RestAssured.port = mockServer.getPort();
        
        NoteDto newNote = new NoteDto();
        newNote.setTitle("Test Note");
        newNote.setContent("This is a test note content");
        newNote.setUserId(1L);

        given()
            .contentType(ContentType.JSON)
            .header("Authorization", "Bearer valid-jwt-token")
            .body(newNote)
        .when()
            .post("/api/notes")
        .then()
            .statusCode(201)
            .body("id", equalTo(1))
            .body("title", equalTo("Test Note"))
            .body("content", equalTo("This is a test note content"))
            .body("userId", equalTo(1))
            .body("createdAt", notNullValue())
            .body("updatedAt", nullValue());
    }

    @Pact(consumer = CONSUMER, provider = PROVIDER)
    public RequestResponsePact getNoteByIdContract(PactDslWithProvider builder) {
        PactDslJsonBody responseBody = new PactDslJsonBody()
            .numberType("id", 1)
            .stringType("title", "Existing Note")
            .stringType("content", "This is an existing note")
            .numberType("userId", 1)
            .stringType("createdAt", "2024-01-15T10:30:00")
            .nullValue("updatedAt");

        return builder
            .given("note exists with ID 1")
            .uponReceiving("a request to get note by ID")
                .method("GET")
                .path("/api/notes/1")
                .headers(Map.of("Authorization", "Bearer valid-jwt-token"))
            .willRespondWith()
                .status(200)
                .headers(Map.of("Content-Type", "application/json"))
                .body(responseBody)
            .toPact();
    }

    @Test
    @PactTestFor(pactMethod = "getNoteByIdContract")
    @DisplayName("Should retrieve note by ID according to contract")
    void shouldRetrieveNoteByIdAccordingToContract(MockServer mockServer) {
        RestAssured.port = mockServer.getPort();

        given()
            .header("Authorization", "Bearer valid-jwt-token")
        .when()
            .get("/api/notes/1")
        .then()
            .statusCode(200)
            .body("id", equalTo(1))
            .body("title", equalTo("Existing Note"))
            .body("content", equalTo("This is an existing note"))
            .body("userId", equalTo(1))
            .body("createdAt", notNullValue());
    }

    @Pact(consumer = CONSUMER, provider = PROVIDER)
    public RequestResponsePact updateNoteContract(PactDslWithProvider builder) {
        PactDslJsonBody requestBody = new PactDslJsonBody()
            .numberType("id", 1)
            .stringType("title", "Updated Note")
            .stringType("content", "This note has been updated")
            .numberType("userId", 1);

        PactDslJsonBody responseBody = new PactDslJsonBody()
            .numberType("id", 1)
            .stringType("title", "Updated Note")
            .stringType("content", "This note has been updated")
            .numberType("userId", 1)
            .stringType("createdAt", "2024-01-15T10:30:00")
            .stringType("updatedAt", "2024-01-15T14:45:00");

        return builder
            .given("note exists with ID 1 and user has permission to update")
            .uponReceiving("a request to update a note")
                .method("PUT")
                .path("/api/notes/1")
                .headers(Map.of(
                    "Content-Type", "application/json",
                    "Authorization", "Bearer valid-jwt-token"
                ))
                .body(requestBody)
            .willRespondWith()
                .status(200)
                .headers(Map.of("Content-Type", "application/json"))
                .body(responseBody)
            .toPact();
    }

    @Test
    @PactTestFor(pactMethod = "updateNoteContract")
    @DisplayName("Should update note according to contract")
    void shouldUpdateNoteAccordingToContract(MockServer mockServer) {
        RestAssured.port = mockServer.getPort();
        
        NoteDto updateNote = new NoteDto();
        updateNote.setId(1L);
        updateNote.setTitle("Updated Note");
        updateNote.setContent("This note has been updated");
        updateNote.setUserId(1L);

        given()
            .contentType(ContentType.JSON)
            .header("Authorization", "Bearer valid-jwt-token")
            .body(updateNote)
        .when()
            .put("/api/notes/1")
        .then()
            .statusCode(200)
            .body("id", equalTo(1))
            .body("title", equalTo("Updated Note"))
            .body("content", equalTo("This note has been updated"))
            .body("userId", equalTo(1))
            .body("createdAt", notNullValue())
            .body("updatedAt", notNullValue());
    }

    @Pact(consumer = CONSUMER, provider = PROVIDER)
    public RequestResponsePact deleteNoteContract(PactDslWithProvider builder) {
        return builder
            .given("note exists with ID 1 and user has permission to delete")
            .uponReceiving("a request to delete a note")
                .method("DELETE")
                .path("/api/notes/1")
                .headers(Map.of("Authorization", "Bearer valid-jwt-token"))
            .willRespondWith()
                .status(204)
            .toPact();
    }

    @Test
    @PactTestFor(pactMethod = "deleteNoteContract")
    @DisplayName("Should delete note according to contract")
    void shouldDeleteNoteAccordingToContract(MockServer mockServer) {
        RestAssured.port = mockServer.getPort();

        given()
            .header("Authorization", "Bearer valid-jwt-token")
        .when()
            .delete("/api/notes/1")
        .then()
            .statusCode(204)
            .body(emptyString());
    }

    // Task API Contract Tests

    @Pact(consumer = CONSUMER, provider = PROVIDER)
    public RequestResponsePact createTaskContract(PactDslWithProvider builder) {
        PactDslJsonBody requestBody = new PactDslJsonBody()
            .stringType("title", "Test Task")
            .stringType("description", "This is a test task")
            .numberType("userId", 1)
            .stringType("priority", "HIGH")
            .stringType("dueDate", "2024-02-15T16:00:00");

        PactDslJsonBody responseBody = new PactDslJsonBody()
            .numberType("id", 1)
            .stringType("title", "Test Task")
            .stringType("description", "This is a test task")
            .numberType("userId", 1)
            .stringType("priority", "HIGH")
            .booleanType("completed", false)
            .stringType("dueDate", "2024-02-15T16:00:00")
            .stringType("createdAt", "2024-01-15T10:30:00")
            .nullValue("updatedAt");

        return builder
            .given("user exists with ID 1")
            .uponReceiving("a request to create a task")
                .method("POST")
                .path("/api/tasks")
                .headers(Map.of(
                    "Content-Type", "application/json",
                    "Authorization", "Bearer valid-jwt-token"
                ))
                .body(requestBody)
            .willRespondWith()
                .status(201)
                .headers(Map.of("Content-Type", "application/json"))
                .body(responseBody)
            .toPact();
    }

    @Test
    @PactTestFor(pactMethod = "createTaskContract")
    @DisplayName("Should create task according to contract")
    void shouldCreateTaskAccordingToContract(MockServer mockServer) {
        RestAssured.port = mockServer.getPort();
        
        TaskDto newTask = new TaskDto();
        newTask.setTitle("Test Task");
        newTask.setDescription("This is a test task");
        newTask.setUserId(1L);
        newTask.setPriority("HIGH");
        newTask.setDueDate(LocalDateTime.parse("2024-02-15T16:00:00"));

        given()
            .contentType(ContentType.JSON)
            .header("Authorization", "Bearer valid-jwt-token")
            .body(newTask)
        .when()
            .post("/api/tasks")
        .then()
            .statusCode(201)
            .body("id", equalTo(1))
            .body("title", equalTo("Test Task"))
            .body("description", equalTo("This is a test task"))
            .body("userId", equalTo(1))
            .body("priority", equalTo("HIGH"))
            .body("completed", equalTo(false))
            .body("dueDate", notNullValue())
            .body("createdAt", notNullValue());
    }

    @Pact(consumer = CONSUMER, provider = PROVIDER)
    public RequestResponsePact completeTaskContract(PactDslWithProvider builder) {
        PactDslJsonBody responseBody = new PactDslJsonBody()
            .numberType("id", 1)
            .stringType("title", "Test Task")
            .stringType("description", "This is a test task")
            .numberType("userId", 1)
            .stringType("priority", "HIGH")
            .booleanType("completed", true)
            .stringType("dueDate", "2024-02-15T16:00:00")
            .stringType("createdAt", "2024-01-15T10:30:00")
            .stringType("updatedAt", "2024-01-16T09:15:00");

        return builder
            .given("task exists with ID 1 and is not completed")
            .uponReceiving("a request to complete a task")
                .method("PUT")
                .path("/api/tasks/1/complete")
                .headers(Map.of("Authorization", "Bearer valid-jwt-token"))
            .willRespondWith()
                .status(200)
                .headers(Map.of("Content-Type", "application/json"))
                .body(responseBody)
            .toPact();
    }

    @Test
    @PactTestFor(pactMethod = "completeTaskContract")
    @DisplayName("Should complete task according to contract")
    void shouldCompleteTaskAccordingToContract(MockServer mockServer) {
        RestAssured.port = mockServer.getPort();

        given()
            .header("Authorization", "Bearer valid-jwt-token")
        .when()
            .put("/api/tasks/1/complete")
        .then()
            .statusCode(200)
            .body("id", equalTo(1))
            .body("completed", equalTo(true))
            .body("updatedAt", notNullValue());
    }

    // User API Contract Tests

    @Pact(consumer = CONSUMER, provider = PROVIDER)
    public RequestResponsePact getUserProfileContract(PactDslWithProvider builder) {
        PactDslJsonBody responseBody = new PactDslJsonBody()
            .numberType("id", 1)
            .stringType("username", "testuser")
            .stringType("email", "test@example.com")
            .stringType("provider", "oauth-google")
            .stringType("providerUserId", "google-123456")
            .stringType("createdAt", "2024-01-01T12:00:00");

        return builder
            .given("authenticated user exists")
            .uponReceiving("a request to get user profile")
                .method("GET")
                .path("/api/users/profile")
                .headers(Map.of("Authorization", "Bearer valid-jwt-token"))
            .willRespondWith()
                .status(200)
                .headers(Map.of("Content-Type", "application/json"))
                .body(responseBody)
            .toPact();
    }

    @Test
    @PactTestFor(pactMethod = "getUserProfileContract")
    @DisplayName("Should get user profile according to contract")
    void shouldGetUserProfileAccordingToContract(MockServer mockServer) {
        RestAssured.port = mockServer.getPort();

        given()
            .header("Authorization", "Bearer valid-jwt-token")
        .when()
            .get("/api/users/profile")
        .then()
            .statusCode(200)
            .body("id", equalTo(1))
            .body("username", equalTo("testuser"))
            .body("email", equalTo("test@example.com"))
            .body("provider", equalTo("oauth-google"))
            .body("providerUserId", equalTo("google-123456"))
            .body("createdAt", notNullValue());
    }

    // Error Contract Tests

    @Pact(consumer = CONSUMER, provider = PROVIDER)
    public RequestResponsePact noteNotFoundContract(PactDslWithProvider builder) {
        PactDslJsonBody errorBody = new PactDslJsonBody()
            .stringType("error", "Not Found")
            .stringType("message", "Note not found with id: 999")
            .stringType("timestamp", "2024-01-15T10:30:00Z")
            .numberType("status", 404)
            .stringType("path", "/api/notes/999");

        return builder
            .given("no note exists with ID 999")
            .uponReceiving("a request for non-existent note")
                .method("GET")
                .path("/api/notes/999")
                .headers(Map.of("Authorization", "Bearer valid-jwt-token"))
            .willRespondWith()
                .status(404)
                .headers(Map.of("Content-Type", "application/json"))
                .body(errorBody)
            .toPact();
    }

    @Test
    @PactTestFor(pactMethod = "noteNotFoundContract")
    @DisplayName("Should return 404 for non-existent note according to contract")
    void shouldReturn404ForNonExistentNoteAccordingToContract(MockServer mockServer) {
        RestAssured.port = mockServer.getPort();

        given()
            .header("Authorization", "Bearer valid-jwt-token")
        .when()
            .get("/api/notes/999")
        .then()
            .statusCode(404)
            .body("error", equalTo("Not Found"))
            .body("message", containsString("Note not found"))
            .body("status", equalTo(404))
            .body("timestamp", notNullValue());
    }

    @Pact(consumer = CONSUMER, provider = PROVIDER)
    public RequestResponsePact unauthorizedAccessContract(PactDslWithProvider builder) {
        PactDslJsonBody errorBody = new PactDslJsonBody()
            .stringType("error", "Unauthorized")
            .stringType("message", "Access denied: Invalid or missing authentication token")
            .stringType("timestamp", "2024-01-15T10:30:00Z")
            .numberType("status", 401)
            .stringType("path", "/api/notes");

        return builder
            .given("no valid authentication token provided")
            .uponReceiving("a request without authentication")
                .method("GET")
                .path("/api/notes")
            .willRespondWith()
                .status(401)
                .headers(Map.of("Content-Type", "application/json"))
                .body(errorBody)
            .toPact();
    }

    @Test
    @PactTestFor(pactMethod = "unauthorizedAccessContract")
    @DisplayName("Should return 401 for unauthorized access according to contract")
    void shouldReturn401ForUnauthorizedAccessAccordingToContract(MockServer mockServer) {
        RestAssured.port = mockServer.getPort();

        given()
            // No authorization header
        .when()
            .get("/api/notes")
        .then()
            .statusCode(401)
            .body("error", equalTo("Unauthorized"))
            .body("message", containsString("Access denied"))
            .body("status", equalTo(401))
            .body("timestamp", notNullValue());
    }

    @Pact(consumer = CONSUMER, provider = PROVIDER)
    public RequestResponsePact validationErrorContract(PactDslWithProvider builder) {
        PactDslJsonBody requestBody = new PactDslJsonBody()
            .stringType("title", "")  // Invalid empty title
            .nullValue("content")     // Missing content
            .nullValue("userId");     // Missing userId

        PactDslJsonBody errorBody = new PactDslJsonBody()
            .stringType("error", "Bad Request")
            .stringType("message", "Validation failed: Title is required, Content is required, User ID is required")
            .stringType("timestamp", "2024-01-15T10:30:00Z")
            .numberType("status", 400)
            .stringType("path", "/api/notes");

        return builder
            .given("user is authenticated")
            .uponReceiving("a request with invalid note data")
                .method("POST")
                .path("/api/notes")
                .headers(Map.of(
                    "Content-Type", "application/json",
                    "Authorization", "Bearer valid-jwt-token"
                ))
                .body(requestBody)
            .willRespondWith()
                .status(400)
                .headers(Map.of("Content-Type", "application/json"))
                .body(errorBody)
            .toPact();
    }

    @Test
    @PactTestFor(pactMethod = "validationErrorContract")
    @DisplayName("Should return 400 for validation errors according to contract")
    void shouldReturn400ForValidationErrorsAccordingToContract(MockServer mockServer) {
        RestAssured.port = mockServer.getPort();
        
        NoteDto invalidNote = new NoteDto();
        invalidNote.setTitle("");  // Invalid empty title
        // Missing content and userId

        given()
            .contentType(ContentType.JSON)
            .header("Authorization", "Bearer valid-jwt-token")
            .body(invalidNote)
        .when()
            .post("/api/notes")
        .then()
            .statusCode(400)
            .body("error", equalTo("Bad Request"))
            .body("message", containsString("Validation failed"))
            .body("status", equalTo(400))
            .body("timestamp", notNullValue());
    }
}
