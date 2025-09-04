package com.modulo.backend.web;

import com.modulo.backend.config.SecurityConfig;
import com.modulo.service.TracingService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;

import org.springframework.boot.test.mock.mockito.MockBean;
import com.modulo.service.TracingService;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = MeController.class, excludeAutoConfiguration = {
    org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration.class,
    org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration.class
})
@Import(SecurityConfig.class)
@ActiveProfiles("oidc")
public class MeControllerTest {

    @Autowired
    private MockMvc mvc;

    @MockBean
    private TracingService tracingService;

    @Test
    void getMe() throws Exception {
        mvc.perform(get("/api/me").with(jwt().jwt(builder -> {
                    builder.claim("email", "test@example.com");
                    builder.claim("realm_access", Map.of("roles", List.of("user")));
                })))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("test@example.com"));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void getMeWithAdminRole() throws Exception {
        mvc.perform(get("/api/me").with(jwt().jwt(builder -> {
                    builder.claim("email", "admin@example.com");
                    builder.claim("realm_access", Map.of("roles", List.of("admin")));
                })))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("admin@example.com"));
    }
}
