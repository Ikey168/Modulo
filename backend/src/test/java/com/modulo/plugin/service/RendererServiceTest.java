package com.modulo.plugin.service;

import com.modulo.entity.Note;
import com.modulo.plugin.api.renderer.NoteRenderer;
import com.modulo.plugin.api.renderer.RendererOutput;
import com.modulo.plugin.impl.MindMapRenderer;
import com.modulo.plugin.registry.RendererPluginRegistry;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("Renderer Service Tests")
class RendererServiceTest {

    @Mock
    private RendererPluginRegistry rendererRegistry;

    @InjectMocks
    private RendererService rendererService;

    private Note note;

    @BeforeEach
    void setUp() {
        note = new Note("Title", "# Heading\n## Sub\nbody");
        note.setId(1L);
    }

    @Test
    void renderNoteSuccess() {
        when(rendererRegistry.getRenderer("mindmap")).thenReturn(new MindMapRenderer());

        RendererOutput output = rendererService.renderNote(note, "mindmap", null);

        assertThat(output).isNotNull();
        assertThat(output.getMimeType()).isEqualTo("text/html");
    }

    @Test
    void renderNoteReturnsNullWhenRendererMissing() {
        when(rendererRegistry.getRenderer("missing")).thenReturn(null);

        assertThat(rendererService.renderNote(note, "missing", null)).isNull();
    }

    @Test
    void canRenderDelegatesToRenderer() {
        when(rendererRegistry.getRenderer("mindmap")).thenReturn(new MindMapRenderer());

        assertThat(rendererService.canRender("mindmap", "# Heading\ncontent", "markdown")).isTrue();
        assertThat(rendererService.canRender("mindmap", "no heading", "markdown")).isFalse();
    }

    @Test
    void getRendererOptionsReturnsRendererOptions() {
        when(rendererRegistry.getRenderer("mindmap")).thenReturn(new MindMapRenderer());

        assertThat(rendererService.getRendererOptions("mindmap")).isNotEmpty();
    }

    @Test
    void getCompatibleRenderersDelegates() {
        when(rendererRegistry.getCompatibleRenderers(anyString(), anyString()))
                .thenReturn(List.of(new MindMapRenderer()));

        List<NoteRenderer> result = rendererService.getCompatibleRenderers(note);

        assertThat(result).hasSize(1);
    }
}
