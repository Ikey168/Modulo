package com.modulo.security.testing;

import com.modulo.security.SecurityAuditLogger;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(locations = "classpath:application-test.properties", properties = {
        "modulo.security.testing.enabled=true",
        "modulo.security.testing.api-key=test-key"
})
@WithMockUser
class SecurityTestingControllerTest {

    private static final String KEY_HEADER = "X-Security-Testing-Key";
    private static final String KEY = "test-key";

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private SecurityAuditLogger auditLogger;

    @Test
    void vulnerabilityScanUnauthorizedWithoutKey() throws Exception {
        mockMvc.perform(post("/api/security/testing/vulnerability-scan").with(csrf()))
                .andExpect(status().isForbidden());
    }

    @Test
    void vulnerabilityScanAuthorized() throws Exception {
        mockMvc.perform(post("/api/security/testing/vulnerability-scan").with(csrf())
                        .header(KEY_HEADER, KEY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.scanId").exists());
    }

    @Test
    void rateLimitingTest() throws Exception {
        mockMvc.perform(post("/api/security/testing/test-rate-limiting").with(csrf())
                        .header(KEY_HEADER, KEY)
                        .param("requestCount", "5"))
                .andExpect(status().isOk());
    }

    @Test
    void sqlInjectionTest() throws Exception {
        mockMvc.perform(post("/api/security/testing/test-sql-injection").with(csrf())
                        .header(KEY_HEADER, KEY)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"query\":\"' OR 1=1 --\"}"))
                .andExpect(status().isOk());
    }

    @Test
    void xssTest() throws Exception {
        mockMvc.perform(post("/api/security/testing/test-xss").with(csrf())
                        .header(KEY_HEADER, KEY)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"input\":\"<script>alert(1)</script>\"}"))
                .andExpect(status().isOk());
    }
}
