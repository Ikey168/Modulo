package com.modulo.integration;

import com.github.tomakehurst.wiremock.WireMockServer;
import com.github.tomakehurst.wiremock.client.WireMock;
import com.modulo.service.IpfsService;
import com.modulo.service.OpenAIService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

import static com.github.tomakehurst.wiremock.client.WireMock.*;
import static org.assertj.core.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * Integration tests for external service interactions
 * Uses WireMock to simulate external API responses
 */
@SpringBootTest
@ActiveProfiles("integration-test")
@TestPropertySource(properties = {
    "modulo.external.openai-api-url=http://localhost:8090",
    "modulo.external.openai-api-key=test-api-key",
    "modulo.external.ipfs-api-url=http://localhost:8091",
    "modulo.external.ipfs-gateway-url=http://localhost:8092",
    "logging.level.com.modulo.service", "DEBUG"
})
@DisplayName("External Services Integration Tests")
class ExternalServicesIntegrationTest {

    private WireMockServer openAiMockServer;
    private WireMockServer ipfsMockServer;
    private WireMockServer ipfsGatewayMockServer;

    @Autowired(required = false)
    private OpenAIService openAIService;

    @Autowired(required = false)
    private IpfsService ipfsService;

    @BeforeEach
    void setUp() {
        // Set up WireMock servers
        openAiMockServer = new WireMockServer(8090);
        ipfsMockServer = new WireMockServer(8091);
        ipfsGatewayMockServer = new WireMockServer(8092);

        openAiMockServer.start();
        ipfsMockServer.start();
        ipfsGatewayMockServer.start();

        // Configure WireMock for each server
        WireMock.configureFor("localhost", 8090);
    }

    @AfterEach
    void tearDown() {
        if (openAiMockServer != null) openAiMockServer.stop();
        if (ipfsMockServer != null) ipfsMockServer.stop();
        if (ipfsGatewayMockServer != null) ipfsGatewayMockServer.stop();
    }

    @Nested
    @DisplayName("OpenAI Service Integration Tests")
    class OpenAIServiceIntegrationTests {

        @Test
        @DisplayName("Should generate note summaries using OpenAI")
        void shouldGenerateNoteSummariesUsingOpenAI() throws Exception {
            assumeTrue(openAIService != null, "OpenAI service not available");

            // Mock OpenAI API response
            openAiMockServer.stubFor(post(urlPathEqualTo("/v1/chat/completions"))
                .withHeader("Authorization", containing("Bearer test-api-key"))
                .withHeader("Content-Type", equalTo("application/json"))
                .willReturn(aResponse()
                    .withStatus(200)
                    .withHeader("Content-Type", "application/json")
                    .withBody("{\n" +
                        "  \"id\": \"chatcmpl-test123\",\n" +
                        "  \"object\": \"chat.completion\",\n" +
                        "  \"created\": 1677652288,\n" +
                        "  \"model\": \"gpt-3.5-turbo\",\n" +
                        "  \"choices\": [{\n" +
                        "    \"index\": 0,\n" +
                        "    \"message\": {\n" +
                        "      \"role\": \"assistant\",\n" +
                        "      \"content\": \"This is a comprehensive integration test note that demonstrates the functionality of the Modulo application.\"\n" +
                        "    },\n" +
                        "    \"finish_reason\": \"stop\"\n" +
                        "  }],\n" +
                        "  \"usage\": {\n" +
                        "    \"prompt_tokens\": 50,\n" +
                        "    \"completion_tokens\": 25,\n" +
                        "    \"total_tokens\": 75\n" +
                        "  }\n" +
                        "}")));

            String noteContent = "This is a long note content about integration testing in the Modulo application. " +
                "It covers various aspects of end-to-end testing including database integration, " +
                "external service mocking, and comprehensive workflow validation.";

            CompletableFuture<String> summary = openAIService.generateNoteSummary(noteContent);
            String result = summary.get(30, TimeUnit.SECONDS);

            assertThat(result).isNotNull().isNotEmpty();
            assertThat(result).contains("integration test");

            // Verify the API call was made correctly
            openAiMockServer.verify(postRequestedFor(urlPathEqualTo("/v1/chat/completions"))
                .withHeader("Authorization", containing("Bearer test-api-key"))
                .withRequestBody(containing(noteContent)));
        }

