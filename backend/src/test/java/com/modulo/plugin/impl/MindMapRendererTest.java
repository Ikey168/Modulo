package com.modulo.plugin.impl;

import com.modulo.plugin.api.renderer.RendererEventResponse;
import com.modulo.plugin.api.renderer.RendererOption;
import com.modulo.plugin.api.renderer.RendererOutput;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("MindMap Renderer Tests")
class MindMapRendererTest {

    private MindMapRenderer renderer;

    @BeforeEach
    void setUp() {
        renderer = new MindMapRenderer();
    }

    @Test
    void metadata() {
        assertThat(renderer.getRendererId()).isNotBlank();
        assertThat(renderer.getName()).isNotBlank();
        assertThat(renderer.getDescription()).isNotBlank();
        assertThat(renderer.getIcon()).isNotNull();
        assertThat(renderer.getVersion()).isNotBlank();
        assertThat(renderer.getAuthor()).isNotBlank();
        assertThat(renderer.getSupportedNoteTypes()).contains("markdown");
        assertThat(renderer.getOutputTypes()).isNotEmpty();
        assertThat(renderer.isInteractive()).isTrue();
    }

    @Test
    void canRenderRequiresHeadingsAndSupportedType() {
        String withHeading = "# Root\n## Child A\n## Child B";
        assertThat(renderer.canRender(withHeading, "markdown")).isTrue();
        assertThat(renderer.canRender(withHeading, null)).isTrue();

        assertThat(renderer.canRender("", "markdown")).isFalse();
        assertThat(renderer.canRender(null, "markdown")).isFalse();
        assertThat(renderer.canRender(withHeading, "pdf")).isFalse();
        assertThat(renderer.canRender("no headings here", "markdown")).isFalse();
    }

    @Test
    void renderProducesHtmlOutput() {
        String content = "# Root\n## Child A\n### Grandchild\n## Child B";
        Map<String, Object> options = new HashMap<>();
        options.put("theme", "dark");

        RendererOutput output = renderer.render(content, "markdown", options);

        assertThat(output).isNotNull();
        assertThat(output.getMimeType()).isEqualTo("text/html");
        assertThat(output.getContent()).isNotBlank();
        assertThat(output.getMetadata()).containsKey("nodeCount");
    }

    @Test
    void availableOptionsExposed() {
        List<RendererOption> options = renderer.getAvailableOptions();
        assertThat(options).isNotEmpty();
        assertThat(options).anyMatch(o -> "theme".equals(o.getName()));
    }

    @Test
    void handleEventReturnsResponse() {
        Map<String, Object> data = new HashMap<>();
        data.put("nodeId", "n1");

        RendererEventResponse clickResp = renderer.handleEvent("node-click", data, new HashMap<>());
        assertThat(clickResp).isNotNull();

        RendererEventResponse unknownResp = renderer.handleEvent("unknown-event", data, new HashMap<>());
        assertThat(unknownResp).isNotNull();
    }
}
