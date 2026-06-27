package com.modulo.sharing;

import java.time.Instant;

public record ShareTokenDto(
    Long id,
    Long noteId,
    String token,
    String ownerId,
    Instant expiresAt,
    boolean hasPassword,
    boolean revoked,
    boolean active,
    Instant createdAt,
    String shareUrl
) {
    static ShareTokenDto from(ShareToken t) {
        return new ShareTokenDto(
            t.getId(),
            t.getNoteId(),
            t.getToken(),
            t.getOwnerId(),
            t.getExpiresAt(),
            t.getPasswordHash() != null,
            t.isRevoked(),
            t.isActive(),
            t.getCreatedAt(),
            "/api/s/" + t.getToken()
        );
    }
}
