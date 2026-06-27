package com.modulo.sharing;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ShareTokenRepository extends JpaRepository<ShareToken, Long> {

    Optional<ShareToken> findByToken(String token);

    List<ShareToken> findByNoteIdAndRevokedFalseOrderByCreatedAtDesc(Long noteId);

    List<ShareToken> findByNoteIdOrderByCreatedAtDesc(Long noteId);

    List<ShareToken> findByOwnerIdOrderByCreatedAtDesc(String ownerId);
}
