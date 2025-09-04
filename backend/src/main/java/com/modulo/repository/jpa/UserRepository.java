package com.modulo.repository.jpa; // Corrected package

import com.modulo.entity.User;
import com.modulo.entity.User.MigrationStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByUsername(String username);
    Optional<User> findByEmail(String email);
    boolean existsByUsername(String username);
    boolean existsByEmail(String email);
    
    // OAuth migration support methods
    
    /**
     * Find user by Google OAuth subject
     */
    Optional<User> findByGoogleSubject(String googleSubject);
    
    /**
     * Find user by Azure OAuth subject
     */
    Optional<User> findByAzureSubject(String azureSubject);
    
    /**
     * Find user by Keycloak subject
     */
    Optional<User> findByKeycloakSubject(String keycloakSubject);
    
    /**
     * Find user by MetaMask subject
     */
    Optional<User> findByMetaMaskSubject(String metaMaskSubject);
    
    /**
     * Find all users with the same email (for conflict resolution)
     */
    List<User> findAllByEmail(String email);
    
    /**
     * Find users by migration status
     */
    List<User> findByMigrationStatus(MigrationStatus migrationStatus);
    
    /**
     * Find users who haven't migrated yet
     */
    @Query("SELECT u FROM User u WHERE u.migrationStatus = :status OR u.migrationStatus IS NULL")
    List<User> findUsersNotMigrated(@Param("status") MigrationStatus status);
    
    /**
     * Find users in dual-auth state for a specific period
     */
    @Query("SELECT u FROM User u WHERE u.migrationStatus = :status AND u.migrationDate < :cutoffDate")
    List<User> findDualAuthUsersBeforeDate(@Param("status") MigrationStatus status, 
                                          @Param("cutoffDate") java.time.LocalDateTime cutoffDate);
    
    /**
     * Count users by migration status
     */
    long countByMigrationStatus(MigrationStatus migrationStatus);
    
    /**
     * Find users with specific primary auth provider
     */
    @Query("SELECT u FROM User u WHERE u.primaryAuthProvider = :provider")
    List<User> findByPrimaryAuthProvider(@Param("provider") User.AuthProvider provider);
    
    /**
     * Find users who have used a specific auth provider
     */
    @Query("SELECT u FROM User u WHERE :provider MEMBER OF u.authProviders")
    List<User> findByAuthProvider(@Param("provider") User.AuthProvider provider);
}