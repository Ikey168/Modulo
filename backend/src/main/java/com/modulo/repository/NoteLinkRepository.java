package com.modulo.repository;

import com.modulo.entity.NoteLink;
import org.springframework.data.neo4j.repository.Neo4jRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface NoteLinkRepository extends Neo4jRepository<NoteLink, Long> {
}