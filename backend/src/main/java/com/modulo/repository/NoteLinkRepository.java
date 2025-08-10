package com.modulo.repository;

import com.modulo.entity.Note;
import com.modulo.entity.NoteLink;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface NoteLinkRepository extends JpaRepository<NoteLink, UUID> {
    
    @Query("SELECT nl FROM NoteLink nl WHERE nl.sourceNote = :note OR nl.targetNote = :note")
    List<NoteLink> findBySourceNoteOrTargetNote(@Param("note") Note note);
    
    @Query("SELECT nl FROM NoteLink nl WHERE nl.sourceNote.id = :noteId")
    List<NoteLink> findBySourceNoteId(@Param("noteId") Long noteId);
    
    @Query("SELECT nl FROM NoteLink nl WHERE nl.targetNote.id = :noteId")
    List<NoteLink> findByTargetNoteId(@Param("noteId") Long noteId);
    
    @Query("SELECT nl FROM NoteLink nl WHERE nl.sourceNote.id = :sourceId AND nl.targetNote.id = :targetId")
    List<NoteLink> findBySourceNoteIdAndTargetNoteId(@Param("sourceId") Long sourceId, @Param("targetId") Long targetId);
    
    @Query("SELECT nl FROM NoteLink nl WHERE nl.linkType = :linkType")
    List<NoteLink> findByLinkType(@Param("linkType") String linkType);
}
