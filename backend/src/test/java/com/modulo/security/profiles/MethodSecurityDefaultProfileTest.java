package com.modulo.security.profiles;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@AutoConfigureMockMvc
class MethodSecurityDefaultProfileTest extends MethodSecurityContract {
    @Test
    void oidcProfileIsNotActive() {
        assertThat(environment.getActiveProfiles()).doesNotContain("oidc", "docker");
    }
}
