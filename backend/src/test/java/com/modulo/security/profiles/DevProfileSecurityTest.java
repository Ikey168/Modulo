package com.modulo.security.profiles;

import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

import java.util.List;

/**
 * The dev profile. It reads PostgreSQL (with Flyway) from its profile file; the
 * datasource is pointed at in-memory H2 with Hibernate DDL so the test runs without a
 * database container. Everything security-related comes from the profile unchanged.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(ProfileSecurityContract.TestKeys.class)
@ActiveProfiles("dev")
@TestPropertySource(properties = {
    ProfileSecurityContract.TRUSTED_ISSUER,
    "spring.datasource.url=jdbc:h2:mem:profile-dev;DB_CLOSE_DELAY=-1",
    "spring.datasource.username=sa",
    "spring.datasource.password=",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
    "spring.flyway.enabled=false",
    "spring.jpa.hibernate.ddl-auto=create-drop",
    "spring.jpa.properties.hibernate.hbm2ddl.create_namespaces=true"
})
class DevProfileSecurityTest extends ProfileSecurityContract {
    @Override List<String> expectedProfiles() { return List.of("dev"); }
}
