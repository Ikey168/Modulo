package com.modulo.user;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** /api/me echoes the caller's token claims; it is used by the Envoy/OPA overlay. */
@SpringBootTest
@AutoConfigureMockMvc
class MeControllerTest {

    @Autowired
    private MockMvc mvc;

    @Test
    void returnsTheCallersClaims() throws Exception {
        mvc.perform(get("/api/me").with(jwt().jwt(builder -> builder
                    .subject("subject-1")
                    .claim("email", "test@example.com")
                    .claim("realm_access", Map.of("roles", List.of("user"))))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sub").value("subject-1"))
                .andExpect(jsonPath("$.email").value("test@example.com"));
    }

    @Test
    void anonymousCallerGets401() throws Exception {
        mvc.perform(get("/api/me")).andExpect(status().isUnauthorized());
    }
}
