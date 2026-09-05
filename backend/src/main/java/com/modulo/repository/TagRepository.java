package com.modulo.repository;

import com.modulo.entity.Tag;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TagRepository extends JpaRepository<Tag, UUID> {
    @Override
    @Query("SELECT t FROM Tag t WHERE t.userId = :#{tenant.ownerId}")
    List<Tag> findAll();
    @Override
    @Query("SELECT t FROM Tag t WHERE t.id = :id AND t.userId = :#{tenant.ownerId}")
    Optional<Tag> findById(@Param("id") UUID id);

    
    @Query("SELECT t FROM Tag t WHERE t.name = :name AND t.userId = :#{tenant.ownerId}")
    Optional<Tag> findByName(@Param("name") String name);
    
    @Query("SELECT t FROM Tag t WHERE t.userId = :#{tenant.ownerId} AND LOWER(t.name) LIKE LOWER(CONCAT('%', :query, '%'))")
    List<Tag> findByNameContainingIgnoreCase(@Param("query") String query);
    
    @Query("SELECT t FROM Tag t JOIN t.notes n WHERE n.id = :noteId AND t.userId = :#{tenant.ownerId} AND n.userId = :#{tenant.ownerId}")
    List<Tag> findByNoteId(@Param("noteId") Long noteId);
    
    @Query("SELECT COUNT(n) FROM Tag t JOIN t.notes n WHERE t.id = :tagId AND t.userId = :#{tenant.ownerId} AND n.userId = :#{tenant.ownerId}")
    Long countNotesByTagId(@Param("tagId") UUID tagId);
}
