package com.modulo.controller;

import com.modulo.service.ObservabilityService;
import com.modulo.service.TracingService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(locations = "classpath:application-test.properties")
@WithMockUser
class ObservabilityDemoControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private ObservabilityService observabilityService;
    @MockBean
    private TracingService tracingService;

    @Test
    void demoTraces() throws Exception {
        mockMvc.perform(get("/api/v1/observability/demo/traces"))
                .andExpect(status().isOk());
    }

    @Test
    void demoMetrics() throws Exception {
        mockMvc.perform(get("/api/v1/observability/demo/metrics"))
                .andExpect(status().isOk());
    }

    @Test
    void demoErrorHandlingSuccess() throws Exception {
        mockMvc.perform(post("/api/v1/observability/demo/errors").with(csrf())
                        .param("shouldFail", "false"))
                .andExpect(status().isOk());
    }
}
