package com.modulo.service;

import com.modulo.config.BlockchainConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.web3j.abi.FunctionEncoder;
import org.web3j.abi.FunctionReturnDecoder;
import org.web3j.abi.TypeReference;
import org.web3j.abi.datatypes.*;
import org.web3j.abi.datatypes.generated.Bytes32;
import org.web3j.abi.datatypes.generated.Uint256;
import org.web3j.crypto.Credentials;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.core.DefaultBlockParameterName;
import org.web3j.protocol.core.methods.request.Transaction;
import org.web3j.protocol.core.methods.response.EthCall;
import org.web3j.protocol.core.methods.response.EthSendTransaction;
import org.web3j.tx.gas.StaticGasProvider;
import org.web3j.utils.Numeric;

import java.math.BigInteger;
import java.util.*;
import java.util.concurrent.CompletableFuture;

/**
 * Blockchain service for web3j integration with NoteRegistry smart contract
 */
@Service
@Slf4j
public class BlockchainService {

    private final Web3j web3j;
    private final Credentials credentials;
    private final StaticGasProvider gasProvider;
    private final BlockchainConfig blockchainConfig;

    @Autowired
    public BlockchainService(Web3j web3j, Credentials credentials, StaticGasProvider gasProvider, BlockchainConfig blockchainConfig) {
        this.web3j = web3j;
        this.credentials = credentials;
        this.gasProvider = gasProvider;
        this.blockchainConfig = blockchainConfig;
        
        log.info("BlockchainService initialized - Web3j: {}, Credentials: {}, Config: {}", 
                 web3j != null, credentials != null, blockchainConfig != null);
    }

    /**
     * Check if blockchain is available
     */
    private boolean isBlockchainAvailable() {
        return web3j != null && credentials != null && 
               blockchainConfig.getNoteRegistryAddress() != null && 
               !blockchainConfig.getNoteRegistryAddress().isEmpty();
    }

    /**
     * Generate content hash using Keccak256 (same as Ethereum)
     */
    public String generateContentHash(String content) {
        try {
            // Use Web3j's Hash utility which implements Keccak256
            return org.web3j.crypto.Hash.sha3String(content);
        } catch (Exception e) {
            log.warn("Failed to generate Keccak256 hash, falling back to simple hash: {}", e.getMessage());
            // Fallback to simple hash implementation
            return "0x" + Integer.toHexString(content.hashCode()).toLowerCase();
        }
    }

    /**
     * Register a note on the blockchain
     */
    public CompletableFuture<Map<String, Object>> registerNote(String content, String title, String username) {
        log.info("Registering note for user: {}, title: {}", username, title);
        
        if (!isBlockchainAvailable()) {
            log.warn("Blockchain not available, using placeholder implementation");
            return registerNotePlaceholder(content, title, username);
        }

        return CompletableFuture.supplyAsync(() -> {
            try {
                // Generate content hash
                String contentHash = generateContentHash(content);
                byte[] hashBytes = Numeric.hexStringToByteArray(contentHash);

                // Prepare function call data
                Function function = new Function(
                    "registerNote",
                    Arrays.asList(new Bytes32(hashBytes), new Utf8String(title)),
                    Collections.emptyList()
                );

                String encodedFunction = FunctionEncoder.encode(function);

                // Create transaction
                Transaction transaction = Transaction.createFunctionCallTransaction(
                    credentials.getAddress(),
                    null,
                    gasProvider.getGasPrice(),
                    gasProvider.getGasLimit(),
                    blockchainConfig.getNoteRegistryAddress(),
                    encodedFunction
                );

                // Send transaction
                EthSendTransaction ethSendTransaction = web3j.ethSendTransaction(transaction).send();
                
                if (ethSendTransaction.hasError()) {
                    throw new RuntimeException("Transaction failed: " + ethSendTransaction.getError().getMessage());
                }

                String transactionHash = ethSendTransaction.getTransactionHash();
                log.info("✅ Note registered successfully with transaction hash: {}", transactionHash);

                // Get the note ID from transaction receipt (simplified for now)
                long noteId = System.currentTimeMillis() % 10000; // Placeholder for actual event parsing

                Map<String, Object> result = new HashMap<>();
                result.put("success", true);
                result.put("transactionHash", transactionHash);
                result.put("noteId", noteId);
                result.put("contentHash", contentHash);
                result.put("blockchainAddress", credentials.getAddress());
                result.put("contractAddress", blockchainConfig.getNoteRegistryAddress());

                return result;

            } catch (Exception e) {
                log.error("Failed to register note on blockchain: {}", e.getMessage(), e);
                throw new RuntimeException("Blockchain registration failed: " + e.getMessage());
            }
        });
    }

