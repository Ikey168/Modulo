package com.modulo.pack;

import com.modulo.config.BlockchainConfig;
import com.modulo.util.LogSanitizer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.web3j.abi.FunctionEncoder;
import org.web3j.abi.FunctionReturnDecoder;
import org.web3j.abi.TypeReference;
import org.web3j.abi.datatypes.Address;
import org.web3j.abi.datatypes.Bool;
import org.web3j.abi.datatypes.Function;
import org.web3j.abi.datatypes.Type;
import org.web3j.abi.datatypes.Utf8String;
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
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

/**
 * On-chain provenance + paid-pack gating for packs (#278).
 *
 * Reuses the idle NoteMonetization/ModuloToken contracts: a pack's content hash
 * is anchored via {@code registerNote(...)} for verifiable authorship, and paid
 * packs are gated through {@code checkNoteAccess(noteId, buyer)} so a purchase
 * (via {@code purchaseNoteAccess}) is required before install.
 *
 * Follows the graceful-degradation pattern of BlockchainService: when the chain
 * is unavailable a deterministic placeholder result is returned so the rest of
 * the pack lifecycle keeps working in dev/offline mode.
 */
@Service
public class PackProvenanceService {

    private static final Logger logger = LoggerFactory.getLogger(PackProvenanceService.class);
    private static final String RUNTIME = "PACK";

    @Autowired private Web3j web3j;
    @Autowired private Credentials credentials;
    @Autowired private StaticGasProvider gasProvider;
    @Autowired private BlockchainConfig blockchainConfig;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private PackService packService;

    private boolean isChainAvailable() {
        String addr = blockchainConfig.getNoteMonetizationAddress();
        return web3j != null && credentials != null && addr != null && !addr.isBlank();
    }

    // -------------------------------------------------------------------------
    // Anchor (provenance)
    // -------------------------------------------------------------------------

    public record AnchorResult(boolean ok, String reason, String txHash, Long onchainId, String authorAddress, boolean placeholder) {
        static AnchorResult fail(String reason) { return new AnchorResult(false, reason, null, null, null, false); }
        static AnchorResult success(String tx, Long id, String author, boolean placeholder) {
            return new AnchorResult(true, null, tx, id, author, placeholder);
        }
    }