        @Test
        @DisplayName("Should handle OpenAI API errors gracefully")
        void shouldHandleOpenAIApiErrorsGracefully() {
            assumeTrue(openAIService != null, "OpenAI service not available");

            // Mock OpenAI API error response
            openAiMockServer.stubFor(post(urlPathEqualTo("/v1/chat/completions"))
                .willReturn(aResponse()
                    .withStatus(429) // Rate limit exceeded
                    .withHeader("Content-Type", "application/json")
                    .withBody("{\n" +
                        "  \"error\": {\n" +
                        "    \"message\": \"Rate limit reached\",\n" +
                        "    \"type\": \"rate_limit_error\",\n" +
                        "    \"param\": null,\n" +
                        "    \"code\": \"rate_limit_exceeded\"\n" +
                        "  }\n" +
                        "}")));

            String noteContent = "Test content for error handling";

            assertThatThrownBy(() -> {
                CompletableFuture<String> summary = openAIService.generateNoteSummary(noteContent);
                summary.get(30, TimeUnit.SECONDS);
            }).hasCauseInstanceOf(RuntimeException.class);
        }

        @Test
        @DisplayName("Should generate task suggestions based on note content")
        void shouldGenerateTaskSuggestionsBasedOnNoteContent() throws Exception {
            assumeTrue(openAIService != null, "OpenAI service not available");

            // Mock OpenAI response for task suggestions
            openAiMockServer.stubFor(post(urlPathEqualTo("/v1/chat/completions"))
                .withRequestBody(containing("task suggestions"))
                .willReturn(aResponse()
                    .withStatus(200)
                    .withHeader("Content-Type", "application/json")
                    .withBody("{\n" +
                        "  \"choices\": [{\n" +
                        "    \"message\": {\n" +
                        "      \"content\": \"1. Review integration test results\\n2. Update documentation\\n3. Fix any failing tests\"\n" +
                        "    }\n" +
                        "  }]\n" +
                        "}")));

            String noteContent = "Meeting notes: We need to complete integration testing and update our documentation.";

            CompletableFuture<String> suggestions = openAIService.generateTaskSuggestions(noteContent);
            String result = suggestions.get(30, TimeUnit.SECONDS);

            assertThat(result).isNotNull();
            assertThat(result).contains("Review integration test results");
            assertThat(result).contains("Update documentation");
        }
    }

    @Nested
    @DisplayName("IPFS Service Integration Tests")
    class IpfsServiceIntegrationTests {

        @Test
        @DisplayName("Should store and retrieve content from IPFS")
        void shouldStoreAndRetrieveContentFromIpfs() throws Exception {
            assumeTrue(ipfsService != null, "IPFS service not available");

            String testContent = "This is test content for IPFS storage integration testing";
            String expectedHash = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";

            // Configure IPFS mock server
            WireMock.configureFor("localhost", 8091);

            // Mock IPFS add endpoint
            ipfsMockServer.stubFor(post(urlPathEqualTo("/api/v0/add"))
                .willReturn(aResponse()
                    .withStatus(200)
                    .withHeader("Content-Type", "application/json")
                    .withBody("{\n" +
                        "  \"Name\": \"test-content\",\n" +
                        "  \"Hash\": \"" + expectedHash + "\",\n" +
                        "  \"Size\": \"" + testContent.length() + "\"\n" +
                        "}")));

            // Store content to IPFS
            CompletableFuture<String> storeResult = ipfsService.storeContent(testContent, "test-content");
            String hash = storeResult.get(30, TimeUnit.SECONDS);

            assertThat(hash).isEqualTo(expectedHash);

            // Configure IPFS gateway mock server
            WireMock.configureFor("localhost", 8092);

            // Mock IPFS retrieval from gateway
            ipfsGatewayMockServer.stubFor(get(urlPathEqualTo("/ipfs/" + expectedHash))
                .willReturn(aResponse()
                    .withStatus(200)
                    .withHeader("Content-Type", "text/plain")
                    .withBody(testContent)));

            // Retrieve content from IPFS
            CompletableFuture<String> retrieveResult = ipfsService.retrieveContent(expectedHash);
            String retrievedContent = retrieveResult.get(30, TimeUnit.SECONDS);

            assertThat(retrievedContent).isEqualTo(testContent);

            // Verify IPFS interactions
            ipfsMockServer.verify(postRequestedFor(urlPathEqualTo("/api/v0/add")));
            ipfsGatewayMockServer.verify(getRequestedFor(urlPathEqualTo("/ipfs/" + expectedHash)));
        }