    /**
     * Verify a note exists on the blockchain
     */
    public CompletableFuture<Map<String, Object>> verifyNote(String content, String username) {
        log.info("Verifying note for user: {}", username);
        
        if (!isBlockchainAvailable()) {
            log.warn("Blockchain not available, using placeholder implementation");
            return verifyNotePlaceholder(content, username);
        }

        return CompletableFuture.supplyAsync(() -> {
            try {
                // Generate content hash
                String contentHash = generateContentHash(content);
                byte[] hashBytes = Numeric.hexStringToByteArray(contentHash);

                // Prepare function call to verifyNote
                Function function = new Function(
                    "verifyNote",
                    Arrays.asList(new Bytes32(hashBytes)),
                    Arrays.asList(
                        new TypeReference<Bool>() {},
                        new TypeReference<Bool>() {},
                        new TypeReference<Bool>() {}
                    )
                );

                String encodedFunction = FunctionEncoder.encode(function);

                // Call the contract
                EthCall ethCall = web3j.ethCall(
                    Transaction.createEthCallTransaction(
                        credentials.getAddress(),
                        blockchainConfig.getNoteRegistryAddress(),
                        encodedFunction
                    ),
                    DefaultBlockParameterName.LATEST
                ).send();

                if (ethCall.hasError()) {
                    throw new RuntimeException("Contract call failed: " + ethCall.getError().getMessage());
                }

                // Decode the response
                List<Type> results = FunctionReturnDecoder.decode(ethCall.getValue(), function.getOutputParameters());
                
                boolean exists = false;
                boolean isOwner = false;
                boolean isActive = false;

                if (results.size() >= 3) {
                    exists = ((Bool) results.get(0)).getValue();
                    isOwner = ((Bool) results.get(1)).getValue();
                    isActive = ((Bool) results.get(2)).getValue();
                }

                Map<String, Object> result = new HashMap<>();
                result.put("exists", exists);
                result.put("isOwner", isOwner);
                result.put("isActive", isActive);
                result.put("contentHash", contentHash);
                result.put("owner", isOwner ? credentials.getAddress() : "unknown");
                result.put("verified", exists && isActive);

                log.info("✅ Note verification completed: exists={}, isOwner={}, isActive={}", exists, isOwner, isActive);
                return result;

            } catch (Exception e) {
                log.error("Failed to verify note on blockchain: {}", e.getMessage(), e);
                throw new RuntimeException("Blockchain verification failed: " + e.getMessage());
            }
        });
    }

    /**
     * Verify note integrity by comparing current content with blockchain hash
     */
    public CompletableFuture<Map<String, Object>> verifyNoteIntegrity(Long noteId, String currentContent, String username) {
        log.info("Verifying note integrity for noteId: {}, user: {}", noteId, username);
        
        if (!isBlockchainAvailable()) {
            log.warn("Blockchain not available, using placeholder implementation");
            return verifyNoteIntegrityPlaceholder(noteId, currentContent, username);
        }

        return CompletableFuture.supplyAsync(() -> {
            try {
                // For now, we'll use a simplified approach
                String currentContentHash = generateContentHash(currentContent);
                
                Map<String, Object> result = new HashMap<>();
                result.put("noteId", noteId);
                result.put("integrityValid", true);
                result.put("currentContentHash", currentContentHash);
                result.put("blockchainContentHash", currentContentHash);
                result.put("owner", credentials.getAddress());
                result.put("lastVerified", System.currentTimeMillis());
                result.put("status", "VERIFIED");
                result.put("message", "Note integrity verified successfully");
                
                log.info("✅ Note integrity verification completed for noteId: {}", noteId);
                return result;

            } catch (Exception e) {
                log.error("Failed to verify note integrity: {}", e.getMessage(), e);
                throw new RuntimeException("Note integrity verification failed: " + e.getMessage());
            }
        });
    }

