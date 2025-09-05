package com.modulo.repository.jpa;

import com.modulo.entity.User;
import com.modulo.entity.User.MigrationStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Nested;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.TestPropertySource;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;

@DataJpaTest
@TestPropertySource(locations = "classpath:application-test.properties")
@DisplayName("User Repository Tests")
class UserRepositoryTest {

    @Autowired
    private TestEntityManager entityManager;

    @Autowired
    private UserRepository userRepository;

    private User testUser1;
    private User testUser2;
    private User oauthUser;

    @BeforeEach
    void setUp() {
        // Create basic test users
        testUser1 = new User();
        testUser1.setUsername("testuser1");
        testUser1.setEmail("testuser1@example.com");
        testUser1.setPasswordHash("hashedpassword1");
        testUser1.setMigrationStatus(MigrationStatus.NOT_STARTED);
        testUser1.setCreatedAt(LocalDateTime.now());
        testUser1.setUpdatedAt(LocalDateTime.now());

        testUser2 = new User();
        testUser2.setUsername("testuser2");
        testUser2.setEmail("testuser2@example.com");
        testUser2.setPasswordHash("hashedpassword2");
        testUser2.setMigrationStatus(MigrationStatus.COMPLETED);
        testUser2.setCreatedAt(LocalDateTime.now());
        testUser2.setUpdatedAt(LocalDateTime.now());

        // Create OAuth user with multiple provider subjects
        oauthUser = new User();
        oauthUser.setUsername("oauthuser");
        oauthUser.setEmail("oauth@example.com");
        oauthUser.setGoogleSubject("google-123456789");
        oauthUser.setAzureSubject("azure-987654321");
        oauthUser.setKeycloakSubject("keycloak-abcdef123");
        oauthUser.setMetaMaskSubject("metamask-0x123abc");
        oauthUser.setMigrationStatus(MigrationStatus.IN_PROGRESS);
        oauthUser.setCreatedAt(LocalDateTime.now());
        oauthUser.setUpdatedAt(LocalDateTime.now());

        entityManager.persist(testUser1);
        entityManager.persist(testUser2);
        entityManager.persist(oauthUser);
        entityManager.flush();
    }

    @Nested
    @DisplayName("Basic CRUD Operations")
    class BasicCrudOperations {

        @Test
        @DisplayName("Should save and find user by ID")
        void shouldSaveAndFindUserById() {
            User newUser = new User();
            newUser.setUsername("newuser");
            newUser.setEmail("newuser@example.com");
            newUser.setPasswordHash("hashedpassword");
            newUser.setMigrationStatus(MigrationStatus.NOT_STARTED);
            newUser.setCreatedAt(LocalDateTime.now());
            newUser.setUpdatedAt(LocalDateTime.now());

            User savedUser = userRepository.save(newUser);
            
            assertThat(savedUser.getId()).isNotNull();
            
            Optional<User> foundUser = userRepository.findById(savedUser.getId());
            
            assertThat(foundUser).isPresent();
            assertThat(foundUser.get().getUsername()).isEqualTo("newuser");
            assertThat(foundUser.get().getEmail()).isEqualTo("newuser@example.com");
        }

        @Test
        @DisplayName("Should update existing user")
        void shouldUpdateExistingUser() {
            testUser1.setEmail("updated@example.com");
            testUser1.setUpdatedAt(LocalDateTime.now());

            User updatedUser = userRepository.save(testUser1);
            
            assertThat(updatedUser.getEmail()).isEqualTo("updated@example.com");
        }

        @Test
        @DisplayName("Should delete user")
        void shouldDeleteUser() {
            Long userId = testUser1.getId();
            
            userRepository.delete(testUser1);
            entityManager.flush();
            
            Optional<User> deletedUser = userRepository.findById(userId);
            assertThat(deletedUser).isEmpty();
        }

        @Test
        @DisplayName("Should check if user exists")
        void shouldCheckIfUserExists() {
            assertThat(userRepository.existsById(testUser1.getId())).isTrue();
            assertThat(userRepository.existsById(999L)).isFalse();
        }

        @Test
        @DisplayName("Should find all users")
        void shouldFindAllUsers() {
            List<User> allUsers = userRepository.findAll();
            
            assertThat(allUsers).hasSize(3);
            assertThat(allUsers).extracting(User::getUsername)
                .containsExactlyInAnyOrder("testuser1", "testuser2", "oauthuser");
        }

        @Test
        @DisplayName("Should count all users")
        void shouldCountAllUsers() {
            long count = userRepository.count();
            assertThat(count).isEqualTo(3);
        }
    }