    /**
     * Anchor an installed pack's content hash on-chain for verifiable authorship.
     */
    @Transactional
    public AnchorResult anchorPack(String packId) {
        Optional<PackEntry> opt = packService.getPack(packId);
        if (opt.isEmpty()) {
            return AnchorResult.fail("Pack \"" + packId + "\" is not installed");
        }
        PackEntry pack = opt.get();
        if (pack.getContentHash() == null || pack.getContentHash().isBlank()) {
            return AnchorResult.fail("Pack \"" + packId + "\" has no content hash; publish to IPFS first");
        }

        byte[] hashBytes;
        try {
            hashBytes = toBytes32(pack.getContentHash());
        } catch (Exception e) {
            return AnchorResult.fail("Invalid content hash: " + e.getMessage());
        }

        boolean premium = Boolean.TRUE.equals(pack.getPremium());
        BigInteger price = premium && pack.getAccessPrice() != null
            ? new BigInteger(pack.getAccessPrice()) : BigInteger.ZERO;

        AnchorResult result;
        if (!isChainAvailable()) {
            logger.warn("Blockchain not available — anchoring pack {} with placeholder", LogSanitizer.sanitize(packId));
            String placeholderTx = "0x" + pack.getContentHash().substring(0, Math.min(64, pack.getContentHash().length()));
            result = AnchorResult.success(placeholderTx, (long) Math.abs(pack.getContentHash().hashCode()),
                credentials != null ? credentials.getAddress() : "0x0", true);
        } else {
            try {
                Function fn = new Function(
                    "registerNote",
                    Arrays.asList(
                        new Bytes32(hashBytes),
                        new Utf8String(packId),
                        new Bool(premium),
                        new Uint256(price),
                        new Utf8String("pack"),
                        new Utf8String(pack.getDescription() != null ? pack.getDescription() : "")
                    ),
                    Collections.emptyList()
                );
                String encoded = FunctionEncoder.encode(fn);
                Transaction tx = Transaction.createFunctionCallTransaction(
                    credentials.getAddress(), null, gasProvider.getGasPrice(), gasProvider.getGasLimit(),
                    blockchainConfig.getNoteMonetizationAddress(), encoded);

                EthSendTransaction sent = web3j.ethSendTransaction(tx).send();
                if (sent.hasError()) {
                    return AnchorResult.fail("Anchor transaction failed: " + sent.getError().getMessage());
                }
                String txHash = sent.getTransactionHash();
                Long onchainId = lookupNoteId(hashBytes);
                result = AnchorResult.success(txHash, onchainId, credentials.getAddress(), false);
            } catch (Exception e) {
                logger.error("Failed to anchor pack {}: {}", LogSanitizer.sanitize(packId),
                    LogSanitizer.sanitizeMessage(e.getMessage()));
                return AnchorResult.fail("Anchor failed: " + e.getMessage());
            }
        }

        // Persist provenance
        jdbc.update(
            "UPDATE plugin_registry SET anchor_tx = ?, onchain_id = ?, author_address = ?, updated_at = ? " +
            "WHERE runtime = ? AND name = ?",
            result.txHash(), result.onchainId(), result.authorAddress(), LocalDateTime.now(), RUNTIME, packId
        );
        logger.info("Pack {} anchored on-chain: tx={} onchainId={} author={}",
            LogSanitizer.sanitize(packId), LogSanitizer.sanitize(result.txHash()),
            result.onchainId(), LogSanitizer.sanitize(result.authorAddress()));
        return result;
    }

    // -------------------------------------------------------------------------
    // Provenance verification
    // -------------------------------------------------------------------------

    public record ProvenanceInfo(boolean anchored, String txHash, Long onchainId, String authorAddress,
                                 String contentHash, boolean verified, boolean placeholder) {}

    /**
     * Return the stored provenance for a pack and, when the chain is reachable,
     * verify the on-chain owner matches the recorded author.
     */
    public Optional<ProvenanceInfo> getProvenance(String packId) {
        Optional<PackEntry> opt = packService.getPack(packId);
        if (opt.isEmpty()) return Optional.empty();
        PackEntry pack = opt.get();

        if (pack.getAnchorTx() == null) {
            return Optional.of(new ProvenanceInfo(false, null, null, null, pack.getContentHash(), false, false));
        }

        boolean verified = false;
        boolean placeholder = !isChainAvailable();
        if (isChainAvailable() && pack.getOnchainId() != null) {
            try {
                String onchainOwner = lookupOwner(pack.getOnchainId());
                verified = onchainOwner != null && onchainOwner.equalsIgnoreCase(pack.getAuthorAddress());
            } catch (Exception e) {
                logger.warn("Provenance verification failed for {}: {}", LogSanitizer.sanitize(packId),
                    LogSanitizer.sanitizeMessage(e.getMessage()));
            }
        }

        return Optional.of(new ProvenanceInfo(
            true, pack.getAnchorTx(), pack.getOnchainId(), pack.getAuthorAddress(),
            pack.getContentHash(), verified, placeholder));
    }

    // -------------------------------------------------------------------------
    // Paid-pack entitlement
    // -------------------------------------------------------------------------

