# OAuth Migration Documentation

## Overview

This document describes the OAuth migration implementation that provides backwards compatibility when migrating from existing OAuth providers (Google, Azure) to Keycloak. The implementation uses an email/subject mapping strategy with support for dual-authentication periods and conflict resolution.

## Architecture

### Core Components

1. **AuthMigrationService**: Central service handling migration logic
2. **User Entity Enhancements**: Extended to support multiple OAuth providers
3. **OAuth2LoginSuccessHandler**: Updated to use migration service
4. **AuthMigrationController**: REST API for migration management
5. **Configuration Properties**: Feature flags and migration settings

### Migration Strategy

The implementation uses an **email-based mapping strategy** with the following approach:

1. **Subject Tracking**: Each user can have multiple OAuth subjects (Google, Azure, Keycloak, MetaMask)
2. **Dual-Auth Period**: Users can authenticate with both legacy and new providers
3. **Conflict Resolution**: Canonical user selection with data merging
4. **Feature Flags**: Configurable migration behavior

## User Entity Schema

### New Fields

```java
// OAuth Provider Support
@ElementCollection(targetClass = AuthProvider.class)
@Enumerated(EnumType.STRING)
@CollectionTable(name = "user_auth_providers")
private Set<AuthProvider> authProviders = new HashSet<>();

@Enumerated(EnumType.STRING)
private AuthProvider primaryAuthProvider;

@Enumerated(EnumType.STRING)
private AuthProvider lastOAuthProvider;

// Migration Tracking
@Enumerated(EnumType.STRING)
private MigrationStatus migrationStatus;

private LocalDateTime migrationDate;

// OAuth Subjects
private String googleSubject;
private String azureSubject;
private String keycloakSubject;
private String metamaskSubject;
```

### Enums

#### AuthProvider
- `GOOGLE`: Google OAuth
- `AZURE`: Microsoft Azure OAuth
- `KEYCLOAK`: Keycloak OAuth
- `METAMASK`: MetaMask Web3 authentication

#### MigrationStatus
- `NOT_MIGRATED`: User has not been migrated
- `MIGRATED`: User successfully migrated
- `DUAL_AUTH`: User in dual-authentication period
- `CONFLICT_RESOLVED`: Account conflicts resolved
- `MANUAL_REVIEW`: Requires manual administrator review

## Migration Process

### 1. User Authentication Flow

```
1. User attempts OAuth login
2. OAuth2LoginSuccessHandler processes authentication
3. AuthMigrationService.processAuthentication() called
4. Service checks for existing user by provider subject
5. If not found, checks by email for migration
6. Handles migration based on configuration
7. Returns User entity with updated migration status
```

### 2. Migration Scenarios

#### Scenario A: New User
- Create new user with primary auth provider
- Set migration status to `MIGRATED`
- Store OAuth subject for provider

#### Scenario B: Existing User - Same Provider
- Update last login time
- Update last OAuth provider
- No migration needed

#### Scenario C: Existing User - New Provider (Dual-Auth Enabled)
- Add new provider to user's auth providers
- Store OAuth subject for new provider
- Set migration status to `DUAL_AUTH`
- If new provider is Keycloak, set as primary

#### Scenario D: Existing User - New Provider (Direct Migration)
- Replace existing auth providers with new one
- Set new provider as primary
- Set migration status to `MIGRATED`
- Update OAuth subject

#### Scenario E: Account Conflict Resolution
- Multiple users found with same email
- Select canonical user (based on provider preference)
- Merge data from duplicate accounts
- Delete duplicate accounts
- Set migration status to `CONFLICT_RESOLVED`

## Configuration

### Application Properties

```properties
# OAuth Migration Configuration
modulo.auth.dual-auth-enabled=true
modulo.auth.default-provider=KEYCLOAK
modulo.auth.migration-grace-period-days=30
modulo.auth.conflict-resolution-strategy=EMAIL_MAPPING
modulo.auth.auto-migrate-legacy-users=false
modulo.auth.require-manual-review-threshold=2
```

### Configuration Options

- **dual-auth-enabled**: Allow users to authenticate with multiple providers
- **default-provider**: Default authentication provider for new installations
- **migration-grace-period-days**: How long to maintain dual-auth state
- **conflict-resolution-strategy**: Strategy for resolving account conflicts
- **auto-migrate-legacy-users**: Automatically migrate users on first Keycloak login
- **require-manual-review-threshold**: Number of conflicts before requiring manual review

## API Endpoints

### User Migration Status

```http
GET /api/auth/migration/status?email={email}&userId={userId}
```

