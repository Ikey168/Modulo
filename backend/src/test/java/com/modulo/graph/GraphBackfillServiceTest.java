package com.modulo.graph;

import com.modulo.entity.Note;
import com.modulo.entity.NoteLink;
import com.modulo.repository.NoteLinkRepository;
import com.modulo.repository.NoteRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** The startup backfill has no signed-in user, so it must not touch the owner-scoped queries. */
@DisplayName("GraphBackfillService — startup runs without a user")
class GraphBackfillServiceTest {

    private final NoteRepository notes = mock(NoteRepository.class);
    private final NoteLinkRepository links = mock(NoteLinkRepository.class);
    private final GraphProjectionService projection = mock(GraphProjectionService.class);
    private final GraphBackfillService service = new GraphBackfillService(notes, links, projection);

    private static Note note(long id, long owner, String title) {
        Note n = new Note(title, "body"); n.setId(id); n.setUserId(owner); return n;
    }

    @Test
    @DisplayName("startup backfill projects every owner's notes via the unscoped queries")
    void startupUsesAllOwnerQueries() {
        Note alice = note(101L, 1L, "Alice"), bob = note(202L, 2L, "Bob"), bob2 = note(203L, 2L, "Bob 2");
        NoteLink link = new NoteLink(bob, bob2, "REFERENCE");
        when(projection.isAvailable()).thenReturn(true);
        when(notes.findAllOwnedForGraphProjection()).thenReturn(List.of(alice, bob, bob2));
        when(links.findAllOwnedForGraphProjection()).thenReturn(List.of(link));
        when(notes.findAll()).thenThrow(new IllegalStateException("no signed-in user"));
        when(links.findAll()).thenThrow(new IllegalStateException("no signed-in user"));
        ReflectionTestUtils.setField(service, "backfillOnStartup", true);

        service.backfillOnStartupIfEnabled();

        verify(projection).upsertNote(101L, "Alice");
        verify(projection).upsertNote(202L, "Bob");
        verify(projection).upsertLink(202L, "Bob", 203L, "Bob 2", "REFERENCE");
        verify(notes, never()).findAll();
        verify(links, never()).findAll();
    }

    @Test
    @DisplayName("on-demand backfill stays scoped to the signed-in user")
    void onDemandUsesScopedQueries() {
        when(projection.isAvailable()).thenReturn(true);
        when(notes.findAll()).thenReturn(List.of(note(101L, 1L, "Alice")));
        when(links.findAll()).thenReturn(List.of());

        service.backfill();

        verify(projection).upsertNote(101L, "Alice");
        verify(notes, never()).findAllOwnedForGraphProjection();
        verify(links, never()).findAllOwnedForGraphProjection();
    }

    @Test
    @DisplayName("startup backfill is skipped when the projection is disabled")
    void skippedWhenUnavailable() {
        when(projection.isAvailable()).thenReturn(false);
        ReflectionTestUtils.setField(service, "backfillOnStartup", true);

        service.backfillOnStartupIfEnabled();

        verify(notes, never()).findAllOwnedForGraphProjection();
        verify(projection, never()).upsertNote(any(), any());
    }
}
