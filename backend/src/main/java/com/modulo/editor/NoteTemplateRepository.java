package com.modulo.editor;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NoteTemplateRepository extends JpaRepository<NoteTemplate, Long> {
    List<NoteTemplate> findByOwnerIdIsNullOrOwnerIdOrderByNameAsc(String ownerId);
    List<NoteTemplate> findAllByOrderByNameAsc();
}