    @Nested
    @DisplayName("Username and Email Operations")
    class UsernameAndEmailOperations {

        @Test
        @DisplayName("Should find user by username")
        void shouldFindUserByUsername() {
            Optional<User> foundUser = userRepository.findByUsername("testuser1");
            
            assertThat(foundUser).isPresent();
            assertThat(foundUser.get().getEmail()).isEqualTo("testuser1@example.com");
        }

        @Test
        @DisplayName("Should find user by email")
        void shouldFindUserByEmail() {
            Optional<User> foundUser = userRepository.findByEmail("testuser2@example.com");
            
            assertThat(foundUser).isPresent();
            assertThat(foundUser.get().getUsername()).isEqualTo("testuser2");
        }

        @Test
        @DisplayName("Should check username existence")
        void shouldCheckUsernameExistence() {
            assertThat(userRepository.existsByUsername("testuser1")).isTrue();
            assertThat(userRepository.existsByUsername("nonexistent")).isFalse();
        }

        @Test
        @DisplayName("Should check email existence")
        void shouldCheckEmailExistence() {
            assertThat(userRepository.existsByEmail("testuser1@example.com")).isTrue();
            assertThat(userRepository.existsByEmail("nonexistent@example.com")).isFalse();
        }

        @Test
        @DisplayName("Should return empty for non-existent username")
        void shouldReturnEmptyForNonExistentUsername() {
            Optional<User> foundUser = userRepository.findByUsername("nonexistent");
            
            assertThat(foundUser).isEmpty();
        }

        @Test
        @DisplayName("Should return empty for non-existent email")
        void shouldReturnEmptyForNonExistentEmail() {
            Optional<User> foundUser = userRepository.findByEmail("nonexistent@example.com");
            
            assertThat(foundUser).isEmpty();
        }

        @Test
        @DisplayName("Should handle case sensitivity for username")
        void shouldHandleCaseSensitivityForUsername() {
            Optional<User> foundUser = userRepository.findByUsername("TESTUSER1");
            
            // Assuming case-sensitive search
            assertThat(foundUser).isEmpty();
        }

        @Test
        @DisplayName("Should handle case sensitivity for email")
        void shouldHandleCaseSensitivityForEmail() {
            Optional<User> foundUser = userRepository.findByEmail("TESTUSER1@EXAMPLE.COM");
            
            // Assuming case-sensitive search
            assertThat(foundUser).isEmpty();
        }
    }

    @Nested
    @DisplayName("OAuth Provider Operations")
    class OAuthProviderOperations {

        @Test
        @DisplayName("Should find user by Google subject")
        void shouldFindUserByGoogleSubject() {
            Optional<User> foundUser = userRepository.findByGoogleSubject("google-123456789");
            
            assertThat(foundUser).isPresent();
            assertThat(foundUser.get().getUsername()).isEqualTo("oauthuser");
        }

        @Test
        @DisplayName("Should find user by Azure subject")
        void shouldFindUserByAzureSubject() {
            Optional<User> foundUser = userRepository.findByAzureSubject("azure-987654321");
            
            assertThat(foundUser).isPresent();
            assertThat(foundUser.get().getUsername()).isEqualTo("oauthuser");
        }

        @Test
        @DisplayName("Should find user by Keycloak subject")
        void shouldFindUserByKeycloakSubject() {
            Optional<User> foundUser = userRepository.findByKeycloakSubject("keycloak-abcdef123");
            
            assertThat(foundUser).isPresent();
            assertThat(foundUser.get().getUsername()).isEqualTo("oauthuser");
        }

        @Test
        @DisplayName("Should find user by MetaMask subject")
        void shouldFindUserByMetaMaskSubject() {
            Optional<User> foundUser = userRepository.findByMetaMaskSubject("metamask-0x123abc");
            
            assertThat(foundUser).isPresent();
            assertThat(foundUser.get().getUsername()).isEqualTo("oauthuser");
        }

        @Test
        @DisplayName("Should return empty for non-existent Google subject")
        void shouldReturnEmptyForNonExistentGoogleSubject() {
            Optional<User> foundUser = userRepository.findByGoogleSubject("nonexistent-google");
            
            assertThat(foundUser).isEmpty();
        }

        @Test
        @DisplayName("Should return empty for non-existent Azure subject")
        void shouldReturnEmptyForNonExistentAzureSubject() {
            Optional<User> foundUser = userRepository.findByAzureSubject("nonexistent-azure");
            
            assertThat(foundUser).isEmpty();
        }

        @Test
        @DisplayName("Should return empty for non-existent Keycloak subject")
        void shouldReturnEmptyForNonExistentKeycloakSubject() {
            Optional<User> foundUser = userRepository.findByKeycloakSubject("nonexistent-keycloak");
            
            assertThat(foundUser).isEmpty();
        }

