package com.modulo.service;

import com.modulo.aspect.Traced;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Timer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
@Slf4j
public class ObservabilityService {

    private final TracingService tracingService;
    private final Counter noteCreatedCounter;
    private final Counter noteUpdatedCounter;
    private final Counter noteDeletedCounter;
    private final Timer noteSaveTimer;
    private final Timer noteSearchTimer;
    private final Counter userLoginCounter;
    private final Counter blockchainTransactionCounter;
    private final Timer blockchainTransactionTimer;
    private final Counter websocketConnectionCounter;
    private final Counter websocketMessageCounter;
    private final Counter apiErrorCounter;
    private final Counter databaseQueryCounter;
    private final Timer databaseQueryTimer;

    @Traced("observability.note.created")
    public void recordNoteCreated(String noteId, String userId) {
        noteCreatedCounter.increment();
        tracingService.addAttribute("note.id", noteId);
        tracingService.addAttribute("user.id", userId);
        tracingService.addEvent("note_created", Map.of(
            "note.id", noteId,
            "user.id", userId,
            "action", "create"
        ));
        log.info("Note created: {} by user: {}", noteId, userId);
    }

    @Traced("observability.note.updated")
    public void recordNoteUpdated(String noteId, String userId) {
        noteUpdatedCounter.increment();
        tracingService.addAttribute("note.id", noteId);
        tracingService.addAttribute("user.id", userId);
        tracingService.addEvent("note_updated", Map.of(
            "note.id", noteId,
            "user.id", userId,
            "action", "update"
        ));
        log.info("Note updated: {} by user: {}", noteId, userId);
    }

    @Traced("observability.note.deleted")
    public void recordNoteDeleted(String noteId, String userId) {
        noteDeletedCounter.increment();
        tracingService.addAttribute("note.id", noteId);
        tracingService.addAttribute("user.id", userId);
        tracingService.addEvent("note_deleted", Map.of(
            "note.id", noteId,
            "user.id", userId,
            "action", "delete"
        ));
        log.info("Note deleted: {} by user: {}", noteId, userId);
    }

    @Traced("observability.note.save_operation")
    public void recordNoteSaveOperation(String noteId, Runnable saveOperation) {
        Timer.Sample sample = Timer.start();
        try {
            saveOperation.run();
            sample.stop(noteSaveTimer);
            tracingService.addEvent("note_save_completed", Map.of(
                "note.id", noteId,
                "result", "success"
            ));
        } catch (Exception e) {
            sample.stop(noteSaveTimer);
            tracingService.addEvent("note_save_failed", Map.of(
                "note.id", noteId,
                "result", "error",
                "error.message", e.getMessage()
            ));
            throw e;
        }
    }

    @Traced("observability.note.search_operation")
    public <T> T recordNoteSearchOperation(String query, java.util.function.Supplier<T> searchOperation) {
        Timer.Sample sample = Timer.start();
        try {
            T result = searchOperation.get();
            sample.stop(noteSearchTimer);
            tracingService.addAttribute("search.query", query);
            tracingService.addEvent("note_search_completed", Map.of(
                "search.query", query,
                "result", "success"
            ));
            return result;
        } catch (Exception e) {
            sample.stop(noteSearchTimer);
            tracingService.addEvent("note_search_failed", Map.of(
                "search.query", query,
                "result", "error",
                "error.message", e.getMessage()
            ));
            throw e;
        }
    }

    @Traced("observability.user.login")
    public void recordUserLogin(String userId, String provider) {
        userLoginCounter.increment();
        tracingService.addAttribute("user.id", userId);
        tracingService.addAttribute("auth.provider", provider);
        tracingService.addEvent("user_login", Map.of(
            "user.id", userId,
            "auth.provider", provider,
            "action", "login"
        ));
        log.info("User logged in: {} via {}", userId, provider);
    }

    @Traced("observability.blockchain.transaction")
    public void recordBlockchainTransaction(String transactionHash, String operation) {
        blockchainTransactionCounter.increment();
        tracingService.addAttribute("blockchain.transaction.hash", transactionHash);
        tracingService.addAttribute("blockchain.operation", operation);
        tracingService.addEvent("blockchain_transaction", Map.of(
            "blockchain.transaction.hash", transactionHash,
            "blockchain.operation", operation,
            "action", "transaction"
        ));
        log.info("Blockchain transaction: {} for operation: {}", transactionHash, operation);
    }

    @Traced("observability.blockchain.transaction_operation")
    public <T> T recordBlockchainTransactionOperation(String operation, java.util.function.Supplier<T> transactionOperation) {
        Timer.Sample sample = Timer.start();
        try {
            T result = transactionOperation.get();
            sample.stop(blockchainTransactionTimer);
            tracingService.addAttribute("blockchain.operation", operation);
            tracingService.addEvent("blockchain_transaction_completed", Map.of(
                "blockchain.operation", operation,
                "result", "success"
            ));
            return result;
        } catch (Exception e) {
            sample.stop(blockchainTransactionTimer);
            tracingService.addEvent("blockchain_transaction_failed", Map.of(
                "blockchain.operation", operation,
                "result", "error",
                "error.message", e.getMessage()
            ));
            throw e;
        }
    }

    @Traced("observability.websocket.connection")
    public void recordWebSocketConnection(String sessionId) {
        websocketConnectionCounter.increment();
        tracingService.addAttribute("websocket.session.id", sessionId);
        tracingService.addEvent("websocket_connection", Map.of(
            "websocket.session.id", sessionId,
            "action", "connect"
        ));
        log.info("WebSocket connection established: {}", sessionId);
    }

    @Traced("observability.websocket.message")
    public void recordWebSocketMessage(String sessionId, String messageType) {
        websocketMessageCounter.increment();
        tracingService.addAttribute("websocket.session.id", sessionId);
        tracingService.addAttribute("websocket.message.type", messageType);
        tracingService.addEvent("websocket_message", Map.of(
            "websocket.session.id", sessionId,
            "websocket.message.type", messageType,
            "action", "message"
        ));
        log.debug("WebSocket message received: {} from session: {}", messageType, sessionId);
    }

    @Traced("observability.api.error")
    public void recordApiError(String endpoint, String errorType, String errorMessage) {
        apiErrorCounter.increment();
        tracingService.addAttribute("api.endpoint", endpoint);
        tracingService.addAttribute("error.type", errorType);
        tracingService.addEvent("api_error", Map.of(
            "api.endpoint", endpoint,
            "error.type", errorType,
            "error.message", errorMessage,
            "action", "error"
        ));
        log.error("API error on endpoint: {} - {}: {}", endpoint, errorType, errorMessage);
    }

    @Traced("observability.database.query_operation")
    public <T> T recordDatabaseQueryOperation(String operation, java.util.function.Supplier<T> queryOperation) {
        databaseQueryCounter.increment();
        Timer.Sample sample = Timer.start();
        try {
            T result = queryOperation.get();
            sample.stop(databaseQueryTimer);
            tracingService.addAttribute("db.operation", operation);
            tracingService.addEvent("database_query_completed", Map.of(
                "db.operation", operation,
                "result", "success"
            ));
            return result;
        } catch (Exception e) {
            sample.stop(databaseQueryTimer);
            tracingService.addEvent("database_query_failed", Map.of(
                "db.operation", operation,
                "result", "error",
                "error.message", e.getMessage()
            ));
            throw e;
        }
    }
}
