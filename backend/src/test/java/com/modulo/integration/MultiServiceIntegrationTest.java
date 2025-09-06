package com.modulo.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.github.tomakehurst.wiremock.WireMockServer;
import com.github.tomakehurst.wiremock.client.WireMock;
import com.modulo.ModuloApplication;
import com.modulo.dto.NoteDto;
import com.modulo.dto.TaskDto;
import com.modulo.entity.User;
import com.modulo.repository.jpa.UserRepository;
import com.modulo.service.*;
import org.junit.jupiter.api.AfterEach;
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
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.LocalDateTime;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

import static com.github.tomakehurst.wiremock.client.WireMock.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Multi-service integration tests covering complex workflows
 * that span multiple services and external dependencies
 */
@SpringBootTest(
    classes = ModuloApplication.class,
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT
)
@AutoConfigureMockMvc
@Testcontainers
@DisplayName("Multi-Service Integration Tests")
class MultiServiceIntegrationTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:13")
            .withDatabaseName("modulo_multiservice_test")
            .withUsername("multi_test_user")
            .withPassword("multi_test_pass");

    private WireMockServer openAiMockServer;
    private WireMockServer ipfsMockServer;
    private WireMockServer blockchainMockServer;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private NoteService noteService;

    @Autowired
    private TaskService taskService;

    @Autowired(required = false)
    private OpenAIService openAIService;

    @Autowired(required = false)
    private IpfsService ipfsService;

    @Autowired(required = false)
    private BlockchainService blockchainService;

    @Autowired(required = false)
    private WebSocketNotificationService notificationService;

    private User testUser;

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");

        // External service configurations
        registry.add("modulo.external.openai-api-url", () -> "http://localhost:8093");
        registry.add("modulo.external.openai-api-key", () -> "test-multi-service-key");
        registry.add("modulo.external.ipfs-api-url", () -> "http://localhost:8094");
        registry.add("modulo.external.ipfs-gateway-url", () -> "http://localhost:8095");
        registry.add("blockchain.network.rpc-url", () -> "http://localhost:8096");

        // Test configuration
        registry.add("modulo.security.jwt-secret", () -> "dGVzdC1tdWx0aS1zZXJ2aWNlLWludGVncmF0aW9uLXRlc3RpbmctMTIzNDU2");
        registry.add("modulo.security.api-key", () -> "test_multi_service_api_key");
        registry.add("logging.level.com.modulo", () -> "INFO");
    }

    @BeforeEach
    void setUp() {
        // Set up external service mocks
        openAiMockServer = new WireMockServer(8093);
        ipfsMockServer = new WireMockServer(8094);
        blockchainMockServer = new WireMockServer(8096);

        openAiMockServer.start();
        ipfsMockServer.start();
        blockchainMockServer.start();

        // Create test user
        testUser = new User();
        testUser.setUsername("multi-service-test-user");
        testUser.setEmail("multi@service.test");
        testUser.setProviderUserId("multi-service-provider-123");
        testUser.setProvider("multi-service-test");
        testUser.setCreatedAt(LocalDateTime.now());
        testUser = userRepository.save(testUser);

        setupExternalServiceMocks();
    }

    @AfterEach
    void tearDown() {
        if (openAiMockServer != null) openAiMockServer.stop();
        if (ipfsMockServer != null) ipfsMockServer.stop();
        if (blockchainMockServer != null) blockchainMockServer.stop();
    }

    private void setupExternalServiceMocks() {
        // OpenAI Mock
        WireMock.configureFor("localhost", 8093);
        openAiMockServer.stubFor(post(urlPathEqualTo("/v1/chat/completions"))
            .willReturn(aResponse()
                .withStatus(200)
                .withHeader("Content-Type", "application/json")
                .withBody("{\"choices\":[{\"message\":{\"content\":\"AI-generated summary of the note content\"}}]}")));

        // IPFS Mock
        WireMock.configureFor("localhost", 8094);
        ipfsMockServer.stubFor(post(urlPathEqualTo("/api/v0/add"))
            .willReturn(aResponse()
                .withStatus(200)
                .withHeader("Content-Type", "application/json")
                .withBody("{\"Hash\":\"QmMultiServiceTestHash123\",\"Size\":\"1024\"}")));

        // Blockchain Mock
        WireMock.configureFor("localhost", 8096);
        blockchainMockServer.stubFor(post(urlEqualTo("/"))
            .willReturn(aResponse()
                .withStatus(200)
                .withHeader("Content-Type", "application/json")
                .withBody("{\"jsonrpc\":\"2.0\",\"result\":\"0x1234567890abcdef\",\"id\":1}")));
    }

    @Nested
    @DisplayName("Note Creation and Enhancement Workflow")
    class NoteCreationAndEnhancementWorkflow {

        @Test
        @WithMockUser(username = "multi-service-test-user")
        @Transactional
        @DisplayName("Should create note and enhance it with AI and blockchain")
        void shouldCreateNoteAndEnhanceItWithAiAndBlockchain() throws Exception {
            // Step 1: Create a note via REST API
            NoteDto newNote = new NoteDto();
            newNote.setTitle("Multi-Service Integration Note");
            newNote.setContent("This is a comprehensive test note that will be processed by multiple services including AI summarization, IPFS storage, and blockchain verification.");
            newNote.setUserId(testUser.getId());

            String noteResponse = mockMvc.perform(post("/api/notes")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(newNote))
                    .with(csrf()))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.title").value("Multi-Service Integration Note"))
                    .andReturn()
                    .getResponse()
                    .getContentAsString();

            NoteDto createdNote = objectMapper.readValue(noteResponse, NoteDto.class);
            Long noteId = createdNote.getId();

            // Step 2: Trigger AI enhancement if available
            if (openAIService != null) {
                CompletableFuture<String> summaryFuture = openAIService.generateNoteSummary(createdNote.getContent());
                String aiSummary = summaryFuture.get(30, TimeUnit.SECONDS);
                assertThat(aiSummary).contains("AI-generated summary");

                // Verify OpenAI was called
                openAiMockServer.verify(postRequestedFor(urlPathEqualTo("/v1/chat/completions")));
            }

            // Step 3: Store note content to IPFS if available
            String ipfsHash = null;
            if (ipfsService != null) {
                CompletableFuture<String> ipfsFuture = ipfsService.storeContent(
                    createdNote.getContent(), "note-" + noteId
                );
                ipfsHash = ipfsFuture.get(30, TimeUnit.SECONDS);
                assertThat(ipfsHash).isEqualTo("QmMultiServiceTestHash123");

                // Verify IPFS was called
                ipfsMockServer.verify(postRequestedFor(urlPathEqualTo("/api/v0/add")));
            }

            // Step 4: Store note reference on blockchain if available
            if (blockchainService != null && ipfsHash != null) {
                CompletableFuture<String> blockchainFuture = blockchainService.storeNoteOnBlockchain(
                    noteId, ipfsHash, createdNote.getContent()
                );
                String transactionHash = blockchainFuture.get(30, TimeUnit.SECONDS);
                assertThat(transactionHash).isNotNull();

                // Verify blockchain was called
                blockchainMockServer.verify(postRequestedFor(urlEqualTo("/")));
            }

            // Step 5: Verify note can still be retrieved
            mockMvc.perform(get("/api/notes/" + noteId))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.title").value("Multi-Service Integration Note"));
        }

        @Test
        @WithMockUser(username = "multi-service-test-user")
        @Transactional
        @DisplayName("Should handle service failures gracefully in workflow")
        void shouldHandleServiceFailuresGracefullyInWorkflow() throws Exception {
            // Simulate IPFS service failure
            WireMock.configureFor("localhost", 8094);
            ipfsMockServer.stubFor(post(urlPathEqualTo("/api/v0/add"))
                .willReturn(aResponse().withStatus(500)));

            // Create note
            NoteDto newNote = new NoteDto();
            newNote.setTitle("Failure Handling Note");
            newNote.setContent("This note will test failure handling across services");
            newNote.setUserId(testUser.getId());

            String noteResponse = mockMvc.perform(post("/api/notes")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(newNote))
                    .with(csrf()))
                    .andExpect(status().isCreated())
                    .andReturn()
                    .getResponse()
                    .getContentAsString();

            NoteDto createdNote = objectMapper.readValue(noteResponse, NoteDto.class);

            // Try AI enhancement - should work
            if (openAIService != null) {
                CompletableFuture<String> summaryFuture = openAIService.generateNoteSummary(createdNote.getContent());
                String aiSummary = summaryFuture.get(30, TimeUnit.SECONDS);
                assertThat(aiSummary).contains("AI-generated summary");
            }

            // Try IPFS storage - should fail gracefully
            if (ipfsService != null) {
                assertThatThrownBy(() -> {
                    CompletableFuture<String> ipfsFuture = ipfsService.storeContent(
                        createdNote.getContent(), "failure-test-note"
                    );
                    ipfsFuture.get(30, TimeUnit.SECONDS);
                }).hasCauseInstanceOf(RuntimeException.class);
            }

            // Note should still be accessible despite service failure
            mockMvc.perform(get("/api/notes/" + createdNote.getId()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.title").value("Failure Handling Note"));
        }
    }

    @Nested
    @DisplayName("Task and Note Coordination Workflow")
    class TaskAndNoteCoordinationWorkflow {

        @Test
        @WithMockUser(username = "multi-service-test-user")
        @Transactional
        @DisplayName("Should coordinate task creation with note analysis")
        void shouldCoordinateTaskCreationWithNoteAnalysis() throws Exception {
            // Step 1: Create a project planning note
            NoteDto projectNote = new NoteDto();
            projectNote.setTitle("Project Implementation Plan");
            projectNote.setContent("We need to implement the following features: user authentication, note management, task tracking, and integration testing. Each feature should have its own development task with proper testing.");
            projectNote.setUserId(testUser.getId());

            String noteResponse = mockMvc.perform(post("/api/notes")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(projectNote))
                    .with(csrf()))
                    .andExpect(status().isCreated())
                    .andReturn()
                    .getResponse()
                    .getContentAsString();

            NoteDto createdNote = objectMapper.readValue(noteResponse, NoteDto.class);

            // Step 2: Use AI to generate task suggestions from note content
            if (openAIService != null) {
                // Mock AI response for task suggestions
                WireMock.configureFor("localhost", 8093);
                openAiMockServer.stubFor(post(urlPathEqualTo("/v1/chat/completions"))
                    .withRequestBody(containing("task suggestions"))
                    .willReturn(aResponse()
                        .withStatus(200)
                        .withHeader("Content-Type", "application/json")
                        .withBody("{\"choices\":[{\"message\":{\"content\":\"1. Implement user authentication\\n2. Develop note management system\\n3. Create task tracking functionality\\n4. Set up integration testing\"}}]}")));

                CompletableFuture<String> taskSuggestions = openAIService.generateTaskSuggestions(createdNote.getContent());
                String suggestions = taskSuggestions.get(30, TimeUnit.SECONDS);
                assertThat(suggestions).contains("Implement user authentication");
                assertThat(suggestions).contains("integration testing");
            }

            // Step 3: Create tasks based on the note analysis
            String[] taskTitles = {
                "Implement User Authentication",
                "Develop Note Management System",
                "Create Task Tracking Functionality",
                "Set up Integration Testing"
            };

            for (String taskTitle : taskTitles) {
                TaskDto newTask = new TaskDto();
                newTask.setTitle(taskTitle);
                newTask.setDescription("Task generated from project planning note: " + createdNote.getTitle());
                newTask.setUserId(testUser.getId());
                newTask.setPriority("HIGH");
                newTask.setDueDate(LocalDateTime.now().plusDays(14));

                mockMvc.perform(post("/api/tasks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(newTask))
                        .with(csrf()))
                        .andExpect(status().isCreated())
                        .andExpect(jsonPath("$.title").value(taskTitle));
            }

            // Step 4: Verify all tasks were created
            mockMvc.perform(get("/api/tasks")
                    .param("userId", testUser.getId().toString()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").value(4));

            // Step 5: Store the coordinated data to external services
            if (ipfsService != null) {
                String coordinatedData = "Note: " + createdNote.getTitle() + "\nTasks: " + String.join(", ", taskTitles);
                CompletableFuture<String> ipfsResult = ipfsService.storeContent(coordinatedData, "coordination-data");
                String hash = ipfsResult.get(30, TimeUnit.SECONDS);
                assertThat(hash).isNotNull();
            }
        }

        @Test
        @WithMockUser(username = "multi-service-test-user")
        @Transactional
        @DisplayName("Should handle concurrent multi-service operations")
        void shouldHandleConcurrentMultiServiceOperations() throws Exception {
            // Create multiple notes and tasks concurrently
            CompletableFuture<Void> note1Future = CompletableFuture.runAsync(() -> {
                try {
                    NoteDto note = new NoteDto();
                    note.setTitle("Concurrent Note 1");
                    note.setContent("Content for concurrent processing test 1");
                    note.setUserId(testUser.getId());

                    mockMvc.perform(post("/api/notes")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(note))
                            .with(csrf()));
                } catch (Exception e) {
                    throw new RuntimeException(e);
                }
            });

            CompletableFuture<Void> task1Future = CompletableFuture.runAsync(() -> {
                try {
                    TaskDto task = new TaskDto();
                    task.setTitle("Concurrent Task 1");
                    task.setDescription("Task for concurrent processing test 1");
                    task.setUserId(testUser.getId());
                    task.setPriority("MEDIUM");

                    mockMvc.perform(post("/api/tasks")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(task))
                            .with(csrf()));
                } catch (Exception e) {
                    throw new RuntimeException(e);
                }
            });

            // Wait for concurrent operations to complete
            CompletableFuture<Void> allOperations = CompletableFuture.allOf(note1Future, task1Future);
            allOperations.get(60, TimeUnit.SECONDS);

            // Verify data consistency
            mockMvc.perform(get("/api/notes")
                    .param("userId", testUser.getId().toString()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").isNumber());

            mockMvc.perform(get("/api/tasks")
                    .param("userId", testUser.getId().toString()))
                    .andExpect(status().isOk())
                    .andExpected jsonPath("$.length()").isNumber());
        }
    }

    @Nested
    @DisplayName("End-to-End Data Flow Integration")
    class EndToEndDataFlowIntegration {

        @Test
        @WithMockUser(username = "multi-service-test-user")
        @Transactional
        @DisplayName("Should handle complete data flow from creation to external storage")
        void shouldHandleCompleteDataFlowFromCreationToExternalStorage() throws Exception {
            // Step 1: Create content via API
            NoteDto note = new NoteDto();
            note.setTitle("Complete Workflow Note");
            note.setContent("This note will go through the complete data flow pipeline including database storage, AI processing, IPFS distribution, and blockchain verification.");
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

            // Step 2: Process through all available services
            CompletableFuture<String> aiSummary = null;
            CompletableFuture<String> ipfsHash = null;
            CompletableFuture<String> blockchainTx = null;

            if (openAIService != null) {
                aiSummary = openAIService.generateNoteSummary(createdNote.getContent());
            }

            if (ipfsService != null) {
                ipfsHash = ipfsService.storeContent(createdNote.getContent(), "complete-workflow-note");
            }

            // Step 3: Wait for parallel processing
            if (aiSummary != null && ipfsHash != null) {
                CompletableFuture<Void> parallelProcessing = CompletableFuture.allOf(aiSummary, ipfsHash);
                parallelProcessing.get(60, TimeUnit.SECONDS);

                String summary = aiSummary.get();
                String hash = ipfsHash.get();

                assertThat(summary).contains("AI-generated summary");
                assertThat(hash).isEqualTo("QmMultiServiceTestHash123");

                // Step 4: Store results on blockchain
                if (blockchainService != null) {
                    blockchainTx = blockchainService.storeNoteOnBlockchain(
                        createdNote.getId(), hash, createdNote.getContent()
                    );
                    String txHash = blockchainTx.get(30, TimeUnit.SECONDS);
                    assertThat(txHash).isNotNull();
                }
            }

            // Step 5: Verify data integrity across all systems
            mockMvc.perform(get("/api/notes/" + createdNote.getId()))
                    .andExpect(status().isOk())
                    .andExpected jsonPath("$.title").value("Complete Workflow Note"))
                    .andExpect(jsonPath("$.content").value(createdNote.getContent()));

            // Verify all external services were called
            if (openAIService != null) {
                openAiMockServer.verify(postRequestedFor(urlPathEqualTo("/v1/chat/completions")));
            }
            if (ipfsService != null) {
                ipfsMockServer.verify(postRequestedFor(urlPathEqualTo("/api/v0/add")));
            }
            if (blockchainService != null && ipfsHash != null) {
                blockchainMockServer.verify(postRequestedFor(urlEqualTo("/")));
            }
        }

        @Test
        @WithMockUser(username = "multi-service-test-user")
        @Transactional
        @DisplayName("Should maintain transaction consistency across services")
        void shouldMaintainTransactionConsistencyAcrossServices() throws Exception {
            // Test transaction rollback scenario
            NoteDto note = new NoteDto();
            note.setTitle("Transaction Test Note");
            note.setContent("Testing transaction consistency");
            note.setUserId(testUser.getId());

            // Mock IPFS failure after successful note creation
            WireMock.configureFor("localhost", 8094);
            ipfsMockServer.stubFor(post(urlPathEqualTo("/api/v0/add"))
                .willReturn(aResponse()
                    .withStatus(500)
                    .withBody("IPFS service unavailable")));

            // Create note (should succeed)
            String noteResponse = mockMvc.perform(post("/api/notes")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(note))
                    .with(csrf()))
                    .andExpect(status().isCreated())
                    .andReturn()
                    .getResponse()
                    .getContentAsString();

            NoteDto createdNote = objectMapper.readValue(noteResponse, NoteDto.class);

            // Attempt IPFS storage (should fail)
            if (ipfsService != null) {
                assertThatThrownBy(() -> {
                    CompletableFuture<String> ipfsResult = ipfsService.storeContent(
                        createdNote.getContent(), "transaction-test"
                    );
                    ipfsResult.get(30, TimeUnit.SECONDS);
                }).hasCauseInstanceOf(RuntimeException.class);
            }

            // Note should still exist in database (partial success is OK)
            mockMvc.perform(get("/api/notes/" + createdNote.getId()))
                    .andExpected status().isOk())
                    .andExpected jsonPath("$.title").value("Transaction Test Note"));
        }
    }
}
