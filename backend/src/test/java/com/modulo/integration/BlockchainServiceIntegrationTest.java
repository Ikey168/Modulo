package com.modulo.integration;

import com.github.tomakehurst.wiremock.WireMockServer;
import com.github.tomakehurst.wiremock.client.WireMock;
import com.modulo.config.AsyncConfig;
import com.modulo.config.BlockchainConfig;
import com.modulo.service.BlockchainService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.TestPropertySource;
import org.testcontainers.containers.MockServerContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import java.math.BigInteger;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

import static com.github.tomakehurst.wiremock.client.WireMock.*;
import static org.assertj.core.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * Integration tests for blockchain service interactions
 * Uses WireMock to simulate blockchain network responses
 */
@SpringBootTest(classes = {BlockchainConfig.class, AsyncConfig.class, BlockchainService.class})
@ActiveProfiles("integration-test")
@Testcontainers
@TestPropertySource(properties = {
    "blockchain.network.rpc-url=http://localhost:8089",
    "blockchain.network.chain-id=31337", // Local test network
    "blockchain.contract.address=0x742d35C8dbD20A1BfD6fD6B10E4B3F5e4B6E8Db8",
    "blockchain.private-key=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // Test key
    "blockchain.enabled=true"
})
@DisplayName("Blockchain Service Integration Tests")
class BlockchainServiceIntegrationTest {

    @Container
    static MockServerContainer mockServer = new MockServerContainer(DockerImageName.parse("mockserver/mockserver:5.15.0"));

    private WireMockServer wireMockServer;

