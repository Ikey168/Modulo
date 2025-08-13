package com.modulo.blockchain.contracts;

import org.web3j.abi.FunctionEncoder;
import org.web3j.abi.FunctionReturnDecoder;
import org.web3j.abi.TypeReference;
import org.web3j.abi.datatypes.*;
import org.web3j.abi.datatypes.generated.Bytes32;
import org.web3j.abi.datatypes.generated.Uint256;
import org.web3j.crypto.Credentials;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.core.DefaultBlockParameter;
import org.web3j.protocol.core.RemoteCall;
import org.web3j.protocol.core.RemoteFunctionCall;
import org.web3j.protocol.core.methods.response.TransactionReceipt;
import org.web3j.tx.Contract;
import org.web3j.tx.TransactionManager;
import org.web3j.tx.gas.ContractGasProvider;
import org.web3j.tuples.generated.Tuple5;
import org.web3j.tuples.generated.Tuple6;

import java.math.BigInteger;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

/**
 * Manual wrapper for NoteRegistry smart contract
 * Generated based on NoteRegistry.sol contract
 */
public class NoteRegistry extends Contract {
    
    public static final String BINARY = ""; // Contract bytecode would go here
    
    public static final String FUNC_REGISTEROTE = "registerNote";
    public static final String FUNC_VERIFYNOTE = "verifyNote";
    public static final String FUNC_GETNOTEBYID = "getNoteById";
    public static final String FUNC_UPDATENOTE = "updateNote";
    public static final String FUNC_GETNOTESOWNEDBY = "getNotesOwnedBy";
    public static final String FUNC_GETTOTALNOTECOUNT = "getTotalNoteCount";
    public static final String FUNC_NOTES = "notes";
    public static final String FUNC_NOTECOUNT = "noteCount";
    public static final String FUNC_HASHTTONOTEID = "hashToNoteId";

    // Events
    public static final Event NOTEREGISTERED_EVENT = new Event("NoteRegistered",
            Arrays.<TypeReference<?>>asList(
                    new TypeReference<Address>(true) {},
                    new TypeReference<Uint256>(true) {},
                    new TypeReference<Bytes32>() {},
                    new TypeReference<Utf8String>() {},
                    new TypeReference<Uint256>() {}));

    public static final Event NOTEUPDATED_EVENT = new Event("NoteUpdated",
            Arrays.<TypeReference<?>>asList(
                    new TypeReference<Address>(true) {},
                    new TypeReference<Uint256>(true) {},
                    new TypeReference<Bytes32>() {},
                    new TypeReference<Uint256>() {}));

    protected NoteRegistry(String contractAddress, Web3j web3j, Credentials credentials, ContractGasProvider contractGasProvider) {
        super(BINARY, contractAddress, web3j, credentials, contractGasProvider);
    }

    protected NoteRegistry(String contractAddress, Web3j web3j, TransactionManager transactionManager, ContractGasProvider contractGasProvider) {
        super(BINARY, contractAddress, web3j, transactionManager, contractGasProvider);
    }

    /**
     * Register a new note on the blockchain
     */
    public RemoteFunctionCall<TransactionReceipt> registerNote(byte[] contentHash, String title) {
        final org.web3j.abi.datatypes.Function function = new org.web3j.abi.datatypes.Function(
                FUNC_REGISTEROTE,
                Arrays.<Type>asList(new Bytes32(contentHash),
                        new Utf8String(title)),
                Collections.<TypeReference<?>>emptyList());
        return executeRemoteCallTransaction(function);
    }

    /**
     * Verify if a note exists on the blockchain
     */
    public RemoteFunctionCall<Tuple6<Address, Bytes32, Uint256, Utf8String, Bool, Uint256>> verifyNote(byte[] contentHash) {
        final org.web3j.abi.datatypes.Function function = new org.web3j.abi.datatypes.Function(
                FUNC_VERIFYNOTE,
                Arrays.<Type>asList(new Bytes32(contentHash)),
                Arrays.<TypeReference<?>>asList(
                        new TypeReference<Address>() {},
                        new TypeReference<Bytes32>() {},
                        new TypeReference<Uint256>() {},
                        new TypeReference<Utf8String>() {},
                        new TypeReference<Bool>() {},
                        new TypeReference<Uint256>() {}));
        return new RemoteFunctionCall<Tuple6<Address, Bytes32, Uint256, Utf8String, Bool, Uint256>>(function,
                () -> {
                    List<Type> results = executeCallMultipleValueReturn(function);
                    return new Tuple6<Address, Bytes32, Uint256, Utf8String, Bool, Uint256>(
                            (Address) results.get(0),
                            (Bytes32) results.get(1),
                            (Uint256) results.get(2),
                            (Utf8String) results.get(3),
                            (Bool) results.get(4),
                            (Uint256) results.get(5));
                });
    }

    /**
     * Get note by ID
     */
    public RemoteFunctionCall<Tuple5<Address, Bytes32, Uint256, Utf8String, Bool>> getNoteById(BigInteger noteId) {
        final org.web3j.abi.datatypes.Function function = new org.web3j.abi.datatypes.Function(
                FUNC_GETNOTEBYID,
                Arrays.<Type>asList(new Uint256(noteId)),
                Arrays.<TypeReference<?>>asList(
                        new TypeReference<Address>() {},
                        new TypeReference<Bytes32>() {},
                        new TypeReference<Uint256>() {},
                        new TypeReference<Utf8String>() {},
                        new TypeReference<Bool>() {}));
        return new RemoteFunctionCall<Tuple5<Address, Bytes32, Uint256, Utf8String, Bool>>(function,
                () -> {
                    List<Type> results = executeCallMultipleValueReturn(function);
                    return new Tuple5<Address, Bytes32, Uint256, Utf8String, Bool>(
                            (Address) results.get(0),
                            (Bytes32) results.get(1),
                            (Uint256) results.get(2),
                            (Utf8String) results.get(3),
                            (Bool) results.get(4));
                });
    }

