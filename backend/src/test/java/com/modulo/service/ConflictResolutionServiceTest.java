package com.modulo.service;

import com.modulo.dto.ConflictResolutionDto;
import com.modulo.entity.Note;
import com.modulo.entity.Tag;
import com.modulo.repository.NoteRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.orm.ObjectOptimisticLockingFailureException;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("Conflict Resolution Service Tests")
class ConflictResolutionServiceTest {

    @Mock
    private NoteRepository noteRepository;

    @Mock
    private TagService tagService;

    @InjectMocks
    private ConflictResolutionService service;

    private Note note;

    @BeforeEach
    void setUp() {
        note = new Note("Title", "Content");
        note.setId(1L);
        note.setVersion(2L);
        note.setLastEditor("alice");
        when(noteRepository.save(any(Note.class))).thenAnswer(inv -> inv.getArgument(0));
        when(tagService.createOrGetTag(anyString())).thenAnswer(inv -> new Tag(inv.getArgument(0)));
    }

    @Test
    void checkForConflictsReturnsDto() {
        when(noteRepository.findById(1L)).thenReturn(Optional.of(note));

        ConflictResolutionDto dto = service.checkForConflicts(
                1L, 2L, "new title", "new content", List.of("t1"), "bob");

        assertThat(dto.getNoteId()).isEqualTo(1L);
        assertThat(dto.getCurrentTitle()).isEqualTo("Title");
        assertThat(dto.getIncomingTitle()).isEqualTo("new title");
    }

    @Test
    void checkForConflictsThrowsWhenNoteMissing() {
        when(noteRepository.findById(9L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.checkForConflicts(9L, 1L, "t", "c", List.of(), "bob"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void updateNoteWithMatchingVersionSucceeds() {
        when(noteRepository.findById(1L)).thenReturn(Optional.of(note));

        Note updated = service.updateNoteWithConflictCheck(
                1L, 2L, "Updated", "Body", "# Body", List.of("tag"), "bob");

        assertThat(updated.getTitle()).isEqualTo("Updated");
        assertThat(updated.getContent()).isEqualTo("Body");
        assertThat(updated.getLastEditor()).isEqualTo("bob");
        verify(noteRepository).save(note);
    }

    @Test
    void updateNoteWithVersionMismatchThrows() {
        when(noteRepository.findById(1L)).thenReturn(Optional.of(note));

        assertThatThrownBy(() -> service.updateNoteWithConflictCheck(
                1L, 99L, "Updated", "Body", "# Body", List.of(), "bob"))
                .isInstanceOf(ObjectOptimisticLockingFailureException.class);

        verify(noteRepository, never()).save(any());
    }

    @Test
    void forceUpdateAppliesChangesWithoutVersionCheck() {
        when(noteRepository.findById(1L)).thenReturn(Optional.of(note));

        Note updated = service.forceUpdateNote(
                1L, "Forced", "Body", "# Body", List.of("tag"), "bob");

        assertThat(updated.getTitle()).isEqualTo("Forced");
        assertThat(updated.getLastEditor()).isEqualTo("bob");
        verify(noteRepository).save(note);
    }

    @Test
    void forceUpdateThrowsWhenNoteMissing() {
        when(noteRepository.findById(9L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.forceUpdateNote(9L, "t", "c", "m", List.of(), "bob"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