        @Test
        @DisplayName("Should handle IPFS storage failures")
        void shouldHandleIpfsStorageFailures() {
            assumeTrue(ipfsService != null, "IPFS service not available");

            // Configure IPFS mock server
            WireMock.configureFor("localhost", 8091);

            // Mock IPFS server error
            ipfsMockServer.stubFor(post(urlPathEqualTo("/api/v0/add"))
                .willReturn(aResponse()
                    .withStatus(500)
                    .withBody("Internal server error")));

            String testContent = "Content that will fail to store";

            assertThatThrownBy(() -> {
                CompletableFuture<String> result = ipfsService.storeContent(testContent, "fail-content");
                result.get(30, TimeUnit.SECONDS);
            }).hasCauseInstanceOf(RuntimeException.class);
        }

        @Test
        @DisplayName("Should handle large file uploads to IPFS")
        void shouldHandleLargeFileUploadsToIpfs() throws Exception {
            assumeTrue(ipfsService != null, "IPFS service not available");

            // Generate large content (1MB)
            StringBuilder largeContent = new StringBuilder();
            for (int i = 0; i < 100000; i++) {
                largeContent.append("This is line ").append(i).append(" of large content for IPFS testing.\n");
            }
            String content = largeContent.toString();
            String expectedHash = "QmLargeContentHashForIntegrationTesting123456";

            // Configure IPFS mock server
            WireMock.configureFor("localhost", 8091);

            // Mock IPFS add endpoint for large file
            ipfsMockServer.stubFor(post(urlPathEqualTo("/api/v0/add"))
                .willReturn(aResponse()
                    .withStatus(200)
                    .withHeader("Content-Type", "application/json")
                    .withBody("{\n" +
                        "  \"Name\": \"large-content\",\n" +
                        "  \"Hash\": \"" + expectedHash + "\",\n" +
                        "  \"Size\": \"" + content.length() + "\"\n" +
                        "}"))
                .withFixedDelay(2000)); // Simulate longer upload time

            CompletableFuture<String> result = ipfsService.storeContent(content, "large-content");
            String hash = result.get(60, TimeUnit.SECONDS); // Longer timeout for large files

            assertThat(hash).isEqualTo(expectedHash);

            ipfsMockServer.verify(postRequestedFor(urlPathEqualTo("/api/v0/add")));
        }

        @Test
        @DisplayName("Should pin content to IPFS cluster")
        void shouldPinContentToIpfsCluster() throws Exception {
            assumeTrue(ipfsService != null, "IPFS service not available");

            String hashToPin = "QmTestHashForPinning123456789";

            // Configure IPFS mock server
            WireMock.configureFor("localhost", 8091);

            // Mock IPFS pin endpoint
            ipfsMockServer.stubFor(post(urlPathEqualTo("/api/v0/pin/add"))
                .withQueryParam("arg", equalTo(hashToPin))
                .willReturn(aResponse()
                    .withStatus(200)
                    .withHeader("Content-Type", "application/json")
                    .withBody("{\n" +
                        "  \"Pins\": [\"" + hashToPin + "\"]\n" +
                        "}")));

            CompletableFuture<Boolean> pinResult = ipfsService.pinContent(hashToPin);
            Boolean isPinned = pinResult.get(30, TimeUnit.SECONDS);

            assertThat(isPinned).isTrue();

            ipfsMockServer.verify(postRequestedFor(urlPathEqualTo("/api/v0/pin/add"))
                .withQueryParam("arg", equalTo(hashToPin)));
        }
    }

