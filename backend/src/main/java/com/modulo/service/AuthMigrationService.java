package com.modulo.service;

import com.modulo.entity.User;
import com.modulo.entity.User.AuthProvider;
import com.modulo.entity.User.MigrationStatus;
import com.modulo.repository.jpa.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.function.Function;

@Service
public class AuthMigrationService {

    private static final Logger logger = LoggerFactory.getLogger(AuthMigrationService.class);

    @Autowired
    private UserRepository userRepository;

    @Value("${modulo.auth.dual-auth-enabled:false}")
    private boolean dualAuthEnabled;

    @Value("${modulo.auth.default-provider:KEYCLOAK}")
    private String defaultProvider;

    @Value("${modulo.auth.migration-grace-period-days:30}")
    private int migrationGracePeriodDays;

    /**
     * Processes user authentication and handles migration logic
     */
    @Transactional
    public User processAuthentication(OAuth2User oauth2User, AuthProvider provider) {
        return processAuthentication(oauth2User::getAttribute, provider, true, null);
    }

    /**
     * Just-in-time provisioning for a bearer token that the resource server has already
     * validated and whose issuer the caller has checked. Uses the same rules as the OAuth
     * login path (subject first, then the migration rules), with two differences: an
     * existing account is linked by email only when the token says {@code email_verified},
     * and {@code preferred_username} becomes the username when it is free.
     *
     * <p>Runs in its own transaction so that a caller inside a read-only transaction can
     * still provision.</p>
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public User provisionFromBearerToken(Jwt jwt) {
        boolean emailVerified = Boolean.TRUE.equals(jwt.getClaimAsBoolean("email_verified"));
        return processAuthentication(jwt::getClaim, AuthProvider.KEYCLOAK, emailVerified,
                jwt.getClaimAsString("preferred_username"));
    }

    private User processAuthentication(Function<String, Object> claims, AuthProvider provider,
                                       boolean linkByEmail, String preferredUsername) {
        String email = claim(claims, "email");
        String subject = claim(claims, "sub");
        String name = claim(claims, "name");
        if (subject == null || subject.isBlank()) {
            throw new IllegalArgumentException("Authentication has no subject");
        }

        logger.info("Processing authentication for provider: {}, email: {}", provider, email);

        // First, try to find user by provider-specific subject
        Optional<User> userBySubject = findUserByProviderSubject(provider, subject);
        if (userBySubject.isPresent()) {
            logger.debug("Found user by {} subject: {}", provider, subject);
            return updateUserLastLogin(userBySubject.get(), provider);
        }

        // Next, try to find user by email (for migration scenarios)
        Optional<User> userByEmail = email == null ? Optional.empty() : userRepository.findByEmail(email);
        if (userByEmail.isPresent()) {
            if (linkByEmail) {
                return handleExistingUserMigration(userByEmail.get(), claims, provider, subject);
            }
            // Never adopt an existing account on an unverified email; the new account
            // simply does not carry the (already taken) address.
            logger.warn("Not linking {} subject {} to an existing account: email is not verified", provider, subject);
            email = null;
        }

        // Create new user
        return createNewUser(claims, provider, subject, email, name, preferredUsername);
    }

    private static String claim(Function<String, Object> claims, String name) {
        Object value = claims.apply(name);
        return value == null ? null : value.toString();
    }

    /**
     * Finds user by provider-specific subject
     */
    private Optional<User> findUserByProviderSubject(AuthProvider provider, String subject) {
        switch (provider) {
            case GOOGLE:
                return userRepository.findByGoogleSubject(subject);
            case AZURE:
                return userRepository.findByAzureSubject(subject);
            case KEYCLOAK:
                return userRepository.findByKeycloakSubject(subject);
            default:
                return Optional.empty();
        }
    }

    /**
     * Handles migration of existing users to new authentication provider
     */
    @Transactional
    private User handleExistingUserMigration(User existingUser, Function<String, Object> claims, AuthProvider provider, String subject) {
        logger.info("Handling migration for existing user: {} with provider: {}", existingUser.getEmail(), provider);

        // Check if user already has this provider configured
        if (existingUser.hasAuthProvider(provider)) {
            logger.debug("User already has provider {} configured", provider);
            return updateUserLastLogin(existingUser, provider);
        }

        // Handle different migration scenarios
        if (dualAuthEnabled) {
            return handleDualAuthMigration(existingUser, claims, provider, subject);
        } else {
            return handleDirectMigration(existingUser, claims, provider, subject);
        }
    }

