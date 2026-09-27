package com.modulo.security.profiles;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("docker")
@TestPropertySource(properties = {
    // The docker profile reads PostgreSQL from SPRING_DATASOURCE_*; point it at H2 so
    // the test runs without a database container. Security wiring is unchanged.
    "spring.datasource.url=jdbc:h2:mem:method-security-docker;DB_CLOSE_DELAY=-1",
    "spring.datasource.username=sa",
    "spring.datasource.password=",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
    "spring.flyway.enabled=false",
    "spring.jpa.hibernate.ddl-auto=create-drop",
    "spring.jpa.properties.hibernate.hbm2ddl.create_namespaces=true"
})
class MethodSecurityDockerProfileTest extends MethodSecurityContract {
    @Test
    void dockerProfileIsActiveWithoutOidc() {
        System.out.println("Active profiles: " + String.join(",", environment.getActiveProfiles()));
        assertThat(environment.getActiveProfiles()).contains("docker").doesNotContain("oidc");
    }
}
