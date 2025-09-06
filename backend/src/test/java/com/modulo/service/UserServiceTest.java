package com.modulo.service;

import com.modulo.entity.User;
import com.modulo.plugin.event.PluginEventBus;
import com.modulo.plugin.event.UserEvent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.Authentication;

import javax.persistence.EntityManager;
import javax.persistence.Query;
import javax.persistence.NoResultException;
import java.time.LocalDateTime;
import java.util.*;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("User Service Tests")
class UserServiceTest {

    @Mock
    private EntityManager entityManager;

    @Mock
    private PluginEventBus eventBus;

    @Mock
    private Query query;

    @Mock
    private SecurityContext securityContext;

    @Mock
    private Authentication authentication;

    @InjectMocks
    private UserService userService;

    @Captor
    private ArgumentCaptor<UserEvent> eventCaptor;

    private User testUser;

    @BeforeEach
    void setUp() {
        testUser = new User();
        testUser.setId(1L);
        testUser.setUsername("testuser");
        testUser.setEmail("test@example.com");
        testUser.setPassword("hashedpassword");
        testUser.setFirstName("Test");
        testUser.setLastName("User");
        testUser.setEnabled(true);
        testUser.setCreatedAt(LocalDateTime.now().minusDays(1));
        testUser.setUpdatedAt(LocalDateTime.now());

        // Mock Security Context
        SecurityContextHolder.setContext(securityContext);
        when(securityContext.getAuthentication()).thenReturn(authentication);
        when(authentication.getName()).thenReturn("testuser");
    }

    @Nested
    @DisplayName("Find Operations")
    class FindOperations {

        @Test
        @DisplayName("Should find user by ID successfully")
        void shouldFindUserByIdSuccessfully() {
            // Arrange
            when(entityManager.find(User.class, 1L)).thenReturn(testUser);

            // Act
            Optional<User> result = userService.findById(1L);

            // Assert
            assertThat(result).isPresent();
            assertThat(result.get()).isEqualTo(testUser);
            verify(entityManager).find(User.class, 1L);
        }

        @Test
        @DisplayName("Should return empty when user not found by ID")
        void shouldReturnEmptyWhenUserNotFoundById() {
            // Arrange
            when(entityManager.find(User.class, 999L)).thenReturn(null);

            // Act
            Optional<User> result = userService.findById(999L);

            // Assert
            assertThat(result).isEmpty();
            verify(entityManager).find(User.class, 999L);
        }

        @Test
        @DisplayName("Should handle exception when finding user by ID")
        void shouldHandleExceptionWhenFindingUserById() {
            // Arrange
            when(entityManager.find(User.class, 1L)).thenThrow(new RuntimeException("Database error"));

            // Act
            Optional<User> result = userService.findById(1L);

            // Assert
            assertThat(result).isEmpty();
            verify(entityManager).find(User.class, 1L);
        }

        @Test
        @DisplayName("Should find user by username successfully")
        void shouldFindUserByUsernameSuccessfully() {
            // Arrange
            when(entityManager.createQuery("SELECT u FROM User u WHERE u.username = :username"))
                    .thenReturn(query);
            when(query.setParameter("username", "testuser")).thenReturn(query);
            when(query.getSingleResult()).thenReturn(testUser);

            // Act
            Optional<User> result = userService.findByUsername("testuser");

            // Assert
            assertThat(result).isPresent();
            assertThat(result.get()).isEqualTo(testUser);
            verify(query).setParameter("username", "testuser");
        }