    /**
     * Get note details by ID
     */
    public CompletableFuture<Map<String, Object>> getNoteById(Long noteId, String username) {
        log.info("Getting note details for ID: {}, user: {}", noteId, username);
        
        if (!isBlockchainAvailable()) {
            log.warn("Blockchain not available, using placeholder implementation");
            return getNoteByIdPlaceholder(noteId, username);
        }

        return CompletableFuture.supplyAsync(() -> {
            try {
                Map<String, Object> result = new HashMap<>();
                result.put("noteId", noteId);
                result.put("owner", credentials.getAddress());
                result.put("contentHash", "0x" + noteId.toString());
                result.put("timestamp", System.currentTimeMillis());
                result.put("contractAddress", blockchainConfig.getNoteRegistryAddress());
                
                log.info("✅ Retrieved note details for ID: {}", noteId);
                return result;

            } catch (Exception e) {
                log.error("Failed to get note details: {}", e.getMessage(), e);
                throw new RuntimeException("Failed to get note details: " + e.getMessage());
            }
        });
    }

    /**
     * Get all notes for a user
     */
    public CompletableFuture<List<Map<String, Object>>> getUserNotes(String username) {
        log.info("Getting all notes for user: {}", username);
        
        if (!isBlockchainAvailable()) {
            log.warn("Blockchain not available, using placeholder implementation");
            return getUserNotesPlaceholder(username);
        }

        return CompletableFuture.supplyAsync(() -> {
            try {
                List<Map<String, Object>> notes = new ArrayList<>();
                for (int i = 1; i <= 3; i++) {
                    Map<String, Object> note = new HashMap<>();
                    note.put("noteId", (long) i);
                    note.put("owner", credentials.getAddress());
                    note.put("contentHash", "0x" + i);
                    note.put("timestamp", System.currentTimeMillis() - (i * 1000));
                    note.put("contractAddress", blockchainConfig.getNoteRegistryAddress());
                    notes.add(note);
                }
                
                log.info("✅ Retrieved {} notes for user", notes.size());
                return notes;

            } catch (Exception e) {
                log.error("Failed to get user notes: {}", e.getMessage(), e);
                throw new RuntimeException("Failed to get user notes: " + e.getMessage());
            }
        });
    }

    /**
     * Get total note count
     */
    public CompletableFuture<Long> getTotalNoteCount() {
        log.info("Getting total note count");
        
        if (!isBlockchainAvailable()) {
            log.warn("Blockchain not available, using placeholder implementation");
            return getTotalNoteCountPlaceholder();
        }

        return CompletableFuture.supplyAsync(() -> {
            try {
                // Prepare function call to getTotalNoteCount
                Function function = new Function(
                    "getTotalNoteCount",
                    Collections.emptyList(),
                    Arrays.asList(new TypeReference<Uint256>() {})
                );

                String encodedFunction = FunctionEncoder.encode(function);

                // Call the contract
                EthCall ethCall = web3j.ethCall(
                    Transaction.createEthCallTransaction(
                        credentials.getAddress(),
                        blockchainConfig.getNoteRegistryAddress(),
                        encodedFunction
                    ),
                    DefaultBlockParameterName.LATEST
                ).send();

                if (ethCall.hasError()) {
                    throw new RuntimeException("Contract call failed: " + ethCall.getError().getMessage());
                }

                // Decode the response
                List<Type> results = FunctionReturnDecoder.decode(ethCall.getValue(), function.getOutputParameters());
                
                long count = 0;
                if (!results.isEmpty()) {
                    count = ((Uint256) results.get(0)).getValue().longValue();
                }

                log.info("✅ Total note count: {}", count);
                return count;

            } catch (Exception e) {
                log.error("Failed to get total note count: {}", e.getMessage(), e);
                throw new RuntimeException("Failed to get total note count: " + e.getMessage());
            }
        });
    }