    @Nested
    @DisplayName("Service Integration and Fallback Tests")
    class ServiceIntegrationAndFallbackTests {

        @Test
        @DisplayName("Should handle service unavailability with fallbacks")
        void shouldHandleServiceUnavailabilityWithFallbacks() throws Exception {
            // Simulate service unavailability
            openAiMockServer.stop();

            if (openAIService != null) {
                String noteContent = "Content for fallback testing";

                // Service should handle unavailability gracefully
                assertThatThrownBy(() -> {
                    CompletableFuture<String> result = openAIService.generateNoteSummary(noteContent);
                    result.get(10, TimeUnit.SECONDS);
                }).hasCauseInstanceOf(Exception.class);
            }
        }

        @Test
        @DisplayName("Should implement circuit breaker pattern")
        void shouldImplementCircuitBreakerPattern() throws Exception {
            assumeTrue(openAIService != null, "OpenAI service not available");

            // Mock repeated failures
            openAiMockServer.stubFor(post(urlPathEqualTo("/v1/chat/completions"))
                .willReturn(aResponse()
                    .withStatus(500)
                    .withFixedDelay(5000))); // Long delay to trigger timeout

            String testContent = "Content for circuit breaker testing";

            // Make multiple requests that should fail
            for (int i = 0; i < 3; i++) {
                assertThatThrownBy(() -> {
                    CompletableFuture<String> result = openAIService.generateNoteSummary(testContent);
                    result.get(10, TimeUnit.SECONDS);
                }).hasCauseInstanceOf(Exception.class);
            }

            // Circuit breaker should now be open, subsequent calls should fail fast
            long startTime = System.currentTimeMillis();
            assertThatThrownBy(() -> {
                CompletableFuture<String> result = openAIService.generateNoteSummary(testContent);
                result.get(10, TimeUnit.SECONDS);
            }).hasCauseInstanceOf(Exception.class);
            long endTime = System.currentTimeMillis();

            // Should fail fast (circuit breaker open)
            assertThat(endTime - startTime).isLessThan(5000);
        }

        @Test
        @DisplayName("Should handle concurrent external service requests")
        void shouldHandleConcurrentExternalServiceRequests() throws Exception {
            assumeTrue(openAIService != null && ipfsService != null, "Services not available");

            // Configure both mock servers
            WireMock.configureFor("localhost", 8090);
            openAiMockServer.stubFor(post(urlPathEqualTo("/v1/chat/completions"))
                .willReturn(aResponse()
                    .withStatus(200)
                    .withHeader("Content-Type", "application/json")
                    .withBody("{\"choices\":[{\"message\":{\"content\":\"Test summary\"}}]}")
                    .withFixedDelay(1000)));

            WireMock.configureFor("localhost", 8091);
            ipfsMockServer.stubFor(post(urlPathEqualTo("/api/v0/add"))
                .willReturn(aResponse()
                    .withStatus(200)
                    .withHeader("Content-Type", "application/json")
                    .withBody("{\"Hash\":\"QmConcurrentTest123\",\"Size\":\"100\"}")
                    .withFixedDelay(1000)));

            String testContent = "Content for concurrent testing";

            // Make concurrent requests to both services
            CompletableFuture<String> openAiResult = openAIService.generateNoteSummary(testContent);
            CompletableFuture<String> ipfsResult = ipfsService.storeContent(testContent, "concurrent-test");

            // Wait for both to complete
            CompletableFuture<Void> allResults = CompletableFuture.allOf(openAiResult, ipfsResult);
            allResults.get(30, TimeUnit.SECONDS);

            assertThat(openAiResult.get()).isEqualTo("Test summary");
            assertThat(ipfsResult.get()).isEqualTo("QmConcurrentTest123");

            // Verify both services were called
            openAiMockServer.verify(postRequestedFor(urlPathEqualTo("/v1/chat/completions")));
            ipfsMockServer.verify(postRequestedFor(urlPathEqualTo("/api/v0/add")));
        }
    }
}
