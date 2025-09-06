package com.modulo.contract;

import com.atlassian.oai.validator.OpenApiInteractionValidator;
import com.atlassian.oai.validator.restassured.OpenApiValidationFilter;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.modulo.dto.AttachmentDto;
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
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

/**
 * Attachment API Contract Tests
 * Validates file upload/download operations against OpenAPI specification
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
@DisplayName("Attachment API Contract Tests")
class AttachmentContractTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:13")
            .withDatabaseName("modulo_attachment_test")
            .withUsername("attachment_test_user")
            .withPassword("attachment_test_pass");

    @LocalServerPort
    private int port;

    @Autowired
    private ObjectMapper objectMapper;

    private static OpenApiValidationFilter validationFilter;

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "create-drop");
        
        // Configure file upload directory for testing
        registry.add("modulo.file.upload-dir", () -> "./test-uploads");
        registry.add("modulo.file.max-size", () -> "10MB");
        
        // Security configuration for testing
        registry.add("modulo.security.jwt-secret", () -> "dGVzdC1hdHRhY2htZW50LWNvbnRyYWN0LXRlc3RpbmctMTIzNDU2Nzg5MA==");
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
    void setUp() throws IOException {
        RestAssured.port = port;
        RestAssured.enableLoggingOfRequestAndResponseIfValidationFails();
        
        // Create test upload directory
        Path uploadDir = Paths.get("./test-uploads");
        if (!Files.exists(uploadDir)) {
            Files.createDirectories(uploadDir);
        }
    }

    private RequestSpecification givenWithContract() {
        return given()
            .filter(validationFilter);
    }

    @Nested
    @DisplayName("File Upload Contract Tests")
    class FileUploadContractTests {

        @Test
        @WithMockUser(username = "attachment-test-user")
        @DisplayName("Should validate single file upload contract")
        void shouldValidateSingleFileUploadContract() throws IOException {
            // Create a test file
            byte[] testContent = "Test file content for contract validation".getBytes();
            
            givenWithContract()
                .multiPart("file", "test-document.txt", testContent, "text/plain")
                .multiPart("noteId", "1")
                .multiPart("description", "Test attachment for contract validation")
            .when()
                .post("/api/attachments/upload")
            .then()
                .statusCode(201)
                .body("id", notNullValue())
                .body("filename", equalTo("test-document.txt"))
                .body("originalFilename", equalTo("test-document.txt"))
                .body("contentType", equalTo("text/plain"))
                .body("size", greaterThan(0))
                .body("description", equalTo("Test attachment for contract validation"))
                .body("noteId", equalTo(1))
                .body("uploadedAt", notNullValue());
        }

        @Test
        @WithMockUser(username = "attachment-test-user")
        @DisplayName("Should validate multiple files upload contract")
        void shouldValidateMultipleFilesUploadContract() throws IOException {
            byte[] testContent1 = "First test file content".getBytes();
            byte[] testContent2 = "Second test file content".getBytes();
            
            givenWithContract()
                .multiPart("files", "document1.txt", testContent1, "text/plain")
                .multiPart("files", "document2.txt", testContent2, "text/plain")
                .multiPart("taskId", "1")
                .multiPart("description", "Multiple test attachments")
            .when()
                .post("/api/attachments/upload/multiple")
            .then()
                .statusCode(201)
                .body("$", hasSize(2))
                .body("[0].filename", anyOf(equalTo("document1.txt"), equalTo("document2.txt")))
                .body("[0].contentType", equalTo("text/plain"))
                .body("[0].taskId", equalTo(1))
                .body("[1].filename", anyOf(equalTo("document1.txt"), equalTo("document2.txt")))
                .body("[1].contentType", equalTo("text/plain"))
                .body("[1].taskId", equalTo(1));
        }

        @Test
        @WithMockUser(username = "attachment-test-user")
        @DisplayName("Should validate image upload contract")
        void shouldValidateImageUploadContract() throws IOException {
            // Create a simple test image data (minimal PNG)
            byte[] minimalPng = new byte[]{
                (byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
                0x00, 0x00, 0x00, 0x0D, // IHDR chunk length
                0x49, 0x48, 0x44, 0x52, // IHDR
                0x00, 0x00, 0x00, 0x01, // width = 1
                0x00, 0x00, 0x00, 0x01, // height = 1
                0x08, 0x02, 0x00, 0x00, 0x00, // bit depth, color type, compression, filter, interlace
                (byte) 0x90, 0x77, 0x53, (byte) 0xDE, // IHDR CRC
                0x00, 0x00, 0x00, 0x0C, // IDAT chunk length
                0x49, 0x44, 0x41, 0x54, // IDAT
                0x08, 0x1D, 0x01, 0x01, 0x00, 0x00, (byte) 0xFE, (byte) 0xFF, 0x00, 0x00, 0x00, 0x02, // minimal image data
                0x00, 0x01, // checksum
                0x00, 0x00, 0x00, 0x00, // IEND chunk length
                0x49, 0x45, 0x4E, 0x44, // IEND
                (byte) 0xAE, 0x42, 0x60, (byte) 0x82 // IEND CRC
            };
            
            givenWithContract()
                .multiPart("file", "test-image.png", minimalPng, "image/png")
                .multiPart("noteId", "1")
                .multiPart("description", "Test image attachment")
            .when()
                .post("/api/attachments/upload")
            .then()
                .statusCode(201)
                .body("filename", equalTo("test-image.png"))
                .body("contentType", equalTo("image/png"))
                .body("size", greaterThan(0))
                .body("noteId", equalTo(1));
        }

        @Test
        @WithMockUser(username = "attachment-test-user")
        @DisplayName("Should validate file upload size limit contract")
        void shouldValidateFileUploadSizeLimitContract() {
            // Create a file larger than the allowed limit (assuming 10MB limit)
            byte[] largeContent = new byte[11 * 1024 * 1024]; // 11MB
            
            givenWithContract()
                .multiPart("file", "large-file.bin", largeContent, "application/octet-stream")
                .multiPart("noteId", "1")
            .when()
                .post("/api/attachments/upload")
            .then()
                .statusCode(413) // Payload Too Large
                .body("error", equalTo("Payload Too Large"))
                .body("message", containsString("File size exceeds maximum allowed"))
                .body("timestamp", notNullValue());
        }

        @Test
        @WithMockUser(username = "attachment-test-user")
        @DisplayName("Should validate unsupported file type contract")
        void shouldValidateUnsupportedFileTypeContract() {
            byte[] executableContent = "#!/bin/bash\necho 'test'".getBytes();
            
            givenWithContract()
                .multiPart("file", "malicious.sh", executableContent, "application/x-sh")
                .multiPart("noteId", "1")
            .when()
                .post("/api/attachments/upload")
            .then()
                .statusCode(400)
                .body("error", equalTo("Bad Request"))
                .body("message", containsString("File type not supported"))
                .body("timestamp", notNullValue());
        }
    }

    @Nested
    @DisplayName("File Download Contract Tests")
    class FileDownloadContractTests {

        @Test
        @WithMockUser(username = "attachment-test-user")
        @DisplayName("Should validate file download contract")
        void shouldValidateFileDownloadContract() throws IOException {
            // First upload a file
            byte[] testContent = "Test file content for download".getBytes();
            
            Integer attachmentId = givenWithContract()
                .multiPart("file", "download-test.txt", testContent, "text/plain")
                .multiPart("noteId", "1")
                .multiPart("description", "File for download testing")
                .post("/api/attachments/upload")
                .then()
                .statusCode(201)
                .extract()
                .path("id");

            // Then download it
            given()
                .filter(validationFilter)
                .header("Authorization", "Bearer valid-jwt-token")
            .when()
                .get("/api/attachments/{id}/download", attachmentId)
            .then()
                .statusCode(200)
                .header("Content-Type", "text/plain")
                .header("Content-Disposition", containsString("attachment"))
                .header("Content-Disposition", containsString("download-test.txt"))
                .body(equalTo("Test file content for download"));
        }

        @Test
        @WithMockUser(username = "attachment-test-user")
        @DisplayName("Should validate file download not found contract")
        void shouldValidateFileDownloadNotFoundContract() {
            given()
                .filter(validationFilter)
                .header("Authorization", "Bearer valid-jwt-token")
            .when()
                .get("/api/attachments/999999/download")
            .then()
                .statusCode(404)
                .body("error", equalTo("Not Found"))
                .body("message", containsString("Attachment not found"))
                .body("timestamp", notNullValue());
        }
    }

    @Nested
    @DisplayName("Attachment Metadata Contract Tests")
    class AttachmentMetadataContractTests {

        @Test
        @WithMockUser(username = "attachment-test-user")
        @DisplayName("Should validate attachment metadata retrieval contract")
        void shouldValidateAttachmentMetadataRetrievalContract() throws IOException {
            // Upload a file first
            byte[] testContent = "Content for metadata test".getBytes();
            
            Integer attachmentId = givenWithContract()
                .multiPart("file", "metadata-test.txt", testContent, "text/plain")
                .multiPart("noteId", "1")
                .multiPart("description", "File for metadata testing")
                .post("/api/attachments/upload")
                .then()
                .statusCode(201)
                .extract()
                .path("id");

            // Retrieve metadata
            givenWithContract()
            .when()
                .get("/api/attachments/{id}", attachmentId)
            .then()
                .statusCode(200)
                .body("id", equalTo(attachmentId))
                .body("filename", equalTo("metadata-test.txt"))
                .body("originalFilename", equalTo("metadata-test.txt"))
                .body("contentType", equalTo("text/plain"))
                .body("size", greaterThan(0))
                .body("description", equalTo("File for metadata testing"))
                .body("noteId", equalTo(1))
                .body("uploadedAt", notNullValue());
        }

        @Test
        @WithMockUser(username = "attachment-test-user")
        @DisplayName("Should validate attachment list by note contract")
        void shouldValidateAttachmentListByNoteContract() throws IOException {
            // Upload multiple files for the same note
            byte[] content1 = "First attachment content".getBytes();
            byte[] content2 = "Second attachment content".getBytes();
            
            givenWithContract()
                .multiPart("file", "first-attachment.txt", content1, "text/plain")
                .multiPart("noteId", "1")
                .multiPart("description", "First attachment")
                .post("/api/attachments/upload")
                .then()
                .statusCode(201);

            givenWithContract()
                .multiPart("file", "second-attachment.txt", content2, "text/plain")
                .multiPart("noteId", "1")
                .multiPart("description", "Second attachment")
                .post("/api/attachments/upload")
                .then()
                .statusCode(201);

            // List attachments for the note
            givenWithContract()
                .queryParam("noteId", "1")
            .when()
                .get("/api/attachments")
            .then()
                .statusCode(200)
                .body("$", hasSize(greaterThanOrEqualTo(2)))
                .body("[0].id", notNullValue())
                .body("[0].filename", notNullValue())
                .body("[0].noteId", equalTo(1))
                .body("[0].uploadedAt", notNullValue());
        }

        @Test
        @WithMockUser(username = "attachment-test-user")
        @DisplayName("Should validate attachment deletion contract")
        void shouldValidateAttachmentDeletionContract() throws IOException {
            // Upload a file first
            byte[] testContent = "Content to be deleted".getBytes();
            
            Integer attachmentId = givenWithContract()
                .multiPart("file", "delete-test.txt", testContent, "text/plain")
                .multiPart("noteId", "1")
                .multiPart("description", "File to be deleted")
                .post("/api/attachments/upload")
                .then()
                .statusCode(201)
                .extract()
                .path("id");

            // Delete the attachment
            givenWithContract()
            .when()
                .delete("/api/attachments/{id}", attachmentId)
            .then()
                .statusCode(204)
                .body(emptyString());

            // Verify it's deleted (should return 404)
            givenWithContract()
            .when()
                .get("/api/attachments/{id}", attachmentId)
            .then()
                .statusCode(404);
        }
    }
}
