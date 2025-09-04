package com.modulo.auth;

import com.modulo.entity.User;
import com.modulo.entity.User.AuthProvider;
import com.modulo.service.AuthMigrationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import java.io.IOException;

@Component("oauth2LoginSuccessHandler")
public class OAuth2LoginSuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private static final Logger logger = LoggerFactory.getLogger(OAuth2LoginSuccessHandler.class);
    
    private String frontendCallbackUrl = "http://localhost:3000/auth/callback";

    @Autowired
    private AuthMigrationService authMigrationService;

    public OAuth2LoginSuccessHandler() {
        setDefaultTargetUrl(frontendCallbackUrl);
        setTargetUrlParameter("redirectTo"); 
    }

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response, Authentication authentication) throws IOException, ServletException {
        if (response.isCommitted()) {
            logger.debug("Response has already been committed. Unable to redirect to " + frontendCallbackUrl);
            return;
        }

        try {
            // Process OAuth authentication and handle migration
            User user = processOAuthAuthentication(authentication, request);
            
            // Store user information in session for frontend access
            HttpSession session = request.getSession();
            session.setAttribute("user", user);
            session.setAttribute("migrationStatus", user.getMigrationStatus());
            session.setAttribute("authProvider", user.getLastOAuthProvider());
            
            // Build success redirect URL with user information
            String targetUrl = UriComponentsBuilder.fromUriString(frontendCallbackUrl)
                    .queryParam("loginSuccess", "true")
                    .queryParam("userId", user.getId())
                    .queryParam("migrationStatus", user.getMigrationStatus())
                    .queryParam("provider", user.getLastOAuthProvider())
                    .build().toUriString();
            
            logger.info("OAuth authentication successful for user: {} with provider: {}", 
                       user.getEmail(), user.getLastOAuthProvider());
            
            getRedirectStrategy().sendRedirect(request, response, targetUrl);
        } catch (Exception e) {
            logger.error("Error processing OAuth authentication", e);
            
            // Redirect to error page
            String errorUrl = UriComponentsBuilder.fromUriString(frontendCallbackUrl)
                    .queryParam("loginSuccess", "false")
                    .queryParam("error", "migration_error")
                    .build().toUriString();
            
            getRedirectStrategy().sendRedirect(request, response, errorUrl);
        }
        
        super.clearAuthenticationAttributes(request); 
    }

    /**
     * Processes OAuth authentication using the migration service
     */
    private User processOAuthAuthentication(Authentication authentication, HttpServletRequest request) {
        if (!(authentication instanceof OAuth2AuthenticationToken)) {
            throw new IllegalArgumentException("Expected OAuth2AuthenticationToken");
        }

        OAuth2AuthenticationToken oauthToken = (OAuth2AuthenticationToken) authentication;
        OAuth2User oauth2User = oauthToken.getPrincipal();
        String registrationId = oauthToken.getAuthorizedClientRegistrationId();

        // Map registration ID to AuthProvider
        AuthProvider provider = mapRegistrationIdToProvider(registrationId);
        
        logger.debug("Processing OAuth authentication for provider: {} with registration ID: {}", 
                    provider, registrationId);

        // Use migration service to process the authentication
        return authMigrationService.processAuthentication(oauth2User, provider);
    }

    /**
     * Maps OAuth2 client registration ID to AuthProvider enum
     */
    private AuthProvider mapRegistrationIdToProvider(String registrationId) {
        switch (registrationId.toLowerCase()) {
            case "google":
                return AuthProvider.GOOGLE;
            case "azure":
            case "microsoft":
                return AuthProvider.AZURE;
            case "keycloak":
                return AuthProvider.KEYCLOAK;
            case "metamask":
                return AuthProvider.METAMASK;
            default:
                logger.warn("Unknown OAuth registration ID: {}, defaulting to KEYCLOAK", registrationId);
                return AuthProvider.KEYCLOAK;
        }
    }
}