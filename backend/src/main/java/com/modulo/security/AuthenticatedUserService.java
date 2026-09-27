package com.modulo.security;

import com.modulo.user.User;
import com.modulo.user.UserRepository;
import com.modulo.user.AuthMigrationService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

/**
 * Resolves a verified login to a persisted owner; display names and emails are not identities.
 *
 * <p>Bearer tokens are trusted only from the issuer the resource server validates:
 * {@code modulo.security.keycloak.issuer-uri}, falling back to
 * {@code spring.security.oauth2.resourceserver.jwt.issuer-uri}. The first request with a
 * valid token from that issuer provisions the account (see
 * {@link AuthMigrationService#provisionFromBearerToken}).</p>
 */
@Service
public class AuthenticatedUserService {
    private final UserRepository users;
    private final AuthMigrationService provisioning;
    private final String issuer;
    /** Serialises first-request provisioning so concurrent requests for a new subject create one row. */
    private final Object provisioningLock = new Object();

    public AuthenticatedUserService(UserRepository users,
            AuthMigrationService provisioning,
            @Value("${modulo.security.keycloak.issuer-uri:}") String keycloakIssuer,
            @Value("${spring.security.oauth2.resourceserver.jwt.issuer-uri:}") String springIssuer) {
        this.users = users;
        this.provisioning = provisioning;
        this.issuer = keycloakIssuer != null && !keycloakIssuer.isBlank()
                ? keycloakIssuer.trim()
                : (springIssuer == null ? "" : springIssuer.trim());
    }

    /** The issuer whose bearer tokens resolve to accounts; empty when none is configured. */
    public String trustedIssuer() {
        return issuer;
    }

    public User requireUser() {
        return requireUser(SecurityContextHolder.getContext().getAuthentication());
    }

    public User requireUser(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        Optional<User> resolved = Optional.empty();
        if (authentication instanceof JwtAuthenticationToken) {
            var jwt = ((JwtAuthenticationToken) authentication).getToken();
            String tokenIssuer = jwt.getClaimAsString("iss");
            String subject = jwt.getSubject();
            if (!issuer.isBlank() && issuer.equals(tokenIssuer) && subject != null && !subject.isBlank()) {
                resolved = users.findByKeycloakSubject(subject);
                if (resolved.isEmpty()) {
                    synchronized (provisioningLock) {
                        resolved = users.findByKeycloakSubject(subject);
                        if (resolved.isEmpty()) {
                            resolved = Optional.of(provisioning.provisionFromBearerToken(jwt));
                        }
                    }
                }
            }
        } else if (authentication instanceof OAuth2AuthenticationToken) {
            var oauth = (OAuth2AuthenticationToken) authentication;
            String subject = oauth.getPrincipal().getAttribute("sub");
            if (subject != null && !subject.isBlank()) {
                switch (oauth.getAuthorizedClientRegistrationId()) {
                    case "google": resolved = users.findByGoogleSubject(subject); break;
                    case "azure": resolved = users.findByAzureSubject(subject); break;
                    case "keycloak": resolved = users.findByKeycloakSubject(subject); break;
                    default: break;
                }
            }
        } else if (authentication.getPrincipal() instanceof UserDetails) {
            // A UserDetails principal is established by the configured local authentication provider.
            resolved = users.findByUsername(((UserDetails) authentication.getPrincipal()).getUsername());
        }
        return resolved.filter(user -> user.getId() != null).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.FORBIDDEN, "Authenticated account is not provisioned"));
    }

    public long requireUserId() {
        return requireUser().getId();
    }
    public long requireOwner(Long claimedOwner) {
        long owner = requireUserId();
        if (claimedOwner != null && claimedOwner != owner) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Resource not found");
        }
        return owner;
    }

    public String actor() { return Long.toString(requireUserId()); }

}