    /**
     * Update a note's content
     */
    public RemoteFunctionCall<TransactionReceipt> updateNote(BigInteger noteId, byte[] newContentHash) {
        final org.web3j.abi.datatypes.Function function = new org.web3j.abi.datatypes.Function(
                FUNC_UPDATENOTE,
                Arrays.<Type>asList(new Uint256(noteId),
                        new Bytes32(newContentHash)),
                Collections.<TypeReference<?>>emptyList());
        return executeRemoteCallTransaction(function);
    }

    /**
     * Get notes owned by an address
     */
    public RemoteFunctionCall<List> getNotesOwnedBy(String owner) {
        final org.web3j.abi.datatypes.Function function = new org.web3j.abi.datatypes.Function(
                FUNC_GETNOTESOWNEDBY,
                Arrays.<Type>asList(new Address(owner)),
                Arrays.<TypeReference<?>>asList(new TypeReference<DynamicArray<Uint256>>() {}));
        return new RemoteFunctionCall<List>(function,
                () -> {
                    List<Type> result = executeCallSingleValueReturn(function, List.class);
                    return convertToNative(result);
                });
    }

    /**
     * Get total note count
     */
    public RemoteFunctionCall<BigInteger> getTotalNoteCount() {
        final org.web3j.abi.datatypes.Function function = new org.web3j.abi.datatypes.Function(
                FUNC_GETTOTALNOTECOUNT,
                Arrays.<Type>asList(),
                Arrays.<TypeReference<?>>asList(new TypeReference<Uint256>() {}));
        return executeRemoteCallSingleValueReturn(function, BigInteger.class);
    }

    /**
     * Get note count
     */
    public RemoteFunctionCall<BigInteger> noteCount() {
        final org.web3j.abi.datatypes.Function function = new org.web3j.abi.datatypes.Function(
                FUNC_NOTECOUNT,
                Arrays.<Type>asList(),
                Arrays.<TypeReference<?>>asList(new TypeReference<Uint256>() {}));
        return executeRemoteCallSingleValueReturn(function, BigInteger.class);
    }

    /**
     * Get note details by storage mapping
     */
    public RemoteFunctionCall<Tuple5<Address, Bytes32, Uint256, Utf8String, Bool>> notes(BigInteger noteId) {
        final org.web3j.abi.datatypes.Function function = new org.web3j.abi.datatypes.Function(
                FUNC_NOTES,
                Arrays.<Type>asList(new Uint256(noteId)),
                Arrays.<TypeReference<?>>asList(
                        new TypeReference<Address>() {},
                        new TypeReference<Bytes32>() {},
                        new TypeReference<Uint256>() {},
                        new TypeReference<Utf8String>() {},
                        new TypeReference<Bool>() {}));
        return new RemoteFunctionCall<Tuple5<Address, Bytes32, Uint256, Utf8String, Bool>>(function,
                () -> {
                    List<Type> results = executeCallMultipleValueReturn(function);
                    return new Tuple5<Address, Bytes32, Uint256, Utf8String, Bool>(
                            (Address) results.get(0),
                            (Bytes32) results.get(1),
                            (Uint256) results.get(2),
                            (Utf8String) results.get(3),
                            (Bool) results.get(4));
                });
    }

    /**
     * Get note ID from hash
     */
    public RemoteFunctionCall<BigInteger> hashToNoteId(byte[] hash) {
        final org.web3j.abi.datatypes.Function function = new org.web3j.abi.datatypes.Function(
                FUNC_HASHTTONOTEID,
                Arrays.<Type>asList(new Bytes32(hash)),
                Arrays.<TypeReference<?>>asList(new TypeReference<Uint256>() {}));
        return executeRemoteCallSingleValueReturn(function, BigInteger.class);
    }

    // Static factory methods
    public static NoteRegistry load(String contractAddress, Web3j web3j, Credentials credentials, ContractGasProvider contractGasProvider) {
        return new NoteRegistry(contractAddress, web3j, credentials, contractGasProvider);
    }

    public static NoteRegistry load(String contractAddress, Web3j web3j, TransactionManager transactionManager, ContractGasProvider contractGasProvider) {
        return new NoteRegistry(contractAddress, web3j, transactionManager, contractGasProvider);
    }

    public static RemoteCall<NoteRegistry> deploy(Web3j web3j, Credentials credentials, ContractGasProvider contractGasProvider) {
        return deployRemoteCall(NoteRegistry.class, web3j, credentials, contractGasProvider, BINARY, "");
    }

    public static RemoteCall<NoteRegistry> deploy(Web3j web3j, TransactionManager transactionManager, ContractGasProvider contractGasProvider) {
        return deployRemoteCall(NoteRegistry.class, web3j, transactionManager, contractGasProvider, BINARY, "");
    }

    // Helper classes for complex return types
    public static class NoteRegisteredEventResponse {
        public String owner;
        public BigInteger noteId;
        public byte[] hash;
        public String title;
        public BigInteger timestamp;
    }

    public static class NoteUpdatedEventResponse {
        public String owner;
        public BigInteger noteId;
        public byte[] newHash;
        public BigInteger timestamp;
    }
}