    @Autowired(required = false)
    private BlockchainService blockchainService;

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("blockchain.network.rpc-url", () -> "http://localhost:8089");
        registry.add("logging.level.com.modulo.service.BlockchainService", () -> "DEBUG");
    }

    @BeforeEach
    void setUp() {
        // Skip tests if blockchain service is not available
        assumeTrue(blockchainService != null, "BlockchainService is not available - skipping blockchain integration tests");
        
        wireMockServer = new WireMockServer(8089);
        wireMockServer.start();
        WireMock.configureFor("localhost", 8089);
    }

    @AfterEach
    void tearDown() {
        if (wireMockServer != null) {
            wireMockServer.stop();
        }
    }

    @Nested
    @DisplayName("Smart Contract Interaction Tests")
    class SmartContractInteractionTests {

        @Test
        @DisplayName("Should interact with note storage contract")
        void shouldInteractWithNoteStorageContract() throws Exception {
            // Mock blockchain RPC responses
            stubFor(post(urlEqualTo("/"))
                .withHeader("Content-Type", equalTo("application/json"))
                .withRequestBody(containing("eth_getTransactionCount"))
                .willReturn(aResponse()
                    .withStatus(200)
                    .withHeader("Content-Type", "application/json")
                    .withBody("{\"jsonrpc\":\"2.0\",\"result\":\"0x1\",\"id\":1}")));

            stubFor(post(urlEqualTo("/"))
                .withHeader("Content-Type", equalTo("application/json"))
                .withRequestBody(containing("eth_gasPrice"))
                .willReturn(aResponse()
                    .withStatus(200)
                    .withHeader("Content-Type", "application/json")
                    .withBody("{\"jsonrpc\":\"2.0\",\"result\":\"0x4a817c800\",\"id\":1}")));

            stubFor(post(urlEqualTo("/"))
                .withHeader("Content-Type", equalTo("application/json"))
                .withRequestBody(containing("eth_sendRawTransaction"))
                .willReturn(aResponse()
                    .withStatus(200)
                    .withHeader("Content-Type", "application/json")
                    .withBody("{\"jsonrpc\":\"2.0\",\"result\":\"0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef\",\"id\":1}")));

            stubFor(post(urlEqualTo("/"))
                .withHeader("Content-Type", equalTo("application/json"))
                .withRequestBody(containing("eth_getTransactionReceipt"))
                .willReturn(aResponse()
                    .withStatus(200)
                    .withHeader("Content-Type", "application/json")
                    .withBody("{\"jsonrpc\":\"2.0\",\"result\":{\"transactionHash\":\"0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef\",\"blockHash\":\"0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890\",\"blockNumber\":\"0x1\",\"gasUsed\":\"0x5208\",\"status\":\"0x1\"},\"id\":1}")));

            // Test note storage on blockchain
            String noteContent = "Test note content for blockchain storage";
            String ipfsHash = "QmTestHashForBlockchainIntegration";
            
            CompletableFuture<String> result = blockchainService.storeNoteOnBlockchain(
                1L, // noteId
                ipfsHash,
                noteContent
            );

            String transactionHash = result.get(30, TimeUnit.SECONDS);
            assertThat(transactionHash).isNotNull().isNotEmpty();

            // Verify the blockchain interaction was called
            verify(postRequestedFor(urlEqualTo("/"))
                .withHeader("Content-Type", equalTo("application/json"))
                .withRequestBody(containing("eth_sendRawTransaction")));
        }

        @Test
        @DisplayName("Should handle blockchain transaction failures")
        void shouldHandleBlockchainTransactionFailures() throws Exception {
            // Mock failed transaction response
            stubFor(post(urlEqualTo("/"))
                .withHeader("Content-Type", equalTo("application/json"))
                .withRequestBody(containing("eth_sendRawTransaction"))
                .willReturn(aResponse()
                    .withStatus(200)
                    .withHeader("Content-Type", "application/json")
                    .withBody("{\"jsonrpc\":\"2.0\",\"error\":{\"code\":-32000,\"message\":\"insufficient funds\"},\"id\":1}")));

            // Test handling of blockchain failures
            String noteContent = "Test note for failure handling";
            String ipfsHash = "QmTestHashForFailure";

            assertThatThrownBy(() -> {
                CompletableFuture<String> result = blockchainService.storeNoteOnBlockchain(
                    2L, // noteId
                    ipfsHash,
                    noteContent
                );
                result.get(30, TimeUnit.SECONDS);
            }).hasCauseInstanceOf(RuntimeException.class);
        }
    }

    @Nested
    @DisplayName("Access Control Integration Tests")
    class AccessControlIntegrationTests {

        @Test
        @DisplayName("Should manage access permissions on blockchain")
        void shouldManageAccessPermissionsOnBlockchain() throws Exception {
            // Mock successful grant access transaction
            stubFor(post(urlEqualTo("/"))
                .withHeader("Content-Type", equalTo("application/json"))
                .withRequestBody(containing("eth_sendRawTransaction"))
                .willReturn(aResponse()
                    .withStatus(200)
                    .withHeader("Content-Type", "application/json")
                    .withBody("{\"jsonrpc\":\"2.0\",\"result\":\"0xaccesscontrolhash1234567890abcdef1234567890abcdef\",\"id\":1}")));

            // Test granting access to a user
            String userAddress = "0x742d35C8dbD20A1BfD6fD6B10E4B3F5e4B6E8Db9";
            Long noteId = 1L;

            CompletableFuture<String> result = blockchainService.grantNoteAccess(noteId, userAddress);
            String transactionHash = result.get(30, TimeUnit.SECONDS);

            assertThat(transactionHash).isNotNull().isNotEmpty();

            // Verify access control transaction
            verify(postRequestedFor(urlEqualTo("/"))
                .withHeader("Content-Type", equalTo("application/json"))
                .withRequestBody(containing("eth_sendRawTransaction")));
        }

        @Test
        @DisplayName("Should verify access permissions")
        void shouldVerifyAccessPermissions() throws Exception {
            // Mock successful access check
            stubFor(post(urlEqualTo("/"))
                .withHeader("Content-Type", equalTo("application/json"))
                .withRequestBody(containing("eth_call"))
                .willReturn(aResponse()
                    .withStatus(200)
                    .withHeader("Content-Type", "application/json")
                    .withBody("{\"jsonrpc\":\"2.0\",\"result\":\"0x0000000000000000000000000000000000000000000000000000000000000001\",\"id\":1}")));

            // Test checking access permissions
            String userAddress = "0x742d35C8dbD20A1BfD6fD6B10E4B3F5e4B6E8Db9";
            Long noteId = 1L;

            CompletableFuture<Boolean> hasAccess = blockchainService.checkNoteAccess(noteId, userAddress);
            Boolean result = hasAccess.get(30, TimeUnit.SECONDS);

            assertThat(result).isTrue();

            // Verify access check call
            verify(postRequestedFor(urlEqualTo("/"))
                .withHeader("Content-Type", equalTo("application/json"))
                .withRequestBody(containing("eth_call")));
        }
    }

    @Nested
    @DisplayName("Network Connectivity Tests")
    class NetworkConnectivityTests {

        @Test
        @DisplayName("Should handle network connectivity issues")
        void shouldHandleNetworkConnectivityIssues() {
            // Mock network timeout
            stubFor(post(urlEqualTo("/"))
                .willReturn(aResponse()
                    .withFixedDelay(31000) // Longer than typical timeout
                    .withStatus(200)));

            // Test timeout handling
            assertThatThrownBy(() -> {
                CompletableFuture<String> result = blockchainService.storeNoteOnBlockchain(
                    3L,
                    "QmTestHashForTimeout",
                    "Test content for timeout"
                );
                result.get(30, TimeUnit.SECONDS);
            }).hasCauseInstanceOf(Exception.class);
        }

        @Test
        @DisplayName("Should retry failed blockchain operations")
        void shouldRetryFailedBlockchainOperations() throws Exception {
            // Mock first call failure, second call success
            stubFor(post(urlEqualTo("/"))
                .withRequestBody(containing("eth_getTransactionCount"))
                .inScenario("Retry Scenario")
                .whenScenarioStateIs("Started")
                .willSetStateTo("First Attempt")
                .willReturn(aResponse()
                    .withStatus(500)
                    .withBody("{\"error\":\"Internal Server Error\"}")));

            stubFor(post(urlEqualTo("/"))
                .withRequestBody(containing("eth_getTransactionCount"))
                .inScenario("Retry Scenario")
                .whenScenarioStateIs("First Attempt")
                .willSetStateTo("Success")
                .willReturn(aResponse()
                    .withStatus(200)
                    .withHeader("Content-Type", "application/json")
                    .withBody("{\"jsonrpc\":\"2.0\",\"result\":\"0x1\",\"id\":1}")));

            // Test retry logic
            CompletableFuture<BigInteger> result = blockchainService.getCurrentBlockNumber();
            BigInteger blockNumber = result.get(30, TimeUnit.SECONDS);

            assertThat(blockNumber).isNotNull();

            // Verify retry occurred (should see 2 requests)
            verify(exactly(2), postRequestedFor(urlEqualTo("/"))
                .withRequestBody(containing("eth_getTransactionCount")));
        }
    }

    @Nested
    @DisplayName("Event Monitoring Integration Tests")
    class EventMonitoringIntegrationTests {

        @Test
        @DisplayName("Should monitor blockchain events")
        void shouldMonitorBlockchainEvents() throws Exception {
            // Mock event log response
            stubFor(post(urlEqualTo("/"))
                .withHeader("Content-Type", equalTo("application/json"))
                .withRequestBody(containing("eth_getLogs"))
                .willReturn(aResponse()
                    .withStatus(200)
                    .withHeader("Content-Type", "application/json")
                    .withBody("{\"jsonrpc\":\"2.0\",\"result\":[{" +
                        "\"address\":\"0x742d35C8dbD20A1BfD6fD6B10E4B3F5e4B6E8Db8\"," +
                        "\"topics\":[\"0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef\"]," +
                        "\"data\":\"0xabcdef1234567890\"," +
                        "\"blockNumber\":\"0x1\"," +
                        "\"transactionHash\":\"0xeventhash1234567890abcdef1234567890abcdef\"" +
                        "}],\"id\":1}")));

            // Start event monitoring
            CompletableFuture<Void> monitoring = blockchainService.startEventMonitoring();

            // Give some time for event monitoring to process
            Thread.sleep(2000);

            // Stop monitoring
            blockchainService.stopEventMonitoring();

            // Verify event monitoring calls were made
            verify(atLeastOnce(), postRequestedFor(urlEqualTo("/"))
                .withHeader("Content-Type", equalTo("application/json"))
                .withRequestBody(containing("eth_getLogs")));
        }

        @Test
        @DisplayName("Should handle event processing errors gracefully")
        void shouldHandleEventProcessingErrorsGracefully() throws Exception {
            // Mock malformed event response
            stubFor(post(urlEqualTo("/"))
                .withHeader("Content-Type", equalTo("application/json"))
                .withRequestBody(containing("eth_getLogs"))
                .willReturn(aResponse()
                    .withStatus(200)
                    .withHeader("Content-Type", "application/json")
                    .withBody("{\"jsonrpc\":\"2.0\",\"result\":[{\"malformed\":\"event\"}],\"id\":1}")));

            // Event monitoring should handle malformed events gracefully
            assertThatNoException().isThrownBy(() -> {
                CompletableFuture<Void> monitoring = blockchainService.startEventMonitoring();
                Thread.sleep(1000);
                blockchainService.stopEventMonitoring();
            });
        }
    }

    @Nested
    @DisplayName("Gas Management Integration Tests")
    class GasManagementIntegrationTests {

        @Test
        @DisplayName("Should estimate gas costs correctly")
        void shouldEstimateGasCostsCorrectly() throws Exception {
            // Mock gas estimation response
            stubFor(post(urlEqualTo("/"))
                .withHeader("Content-Type", equalTo("application/json"))
                .withRequestBody(containing("eth_estimateGas"))
                .willReturn(aResponse()
                    .withStatus(200)
                    .withHeader("Content-Type", "application/json")
                    .withBody("{\"jsonrpc\":\"2.0\",\"result\":\"0x5208\",\"id\":1}")));

            // Test gas estimation
            CompletableFuture<BigInteger> gasEstimate = blockchainService.estimateGasForNoteStorage(
                1L,
                "QmTestHashForGasEstimation"
            );

            BigInteger result = gasEstimate.get(30, TimeUnit.SECONDS);
            assertThat(result).isNotNull().isPositive();

            // Verify gas estimation call
            verify(postRequestedFor(urlEqualTo("/"))
                .withHeader("Content-Type", equalTo("application/json"))
                .withRequestBody(containing("eth_estimateGas")));
        }

        @Test
        @DisplayName("Should handle high gas price scenarios")
        void shouldHandleHighGasPriceScenarios() throws Exception {
            // Mock very high gas price
            stubFor(post(urlEqualTo("/"))
                .withHeader("Content-Type", equalTo("application/json"))
                .withRequestBody(containing("eth_gasPrice"))
                .willReturn(aResponse()
                    .withStatus(200)
                    .withHeader("Content-Type", "application/json")
                    .withBody("{\"jsonrpc\":\"2.0\",\"result\":\"0x2540be400\",\"id\":1}"))); // 10 Gwei

            // Test high gas price handling
            CompletableFuture<BigInteger> gasPrice = blockchainService.getCurrentGasPrice();
            BigInteger result = gasPrice.get(30, TimeUnit.SECONDS);

            assertThat(result).isNotNull();
            // Service should handle high gas prices gracefully (implementation dependent)
        }
    }
}