        @Test
        @DisplayName("Should return empty when user not found by username")
        void shouldReturnEmptyWhenUserNotFoundByUsername() {
            // Arrange
            when(entityManager.createQuery("SELECT u FROM User u WHERE u.username = :username"))
                    .thenReturn(query);
            when(query.setParameter("username", "nonexistent")).thenReturn(query);
            when(query.getSingleResult()).thenThrow(new NoResultException());

            // Act
            Optional<User> result = userService.findByUsername("nonexistent");

            // Assert
            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("Should find user by email successfully")
        void shouldFindUserByEmailSuccessfully() {
            // Arrange
            when(entityManager.createQuery("SELECT u FROM User u WHERE u.email = :email"))
                    .thenReturn(query);
            when(query.setParameter("email", "test@example.com")).thenReturn(query);
            when(query.getSingleResult()).thenReturn(testUser);

            // Act
            Optional<User> result = userService.findByEmail("test@example.com");

            // Assert
            assertThat(result).isPresent();
            assertThat(result.get()).isEqualTo(testUser);
            verify(query).setParameter("email", "test@example.com");
        }

        @Test
        @DisplayName("Should return empty when user not found by email")
        void shouldReturnEmptyWhenUserNotFoundByEmail() {
            // Arrange
            when(entityManager.createQuery("SELECT u FROM User u WHERE u.email = :email"))
                    .thenReturn(query);
            when(query.setParameter("email", "nonexistent@example.com")).thenReturn(query);
            when(query.getSingleResult()).thenThrow(new NoResultException());

            // Act
            Optional<User> result = userService.findByEmail("nonexistent@example.com");

            // Assert
            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("Should find all users successfully")
        void shouldFindAllUsersSuccessfully() {
            // Arrange
            List<User> users = Arrays.asList(testUser);
            when(entityManager.createQuery("SELECT u FROM User u ORDER BY u.createdAt DESC"))
                    .thenReturn(query);
            when(query.getResultList()).thenReturn(users);

            // Act
            List<User> result = userService.findAll();

            // Assert
            assertThat(result).hasSize(1);
            assertThat(result.get(0)).isEqualTo(testUser);
        }
    }

    @Nested
    @DisplayName("Save Operations")
    class SaveOperations {

        @Test
        @DisplayName("Should create new user successfully")
        void shouldCreateNewUserSuccessfully() {
            // Arrange
            User newUser = new User();
            newUser.setUsername("newuser");
            newUser.setEmail("new@example.com");
            newUser.setFirstName("New");
            newUser.setLastName("User");

            User savedUser = new User();
            savedUser.setId(2L);
            savedUser.setUsername("newuser");
            savedUser.setEmail("new@example.com");
            savedUser.setFirstName("New");
            savedUser.setLastName("User");
            savedUser.setEnabled(true);
            savedUser.setCreatedAt(LocalDateTime.now());
            savedUser.setUpdatedAt(LocalDateTime.now());

            when(entityManager.merge(any(User.class))).thenReturn(savedUser);

            // Act
            User result = userService.save(newUser);

            // Assert
            assertThat(result).isNotNull();
            assertThat(result.getId()).isEqualTo(2L);
            assertThat(result.getUsername()).isEqualTo("newuser");
            assertThat(result.isEnabled()).isTrue();
            assertThat(result.getCreatedAt()).isNotNull();
            assertThat(result.getUpdatedAt()).isNotNull();

            verify(entityManager).merge(any(User.class));
            verify(entityManager).flush();
            verify(eventBus).publishAsync(any(UserEvent.UserCreated.class));
        }

        @Test
        @DisplayName("Should update existing user successfully")
        void shouldUpdateExistingUserSuccessfully() {
            // Arrange
            User existingUser = new User();
            existingUser.setId(1L);
            existingUser.setUsername("testuser");
            existingUser.setEmail("old@example.com");
            existingUser.setFirstName("Old");
            existingUser.setLastName("Name");

            User updatedUser = new User();
            updatedUser.setId(1L);
            updatedUser.setUsername("testuser");
            updatedUser.setEmail("new@example.com");
            updatedUser.setFirstName("New");
            updatedUser.setLastName("Name");

            when(entityManager.find(User.class, 1L)).thenReturn(existingUser);
            when(entityManager.merge(any(User.class))).thenReturn(updatedUser);

            // Act
            User result = userService.save(updatedUser);

            // Assert
            assertThat(result).isNotNull();
            assertThat(result.getEmail()).isEqualTo("new@example.com");
            assertThat(result.getFirstName()).isEqualTo("New");
            assertThat(result.getUpdatedAt()).isNotNull();

            verify(entityManager).find(User.class, 1L);
            verify(entityManager).merge(any(User.class));
            verify(entityManager).flush();
            verify(eventBus).publishAsync(any(UserEvent.UserUpdated.class));
        }

        @Test
        @DisplayName("Should set default values on new user creation")
        void shouldSetDefaultValuesOnNewUserCreation() {
            // Arrange
            User newUser = new User();
            newUser.setUsername("testuser");
            newUser.setEmail("test@example.com");

            when(entityManager.merge(any(User.class))).thenAnswer(invocation -> {
                User user = invocation.getArgument(0);
                user.setId(1L);
                return user;
            });

            // Act
            User result = userService.save(newUser);

            // Assert
            assertThat(result.getCreatedAt()).isNotNull();
            assertThat(result.getUpdatedAt()).isNotNull();
            assertThat(result.isEnabled()).isTrue();
        }
    }

    @Nested
    @DisplayName("Delete Operations")
    class DeleteOperations {

        @Test
        @DisplayName("Should delete user successfully")
        void shouldDeleteUserSuccessfully() {
            // Arrange
            when(entityManager.find(User.class, 1L)).thenReturn(testUser);

            // Act
            userService.deleteById(1L);

            // Assert
            verify(entityManager).find(User.class, 1L);
            verify(entityManager).remove(testUser);
            verify(entityManager).flush();
            verify(eventBus).publishAsync(any(UserEvent.UserDeleted.class));
        }

        @Test
        @DisplayName("Should handle delete of non-existent user gracefully")
        void shouldHandleDeleteOfNonExistentUserGracefully() {
            // Arrange
            when(entityManager.find(User.class, 999L)).thenReturn(null);

            // Act
            userService.deleteById(999L);

            // Assert
            verify(entityManager).find(User.class, 999L);
            verify(entityManager, never()).remove(any());
            verify(eventBus, never()).publishAsync(any());
        }
    }

    @Nested
    @DisplayName("Validation Operations")
    class ValidationOperations {

        @Test
        @DisplayName("Should check if username exists")
        void shouldCheckIfUsernameExists() {
            // Arrange
            when(entityManager.createQuery("SELECT COUNT(u) FROM User u WHERE u.username = :username"))
                    .thenReturn(query);
            when(query.setParameter("username", "testuser")).thenReturn(query);
            when(query.getSingleResult()).thenReturn(1L);

            // Act
            boolean result = userService.existsByUsername("testuser");

            // Assert
            assertThat(result).isTrue();
            verify(query).setParameter("username", "testuser");
        }

        @Test
        @DisplayName("Should return false for non-existent username")
        void shouldReturnFalseForNonExistentUsername() {
            // Arrange
            when(entityManager.createQuery("SELECT COUNT(u) FROM User u WHERE u.username = :username"))
                    .thenReturn(query);
            when(query.setParameter("username", "nonexistent")).thenReturn(query);
            when(query.getSingleResult()).thenReturn(0L);

            // Act
            boolean result = userService.existsByUsername("nonexistent");

            // Assert
            assertThat(result).isFalse();
        }

        @Test
        @DisplayName("Should check if email exists")
        void shouldCheckIfEmailExists() {
            // Arrange
            when(entityManager.createQuery("SELECT COUNT(u) FROM User u WHERE u.email = :email"))
                    .thenReturn(query);
            when(query.setParameter("email", "test@example.com")).thenReturn(query);
            when(query.getSingleResult()).thenReturn(1L);

            // Act
            boolean result = userService.existsByEmail("test@example.com");

            // Assert
            assertThat(result).isTrue();
            verify(query).setParameter("email", "test@example.com");
        }

        @Test
        @DisplayName("Should return false for non-existent email")
        void shouldReturnFalseForNonExistentEmail() {
            // Arrange
            when(entityManager.createQuery("SELECT COUNT(u) FROM User u WHERE u.email = :email"))
                    .thenReturn(query);
            when(query.setParameter("email", "nonexistent@example.com")).thenReturn(query);
            when(query.getSingleResult()).thenReturn(0L);

            // Act
            boolean result = userService.existsByEmail("nonexistent@example.com");

            // Assert
            assertThat(result).isFalse();
        }
    }

    @Nested
    @DisplayName("User Status Operations")
    class UserStatusOperations {

        @Test
        @DisplayName("Should enable user successfully")
        void shouldEnableUserSuccessfully() {
            // Arrange
            testUser.setEnabled(false);
            when(entityManager.find(User.class, 1L)).thenReturn(testUser);
            when(entityManager.merge(any(User.class))).thenReturn(testUser);

            // Act
            userService.enableUser(1L);

            // Assert
            assertThat(testUser.isEnabled()).isTrue();
            verify(entityManager).merge(testUser);
            verify(entityManager).flush();
        }

        @Test
        @DisplayName("Should disable user successfully")
        void shouldDisableUserSuccessfully() {
            // Arrange
            testUser.setEnabled(true);
            when(entityManager.find(User.class, 1L)).thenReturn(testUser);
            when(entityManager.merge(any(User.class))).thenReturn(testUser);

            // Act
            userService.disableUser(1L);

            // Assert
            assertThat(testUser.isEnabled()).isFalse();
            verify(entityManager).merge(testUser);
            verify(entityManager).flush();
        }

        @Test
        @DisplayName("Should handle enable/disable of non-existent user")
        void shouldHandleEnableDisableOfNonExistentUser() {
            // Arrange
            when(entityManager.find(User.class, 999L)).thenReturn(null);

            // Act & Assert
            assertThatThrownBy(() -> userService.enableUser(999L))
                    .isInstanceOf(RuntimeException.class);

            assertThatThrownBy(() -> userService.disableUser(999L))
                    .isInstanceOf(RuntimeException.class);
        }
    }

    @Nested
    @DisplayName("Search Operations")
    class SearchOperations {

        @Test
        @DisplayName("Should search users by keyword")
        void shouldSearchUsersByKeyword() {
            // Arrange
            List<User> users = Arrays.asList(testUser);
            when(entityManager.createQuery(anyString())).thenReturn(query);
            when(query.setParameter(anyString(), any())).thenReturn(query);
            when(query.setFirstResult(anyInt())).thenReturn(query);
            when(query.setMaxResults(anyInt())).thenReturn(query);
            when(query.getResultList()).thenReturn(users);

            // Act
            List<User> result = userService.searchUsers("test", 10, 0);

            // Assert
            assertThat(result).hasSize(1);
            assertThat(result.get(0)).isEqualTo(testUser);
            verify(query).setParameter("keyword", "%test%");
            verify(query).setFirstResult(0);
            verify(query).setMaxResults(10);
        }

        @Test
        @DisplayName("Should return empty list for empty search")
        void shouldReturnEmptyListForEmptySearch() {
            // Arrange
            when(entityManager.createQuery(anyString())).thenReturn(query);
            when(query.setParameter(anyString(), any())).thenReturn(query);
            when(query.setFirstResult(anyInt())).thenReturn(query);
            when(query.setMaxResults(anyInt())).thenReturn(query);
            when(query.getResultList()).thenReturn(Collections.emptyList());

            // Act
            List<User> result = userService.searchUsers("nonexistent", 10, 0);

            // Assert
            assertThat(result).isEmpty();
        }
    }

    @Nested
    @DisplayName("Error Handling")
    class ErrorHandling {

        @Test
        @DisplayName("Should handle null inputs gracefully")
        void shouldHandleNullInputsGracefully() {
            // Test null user save
            assertThatThrownBy(() -> userService.save(null))
                    .isInstanceOf(Exception.class);

            // Test null ID find
            Optional<User> result = userService.findById(null);
            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("Should handle database exceptions during save")
        void shouldHandleDatabaseExceptionsDuringSave() {
            // Arrange
            User newUser = new User();
            newUser.setUsername("test");
            when(entityManager.merge(any(User.class))).thenThrow(new RuntimeException("DB Error"));

            // Act & Assert
            assertThatThrownBy(() -> userService.save(newUser))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessage("DB Error");
        }
    }

    @Nested
    @DisplayName("Event Publishing")
    class EventPublishing {

        @Test
        @DisplayName("Should publish UserCreated event on new user")
        void shouldPublishUserCreatedEventOnNewUser() {
            // Arrange
            User newUser = new User();
            newUser.setUsername("eventuser");
            when(entityManager.merge(any(User.class))).thenReturn(testUser);

            // Act
            userService.save(newUser);

            // Assert
            verify(eventBus).publishAsync(eventCaptor.capture());
            UserEvent capturedEvent = eventCaptor.getValue();
            assertThat(capturedEvent).isInstanceOf(UserEvent.UserCreated.class);
        }

        @Test
        @DisplayName("Should publish UserUpdated event on existing user")
        void shouldPublishUserUpdatedEventOnExistingUser() {
            // Arrange
            testUser.setEmail("updated@example.com");
            when(entityManager.find(User.class, 1L)).thenReturn(testUser);
            when(entityManager.merge(any(User.class))).thenReturn(testUser);

            // Act
            userService.save(testUser);

            // Assert
            verify(eventBus).publishAsync(eventCaptor.capture());
            UserEvent capturedEvent = eventCaptor.getValue();
            assertThat(capturedEvent).isInstanceOf(UserEvent.UserUpdated.class);
        }

        @Test
        @DisplayName("Should publish UserDeleted event on deletion")
        void shouldPublishUserDeletedEventOnDeletion() {
            // Arrange
            when(entityManager.find(User.class, 1L)).thenReturn(testUser);

            // Act
            userService.deleteById(1L);

            // Assert
            verify(eventBus).publishAsync(eventCaptor.capture());
            UserEvent capturedEvent = eventCaptor.getValue();
            assertThat(capturedEvent).isInstanceOf(UserEvent.UserDeleted.class);
        }
    }
}