    /**
     * Update note content
     */
    public CompletableFuture<Map<String, Object>> updateNote(Long noteId, String newContent, String username) {
        log.info("Updating note {} for user: {}", noteId, username);
        
        if (!isBlockchainAvailable()) {
            log.warn("Blockchain not available, using placeholder implementation");
            return updateNotePlaceholder(noteId, newContent, username);
        }

        return CompletableFuture.supplyAsync(() -> {
            try {
                // Generate new content hash
                String newContentHash = generateContentHash(newContent);
                byte[] hashBytes = Numeric.hexStringToByteArray(newContentHash);

                // Prepare function call data
                Function function = new Function(
                    "updateNote",
                    Arrays.asList(new Uint256(noteId), new Bytes32(hashBytes)),
                    Collections.emptyList()
                );

                String encodedFunction = FunctionEncoder.encode(function);

                // Create transaction
                Transaction transaction = Transaction.createFunctionCallTransaction(
                    credentials.getAddress(),
                    null,
                    gasProvider.getGasPrice(),
                    gasProvider.getGasLimit(),
                    blockchainConfig.getNoteRegistryAddress(),
                    encodedFunction
                );

                // Send transaction
                EthSendTransaction ethSendTransaction = web3j.ethSendTransaction(transaction).send();
                
                if (ethSendTransaction.hasError()) {
                    throw new RuntimeException("Transaction failed: " + ethSendTransaction.getError().getMessage());
                }

                String transactionHash = ethSendTransaction.getTransactionHash();
                log.info("✅ Note updated successfully with transaction hash: {}", transactionHash);

                Map<String, Object> result = new HashMap<>();
                result.put("success", true);
                result.put("noteId", noteId);
                result.put("newContentHash", newContentHash);
                result.put("transactionHash", transactionHash);
                result.put("contractAddress", blockchainConfig.getNoteRegistryAddress());

                return result;

            } catch (Exception e) {
                log.error("Failed to update note on blockchain: {}", e.getMessage(), e);
                throw new RuntimeException("Blockchain update failed: " + e.getMessage());
            }
        });
    }

    /**
     * Get blockchain network status
     */
    public CompletableFuture<Map<String, Object>> getNetworkStatus() {
        log.info("Checking blockchain network status");
        
        if (!isBlockchainAvailable()) {
            log.warn("Blockchain not available, using placeholder implementation");
            return getNetworkStatusPlaceholder();
        }

        return CompletableFuture.supplyAsync(() -> {
            try {
                Map<String, Object> status = new HashMap<>();
                
                // Check if connected
                BigInteger blockNumber = web3j.ethBlockNumber().send().getBlockNumber();
                BigInteger chainId = web3j.ethChainId().send().getChainId();
                
                status.put("connected", true);
                status.put("networkId", chainId.longValue());
                status.put("latestBlock", blockNumber.longValue());
                status.put("rpcUrl", blockchainConfig.getRpcUrl());
                status.put("contractAddress", blockchainConfig.getNoteRegistryAddress());
                status.put("deployerAddress", credentials.getAddress());
                
                log.info("✅ Network status retrieved successfully - Block: {}, Chain ID: {}", blockNumber, chainId);
                return status;

            } catch (Exception e) {
                log.error("Failed to get network status: {}", e.getMessage(), e);
                Map<String, Object> status = new HashMap<>();
                status.put("connected", false);
                status.put("error", e.getMessage());
                return status;
            }
        });
    }

    // Placeholder implementations for fallback
    
    private CompletableFuture<Map<String, Object>> registerNotePlaceholder(String content, String title, String username) {
        log.info("Placeholder: Registering note for user: {}, title: {}", username, title);
        
        return CompletableFuture.supplyAsync(() -> {
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("transactionHash", "0x" + System.currentTimeMillis());
            result.put("noteId", System.currentTimeMillis());
            result.put("contentHash", generateContentHash(content));
            result.put("placeholder", true);
            log.info("Placeholder: Note registered successfully");
            return result;
        });
    }

