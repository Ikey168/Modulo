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

/**
 * Smoke tests for small read-only controllers driven through the full
 * application context.
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(locations = "classpath:application-test.properties")
@WithMockUser
class MiscControllersTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void simpleHealth() throws Exception {
        mockMvc.perform(get("/api/simple-health")).andExpect(status().isOk());
    }

    @Test
    void actuatorTest() throws Exception {
        mockMvc.perform(get("/api/actuator-test")).andExpect(status().isOk());
    }

    @Test
    void chaosConfig() throws Exception {
        mockMvc.perform(get("/chaos/config")).andExpect(status().isOk());
    }

    @Test
    void chaosHealth() throws Exception {
        mockMvc.perform(get("/chaos/health")).andExpect(status().isOk());
    }
}
