package com.modulo.service;

import com.modulo.entity.User;
import com.modulo.plugin.event.PluginEventBus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import javax.persistence.EntityManager;
import javax.persistence.NoResultException;
import javax.persistence.Query;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("User Service Tests")
class UserServiceTest {

    @Mock
    private EntityManager entityManager;

    @Mock
    private PluginEventBus eventBus;

    @InjectMocks
    private UserService userService;

    private User user;

    @BeforeEach
    void setUp() {
        user = new User();
        user.setId(1L);
        user.setUsername("testuser");
        user.setEmail("test@example.com");
    }

    private Query mockQueryReturning(Object result) {
        Query query = mock(Query.class);
        when(entityManager.createQuery(anyString())).thenReturn(query);
        when(query.setParameter(anyString(), any())).thenReturn(query);
        when(query.getSingleResult()).thenReturn(result);
        return query;
    }

    @Test
    @DisplayName("findById returns user when present")
    void findByIdFound() {
        when(entityManager.find(User.class, 1L)).thenReturn(user);

        assertThat(userService.findById(1L)).containsSame(user);
    }

    @Test
    @DisplayName("findById returns empty on lookup failure")
    void findByIdError() {
        when(entityManager.find(User.class, 2L)).thenThrow(new RuntimeException("boom"));

        assertThat(userService.findById(2L)).isEmpty();
    }

    @Test
    @DisplayName("findByUsername returns user when present")
    void findByUsernameFound() {
        mockQueryReturning(user);

        assertThat(userService.findByUsername("testuser")).containsSame(user);
    }

    @Test
    @DisplayName("findByUsername returns empty when no result")
    void findByUsernameNotFound() {
        Query query = mock(Query.class);
        when(entityManager.createQuery(anyString())).thenReturn(query);
        when(query.setParameter(anyString(), any())).thenReturn(query);
        when(query.getSingleResult()).thenThrow(new NoResultException());

        assertThat(userService.findByUsername("missing")).isEmpty();
    }

    @Test
    @DisplayName("findByEmail returns user when present")
    void findByEmailFound() {
        mockQueryReturning(user);

        assertThat(userService.findByEmail("test@example.com")).containsSame(user);
    }

    @Test
    @DisplayName("save persists new user and publishes event")
    void saveNewUser() {
        User fresh = new User();
        fresh.setUsername("new");
        when(entityManager.merge(fresh)).thenReturn(fresh);

        User saved = userService.save(fresh);

        assertThat(saved.getCreatedAt()).isNotNull();
        assertThat(saved.getUpdatedAt()).isNotNull();
        verify(entityManager).merge(fresh);
        verify(entityManager).flush();
        verify(eventBus).publishAsync(any());
    }

    @Test
    @DisplayName("save updates existing user without registration event")
    void saveExistingUser() {
        when(entityManager.merge(user)).thenReturn(user);

        User saved = userService.save(user);

        assertThat(saved.getUpdatedAt()).isNotNull();
        verify(eventBus, never()).publishAsync(any());
    }

    @Test
    @DisplayName("updateProfile applies field updates")
    void updateProfileApplies() {
        when(entityManager.find(User.class, 1L)).thenReturn(user);
        when(entityManager.merge(user)).thenReturn(user);
        Map<String, Object> updates = new HashMap<>();
        updates.put("firstName", "Jane");
        updates.put("email", "jane@example.com");

        User result = userService.updateProfile(1L, updates);

        assertThat(result.getFirstName()).isEqualTo("Jane");
        assertThat(result.getEmail()).isEqualTo("jane@example.com");
        verify(eventBus).publishAsync(any());
    }

    @Test
    @DisplayName("updateProfile throws when user missing")
    void updateProfileMissing() {
        when(entityManager.find(User.class, 9L)).thenReturn(null);

        assertThatThrownBy(() -> userService.updateProfile(9L, Map.of("firstName", "X")))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("not found");
    }

    @Test
    @DisplayName("addCustomAttribute stores the value")
    void addCustomAttribute() {
        when(entityManager.find(User.class, 1L)).thenReturn(user);

        userService.addCustomAttribute(1L, "theme", "dark");

        assertThat(user.getCustomAttributes()).containsEntry("theme", "dark");
        verify(entityManager).merge(user);
    }

    @Test
    @DisplayName("getCustomAttribute returns stored value")
    void getCustomAttribute() {
        user.setCustomAttributes(new HashMap<>(Map.of("theme", "dark")));
        when(entityManager.find(User.class, 1L)).thenReturn(user);

        assertThat(userService.getCustomAttribute(1L, "theme")).isEqualTo("dark");
    }

    @Test
    @DisplayName("removeCustomAttribute deletes the key")
    void removeCustomAttribute() {
        user.setCustomAttributes(new HashMap<>(Map.of("theme", "dark")));
        when(entityManager.find(User.class, 1L)).thenReturn(user);

        userService.removeCustomAttribute(1L, "theme");

        assertThat(user.getCustomAttributes()).doesNotContainKey("theme");
        verify(entityManager).merge(user);
    }

    @Test
    @DisplayName("canAccessNote is true when count > 0")
    void canAccessNoteTrue() {
        mockQueryReturning(1L);

        assertThat(userService.canAccessNote(1L, 5L)).isTrue();
    }

    @Test
    @DisplayName("canAccessNote is false when count == 0")
    void canAccessNoteFalse() {
        mockQueryReturning(0L);

        assertThat(userService.canAccessNote(1L, 5L)).isFalse();
    }

    @Test
    @DisplayName("getUserPreferences returns a copy of preferences")
    void getUserPreferences() {
        user.setPreferences(new HashMap<>(Map.of("lang", "en")));
        when(entityManager.find(User.class, 1L)).thenReturn(user);

        Map<String, Object> prefs = userService.getUserPreferences(1L);

        assertThat(prefs).containsEntry("lang", "en");
    }

    @Test
    @DisplayName("getUserPreferences returns empty map when none set")
    void getUserPreferencesEmpty() {
        user.setPreferences(null);
        when(entityManager.find(User.class, 1L)).thenReturn(user);

        assertThat(userService.getUserPreferences(1L)).isEmpty();
    }
}
