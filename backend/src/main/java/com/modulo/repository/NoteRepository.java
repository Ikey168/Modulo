package com.modulo.repository;

import com.modulo.entity.Note;
import org.springframework.data.neo4j.repository.Neo4jRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface NoteRepository extends Neo4jRepository<Note, Long> {
}