package com.modulo.service;

import com.modulo.config.AsyncConfig;
import com.modulo.config.BlockchainConfig;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * Integration tests for BlockchainService
 * These tests require network connectivity to Polygon Mumbai testnet
 */
@SpringBootTest(classes = {BlockchainConfig.class, AsyncConfig.class, BlockchainService.class})
@ActiveProfiles("test")
@TestPropertySource(properties = {
    "blockchain.network.rpc-url=https://rpc-mumbai.maticvigil.com",
    "blockchain.network.chain-id=80001",
    "blockchain.contract.address=0x0000000000000000000000000000000000000000", // Placeholder
    "blockchain.private-key=0x0000000000000000000000000000000000000000000000000000000000000001" // Test key
})
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class BlockchainServiceIntegrationTest {

    @Autowired
    private BlockchainService blockchainService;

    private static final String TEST_NOTE_CONTENT = "Test note content for blockchain integration";
    private static final String TEST_NOTE_TITLE = "Test Note Title";

    @BeforeEach
    void setUp() {
        // Only run tests if blockchain service is available
        assumeTrue(blockchainService.isAvailable(), 
                  "Skipping blockchain tests - service not available");
    }

    @Test
    void testNetworkConnectivity() {
        var networkInfo = blockchainService.getNetworkInfo();
        
        assertNotNull(networkInfo);
        assertTrue(networkInfo.isConnected(), "Should be connected to blockchain network");
        assertEquals("mumbai", networkInfo.getNetworkName().toLowerCase());
        assertEquals(80001L, networkInfo.getChainId());
    }

    @Test
    void testHashGeneration() {
        String hash1 = blockchainService.generateNoteHash(TEST_NOTE_CONTENT);
        String hash2 = blockchainService.generateNoteHash(TEST_NOTE_CONTENT);
        
        assertNotNull(hash1);
        assertNotNull(hash2);
        assertEquals(hash1, hash2, "Hash should be deterministic");
        assertTrue(hash1.startsWith("0x"), "Hash should be hex string");
        assertEquals(66, hash1.length(), "Hash should be 32 bytes (64 hex chars + 0x prefix)");
    }

    @Test
    void testHashUniqueness() {
        String hash1 = blockchainService.generateNoteHash("Content 1");
        String hash2 = blockchainService.generateNoteHash("Content 2");
        
        assertNotEquals(hash1, hash2, "Different content should produce different hashes");
    }

    @Test
    void testNoteRegistrationValidation() {
        // Test with null content
        assertThrows(IllegalArgumentException.class, () -> {
            blockchainService.registerNote(null, TEST_NOTE_TITLE);
        });

        // Test with empty content
        assertThrows(IllegalArgumentException.class, () -> {
            blockchainService.registerNote("", TEST_NOTE_TITLE);
        });

        // Test with null title
        assertThrows(IllegalArgumentException.class, () -> {
            blockchainService.registerNote(TEST_NOTE_CONTENT, null);
        });

        // Test with empty title
        assertThrows(IllegalArgumentException.class, () -> {
            blockchainService.registerNote(TEST_NOTE_CONTENT, "");
        });
    }

    @Test
    void testNoteVerificationValidation() {
        // Test with null content
        assertThrows(IllegalArgumentException.class, () -> {
            blockchainService.verifyNote(null);
        });

        // Test with empty content
        assertThrows(IllegalArgumentException.class, () -> {
            blockchainService.verifyNote("");
        });
    }

    // Note: The following tests require a deployed smart contract and actual blockchain interaction
    // They are disabled by default to avoid network dependencies in CI/CD

    // @Test
    // @Disabled("Requires deployed smart contract")
    // void testNoteRegistrationFlow() throws Exception {
    //     var result = blockchainService.registerNote(TEST_NOTE_CONTENT, TEST_NOTE_TITLE).get();
    //     
    //     assertTrue(result.isSuccess(), "Note registration should succeed");
    //     assertNotNull(result.getNoteId(), "Should return note ID");
    //     assertNotNull(result.getTransactionHash(), "Should return transaction hash");
    // }

    // @Test
    // @Disabled("Requires deployed smart contract")
    // void testNoteVerificationFlow() throws Exception {
    //     // First register a note
    //     var registerResult = blockchainService.registerNote(TEST_NOTE_CONTENT, TEST_NOTE_TITLE).get();
    //     assertTrue(registerResult.isSuccess());
    //     
    //     // Then verify it
    //     var verifyResult = blockchainService.verifyNote(TEST_NOTE_CONTENT).get();
    //     assertTrue(verifyResult.isExists(), "Note should exist on blockchain");
    //     assertEquals(registerResult.getNoteId(), verifyResult.getNoteId());
    // }
}
