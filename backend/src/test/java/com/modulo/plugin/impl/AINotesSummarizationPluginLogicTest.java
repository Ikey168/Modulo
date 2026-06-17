package com.modulo.plugin.impl;

import com.modulo.entity.Note;
import com.modulo.repository.NoteRepository;
import com.modulo.service.OpenAIService;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("AI Notes Summarization Plugin Logic Tests")
class AINotesSummarizationPluginLogicTest {

    @Mock
    private OpenAIService openAIService;
    @Mock
    private NoteRepository noteRepository;

    @InjectMocks
    private AINotesSummarizationPlugin plugin;

    private Note note;

    @BeforeEach
    void setUp() {
        note = new Note("Title", "This is the note content to analyse.");
        note.setId(1L);
    }

    @Test
    void summarizeNoteNotFound() {
        when(noteRepository.findById(9L)).thenReturn(Optional.empty());

        AINotesSummarizationPlugin.SummaryResult result = plugin.summarizeNote(9L, null);

        assertThat(result.isSuccess()).isFalse();
    }

    @Test
    void summarizeNoteEmptyContent() {
        Note empty = new Note("T", "");
        empty.setId(2L);
        when(noteRepository.findById(2L)).thenReturn(Optional.of(empty));

        AINotesSummarizationPlugin.SummaryResult result = plugin.summarizeNote(2L, null);

        assertThat(result.isSuccess()).isFalse();
    }

    @Test
    void summarizeNoteSuccess() {
        when(noteRepository.findById(1L)).thenReturn(Optional.of(note));
        when(openAIService.generateSummary(anyString(), any()))
                .thenReturn(OpenAIService.SummaryResponse.builder().summary("a summary").success(true).build());

        AINotesSummarizationPlugin.SummaryResult result = plugin.summarizeNote(1L, null);

        assertThat(result.isSuccess()).isTrue();
    }

    @Test
    void extractKeyPointsSuccess() {
        when(noteRepository.findById(1L)).thenReturn(Optional.of(note));
        when(openAIService.generateKeyPoints(anyString(), anyInt()))
                .thenReturn(OpenAIService.KeyPointsResponse.builder().build());

        AINotesSummarizationPlugin.KeyPointsResult result = plugin.extractKeyPoints(1L, 5);

        assertThat(result).isNotNull();
    }

    @Test
    void generateInsightsNotFound() {
        when(noteRepository.findById(9L)).thenReturn(Optional.empty());

        AINotesSummarizationPlugin.InsightsResult result = plugin.generateInsights(9L);

        assertThat(result.isSuccess()).isFalse();
    }
}
