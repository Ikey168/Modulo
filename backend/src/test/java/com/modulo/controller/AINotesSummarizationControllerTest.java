package com.modulo.controller;

import com.modulo.plugin.impl.AINotesSummarizationPlugin;
import com.modulo.plugin.impl.AINotesSummarizationPlugin.InsightsResult;
import com.modulo.plugin.impl.AINotesSummarizationPlugin.KeyPointsResult;
import com.modulo.plugin.impl.AINotesSummarizationPlugin.SummaryResult;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(locations = "classpath:application-test.properties")
@WithMockUser
class AINotesSummarizationControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AINotesSummarizationPlugin aiPlugin;

    @Test
    void summarizeSuccess() throws Exception {
        when(aiPlugin.summarizeNote(eq(1L), any()))
                .thenReturn(SummaryResult.builder().success(true).build());

        mockMvc.perform(post("/api/plugin/ai-notes-summarization/notes/1/summarize").with(csrf()))
                .andExpect(status().isOk());
    }

    @Test
    void summarizeFailureReturnsBadRequest() throws Exception {
        when(aiPlugin.summarizeNote(eq(2L), any()))
                .thenReturn(SummaryResult.error("note not found"));

        mockMvc.perform(post("/api/plugin/ai-notes-summarization/notes/2/summarize").with(csrf()))
                .andExpect(status().isBadRequest());
    }

    @Test
    void extractKeyPointsSuccess() throws Exception {
        when(aiPlugin.extractKeyPoints(eq(1L), anyInt()))
                .thenReturn(KeyPointsResult.builder().success(true).build());

        mockMvc.perform(post("/api/plugin/ai-notes-summarization/notes/1/key-points").with(csrf()))
                .andExpect(status().isOk());
    }

    @Test
    void generateInsightsSuccess() throws Exception {
        when(aiPlugin.generateInsights(1L))
                .thenReturn(InsightsResult.builder().success(true).build());

        mockMvc.perform(post("/api/plugin/ai-notes-summarization/notes/1/insights").with(csrf()))
                .andExpect(status().isOk());
    }

    @Test
    void analyzeNote() throws Exception {
        mockMvc.perform(post("/api/plugin/ai-notes-summarization/notes/1/analyze").with(csrf()))
                .andExpect(status().isOk());
    }

    @Test
    void batchSummarizeRejectsEmptyIds() throws Exception {
        mockMvc.perform(post("/api/plugin/ai-notes-summarization/notes/batch-summarize").with(csrf())
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                        .content("{\"noteIds\":[]}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void getPluginStatus() throws Exception {
        mockMvc.perform(get("/api/plugin/ai-notes-summarization/status"))
                .andExpect(status().isOk());
    }
}