Returns migration status for a user including:
- Migration status
- Available auth providers
- Primary auth provider
- Last login information

### Migration Statistics (Admin)

```http
GET /api/auth/migration/statistics
```

Returns system-wide migration statistics:
- Total users
- Migration status breakdown
- Migration progress percentage

### Users Requiring Manual Review (Admin)

```http
GET /api/auth/migration/manual-review
```

Returns list of users that need administrator attention.

### Resolve Account Conflict (Admin)

```http
POST /api/auth/migration/resolve-conflict
Content-Type: application/json

{
  "email": "user@example.com",
  "canonicalProvider": "KEYCLOAK",
  "canonicalSubject": "keycloak-subject-id"
}
```

Resolves conflicts by selecting a canonical account.

### Force Migration (Admin)

```http
POST /api/auth/migration/force-migrate
Content-Type: application/json

{
  "userId": 123,
  "targetProvider": "KEYCLOAK",
  "targetSubject": "keycloak-subject-id"
}
```

Forces migration for a specific user.

## Security Considerations

### 1. Subject Validation
- OAuth subjects are validated against provider-specific formats
- Subjects are stored securely and not exposed in logs

### 2. Conflict Resolution
- Only administrators can resolve account conflicts
- All conflict resolutions are logged for audit purposes

### 3. Data Merging
- User data is merged safely without overwriting critical information
- Custom attributes and preferences are preserved

### 4. Session Management
- Migration status is stored in user session
- Frontend can access migration information for UI updates

## Monitoring and Logging

### Migration Events

All migration activities are logged with the following format:

```
MIGRATION_AUDIT: user_id={id}, email={email}, provider={provider}, activity={activity}, timestamp={timestamp}
```

### Activities Logged
- `new_user_created`: New user created via OAuth
- `dual_auth_added`: New provider added to existing user
- `direct_migration`: User directly migrated to new provider
- `conflict_resolved`: Account conflict resolved
- `manual_review_required`: User flagged for manual review

### Metrics

The following metrics are available:
- Migration completion percentage
- Users by authentication provider
- Conflict resolution statistics
- Dual-auth usage statistics

## Deployment Strategy

### Phase 1: Preparation
1. Deploy backend changes with dual-auth enabled
2. Configure Keycloak integration
3. Test migration flows in staging environment

### Phase 2: Gradual Migration
1. Enable dual-auth for existing users
2. Communicate migration timeline to users
3. Monitor migration progress and resolve conflicts

### Phase 3: Full Migration
1. Set Keycloak as default provider
2. Disable legacy OAuth providers (optional)
3. Clean up migrated user data

## Troubleshooting

### Common Issues

#### 1. Subject Mismatch
**Problem**: OAuth subject changed between logins
**Solution**: Use email-based fallback matching

#### 2. Multiple Accounts
**Problem**: User has multiple accounts with same email
**Solution**: Use conflict resolution API to merge accounts

#### 3. Missing Migration Status
**Problem**: Existing users don't have migration status
**Solution**: Run migration status initialization script

#### 4. Provider Configuration
**Problem**: OAuth provider configuration issues
**Solution**: Verify OAuth client registration settings

### Debug Mode

Enable debug logging for migration troubleshooting:

```properties
logging.level.com.modulo.service.AuthMigrationService=DEBUG
logging.level.com.modulo.auth.OAuth2LoginSuccessHandler=DEBUG
```

## Testing

### Unit Tests
- AuthMigrationService test scenarios
- User entity helper method tests
- OAuth2LoginSuccessHandler integration tests

### Integration Tests
- End-to-end OAuth flow tests
- Migration scenario tests
- Conflict resolution tests

### Manual Testing Checklist
- [ ] Google OAuth login (existing user)
- [ ] Azure OAuth login (existing user)
- [ ] Keycloak OAuth login (new provider)
- [ ] Dual-auth period functionality
- [ ] Conflict resolution workflow
- [ ] Admin migration management

## Future Enhancements

### Planned Features
1. **Automatic Migration Scheduling**: Scheduled migration of legacy users
2. **Migration Notifications**: Email notifications for migration events
3. **Advanced Conflict Resolution**: ML-based duplicate detection
4. **Migration Analytics**: Detailed analytics dashboard
5. **Provider-Specific Customization**: Custom migration logic per provider

### Migration Timeline
- **Immediate**: Core migration functionality
- **Short-term** (1-2 months): Analytics and notifications
- **Long-term** (3-6 months): Advanced conflict resolution and automation

---

For additional support or questions about the OAuth migration implementation, please refer to the development team or create an issue in the project repository.
