package com.modulo.repository;

import com.modulo.entity.Note;
import com.modulo.entity.Tag;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface NoteRepository extends JpaRepository<Note, Long> {

    @Query("SELECT DISTINCT n FROM Note n JOIN n.tags t LEFT JOIN FETCH n.tags WHERE t = :tag")
    List<Note> findByTag(@Param("tag") Tag tag);

    @Query("SELECT DISTINCT n FROM Note n JOIN n.tags t LEFT JOIN FETCH n.tags WHERE t.name = :tagName")
    List<Note> findByTagName(@Param("tagName") String tagName);

    @Query("SELECT DISTINCT n FROM Note n LEFT JOIN FETCH n.tags WHERE LOWER(n.title) LIKE LOWER(CONCAT('%', :query, '%')) OR LOWER(n.content) LIKE LOWER(CONCAT('%', :query, '%'))")
    List<Note> findByTitleOrContentContainingIgnoreCase(@Param("query") String query);

    @Query("SELECT DISTINCT n FROM Note n LEFT JOIN FETCH n.tags")
    List<Note> findAllWithTags();

    // Fetch-join tags so the note can be serialized after the Hibernate session
    // closes (open-in-view=false) without a LazyInitializationException.
    @Query("SELECT n FROM Note n LEFT JOIN FETCH n.tags WHERE n.id = :id")
    Optional<Note> findByIdWithTags(@Param("id") Long id);
}