    /**
     * Handles dual-auth period where users can authenticate with both legacy and new providers
     */
    @Transactional
    private User handleDualAuthMigration(User existingUser, Function<String, Object> claims, AuthProvider provider, String subject) {
        logger.info("Processing dual-auth migration for user: {} with provider: {}", existingUser.getEmail(), provider);

        // Add the new provider to the user's auth providers
        existingUser.addAuthProvider(provider);
        existingUser.setSubjectForProvider(provider, subject);
        existingUser.setLastOAuthProvider(provider);

        // Update migration status based on current state
        if (existingUser.getMigrationStatus() == null || existingUser.getMigrationStatus() == MigrationStatus.NOT_MIGRATED) {
            existingUser.setMigrationStatus(MigrationStatus.DUAL_AUTH);
            existingUser.setMigrationDate(LocalDateTime.now());
        }

        // If the new provider is Keycloak and user doesn't have a primary provider set, make it primary
        if (provider == AuthProvider.KEYCLOAK && existingUser.getPrimaryAuthProvider() == null) {
            existingUser.setPrimaryAuthProvider(AuthProvider.KEYCLOAK);
            logger.info("Set Keycloak as primary auth provider for user: {}", existingUser.getEmail());
        }

        // Update user profile information from the new provider
        updateUserProfileFromOAuth(existingUser, claims);

        // Log the migration activity
        logMigrationActivity(existingUser, provider, "dual_auth_added");

        return userRepository.save(existingUser);
    }

    /**
     * Handles direct migration without dual-auth period
     */
    @Transactional
    private User handleDirectMigration(User existingUser, Function<String, Object> claims, AuthProvider provider, String subject) {
        logger.info("Processing direct migration for user: {} to provider: {}", existingUser.getEmail(), provider);

        // Clear existing auth providers and set the new one as primary
        existingUser.getAuthProviders().clear();
        existingUser.addAuthProvider(provider);
        existingUser.setPrimaryAuthProvider(provider);
        existingUser.setSubjectForProvider(provider, subject);
        existingUser.setLastOAuthProvider(provider);
        existingUser.setMigrationStatus(MigrationStatus.MIGRATED);
        existingUser.setMigrationDate(LocalDateTime.now());

        // Update user profile information
        updateUserProfileFromOAuth(existingUser, claims);

        // Log the migration activity
        logMigrationActivity(existingUser, provider, "direct_migration");

        return userRepository.save(existingUser);
    }

    /**
     * Creates a new user from OAuth authentication
     */
    @Transactional
    private User createNewUser(Function<String, Object> claims, AuthProvider provider, String subject,
                               String email, String name, String preferredUsername) {
        logger.info("Creating new user for provider: {}, email: {}", provider, email);

        User newUser = new User();
        newUser.setEmail(email);
        newUser.setUsername(chooseUsername(preferredUsername, email, provider, subject));
        
        // Set name fields
        if (name != null) {
            String[] nameParts = name.split(" ", 2);
            newUser.setFirstName(nameParts[0]);
            if (nameParts.length > 1) {
                newUser.setLastName(nameParts[1]);
            }
        }

        // Set OAuth-specific fields
        newUser.setPrimaryAuthProvider(provider);
        newUser.addAuthProvider(provider);
        newUser.setSubjectForProvider(provider, subject);
        newUser.setLastOAuthProvider(provider);
        newUser.setMigrationStatus(MigrationStatus.MIGRATED); // New users are considered migrated
        newUser.setMigrationDate(LocalDateTime.now());
        newUser.setLastLoginAt(LocalDateTime.now());

        // Extract additional profile information
        updateUserProfileFromOAuth(newUser, claims);

        User savedUser = userRepository.save(newUser);
        
        // Log the user creation
        logMigrationActivity(savedUser, provider, "new_user_created");
        
        return savedUser;
    }

    /**
     * The OAuth login path has always used the email as username. Bearer provisioning
     * prefers {@code preferred_username}. Usernames are unique, so a taken or missing
     * candidate falls back to one derived from the provider subject.
     */
    private String chooseUsername(String preferredUsername, String email, AuthProvider provider, String subject) {
        String candidate = preferredUsername != null && !preferredUsername.isBlank() ? preferredUsername : email;
        if (candidate != null && !candidate.isBlank() && (preferredUsername == null || !userRepository.existsByUsername(candidate))) {
            return candidate;
        }
        return provider.name().toLowerCase(java.util.Locale.ROOT) + ":" + subject;
    }

    /**
     * Updates user's last login time and auth provider
     */
    @Transactional
    private User updateUserLastLogin(User user, AuthProvider provider) {
        user.setLastLoginAt(LocalDateTime.now());
        user.setLastOAuthProvider(provider);
        return userRepository.save(user);
    }

