package com.modulo.security.profiles;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.env.Environment;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * #530: {@code @PreAuthorize("hasRole('ADMIN')")} is enforced without the {@code oidc}
 * profile. Subclasses boot the whole application on in-memory H2 (no Docker) under one
 * profile each; they are separate classes because surefire gives every test class its
 * own JVM, and each context binds the gRPC port.
 */
abstract class MethodSecurityContract {
    @Autowired MockMvc mvc;
    @Autowired Environment environment;

    @Test
    void nonAdminIsForbiddenOnAdminEndpoint() throws Exception {
        mvc.perform(get("/chaos/config").with(jwt().authorities(new SimpleGrantedAuthority("ROLE_USER"))))
            .andExpect(status().isForbidden());
    }

    @Test
    void adminReachesAdminEndpoint() throws Exception {
        mvc.perform(get("/chaos/config").with(jwt().authorities(new SimpleGrantedAuthority("ROLE_ADMIN"))))
            .andExpect(status().isOk());
    }
}
