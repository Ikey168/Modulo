package com.modulo.controller;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(locations = "classpath:application-test.properties")
@WithMockUser
class PerformanceControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void stats() throws Exception {
        mockMvc.perform(get("/api/v2/performance/stats")).andExpect(status().isOk());
    }

    @Test
    void cache() throws Exception {
        mockMvc.perform(get("/api/v2/performance/cache")).andExpect(status().isOk());
    }

    @Test
    void database() throws Exception {
        mockMvc.perform(get("/api/v2/performance/database")).andExpect(status().isOk());
    }

    @Test
    void overview() throws Exception {
        mockMvc.perform(get("/api/v2/performance/overview")).andExpect(status().isOk());
    }
}