    /**
     * True when {@code address} may install {@code pack}: free packs are always
     * installable; premium packs require on-chain access (a completed purchase).
     */
    public boolean hasEntitlement(PackEntry pack, String address) {
        if (pack == null || !Boolean.TRUE.equals(pack.getPremium())) {
            return true; // free pack
        }
        if (address == null || address.isBlank()) {
            return false; // premium pack needs a buyer address
        }
        // Author always has access to their own pack
        if (address.equalsIgnoreCase(pack.getAuthorAddress())) {
            return true;
        }
        if (!isChainAvailable() || pack.getOnchainId() == null) {
            // Cannot verify a purchase off-chain — deny premium install in offline mode
            return false;
        }
        try {
            return checkNoteAccess(pack.getOnchainId(), address);
        } catch (Exception e) {
            logger.warn("Entitlement check failed for pack {}: {}", LogSanitizer.sanitize(pack.getPackId()),
                LogSanitizer.sanitizeMessage(e.getMessage()));
            return false;
        }
    }

    /** Convenience overload that looks the pack up by id. */
    public boolean hasEntitlement(String packId, String address) {
        return hasEntitlement(packService.getPack(packId).orElse(null), address);
    }

    // -------------------------------------------------------------------------
    // web3j helpers
    // -------------------------------------------------------------------------

    private Long lookupNoteId(byte[] hashBytes) {
        try {
            Function fn = new Function("hashToNoteId",
                Arrays.asList(new Bytes32(hashBytes)),
                Arrays.asList(new TypeReference<Uint256>() {}));
            List<Type> out = callContract(fn);
            if (!out.isEmpty()) {
                return ((Uint256) out.get(0)).getValue().longValue();
            }
        } catch (Exception e) {
            logger.warn("Failed to resolve on-chain note id: {}", LogSanitizer.sanitizeMessage(e.getMessage()));
        }
        return null;
    }

    private String lookupOwner(Long onchainId) throws Exception {
        Function fn = new Function("getNoteDetails",
            Arrays.asList(new Uint256(BigInteger.valueOf(onchainId))),
            Arrays.asList(
                new TypeReference<Address>() {},     // owner
                new TypeReference<Bytes32>() {},     // hash
                new TypeReference<Uint256>() {},     // timestamp
                new TypeReference<Utf8String>() {},  // title
                new TypeReference<Bool>() {},        // isActive
                new TypeReference<Bool>() {},        // isPremium
                new TypeReference<Uint256>() {},     // accessPrice
                new TypeReference<Uint256>() {},     // totalEarnings
                new TypeReference<Uint256>() {},     // accessCount
                new TypeReference<Utf8String>() {},  // category
                new TypeReference<Utf8String>() {}   // description
            ));
        List<Type> out = callContract(fn);
        if (out.isEmpty()) return null;
        return ((Address) out.get(0)).getValue();
    }

    private boolean checkNoteAccess(Long onchainId, String address) throws Exception {
        Function fn = new Function("checkNoteAccess",
            Arrays.asList(new Uint256(BigInteger.valueOf(onchainId)), new Address(address)),
            Arrays.asList(new TypeReference<Bool>() {}));
        List<Type> out = callContract(fn);
        return !out.isEmpty() && ((Bool) out.get(0)).getValue();
    }

    private List<Type> callContract(Function fn) throws Exception {
        String encoded = FunctionEncoder.encode(fn);
        EthCall call = web3j.ethCall(
            Transaction.createEthCallTransaction(
                credentials.getAddress(), blockchainConfig.getNoteMonetizationAddress(), encoded),
            DefaultBlockParameterName.LATEST
        ).send();
        if (call.hasError()) {
            throw new RuntimeException("Contract call failed: " + call.getError().getMessage());
        }
        return FunctionReturnDecoder.decode(call.getValue(), fn.getOutputParameters());
    }

    /** Convert a 64-char hex SHA-256 digest (with or without 0x) to a 32-byte array. */
    static byte[] toBytes32(String hash) {
        String hex = hash.startsWith("0x") ? hash.substring(2) : hash;
        if (hex.length() != 64) {
            throw new IllegalArgumentException("Expected 32-byte (64 hex char) hash, got " + hex.length() + " chars");
        }
        return Numeric.hexStringToByteArray("0x" + hex);
    }
}
