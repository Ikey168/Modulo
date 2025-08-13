package com.modulo.service;

import com.modulo.blockchain.contracts.NoteRegistry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.web3j.crypto.Credentials;
import org.web3j.crypto.Hash;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.core.DefaultBlockParameterName;
import org.web3j.protocol.core.methods.response.EthGasPrice;
import org.web3j.protocol.core.methods.response.EthGetBalance;
import org.web3j.protocol.core.methods.response.TransactionReceipt;
import org.web3j.tx.gas.StaticGasProvider;
import org.web3j.utils.Convert;

import javax.annotation.PostConstruct;
import java.math.BigDecimal;
import java.math.BigInteger;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;

/**
 * Service for interacting with the NoteRegistry smart contract
 * Provides high-level methods for note registration, verification, and management
 */
@Slf4j
@Service
public class BlockchainService {

    private final Web3j web3j;
    private final Credentials credentials;
    private final StaticGasProvider gasProvider;
    private final String contractAddress;
    private final String networkName;

    private NoteRegistry noteRegistry;

    @Autowired
    public BlockchainService(
            Web3j web3j,
            Credentials credentials,
            StaticGasProvider gasProvider,
            @Value("${blockchain.contract.address}") String contractAddress,
            @Value("${blockchain.network.name}") String networkName) {
        this.web3j = web3j;
        this.credentials = credentials;
        this.gasProvider = gasProvider;
        this.contractAddress = contractAddress;
        this.networkName = networkName;
    }

    /**
     * Initialize the contract connection after bean creation
     */
    @PostConstruct
    public void initializeContract() {
        if (contractAddress == null || contractAddress.isEmpty()) {
            log.warn("Contract address not configured. Blockchain operations will not be available.");
            return;
        }

        try {
            this.noteRegistry = NoteRegistry.load(
                contractAddress,
                web3j,
                credentials,
                gasProvider
            );
            log.info("Connected to NoteRegistry contract at {} on {}", contractAddress, networkName);
        } catch (Exception e) {
            log.error("Failed to connect to smart contract: {}", e.getMessage());
            throw new RuntimeException("Smart contract initialization failed", e);
        }
    }

    /**
     * Check if blockchain service is available
     */
    public boolean isAvailable() {
        return noteRegistry != null;
    }

    /**
     * Get blockchain network information
     */
    public BlockchainNetworkInfo getNetworkInfo() {
        try {
            String clientVersion = web3j.web3ClientVersion().send().getWeb3ClientVersion();
            BigInteger chainId = web3j.ethChainId().send().getChainId();
            EthGasPrice gasPrice = web3j.ethGasPrice().send();
            EthGetBalance balance = web3j.ethGetBalance(
                credentials.getAddress(), 
                DefaultBlockParameterName.LATEST
            ).send();

            return BlockchainNetworkInfo.builder()
                .networkName(networkName)
                .chainId(chainId.longValue())
                .clientVersion(clientVersion)
                .contractAddress(contractAddress)
                .accountAddress(credentials.getAddress())
                .accountBalance(Convert.fromWei(balance.getBalance().toString(), Convert.Unit.ETHER))
                .gasPrice(gasPrice.getGasPrice())
                .isConnected(true)
                .build();
        } catch (Exception e) {
            log.error("Failed to get network info: {}", e.getMessage());
            return BlockchainNetworkInfo.builder()
                .networkName(networkName)
                .isConnected(false)
                .build();
        }
    }

    /**
     * Generate hash for note content
     */
    public String generateNoteHash(String content) {
        return Hash.sha3String(content);
    }

