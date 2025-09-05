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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

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
        String email = oauth2User.getAttribute("email");
        String subject = oauth2User.getAttribute("sub");
        String name = oauth2User.getAttribute("name");

        logger.info("Processing authentication for provider: {}, email: {}", provider, email);

        // First, try to find user by provider-specific subject
        Optional<User> userBySubject = findUserByProviderSubject(provider, subject);
        if (userBySubject.isPresent()) {
            logger.debug("Found user by {} subject: {}", provider, subject);
            return updateUserLastLogin(userBySubject.get(), provider);
        }

        // Next, try to find user by email (for migration scenarios)
        Optional<User> userByEmail = userRepository.findByEmail(email);
        if (userByEmail.isPresent()) {
            return handleExistingUserMigration(userByEmail.get(), oauth2User, provider, subject);
        }

        // Create new user
        return createNewUser(oauth2User, provider, subject, email, name);
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
    private User handleExistingUserMigration(User existingUser, OAuth2User oauth2User, AuthProvider provider, String subject) {
        logger.info("Handling migration for existing user: {} with provider: {}", existingUser.getEmail(), provider);

        // Check if user already has this provider configured
        if (existingUser.hasAuthProvider(provider)) {
            logger.debug("User already has provider {} configured", provider);
            return updateUserLastLogin(existingUser, provider);
        }

        // Handle different migration scenarios
        if (dualAuthEnabled) {
            return handleDualAuthMigration(existingUser, oauth2User, provider, subject);
        } else {
            return handleDirectMigration(existingUser, oauth2User, provider, subject);
        }
    }

    /**
     * Handles dual-auth period where users can authenticate with both legacy and new providers
     */
    @Transactional
    private User handleDualAuthMigration(User existingUser, OAuth2User oauth2User, AuthProvider provider, String subject) {
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
        updateUserProfileFromOAuth(existingUser, oauth2User);

        // Log the migration activity
        logMigrationActivity(existingUser, provider, "dual_auth_added");

        return userRepository.save(existingUser);
    }

    /**
     * Handles direct migration without dual-auth period
     */
    @Transactional
    private User handleDirectMigration(User existingUser, OAuth2User oauth2User, AuthProvider provider, String subject) {
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
        updateUserProfileFromOAuth(existingUser, oauth2User);

        // Log the migration activity
        logMigrationActivity(existingUser, provider, "direct_migration");

        return userRepository.save(existingUser);
    }

    /**
     * Creates a new user from OAuth authentication
     */
    @Transactional
    private User createNewUser(OAuth2User oauth2User, AuthProvider provider, String subject, String email, String name) {
        logger.info("Creating new user for provider: {}, email: {}", provider, email);

        User newUser = new User();
        newUser.setEmail(email);
        newUser.setUsername(email); // Use email as username for OAuth users
        
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
        updateUserProfileFromOAuth(newUser, oauth2User);

        User savedUser = userRepository.save(newUser);
        
        // Log the user creation
        logMigrationActivity(savedUser, provider, "new_user_created");
        
        return savedUser;
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
    private void updateUserProfileFromOAuth(User user, OAuth2User oauth2User) {
        // Update basic profile fields if they're not set
        if (user.getFirstName() == null) {
            user.setFirstName(oauth2User.getAttribute("given_name"));
        }
        if (user.getLastName() == null) {
            user.setLastName(oauth2User.getAttribute("family_name"));
        }

        // Store additional OAuth attributes
        String picture = oauth2User.getAttribute("picture");
        if (picture != null) {
            user.getCustomAttributes().put("profile_picture", picture);
        }

        String locale = oauth2User.getAttribute("locale");
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
