package com.modulo.graph;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

/**
 * Verifies the projection degrades gracefully when Neo4j is disabled/unavailable
 * (no {@code Driver} bean → empty Optional), which is the core resilience requirement
 * of #250: note writes must never fail because of the graph projection.
 */
@DisplayName("GraphProjectionService — graceful degradation")
class GraphProjectionServiceTest {

    private final GraphProjectionService service = new GraphProjectionService(Optional.empty());

    @Test
    @DisplayName("reports unavailable when no driver is configured")
    void notAvailableWithoutDriver() {
        assertThat(service.isAvailable()).isFalse();
        assertThat(service.nodeCount()).isEqualTo(-1);
    }

    @Test
    @DisplayName("projection writes are no-ops and never throw when disabled")
    void writesAreNoOps() {
        assertThatCode(() -> {
            service.upsertNote(1L, "A");
            service.deleteNote(1L);
            service.upsertLink(1L, "A", 2L, "B", "REFERENCE");
            service.deleteLink(1L, 2L);
            // null ids must also be tolerated
            service.upsertNote(null, null);
            service.upsertLink(null, null, null, null, null);
        }).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("graph reads return empty results when disabled")
    void readsReturnEmpty() {
        assertThat(service.getBacklinks(1L)).isEmpty();
        assertThat(service.getRelatedNotes(1L, 10)).isEmpty();

        GraphProjectionService.NeighborhoodResult neighborhood = service.getNeighborhood(1L, 2);
        assertThat(neighborhood.getNodes()).isEmpty();
        assertThat(neighborhood.getEdges()).isEmpty();
    }
}