    /**
     * Register a note on the blockchain
     */
    public CompletableFuture<NoteRegistrationResult> registerNote(String content, String title) {
        if (!isAvailable()) {
            return CompletableFuture.failedFuture(
                new IllegalStateException("Blockchain service not available")
            );
        }

        return CompletableFuture.supplyAsync(() -> {
            try {
                String noteHash = generateNoteHash(content);
                log.info("Registering note with hash: {} and title: {}", noteHash, title);

                // Check if note already exists
                NoteRegistry.NoteRegisteredEventResponse existingNote = null;
                try {
                    // This will throw if note doesn't exist
                    existingNote = (NoteRegistry.NoteRegisteredEventResponse) noteRegistry.getNoteByHash(noteHash.getBytes()).send();
                    if (existingNote != null) {
                        throw new IllegalArgumentException("Note with this content already exists on blockchain");
                    }
                } catch (Exception e) {
                    // Note doesn't exist, which is what we want
                    log.debug("Note doesn't exist yet, proceeding with registration");
                }

                // Register the note
                TransactionReceipt receipt = noteRegistry.registerNote(noteHash.getBytes(), title).send();
                
                if (!receipt.isStatusOK()) {
                    throw new RuntimeException("Transaction failed with status: " + receipt.getStatus());
                }

                // Extract note ID from events
                List<NoteRegistry.NoteRegisteredEventResponse> events = 
                    noteRegistry.getNoteRegisteredEvents(receipt);
                
                if (events.isEmpty()) {
                    throw new RuntimeException("No NoteRegistered event found in transaction receipt");
                }

                NoteRegistry.NoteRegisteredEventResponse event = events.get(0);
                
                log.info("Note registered successfully. Note ID: {}, Transaction: {}", 
                    event.noteId, receipt.getTransactionHash());

                return NoteRegistrationResult.builder()
                    .noteId(event.noteId.longValue())
                    .noteHash(noteHash)
                    .title(title)
                    .owner(event.owner)
                    .transactionHash(receipt.getTransactionHash())
                    .blockNumber(receipt.getBlockNumber().longValue())
                    .gasUsed(receipt.getGasUsed().longValue())
                    .timestamp(event.timestamp.longValue())
                    .success(true)
                    .build();

            } catch (Exception e) {
                log.error("Failed to register note on blockchain: {}", e.getMessage());
                return NoteRegistrationResult.builder()
                    .success(false)
                    .error(e.getMessage())
                    .build();
            }
        });
    }

    /**
     * Verify a note on the blockchain
     */
    public CompletableFuture<NoteVerificationResult> verifyNote(String content) {
        if (!isAvailable()) {
            return CompletableFuture.failedFuture(
                new IllegalStateException("Blockchain service not available")
            );
        }

        return CompletableFuture.supplyAsync(() -> {
            try {
                String noteHash = generateNoteHash(content);
                log.debug("Verifying note with hash: {}", noteHash);

                // Call the contract's verifyNote function
                var result = noteRegistry.verifyNote(noteHash.getBytes()).send();
                
                Boolean exists = result.component1();
                Boolean isOwner = result.component2();
                Boolean isActive = result.component3();

                log.debug("Note verification result - exists: {}, isOwner: {}, isActive: {}", 
                    exists, isOwner, isActive);

                return NoteVerificationResult.builder()
                    .noteHash(noteHash)
                    .exists(exists)
                    .isOwner(isOwner)
                    .isActive(isActive)
                    .verified(exists && isActive)
                    .build();

            } catch (Exception e) {
                log.error("Failed to verify note on blockchain: {}", e.getMessage());
                return NoteVerificationResult.builder()
                    .verified(false)
                    .error(e.getMessage())
                    .build();
            }
        });
    }

    /**
     * Get note details by ID
     */
    public CompletableFuture<Optional<NoteDetails>> getNoteById(Long noteId) {
        if (!isAvailable()) {
            return CompletableFuture.failedFuture(
                new IllegalStateException("Blockchain service not available")
            );
        }

        return CompletableFuture.supplyAsync(() -> {
            try {
                log.debug("Getting note details for ID: {}", noteId);

                var noteData = noteRegistry.getNote(BigInteger.valueOf(noteId)).send();
                
                return Optional.of(NoteDetails.builder()
                    .noteId(noteId)
                    .owner(noteData.component1())
                    .hash(new String(noteData.component2()))
                    .timestamp(noteData.component3().longValue())
                    .title(noteData.component4())
                    .isActive(noteData.component5())
                    .build());

            } catch (Exception e) {
                log.error("Failed to get note details: {}", e.getMessage());
                return Optional.empty();
            }
        });
    }