    /**
     * Updates user profile information from OAuth provider
     */
    private void updateUserProfileFromOAuth(User user, Function<String, Object> claims) {
        // Update basic profile fields if they're not set
        if (user.getFirstName() == null) {
            user.setFirstName(claim(claims, "given_name"));
        }
        if (user.getLastName() == null) {
            user.setLastName(claim(claims, "family_name"));
        }

        // Store additional OAuth attributes
        String picture = claim(claims, "picture");
        if (picture != null) {
            user.getCustomAttributes().put("profile_picture", picture);
        }

        String locale = claim(claims, "locale");
        if (locale != null) {
            user.getCustomAttributes().put("locale", locale);
        }
    }

    /**
     * Resolves conflicts when multiple accounts exist for the same email
     */
    @Transactional
    public User resolveAccountConflict(String email, AuthProvider canonicalProvider, String canonicalSubject) {
        logger.info("Resolving account conflict for email: {} with canonical provider: {}", email, canonicalProvider);

        List<User> conflictingUsers = userRepository.findAllByEmail(email);
        if (conflictingUsers.size() <= 1) {
            logger.warn("No conflict found for email: {}", email);
            return conflictingUsers.isEmpty() ? null : conflictingUsers.get(0);
        }

        // Find the canonical user (the one we want to keep)
        User canonicalUser = conflictingUsers.stream()
                .filter(u -> canonicalProvider.equals(u.getPrimaryAuthProvider()))
                .findFirst()
                .orElse(conflictingUsers.get(0)); // Fallback to first user

        // Merge data from other users into canonical user
        for (User duplicateUser : conflictingUsers) {
            if (!duplicateUser.getId().equals(canonicalUser.getId())) {
                mergeUserData(canonicalUser, duplicateUser);
                userRepository.delete(duplicateUser);
                logger.info("Merged and deleted duplicate user: {}", duplicateUser.getId());
            }
        }

        // Update canonical user
        canonicalUser.setMigrationStatus(MigrationStatus.CONFLICT_RESOLVED);
        canonicalUser.setMigrationDate(LocalDateTime.now());
        canonicalUser.setPrimaryAuthProvider(canonicalProvider);
        canonicalUser.setSubjectForProvider(canonicalProvider, canonicalSubject);

        // Log the conflict resolution
        logMigrationActivity(canonicalUser, canonicalProvider, "conflict_resolved");

        return userRepository.save(canonicalUser);
    }

    /**
     * Merges data from source user into target user
     */
    private void mergeUserData(User targetUser, User sourceUser) {
        // Merge auth providers
        targetUser.getAuthProviders().addAll(sourceUser.getAuthProviders());

        // Merge custom attributes
        sourceUser.getCustomAttributes().forEach((key, value) -> {
            if (!targetUser.getCustomAttributes().containsKey(key)) {
                targetUser.getCustomAttributes().put(key, value);
            }
        });

        // Merge preferences
        sourceUser.getPreferences().forEach((key, value) -> {
            if (!targetUser.getPreferences().containsKey(key)) {
                targetUser.getPreferences().put(key, value);
            }
        });

        // Keep the earliest creation date
        if (sourceUser.getCreatedAt().isBefore(targetUser.getCreatedAt())) {
            targetUser.setCreatedAt(sourceUser.getCreatedAt());
        }
    }

    /**
     * Logs migration activity for audit purposes
     */
    private void logMigrationActivity(User user, AuthProvider provider, String activity) {
        logger.info("MIGRATION_AUDIT: user_id={}, email={}, provider={}, activity={}, timestamp={}", 
                   user.getId(), user.getEmail(), provider, activity, LocalDateTime.now());
    }

    /**
     * Gets the default authentication provider
     */
    public AuthProvider getDefaultAuthProvider() {
        try {
            return AuthProvider.valueOf(defaultProvider.toUpperCase());
        } catch (IllegalArgumentException e) {
            logger.warn("Invalid default provider configured: {}, falling back to KEYCLOAK", defaultProvider);
            return AuthProvider.KEYCLOAK;
        }
    }

    /**
     * Checks if dual-auth is enabled
     */
    public boolean isDualAuthEnabled() {
        return dualAuthEnabled;
    }

    /**
     * Gets users that need manual review
     */
    public List<User> getUsersRequiringManualReview() {
        return userRepository.findByMigrationStatus(MigrationStatus.MANUAL_REVIEW);
    }

    /**
     * Gets users in dual-auth state
     */
    public List<User> getUsersInDualAuth() {
        return userRepository.findByMigrationStatus(MigrationStatus.DUAL_AUTH);
    }
}
