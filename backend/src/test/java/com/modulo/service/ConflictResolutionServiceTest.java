package com.modulo.service;

import com.modulo.dto.ConflictResolutionDto;
import com.modulo.entity.Note;
import com.modulo.entity.Tag;
import com.modulo.repository.NoteRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.orm.ObjectOptimisticLockingFailureException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ConflictResolutionServiceTest {

    @Mock
    private NoteRepository noteRepository;

    @Mock
    private TagService tagService;

    @InjectMocks
    private ConflictResolutionService conflictResolutionService;

    private Note testNote;
    private Tag testTag;

    @BeforeEach
    void setUp() {
        testTag = new Tag();
        testTag.setName("test-tag");

        testNote = new Note();
        testNote.setId(1L);
        testNote.setTitle("Original Title");
        testNote.setContent("Original Content");
        testNote.setMarkdownContent("Original Content");
        testNote.setVersion(1L);
        testNote.setLastEditor("editor1");
        testNote.setCreatedAt(LocalDateTime.now().minusHours(1));
        testNote.setUpdatedAt(LocalDateTime.now().minusMinutes(30));
        testNote.setTags(Set.of(testTag));
    }

    @Test
    void checkForConflicts_ShouldDetectVersionConflict() {
        // Given
        when(noteRepository.findById(1L)).thenReturn(Optional.of(testNote));
        
        Long expectedVersion = 0L; // Different from actual version (1L)
        List<String> incomingTagNames = List.of("test-tag");

        // When
        ConflictResolutionDto result = conflictResolutionService.checkForConflicts(
            1L, expectedVersion, "New Title", "New Content", incomingTagNames, "editor2"
        );

        // Then
        assertNotNull(result);
        assertTrue(result.hasConflict());
        assertTrue(result.hasTitleConflict());
        assertTrue(result.hasContentConflict());
        assertEquals("Original Title", result.getCurrentTitle());
        assertEquals("New Title", result.getIncomingTitle());
        assertEquals("Original Content", result.getCurrentContent());
        assertEquals("New Content", result.getIncomingContent());
        assertEquals(expectedVersion, result.getExpectedVersion());
        assertEquals(testNote.getVersion(), result.getActualVersion());
    }

    @Test
    void checkForConflicts_ShouldNotDetectConflictWhenVersionMatches() {
        // Given
        when(noteRepository.findById(1L)).thenReturn(Optional.of(testNote));
        
        Long expectedVersion = 1L; // Matches actual version
        List<String> incomingTagNames = List.of("test-tag");

        // When
        ConflictResolutionDto result = conflictResolutionService.checkForConflicts(
            1L, expectedVersion, "Same Title", "Same Content", incomingTagNames, "editor2"
        );

        // Then
        assertNotNull(result);
        assertFalse(result.hasConflict());
        assertEquals(expectedVersion, result.getExpectedVersion());
        assertEquals(testNote.getVersion(), result.getActualVersion());
    }

    @Test
    void updateNoteWithConflictCheck_ShouldSucceedWhenVersionMatches() {
        // Given
        Note mutableNote = new Note();
        mutableNote.setId(1L);
        mutableNote.setTitle("Original Title");
        mutableNote.setContent("Original Content");
        mutableNote.setMarkdownContent("Original Content");
        mutableNote.setVersion(1L);
        mutableNote.setLastEditor("editor1");
        mutableNote.setCreatedAt(LocalDateTime.now().minusHours(1));
        mutableNote.setUpdatedAt(LocalDateTime.now().minusMinutes(30));
        
        when(noteRepository.findById(1L)).thenReturn(Optional.of(mutableNote));
        when(tagService.createOrGetTag("new-tag")).thenReturn(testTag);
        when(noteRepository.save(any(Note.class))).thenReturn(mutableNote);

        // When
        Note result = conflictResolutionService.updateNoteWithConflictCheck(
            1L, 1L, "Updated Title", "Updated Content", "Updated Content", 
            List.of("new-tag"), "editor2"
        );

        // Then
        assertNotNull(result);
        verify(noteRepository).save(mutableNote);
        assertEquals("Updated Title", mutableNote.getTitle());
        assertEquals("Updated Content", mutableNote.getContent());
        assertEquals("editor2", mutableNote.getLastEditor());
    }

    @Test
    void updateNoteWithConflictCheck_ShouldThrowExceptionWhenVersionConflict() {
        // Given
        when(noteRepository.findById(1L)).thenReturn(Optional.of(testNote));

        // When & Then
        assertThrows(ObjectOptimisticLockingFailureException.class, () -> {
            conflictResolutionService.updateNoteWithConflictCheck(
                1L, 0L, "Updated Title", "Updated Content", "Updated Content", 
                List.of("new-tag"), "editor2"
            );
        });

        verify(noteRepository, never()).save(any(Note.class));
    }

    @Test
    void forceUpdateNote_ShouldAlwaysSucceed() {
        // Given
        Note mutableNote = new Note();
        mutableNote.setId(1L);
        mutableNote.setTitle("Original Title");
        mutableNote.setContent("Original Content");
        mutableNote.setMarkdownContent("Original Content");
        mutableNote.setVersion(1L);
        mutableNote.setLastEditor("editor1");
        mutableNote.setCreatedAt(LocalDateTime.now().minusHours(1));
        mutableNote.setUpdatedAt(LocalDateTime.now().minusMinutes(30));
        
        when(noteRepository.findById(1L)).thenReturn(Optional.of(mutableNote));
        when(tagService.createOrGetTag("forced-tag")).thenReturn(testTag);
        when(noteRepository.save(any(Note.class))).thenReturn(mutableNote);

        // When
        Note result = conflictResolutionService.forceUpdateNote(
            1L, "Forced Title", "Forced Content", "Forced Content", 
            List.of("forced-tag"), "editor2"
        );

        // Then
        assertNotNull(result);
        verify(noteRepository).save(mutableNote);
        assertEquals("Forced Title", mutableNote.getTitle());
        assertEquals("Forced Content", mutableNote.getContent());
        assertEquals("editor2", mutableNote.getLastEditor());
    }

    @Test
    void checkForConflicts_ShouldThrowExceptionWhenNoteNotFound() {
        // Given
        when(noteRepository.findById(anyLong())).thenReturn(Optional.empty());

        // When & Then
        assertThrows(IllegalArgumentException.class, () -> {
            conflictResolutionService.checkForConflicts(
                999L, 1L, "Title", "Content", List.of(), "editor"
            );
        });
    }

    @Test
    void conflictResolutionDto_ShouldCorrectlyDetectTagConflicts() {
        // Given
        when(noteRepository.findById(1L)).thenReturn(Optional.of(testNote));
        
        List<String> incomingTagNames = List.of("different-tag");

        // When
        ConflictResolutionDto result = conflictResolutionService.checkForConflicts(
            1L, 0L, "Title", "Content", incomingTagNames, "editor2"
        );

        // Then
        assertTrue(result.hasTagConflict());
        assertEquals(List.of("test-tag"), result.getCurrentTagNames());
        assertEquals(incomingTagNames, result.getIncomingTagNames());
    }
}