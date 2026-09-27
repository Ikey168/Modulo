package com.modulo.security.profiles;

import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;

import java.util.List;

/**
 * No profile at all. Surefire sets spring.profiles.active=test for every test, so this
 * clears it; the base file's in-memory H2 datasource is used as is.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(ProfileSecurityContract.TestKeys.class)
@TestPropertySource(properties = {"spring.profiles.active=", ProfileSecurityContract.TRUSTED_ISSUER})
class DefaultProfileSecurityTest extends ProfileSecurityContract {
    @Override List<String> expectedProfiles() { return List.of(); }
}
