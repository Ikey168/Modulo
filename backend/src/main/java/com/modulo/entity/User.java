package com.modulo.entity;

import javax.persistence.*;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.HashMap;
import java.util.Set;
import java.util.HashSet;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true)
    private String username;

    @Column(unique = true)
    private String email;

    @Column(name = "first_name")
    private String firstName;

    @Column(name = "last_name")
    private String lastName;

    @Column(name = "wallet_address")
    private String walletAddress;

    // OAuth Migration Support
    @Column(name = "primary_auth_provider")
    @Enumerated(EnumType.STRING)
    private AuthProvider primaryAuthProvider;

    @Column(name = "google_sub")
    private String googleSubject;

    @Column(name = "azure_sub")
    private String azureSubject;

    @Column(name = "keycloak_sub")
    private String keycloakSubject;

    @Column(name = "legacy_oauth_email")
    private String legacyOAuthEmail;

    @Column(name = "migration_status")
    @Enumerated(EnumType.STRING)
    private MigrationStatus migrationStatus;

    @Column(name = "migration_date")
    private LocalDateTime migrationDate;

    @Column(name = "last_oauth_provider")
    @Enumerated(EnumType.STRING)
    private AuthProvider lastOAuthProvider;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "user_auth_providers", joinColumns = @JoinColumn(name = "user_id"))
    @Enumerated(EnumType.STRING)
    @Column(name = "auth_provider")
    private Set<AuthProvider> authProviders = new HashSet<>();

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "last_login_at")
    private LocalDateTime lastLoginAt;

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "user_custom_attributes", joinColumns = @JoinColumn(name = "user_id"))
    @MapKeyColumn(name = "attribute_key")
    @Column(name = "attribute_value", columnDefinition = "TEXT")
    private Map<String, String> customAttributes = new HashMap<>();

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "user_preferences", joinColumns = @JoinColumn(name = "user_id"))
    @MapKeyColumn(name = "preference_key")
    @Column(name = "preference_value", columnDefinition = "TEXT")
    private Map<String, String> preferences = new HashMap<>();

    public enum AuthProvider {
        GOOGLE, AZURE, KEYCLOAK, METAMASK
    }

    public enum MigrationStatus {
        NOT_MIGRATED,       // User created before Keycloak migration
        MIGRATED,           // Successfully migrated to Keycloak
        DUAL_AUTH,          // Active in both legacy OAuth and Keycloak
        CONFLICT_RESOLVED,  // Had conflicts that were resolved
        MANUAL_REVIEW       // Requires manual intervention
    }

    public User() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    private void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getWalletAddress() {
        return walletAddress;
    }

    public void setWalletAddress(String walletAddress) {
        this.walletAddress = walletAddress;
    }

    public String getFirstName() {
        return firstName;
    }

    public void setFirstName(String firstName) {
        this.firstName = firstName;
    }

    public String getLastName() {
        return lastName;
    }

    public void setLastName(String lastName) {
        this.lastName = lastName;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public LocalDateTime getLastLoginAt() {
        return lastLoginAt;
    }

    public void setLastLoginAt(LocalDateTime lastLoginAt) {
        this.lastLoginAt = lastLoginAt;
    }

    public Map<String, String> getCustomAttributes() {
        return customAttributes;
    }

    public void setCustomAttributes(Map<String, String> customAttributes) {
        this.customAttributes = customAttributes;
    }

    public Map<String, String> getPreferences() {
        return preferences;
    }

    public void setPreferences(Map<String, String> preferences) {
        this.preferences = preferences;
    }

    // OAuth Migration Support Getters and Setters
    public AuthProvider getPrimaryAuthProvider() {
        return primaryAuthProvider;
    }

    public void setPrimaryAuthProvider(AuthProvider primaryAuthProvider) {
        this.primaryAuthProvider = primaryAuthProvider;
    }

    public String getGoogleSubject() {
        return googleSubject;
    }

    public void setGoogleSubject(String googleSubject) {
        this.googleSubject = googleSubject;
    }

    public String getAzureSubject() {
        return azureSubject;
    }

    public void setAzureSubject(String azureSubject) {
        this.azureSubject = azureSubject;
    }

    public String getKeycloakSubject() {
        return keycloakSubject;
    }

    public void setKeycloakSubject(String keycloakSubject) {
        this.keycloakSubject = keycloakSubject;
    }

    public String getLegacyOAuthEmail() {
        return legacyOAuthEmail;
    }

    public void setLegacyOAuthEmail(String legacyOAuthEmail) {
        this.legacyOAuthEmail = legacyOAuthEmail;
    }

    public MigrationStatus getMigrationStatus() {
        return migrationStatus;
    }

    public void setMigrationStatus(MigrationStatus migrationStatus) {
        this.migrationStatus = migrationStatus;
    }

    public LocalDateTime getMigrationDate() {
        return migrationDate;
    }

    public void setMigrationDate(LocalDateTime migrationDate) {
        this.migrationDate = migrationDate;
    }

    public AuthProvider getLastOAuthProvider() {
        return lastOAuthProvider;
    }

    public void setLastOAuthProvider(AuthProvider lastOAuthProvider) {
        this.lastOAuthProvider = lastOAuthProvider;
    }

    public Set<AuthProvider> getAuthProviders() {
        return authProviders;
    }

    public void setAuthProviders(Set<AuthProvider> authProviders) {
        this.authProviders = authProviders;
    }

    // Helper methods for migration
    public void addAuthProvider(AuthProvider provider) {
        this.authProviders.add(provider);
    }

    public boolean hasAuthProvider(AuthProvider provider) {
        return this.authProviders.contains(provider);
    }

    public String getSubjectForProvider(AuthProvider provider) {
        switch (provider) {
            case GOOGLE:
                return googleSubject;
            case AZURE:
                return azureSubject;
            case KEYCLOAK:
                return keycloakSubject;
            default:
                return null;
        }
    }

    public void setSubjectForProvider(AuthProvider provider, String subject) {
        switch (provider) {
            case GOOGLE:
                this.googleSubject = subject;
                break;
            case AZURE:
                this.azureSubject = subject;
                break;
            case KEYCLOAK:
                this.keycloakSubject = subject;
                break;
        }
    }
}