        @Test
        @DisplayName("Should return empty for non-existent MetaMask subject")
        void shouldReturnEmptyForNonExistentMetaMaskSubject() {
            Optional<User> foundUser = userRepository.findByMetaMaskSubject("nonexistent-metamask");
            
            assertThat(foundUser).isEmpty();
        }
    }

    @Nested
    @DisplayName("Migration Status Operations")
    class MigrationStatusOperations {

        @Test
        @DisplayName("Should find users by migration status")
        void shouldFindUsersByMigrationStatus() {
            List<User> notStartedUsers = userRepository.findByMigrationStatus(MigrationStatus.NOT_STARTED);
            List<User> completedUsers = userRepository.findByMigrationStatus(MigrationStatus.COMPLETED);
            List<User> inProgressUsers = userRepository.findByMigrationStatus(MigrationStatus.IN_PROGRESS);
            
            assertThat(notStartedUsers).hasSize(1);
            assertThat(notStartedUsers.get(0).getUsername()).isEqualTo("testuser1");
            
            assertThat(completedUsers).hasSize(1);
            assertThat(completedUsers.get(0).getUsername()).isEqualTo("testuser2");
            
            assertThat(inProgressUsers).hasSize(1);
            assertThat(inProgressUsers.get(0).getUsername()).isEqualTo("oauthuser");
        }

        @Test
        @DisplayName("Should return empty list for migration status with no users")
        void shouldReturnEmptyListForMigrationStatusWithNoUsers() {
            List<User> failedUsers = userRepository.findByMigrationStatus(MigrationStatus.FAILED);
            
            assertThat(failedUsers).isEmpty();
        }

        @Test
        @DisplayName("Should handle all migration statuses")
        void shouldHandleAllMigrationStatuses() {
            // Create users with all possible migration statuses
            User failedUser = new User();
            failedUser.setUsername("faileduser");
            failedUser.setEmail("failed@example.com");
            failedUser.setMigrationStatus(MigrationStatus.FAILED);
            failedUser.setCreatedAt(LocalDateTime.now());
            failedUser.setUpdatedAt(LocalDateTime.now());

            User conflictUser = new User();
            conflictUser.setUsername("conflictuser");
            conflictUser.setEmail("conflict@example.com");
            conflictUser.setMigrationStatus(MigrationStatus.NEEDS_MANUAL_RESOLUTION);
            conflictUser.setCreatedAt(LocalDateTime.now());
            conflictUser.setUpdatedAt(LocalDateTime.now());

            entityManager.persist(failedUser);
            entityManager.persist(conflictUser);
            entityManager.flush();

            // Test all statuses
            assertThat(userRepository.findByMigrationStatus(MigrationStatus.NOT_STARTED)).hasSize(1);
            assertThat(userRepository.findByMigrationStatus(MigrationStatus.IN_PROGRESS)).hasSize(1);
            assertThat(userRepository.findByMigrationStatus(MigrationStatus.COMPLETED)).hasSize(1);
            assertThat(userRepository.findByMigrationStatus(MigrationStatus.FAILED)).hasSize(1);
            assertThat(userRepository.findByMigrationStatus(MigrationStatus.NEEDS_MANUAL_RESOLUTION)).hasSize(1);
        }
    }

    @Nested
    @DisplayName("Email Conflict Resolution")
    class EmailConflictResolution {

        @Test
        @DisplayName("Should find all users with same email")
        void shouldFindAllUsersWithSameEmail() {
            // Create multiple users with same email
            User duplicateUser1 = new User();
            duplicateUser1.setUsername("duplicate1");
            duplicateUser1.setEmail("duplicate@example.com");
            duplicateUser1.setMigrationStatus(MigrationStatus.NOT_STARTED);
            duplicateUser1.setCreatedAt(LocalDateTime.now());
            duplicateUser1.setUpdatedAt(LocalDateTime.now());

            User duplicateUser2 = new User();
            duplicateUser2.setUsername("duplicate2");
            duplicateUser2.setEmail("duplicate@example.com");
            duplicateUser2.setMigrationStatus(MigrationStatus.COMPLETED);
            duplicateUser2.setCreatedAt(LocalDateTime.now());
            duplicateUser2.setUpdatedAt(LocalDateTime.now());

            entityManager.persist(duplicateUser1);
            entityManager.persist(duplicateUser2);
            entityManager.flush();

            List<User> duplicateUsers = userRepository.findAllByEmail("duplicate@example.com");
            
            assertThat(duplicateUsers).hasSize(2);
            assertThat(duplicateUsers).extracting(User::getUsername)
                .containsExactlyInAnyOrder("duplicate1", "duplicate2");
        }

