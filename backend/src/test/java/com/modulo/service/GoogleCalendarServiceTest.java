package com.modulo.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DisplayName("Google Calendar Service Tests")
class GoogleCalendarServiceTest {

    private GoogleCalendarService configured() {
        GoogleCalendarService service = new GoogleCalendarService();
        ReflectionTestUtils.setField(service, "googleCalendarEnabled", true);
        ReflectionTestUtils.setField(service, "apiKey", "api-key");
        ReflectionTestUtils.setField(service, "clientId", "client-id");
        ReflectionTestUtils.setField(service, "clientSecret", "client-secret");
        return service;
    }

    @Test
    void configurationStatusWhenConfigured() {
        Map<String, Object> status = configured().getConfigurationStatus();

        assertThat(status).containsEntry("enabled", true);
        assertThat(status).containsEntry("configured", true);
        assertThat(status).containsEntry("apiKeyPresent", true);
        assertThat(status).containsEntry("clientIdPresent", true);
        assertThat(status).containsEntry("clientSecretPresent", true);
    }

    @Test
    void configurationStatusWhenNotConfigured() {
        GoogleCalendarService service = new GoogleCalendarService();

        Map<String, Object> status = service.getConfigurationStatus();

        assertThat(status).containsEntry("enabled", false);
        assertThat(status).containsEntry("configured", false);
    }

    @Test
    void authorizationUrlIncludesClientId() {
        String url = configured().getAuthorizationUrl("https://app/callback");

        assertThat(url).contains("client_id=client-id");
        assertThat(url).contains("redirect_uri=https://app/callback");
        assertThat(url).startsWith("https://accounts.google.com/o/oauth2/v2/auth");
    }

    @Test
    void authorizationUrlFailsWhenNotConfigured() {
        assertThatThrownBy(() -> new GoogleCalendarService().getAuthorizationUrl("https://app/cb"))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void exchangeCodeForTokenReturnsTokenInfo() {
        Map<String, Object> tokenInfo = configured().exchangeCodeForToken("auth-code", "https://app/cb");

        assertThat(tokenInfo).containsKey("access_token");
    }
}
