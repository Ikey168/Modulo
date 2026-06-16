package com.modulo.controller;

import com.modulo.plugin.impl.CalendarTaskManagerPlugin;
import com.modulo.service.GoogleCalendarService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(locations = "classpath:application-test.properties")
@WithMockUser
class CalendarTaskManagerControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private GoogleCalendarService googleCalendarService;

    @MockBean
    private CalendarTaskManagerPlugin plugin;

    @Test
    void googleCalendarStatus() throws Exception {
        when(googleCalendarService.getConfigurationStatus()).thenReturn(Map.of("configured", true));

        mockMvc.perform(get("/api/plugins/calendar-task-manager/google-calendar/status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.configured").value(true));
    }

    @Test
    void googleCalendarAuthUrl() throws Exception {
        when(googleCalendarService.getAuthorizationUrl(anyString())).thenReturn("https://auth");

        mockMvc.perform(get("/api/plugins/calendar-task-manager/google-calendar/auth-url")
                        .param("redirectUri", "https://app/cb"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authorizationUrl").value("https://auth"));
    }

    @Test
    void exchangeTokenValid() throws Exception {
        when(googleCalendarService.exchangeCodeForToken(anyString(), anyString()))
                .thenReturn(Map.of("accessToken", "tok"));

        mockMvc.perform(post("/api/plugins/calendar-task-manager/google-calendar/exchange-token").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"c\",\"redirectUri\":\"https://app/cb\"}"))
                .andExpect(status().isOk());
    }

    @Test
    void exchangeTokenMissingParams() throws Exception {
        mockMvc.perform(post("/api/plugins/calendar-task-manager/google-calendar/exchange-token").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void testConnection() throws Exception {
        when(googleCalendarService.testConnection()).thenReturn(true);

        mockMvc.perform(get("/api/plugins/calendar-task-manager/google-calendar/test"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.connected").value(true));
    }
}