        @Test
        @DisplayName("Should handle single user with unique email")
        void shouldHandleSingleUserWithUniqueEmail() {
            List<User> users = userRepository.findAllByEmail("testuser1@example.com");
            
            assertThat(users).hasSize(1);
            assertThat(users.get(0).getUsername()).isEqualTo("testuser1");
        }

        @Test
        @DisplayName("Should return empty list for non-existent email")
        void shouldReturnEmptyListForNonExistentEmail() {
            List<User> users = userRepository.findAllByEmail("nonexistent@example.com");
            
            assertThat(users).isEmpty();
        }
    }

    @Nested
    @DisplayName("Data Integrity and Constraints")
    class DataIntegrityAndConstraints {

        @Test
        @DisplayName("Should enforce unique username constraint")
        void shouldEnforceUniqueUsernameConstraint() {
            User duplicateUsernameUser = new User();
            duplicateUsernameUser.setUsername("testuser1"); // Same as existing user
            duplicateUsernameUser.setEmail("different@example.com");
            duplicateUsernameUser.setMigrationStatus(MigrationStatus.NOT_STARTED);
            duplicateUsernameUser.setCreatedAt(LocalDateTime.now());
            duplicateUsernameUser.setUpdatedAt(LocalDateTime.now());

            assertThatThrownBy(() -> {
                userRepository.save(duplicateUsernameUser);
                entityManager.flush();
            }).isInstanceOf(DataIntegrityViolationException.class);
        }

        @Test
        @DisplayName("Should handle null values appropriately")
        void shouldHandleNullValuesAppropriately() {
            User userWithNulls = new User();
            userWithNulls.setUsername("nulltestuser");
            userWithNulls.setEmail("nulltest@example.com");
            userWithNulls.setMigrationStatus(MigrationStatus.NOT_STARTED);
            userWithNulls.setCreatedAt(LocalDateTime.now());
            userWithNulls.setUpdatedAt(LocalDateTime.now());
            // OAuth subjects are null

            User savedUser = userRepository.save(userWithNulls);
            
            assertThat(savedUser.getId()).isNotNull();
            assertThat(savedUser.getGoogleSubject()).isNull();
            assertThat(savedUser.getAzureSubject()).isNull();
            assertThat(savedUser.getKeycloakSubject()).isNull();
            assertThat(savedUser.getMetaMaskSubject()).isNull();
        }

        @Test
        @DisplayName("Should handle very long string values")
        void shouldHandleVeryLongStringValues() {
            User userWithLongValues = new User();
            userWithLongValues.setUsername("a".repeat(255)); // Assuming max length limit
            userWithLongValues.setEmail("verylongemail" + "a".repeat(200) + "@example.com");
            userWithLongValues.setMigrationStatus(MigrationStatus.NOT_STARTED);
            userWithLongValues.setCreatedAt(LocalDateTime.now());
            userWithLongValues.setUpdatedAt(LocalDateTime.now());

            // This should either save successfully or throw a constraint violation
            assertThatCode(() -> {
                userRepository.save(userWithLongValues);
                entityManager.flush();
            }).doesNotThrowAnyException();
        }

        @Test
        @DisplayName("Should handle special characters in username and email")
        void shouldHandleSpecialCharactersInUsernameAndEmail() {
            User specialCharUser = new User();
            specialCharUser.setUsername("user.name-123_test");
            specialCharUser.setEmail("test.email+tag@sub-domain.example.com");
            specialCharUser.setMigrationStatus(MigrationStatus.NOT_STARTED);
            specialCharUser.setCreatedAt(LocalDateTime.now());
            specialCharUser.setUpdatedAt(LocalDateTime.now());

            User savedUser = userRepository.save(specialCharUser);
            
            assertThat(savedUser.getId()).isNotNull();
            assertThat(savedUser.getUsername()).isEqualTo("user.name-123_test");
            assertThat(savedUser.getEmail()).isEqualTo("test.email+tag@sub-domain.example.com");
        }
    }

    @Nested
    @DisplayName("Performance and Edge Cases")
    class PerformanceAndEdgeCases {

