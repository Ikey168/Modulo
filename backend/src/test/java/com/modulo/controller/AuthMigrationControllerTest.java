package com.modulo.controller;

import com.modulo.entity.User;
import com.modulo.repository.jpa.UserRepository;
import com.modulo.service.AuthMigrationService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(locations = "classpath:application-test.properties")
@WithMockUser
class AuthMigrationControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AuthMigrationService authMigrationService;
    @MockBean
    private UserRepository userRepository;

    @Test
    void getUsersRequiringManualReview() throws Exception {
        when(authMigrationService.getUsersRequiringManualReview()).thenReturn(List.of(new User()));

        mockMvc.perform(get("/auth/migration/manual-review"))
                .andExpect(status().isOk());
    }

    @Test
    void getUsersInDualAuth() throws Exception {
        when(authMigrationService.getUsersInDualAuth()).thenReturn(List.of(new User()));

        mockMvc.perform(get("/auth/migration/dual-auth"))
                .andExpect(status().isOk());
    }

    @Test
    void getMigrationStatistics() throws Exception {
        when(authMigrationService.isDualAuthEnabled()).thenReturn(true);
        when(authMigrationService.getDefaultAuthProvider()).thenReturn(User.AuthProvider.KEYCLOAK);

        mockMvc.perform(get("/auth/migration/statistics"))
                .andExpect(status().isOk());
    }
}
