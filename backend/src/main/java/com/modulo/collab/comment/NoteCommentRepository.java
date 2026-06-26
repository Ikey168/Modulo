package com.modulo.collab.comment;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NoteCommentRepository extends JpaRepository<NoteComment, Long> {
    List<NoteComment> findByNoteIdOrderByCreatedAtAsc(Long noteId);
    List<NoteComment> findByNoteIdAndParentIdIsNullOrderByCreatedAtAsc(Long noteId);
    void deleteAllByNoteId(Long noteId);
}
