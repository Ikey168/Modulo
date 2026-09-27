package com.modulo.security.profiles;

import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

import java.util.List;

/** The test profile, exactly as the rest of the suite runs. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(ProfileSecurityContract.TestKeys.class)
@ActiveProfiles("test")
@TestPropertySource(properties = ProfileSecurityContract.TRUSTED_ISSUER)
class TestProfileSecurityTest extends ProfileSecurityContract {
    @Override List<String> expectedProfiles() { return List.of("test"); }
}
