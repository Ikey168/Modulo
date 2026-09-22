package com.modulo.security;

import java.security.Principal;
import java.time.Instant;

/** Server-created principal; neither the name nor the lifetime comes from a STOMP user header. */
public final class OwnedSocketPrincipal implements Principal {
    private final long ownerId;
    private final Instant expiresAt;
    public OwnedSocketPrincipal(long ownerId, Instant expiresAt) { this.ownerId = ownerId; this.expiresAt = expiresAt; }
    public long ownerId() { return ownerId; }
    public boolean expired() { return expiresAt == null || !Instant.now().isBefore(expiresAt); }
    @Override public String getName() { return Long.toString(ownerId); }
}
