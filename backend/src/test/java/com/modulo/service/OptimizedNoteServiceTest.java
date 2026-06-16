package com.modulo.service;

import com.modulo.entity.Note;
import com.modulo.repository.jpa.OptimizedNoteRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("Optimized Note Service Tests")
class OptimizedNoteServiceTest {

    @Mock
    private OptimizedNoteRepository noteRepository;

    @Mock
    private TagService tagService;

    @InjectMocks
    private OptimizedNoteService service;

    private Note note;

    @BeforeEach
    void setUp() {
        note = new Note();
        note.setId(1L);
        note.setTitle("Title");
        note.setUserId(100L);
    }

    @Test
    @DisplayName("findById returns note and updates last-viewed")
    void findByIdPresent() {
        when(noteRepository.findByIdOptimized(1L)).thenReturn(Optional.of(note));

        Optional<Note> result = service.findById(1L);

        assertThat(result).containsSame(note);
        verify(noteRepository).updateLastViewedAt(1L);
    }

    @Test
    @DisplayName("findById empty does not update last-viewed")
    void findByIdEmpty() {
        when(noteRepository.findByIdOptimized(2L)).thenReturn(Optional.empty());

        assertThat(service.findById(2L)).isEmpty();
        verify(noteRepository, never()).updateLastViewedAt(anyLong());
    }

    @Test
    @DisplayName("findByUserId delegates to optimized finder")
    void findByUserId() {
        Page<Note> page = new PageImpl<>(List.of(note));
        when(noteRepository.findByUserIdOptimized(eq(100L), any(Pageable.class))).thenReturn(page);

        Page<Note> result = service.findByUserId(100L, 0, 20, "updatedAt");

        assertThat(result.getContent()).containsExactly(note);
    }

    @Test
    @DisplayName("findRecentlyAccessedByUser delegates")
    void findRecentlyAccessed() {
        when(noteRepository.findRecentlyAccessedByUser(eq(100L), any(Pageable.class))).thenReturn(List.of(note));

        assertThat(service.findRecentlyAccessedByUser(100L)).containsExactly(note);
    }

    @Test
    @DisplayName("searchNotes returns empty page for blank query")
    void searchNotesBlank() {
        assertThat(service.searchNotes("   ", 0, 10).getContent()).isEmpty();
        verify(noteRepository, never()).searchNotesOptimized(anyString(), any());
    }

    @Test
    @DisplayName("searchNotes delegates for a real query")
    void searchNotesQuery() {
        when(noteRepository.searchNotesOptimized(eq("hello"), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(note)));

        assertThat(service.searchNotes("hello", 0, 10).getContent()).containsExactly(note);
    }

    @Test
    @DisplayName("advancedSearch delegates with criteria")
    void advancedSearch() {
        when(noteRepository.findByAdvancedCriteria(any(), any(), any(), any(), any(), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(note)));

        Page<Note> result = service.advancedSearch("q", 100L, "tag", null, null, 0, 10);

        assertThat(result.getContent()).containsExactly(note);
    }

    @Test
    @DisplayName("findByTag delegates to optimized finder")
    void findByTag() {
        when(noteRepository.findByTagNameOptimized(eq("tag"), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(note)));

        assertThat(service.findByTag("tag", 0, 10).getContent()).containsExactly(note);
    }

    @Test
    @DisplayName("getNoteCountByUser delegates")
    void getNoteCountByUser() {
        when(noteRepository.countByUserId(100L)).thenReturn(5L);

        assertThat(service.getNoteCountByUser(100L)).isEqualTo(5L);
    }

    @Test
    @DisplayName("getRecentlyUpdatedNotes delegates")
    void getRecentlyUpdatedNotes() {
        when(noteRepository.findRecentlyUpdated(eq(100L), any(LocalDateTime.class), any(Pageable.class)))
                .thenReturn(List.of(note));

        assertThat(service.getRecentlyUpdatedNotes(100L, 5)).containsExactly(note);
    }

    @Test
    @DisplayName("getNoteTitles maps projection rows to maps")
    void getNoteTitles() {
        Object[] row = new Object[]{1L, "Title", LocalDateTime.now(), 100L};
        when(noteRepository.findNoteTitlesOptimized(eq(100L), any(Pageable.class)))
                .thenReturn(List.<Object[]>of(row));

        List<Map<String, Object>> result = service.getNoteTitles(100L, 10);

        assertThat(result).hasSize(1);
        assertThat(result.get(0)).containsEntry("id", 1L).containsEntry("title", "Title");
    }

    @Test
    @DisplayName("getUserNoteStatistics maps the stats array")
    void getUserNoteStatistics() {
        Object[] stats = new Object[]{10L, 2L, 5L, 1L};
        when(noteRepository.getNoteStatistics(eq(100L), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(stats);

        Map<String, Object> result = service.getUserNoteStatistics(100L);

        assertThat(result).containsEntry("totalNotes", 10L)
                .containsEntry("notesThisWeek", 2L)
                .containsEntry("notesThisMonth", 5L)
                .containsEntry("publicNotes", 1L);
    }

    @Test
    @DisplayName("save sets timestamps and persists a new note")
    void saveNewNote() {
        Note fresh = new Note();
        fresh.setTitle("New");
        when(noteRepository.save(fresh)).thenReturn(fresh);

        Note saved = service.save(fresh);

        assertThat(saved.getCreatedAt()).isNotNull();
        assertThat(saved.getUpdatedAt()).isNotNull();
        verify(noteRepository).save(fresh);
    }

    @Test
    @DisplayName("save updates timestamp for an existing note")
    void saveExistingNote() {
        when(noteRepository.save(note)).thenReturn(note);

        Note saved = service.save(note);

        assertThat(saved.getUpdatedAt()).isNotNull();
    }

    @Test
    @DisplayName("deleteById deletes when present")
    void deleteByIdPresent() {
        when(noteRepository.findById(1L)).thenReturn(Optional.of(note));

        service.deleteById(1L);

        verify(noteRepository).deleteById(1L);
    }

    @Test
    @DisplayName("deleteById is a no-op when absent")
    void deleteByIdAbsent() {
        when(noteRepository.findById(9L)).thenReturn(Optional.empty());

        service.deleteById(9L);

        verify(noteRepository, never()).deleteById(anyLong());
    }

    @Test
    @DisplayName("warmUpCache pre-loads without error")
    void warmUpCache() {
        when(noteRepository.findRecentlyAccessedByUser(eq(100L), any(Pageable.class))).thenReturn(List.of(note));
        when(noteRepository.findByUserIdOptimized(eq(100L), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(note)));
        when(noteRepository.getNoteStatistics(eq(100L), any(), any())).thenReturn(new Object[]{1L, 0L, 0L, 0L});

        service.warmUpCache(100L);

        verify(noteRepository).findRecentlyAccessedByUser(eq(100L), any(Pageable.class));
    }
}
