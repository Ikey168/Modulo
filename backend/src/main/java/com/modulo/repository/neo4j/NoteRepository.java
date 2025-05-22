/*
package com.modulo.repository.neo4j;

import com.modulo.entity.Note;
import org.springframework.data.neo4j.repository.Neo4jRepository;
import org.springframework.data.neo4j.repository.query.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface NoteRepository extends Neo4jRepository<Note, Long> { // Changed ID type back to Long

    @Query("MATCH (n:Note {id: $noteId}) RETURN n")
    Optional<Note> findByIdCustom(Long noteId); // Changed parameter to Long

    @Query("MATCH (n:Note) RETURN n")
    List<Note> findAllCustom();

    // saveCustom might not be needed if using standard save, but ensure consistency if kept
    // For now, assuming standard save() is sufficient and removing saveCustom to simplify
    // @Query("CREATE (n:Note {id: $note.id, title: $note.title, content: $note.content}) RETURN n")
    // Note saveCustom(Note note);

    @Query("MATCH (n:Note {id: $noteId}) DELETE n")
    void deleteByIdCustom(Long noteId); // Changed parameter to Long
}
*/