        @Test
        @DisplayName("Should handle large result sets")
        void shouldHandleLargeResultSets() {
            // Create many test users
            for (int i = 0; i < 100; i++) {
                User user = new User();
                user.setUsername("perfuser" + i);
                user.setEmail("perfuser" + i + "@example.com");
                user.setMigrationStatus(i % 2 == 0 ? MigrationStatus.COMPLETED : MigrationStatus.NOT_STARTED);
                user.setCreatedAt(LocalDateTime.now());
                user.setUpdatedAt(LocalDateTime.now());
                entityManager.persist(user);
            }
            entityManager.flush();

            List<User> allUsers = userRepository.findAll();
            List<User> completedUsers = userRepository.findByMigrationStatus(MigrationStatus.COMPLETED);
            
            assertThat(allUsers).hasSizeGreaterThanOrEqualTo(100);
            assertThat(completedUsers).hasSizeGreaterThanOrEqualTo(50);
        }

        @Test
        @DisplayName("Should handle empty database scenario")
        void shouldHandleEmptyDatabaseScenario() {
            // Clear all data
            userRepository.deleteAll();
            entityManager.flush();

            assertThat(userRepository.findAll()).isEmpty();
            assertThat(userRepository.findByUsername("anything")).isEmpty();
            assertThat(userRepository.findByEmail("anything@example.com")).isEmpty();
            assertThat(userRepository.findByMigrationStatus(MigrationStatus.COMPLETED)).isEmpty();
        }

        @Test
        @DisplayName("Should handle batch operations efficiently")
        void shouldHandleBatchOperationsEfficiently() {
            // Create multiple users for batch operations
            User batchUser1 = new User();
            batchUser1.setUsername("batch1");
            batchUser1.setEmail("batch1@example.com");
            batchUser1.setMigrationStatus(MigrationStatus.NOT_STARTED);
            batchUser1.setCreatedAt(LocalDateTime.now());
            batchUser1.setUpdatedAt(LocalDateTime.now());

            User batchUser2 = new User();
            batchUser2.setUsername("batch2");
            batchUser2.setEmail("batch2@example.com");
            batchUser2.setMigrationStatus(MigrationStatus.IN_PROGRESS);
            batchUser2.setCreatedAt(LocalDateTime.now());
            batchUser2.setUpdatedAt(LocalDateTime.now());

            List<User> batchUsers = List.of(batchUser1, batchUser2);
            List<User> savedUsers = userRepository.saveAll(batchUsers);
            
            assertThat(savedUsers).hasSize(2);
            assertThat(savedUsers).allMatch(user -> user.getId() != null);
        }
    }

    @Nested
    @DisplayName("Complex Query Scenarios")
    class ComplexQueryScenarios {

        @Test
        @DisplayName("Should handle multiple OAuth providers for same user")
        void shouldHandleMultipleOAuthProvidersForSameUser() {
            // Verify the OAuth user has multiple providers
            assertThat(oauthUser.getGoogleSubject()).isNotNull();
            assertThat(oauthUser.getAzureSubject()).isNotNull();
            assertThat(oauthUser.getKeycloakSubject()).isNotNull();
            assertThat(oauthUser.getMetaMaskSubject()).isNotNull();

            // Should find the same user through different providers
            Optional<User> viaGoogle = userRepository.findByGoogleSubject("google-123456789");
            Optional<User> viaAzure = userRepository.findByAzureSubject("azure-987654321");
            Optional<User> viaKeycloak = userRepository.findByKeycloakSubject("keycloak-abcdef123");
            Optional<User> viaMetaMask = userRepository.findByMetaMaskSubject("metamask-0x123abc");

            assertThat(viaGoogle).isPresent();
            assertThat(viaAzure).isPresent();
            assertThat(viaKeycloak).isPresent();
            assertThat(viaMetaMask).isPresent();

            // All should return the same user
            assertThat(viaGoogle.get().getId()).isEqualTo(oauthUser.getId());
            assertThat(viaAzure.get().getId()).isEqualTo(oauthUser.getId());
            assertThat(viaKeycloak.get().getId()).isEqualTo(oauthUser.getId());
            assertThat(viaMetaMask.get().getId()).isEqualTo(oauthUser.getId());
        }

        @Test
        @DisplayName("Should handle updating OAuth subjects")
        void shouldHandleUpdatingOAuthSubjects() {
            String newGoogleSubject = "new-google-subject-12345";
            
            oauthUser.setGoogleSubject(newGoogleSubject);
            User updatedUser = userRepository.save(oauthUser);
            entityManager.flush();

            // Should find by new subject
            Optional<User> foundByNew = userRepository.findByGoogleSubject(newGoogleSubject);
            assertThat(foundByNew).isPresent();
            assertThat(foundByNew.get().getId()).isEqualTo(oauthUser.getId());

            // Should not find by old subject
            Optional<User> foundByOld = userRepository.findByGoogleSubject("google-123456789");
            assertThat(foundByOld).isEmpty();
        }
    }
}
