package com.modulo.service;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Timer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.mockito.Mockito.*;

@DisplayName("Observability Service Tests")
class ObservabilityServiceTest {

    private Counter noteCreatedCounter;
    private Counter noteUpdatedCounter;
    private Counter noteDeletedCounter;
    private Counter userLoginCounter;
    private Counter blockchainTransactionCounter;
    private Counter websocketConnectionCounter;
    private Counter websocketMessageCounter;
    private Counter apiErrorCounter;
    private Counter databaseQueryCounter;
    private ObservabilityService service;

    @BeforeEach
    void setUp() {
        TracingService tracingService = mock(TracingService.class);
        noteCreatedCounter = mock(Counter.class);
        noteUpdatedCounter = mock(Counter.class);
        noteDeletedCounter = mock(Counter.class);
        Timer noteSaveTimer = mock(Timer.class);
        Timer noteSearchTimer = mock(Timer.class);
        userLoginCounter = mock(Counter.class);
        blockchainTransactionCounter = mock(Counter.class);
        Timer blockchainTransactionTimer = mock(Timer.class);
        websocketConnectionCounter = mock(Counter.class);
        websocketMessageCounter = mock(Counter.class);
        apiErrorCounter = mock(Counter.class);
        databaseQueryCounter = mock(Counter.class);
        Timer databaseQueryTimer = mock(Timer.class);

        service = new ObservabilityService(
                tracingService,
                noteCreatedCounter, noteUpdatedCounter, noteDeletedCounter,
                noteSaveTimer, noteSearchTimer,
                userLoginCounter,
                blockchainTransactionCounter, blockchainTransactionTimer,
                websocketConnectionCounter, websocketMessageCounter,
                apiErrorCounter, databaseQueryCounter, databaseQueryTimer);
    }

    @Test
    void recordNoteCreated() {
        service.recordNoteCreated("n1", "u1");
        verify(noteCreatedCounter).increment();
    }

    @Test
    void recordNoteUpdated() {
        service.recordNoteUpdated("n1", "u1");
        verify(noteUpdatedCounter).increment();
    }

    @Test
    void recordNoteDeleted() {
        service.recordNoteDeleted("n1", "u1");
        verify(noteDeletedCounter).increment();
    }

    @Test
    void recordUserLogin() {
        service.recordUserLogin("u1", "google");
        verify(userLoginCounter).increment();
    }

    @Test
    void recordBlockchainTransaction() {
        service.recordBlockchainTransaction("0xabc", "register");
        verify(blockchainTransactionCounter).increment();
    }

    @Test
    void recordWebSocketConnection() {
        service.recordWebSocketConnection("s1");
        verify(websocketConnectionCounter).increment();
    }

    @Test
    void recordWebSocketMessage() {
        service.recordWebSocketMessage("s1", "chat");
        verify(websocketMessageCounter).increment();
    }

    @Test
    void recordApiError() {
        service.recordApiError("/api/x", "500", "boom");
        verify(apiErrorCounter).increment();
    }
}
