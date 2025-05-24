package com.modulo.controller;

import com.modulo.ModuloApplication; // Import main application
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.boot.autoconfigure.security.oauth2.client.servlet.OAuth2ClientAutoConfiguration;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;

@SpringBootTest(classes = ModuloApplication.class)
@AutoConfigureMockMvc
@Import(OAuth2ClientAutoConfiguration.class)
@TestPropertySource(locations = "classpath:application-test.properties")
public class NoteControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @WithMockUser // Add this for authentication
    public void createNote_ShouldReturnCreatedNote() throws Exception {
        mockMvc.perform(post("/notes")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Test Title\", \"content\":\"Test Content\"}")
                .with(csrf())) // Add this for CSRF
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.title").value("Test Title"))
                .andExpect(jsonPath("$.content").value("Test Content"));
    }

    @Test
    @WithMockUser // Add this for authentication
    public void getAllNotes_ShouldReturnListOfNotes() throws Exception {
        mockMvc.perform(get("/notes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
    }
}