    /**
     * Get notes owned by the current account
     */
    public CompletableFuture<List<Long>> getMyNotes() {
        if (!isAvailable()) {
            return CompletableFuture.failedFuture(
                new IllegalStateException("Blockchain service not available")
            );
        }

        return CompletableFuture.supplyAsync(() -> {
            try {
                log.debug("Getting notes for account: {}", credentials.getAddress());

                List<BigInteger> noteIds = noteRegistry.getNotesByOwner(credentials.getAddress()).send();
                
                return noteIds.stream()
                    .map(BigInteger::longValue)
                    .toList();

            } catch (Exception e) {
                log.error("Failed to get user notes: {}", e.getMessage());
                throw new RuntimeException("Failed to get user notes", e);
            }
        });
    }

    /**
     * Get total number of registered notes
     */
    public CompletableFuture<Long> getTotalNoteCount() {
        if (!isAvailable()) {
            return CompletableFuture.failedFuture(
                new IllegalStateException("Blockchain service not available")
            );
        }

        return CompletableFuture.supplyAsync(() -> {
            try {
                BigInteger count = noteRegistry.getTotalNoteCount().send();
                return count.longValue();
            } catch (Exception e) {
                log.error("Failed to get total note count: {}", e.getMessage());
                throw new RuntimeException("Failed to get total note count", e);
            }
        });
    }

    /**
     * Update a note's content (owner only)
     */
    public CompletableFuture<TransactionResult> updateNote(Long noteId, String newContent) {
        if (!isAvailable()) {
            return CompletableFuture.failedFuture(
                new IllegalStateException("Blockchain service not available")
            );
        }

        return CompletableFuture.supplyAsync(() -> {
            try {
                String newHash = generateNoteHash(newContent);
                log.info("Updating note {} with new hash: {}", noteId, newHash);

                TransactionReceipt receipt = noteRegistry.updateNote(
                    BigInteger.valueOf(noteId), 
                    newHash.getBytes()
                ).send();

                if (!receipt.isStatusOK()) {
                    throw new RuntimeException("Transaction failed with status: " + receipt.getStatus());
                }

                log.info("Note updated successfully. Transaction: {}", receipt.getTransactionHash());

                return TransactionResult.builder()
                    .transactionHash(receipt.getTransactionHash())
                    .blockNumber(receipt.getBlockNumber().longValue())
                    .gasUsed(receipt.getGasUsed().longValue())
                    .success(true)
                    .build();

            } catch (Exception e) {
                log.error("Failed to update note: {}", e.getMessage());
                return TransactionResult.builder()
                    .success(false)
                    .error(e.getMessage())
                    .build();
            }
        });
    }
}

// Data transfer objects for blockchain operations

@lombok.Data
@lombok.Builder
class BlockchainNetworkInfo {
    private String networkName;
    private Long chainId;
    private String clientVersion;
    private String contractAddress;
    private String accountAddress;
    private BigDecimal accountBalance;
    private BigInteger gasPrice;
    private boolean isConnected;
}

@lombok.Data
@lombok.Builder
class NoteRegistrationResult {
    private Long noteId;
    private String noteHash;
    private String title;
    private String owner;
    private String transactionHash;
    private Long blockNumber;
    private Long gasUsed;
    private Long timestamp;
    private boolean success;
    private String error;
}

@lombok.Data
@lombok.Builder
class NoteVerificationResult {
    private String noteHash;
    private boolean exists;
    private boolean isOwner;
    private boolean isActive;
    private boolean verified;
    private String error;
}

@lombok.Data
@lombok.Builder
class NoteDetails {
    private Long noteId;
    private String owner;
    private String hash;
    private Long timestamp;
    private String title;
    private boolean isActive;
}

@lombok.Data
@lombok.Builder
class TransactionResult {
    private String transactionHash;
    private Long blockNumber;
    private Long gasUsed;
    private boolean success;
    private String error;
}
