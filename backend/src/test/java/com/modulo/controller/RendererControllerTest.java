package com.modulo.controller;

import com.modulo.plugin.registry.RendererPluginRegistry;
import com.modulo.plugin.impl.MindMapRenderer;
import com.modulo.service.NoteService;
import com.modulo.plugin.service.RendererService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Collections;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(locations = "classpath:application-test.properties")
@WithMockUser
class RendererControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private RendererService rendererService;
    @MockBean
    private RendererPluginRegistry rendererRegistry;
    @MockBean
    private NoteService noteService;

    @Test
    void getAllRenderers() throws Exception {
        when(rendererRegistry.getAllRendererMetadata()).thenReturn(Collections.emptyMap());

        mockMvc.perform(get("/api/renderers"))
                .andExpect(status().isOk());
    }

    @Test
    void getRendererFound() throws Exception {
        MindMapRenderer renderer = new MindMapRenderer();
        when(rendererRegistry.getRenderer("mindmap")).thenReturn(renderer);

        mockMvc.perform(get("/api/renderers/mindmap"))
                .andExpect(status().isOk());
    }

    @Test
    void getRendererNotFound() throws Exception {
        when(rendererRegistry.getRenderer("missing")).thenReturn(null);

        mockMvc.perform(get("/api/renderers/missing"))
                .andExpect(status().isNotFound());
    }
}
