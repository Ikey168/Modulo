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
@org.springframework.context.annotation.Primary
public interface NoteRepository extends JpaRepository<Note, Long> {
    Optional<Note> findByIdAndUserId(Long id, Long userId);
    @Override
    @Query("SELECT DISTINCT n FROM Note n LEFT JOIN FETCH n.tags WHERE n.id IN :ids AND n.userId = :#{tenant.ownerId}")
    List<Note> findAllById(@Param("ids") Iterable<Long> ids);
    @Override
    @Query("SELECT COUNT(n) FROM Note n WHERE n.userId = :#{tenant.ownerId}")
    long count();

    @Override
    @Query("SELECT n FROM Note n LEFT JOIN FETCH n.tags WHERE n.id = :id AND n.userId = :#{tenant.ownerId}")
    Optional<Note> findById(@Param("id") Long id);

    @Override
    @Query("SELECT DISTINCT n FROM Note n LEFT JOIN FETCH n.tags WHERE n.userId = :#{tenant.ownerId}")
    List<Note> findAll();

    @Override
    @Query("SELECT COUNT(n) > 0 FROM Note n WHERE n.id = :id AND n.userId = :#{tenant.ownerId}")
    boolean existsById(@Param("id") Long id);


    @Query("SELECT DISTINCT n FROM Note n JOIN n.tags t LEFT JOIN FETCH n.tags WHERE n.userId = :#{tenant.ownerId} AND t = :tag")
    List<Note> findByTag(@Param("tag") Tag tag);

    @Query("SELECT DISTINCT n FROM Note n JOIN n.tags t LEFT JOIN FETCH n.tags WHERE n.userId = :#{tenant.ownerId} AND t.name = :tagName")
    List<Note> findByTagName(@Param("tagName") String tagName);

    @Query("SELECT DISTINCT n FROM Note n LEFT JOIN FETCH n.tags WHERE n.userId = :#{tenant.ownerId} AND (LOWER(n.title) LIKE LOWER(CONCAT('%', :query, '%')) OR LOWER(n.content) LIKE LOWER(CONCAT('%', :query, '%')))")
    List<Note> findByTitleOrContentContainingIgnoreCase(@Param("query") String query);

    @Query("SELECT DISTINCT n FROM Note n LEFT JOIN FETCH n.tags WHERE n.userId = :#{tenant.ownerId}")
    List<Note> findAllWithTags();

    // Fetch-join tags so the note can be serialized after the Hibernate session
    // closes (open-in-view=false) without a LazyInitializationException.
    @Query("SELECT n FROM Note n LEFT JOIN FETCH n.tags WHERE n.id = :id AND n.userId = :#{tenant.ownerId}")
    Optional<Note> findByIdWithTags(@Param("id") Long id);
}