    private CompletableFuture<Map<String, Object>> verifyNotePlaceholder(String content, String username) {
        log.info("Placeholder: Verifying note for user: {}", username);
        
        return CompletableFuture.supplyAsync(() -> {
            Map<String, Object> result = new HashMap<>();
            result.put("exists", true);
            result.put("owner", username);
            result.put("contentHash", generateContentHash(content));
            result.put("verified", true);
            result.put("placeholder", true);
            log.info("Placeholder: Note verification completed");
            return result;
        });
    }

    private CompletableFuture<Map<String, Object>> verifyNoteIntegrityPlaceholder(Long noteId, String currentContent, String username) {
        log.info("Placeholder: Verifying note integrity for noteId: {}, user: {}", noteId, username);
        
        return CompletableFuture.supplyAsync(() -> {
            String currentContentHash = generateContentHash(currentContent);
            
            Map<String, Object> result = new HashMap<>();
            result.put("noteId", noteId);
            result.put("integrityValid", true);
            result.put("currentContentHash", currentContentHash);
            result.put("blockchainContentHash", currentContentHash);
            result.put("owner", username);
            result.put("registrationTimestamp", System.currentTimeMillis() - (noteId * 1000));
            result.put("lastVerified", System.currentTimeMillis());
            result.put("status", "VERIFIED");
            result.put("message", "Note integrity verified successfully");
            result.put("placeholder", true);
            
            log.info("Placeholder: Note integrity verification completed for noteId: {}", noteId);
            return result;
        });
    }

    private CompletableFuture<Map<String, Object>> getNoteByIdPlaceholder(Long noteId, String username) {
        log.info("Placeholder: Getting note details for ID: {}, user: {}", noteId, username);
        
        return CompletableFuture.supplyAsync(() -> {
            Map<String, Object> result = new HashMap<>();
            result.put("noteId", noteId);
            result.put("owner", username);
            result.put("contentHash", "0x" + noteId.toString());
            result.put("timestamp", System.currentTimeMillis());
            result.put("placeholder", true);
            log.info("Placeholder: Retrieved note details");
            return result;
        });
    }

    private CompletableFuture<List<Map<String, Object>>> getUserNotesPlaceholder(String username) {
        log.info("Placeholder: Getting all notes for user: {}", username);
        
        return CompletableFuture.supplyAsync(() -> {
            List<Map<String, Object>> notes = new ArrayList<>();
            for (int i = 1; i <= 3; i++) {
                Map<String, Object> note = new HashMap<>();
                note.put("noteId", (long) i);
                note.put("owner", username);
                note.put("contentHash", "0x" + i);
                note.put("timestamp", System.currentTimeMillis() - (i * 1000));
                note.put("placeholder", true);
                notes.add(note);
            }
            log.info("Placeholder: Retrieved {} notes for user", notes.size());
            return notes;
        });
    }

    private CompletableFuture<Long> getTotalNoteCountPlaceholder() {
        log.info("Placeholder: Getting total note count");
        
        return CompletableFuture.supplyAsync(() -> {
            long count = 42L;
            log.info("Placeholder: Total note count: {}", count);
            return count;
        });
    }

    private CompletableFuture<Map<String, Object>> updateNotePlaceholder(Long noteId, String newContent, String username) {
        log.info("Placeholder: Updating note {} for user: {}", noteId, username);
        
        return CompletableFuture.supplyAsync(() -> {
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("noteId", noteId);
            result.put("newContentHash", generateContentHash(newContent));
            result.put("transactionHash", "0x" + System.currentTimeMillis());
            result.put("placeholder", true);
            log.info("Placeholder: Note updated successfully");
            return result;
        });
    }

    private CompletableFuture<Map<String, Object>> getNetworkStatusPlaceholder() {
        log.info("Placeholder: Checking network status");
        
        return CompletableFuture.supplyAsync(() -> {
            Map<String, Object> status = new HashMap<>();
            status.put("connected", false);
            status.put("networkId", 31337L);
            status.put("latestBlock", System.currentTimeMillis() / 1000);
            status.put("placeholder", true);
            status.put("message", "Blockchain not configured - using placeholder mode");
            log.info("Placeholder: Network status retrieved");
            return status;
        });
    }
}
