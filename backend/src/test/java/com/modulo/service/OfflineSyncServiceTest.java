package com.modulo.service;

import com.modulo.entity.Note;
import com.modulo.entity.offline.OfflineNote;
import com.modulo.repository.NoteRepository;
import com.modulo.repository.offline.OfflineNoteRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("Offline Sync Service Tests")
class OfflineSyncServiceTest {

    @Mock
    private OfflineNoteRepository offlineNoteRepository;
    @Mock
    private NoteRepository noteRepository;
    @Mock
    private TagService tagService;

    @InjectMocks
    private OfflineSyncService service;

    @BeforeEach
    void setUp() {
        when(offlineNoteRepository.save(any(OfflineNote.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    void saveOfflineConvertsNote() {
        Note note = new Note("Title", "Content");
        note.setId(5L);

        OfflineNote result = service.saveOffline(note);

        assertThat(result.getTitle()).isEqualTo("Title");
        assertThat(result.getContent()).isEqualTo("Content");
        assertThat(result.getServerId()).isEqualTo(5L);
        verify(offlineNoteRepository).save(any(OfflineNote.class));
    }

    @Test
    void createOfflineNote() {
        OfflineNote result = service.createOfflineNote("T", "C", Set.of("a", "b"));

        assertThat(result.getTitle()).isEqualTo("T");
        assertThat(result.getContent()).isEqualTo("C");
        assertThat(result.getSyncStatus()).isEqualTo(OfflineNote.SyncStatus.PENDING_SYNC);
        verify(offlineNoteRepository).save(any(OfflineNote.class));
    }

    @Test
    void updateOfflineNoteFound() {
        OfflineNote existing = new OfflineNote("Old", "Old");
        when(offlineNoteRepository.findById(1L)).thenReturn(Optional.of(existing));

        OfflineNote result = service.updateOfflineNote(1L, "New", "Body", Set.of("x"));

        assertThat(result.getTitle()).isEqualTo("New");
        assertThat(result.getContent()).isEqualTo("Body");
        verify(offlineNoteRepository).save(existing);
    }

    @Test
    void updateOfflineNoteMissingThrows() {
        when(offlineNoteRepository.findById(9L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.updateOfflineNote(9L, "N", "B", Set.of()))
                .isInstanceOf(RuntimeException.class);
    }

    @Test
    void deleteOfflineNoteFoundMarksForDeletion() {
        OfflineNote existing = new OfflineNote("T", "C");
        when(offlineNoteRepository.findById(1L)).thenReturn(Optional.of(existing));

        service.deleteOfflineNote(1L);

        verify(offlineNoteRepository).save(existing);
    }

    @Test
    void deleteOfflineNoteMissingIsNoOp() {
        when(offlineNoteRepository.findById(9L)).thenReturn(Optional.empty());

        service.deleteOfflineNote(9L);

        verify(offlineNoteRepository, never()).save(any());
    }

    @Test
    void getAllOfflineNotes() {
        OfflineNote n = new OfflineNote("T", "C");
        when(offlineNoteRepository.findAllActiveNotes()).thenReturn(List.of(n));

        assertThat(service.getAllOfflineNotes()).containsExactly(n);
    }

    @Test
    void searchOfflineNotes() {
        OfflineNote n = new OfflineNote("T", "C");
        when(offlineNoteRepository.searchNotes("q")).thenReturn(List.of(n));

        assertThat(service.searchOfflineNotes("q")).containsExactly(n);
    }

    @Test
    void getOfflineNotesByTag() {
        OfflineNote n = new OfflineNote("T", "C");
        when(offlineNoteRepository.findByTagContaining("work")).thenReturn(List.of(n));

        assertThat(service.getOfflineNotesByTag("work")).containsExactly(n);
    }
}
