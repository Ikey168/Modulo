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
    
    Optional<Tag> findByName(String name);
    
    @Query("SELECT t FROM Tag t WHERE LOWER(t.name) LIKE LOWER(CONCAT('%', :query, '%'))")
    List<Tag> findByNameContainingIgnoreCase(@Param("query") String query);
    
    @Query("SELECT t FROM Tag t JOIN t.notes n WHERE n.id = :noteId")
    List<Tag> findByNoteId(@Param("noteId") Long noteId);
    
    @Query("SELECT COUNT(n) FROM Tag t JOIN t.notes n WHERE t.id = :tagId")
    Long countNotesByTagId(@Param("tagId") UUID tagId);
}
