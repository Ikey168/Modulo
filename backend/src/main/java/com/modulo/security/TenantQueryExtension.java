package com.modulo.security;

import org.springframework.data.spel.spi.EvaluationContextExtension;
import org.springframework.stereotype.Component;

/** Repository queries resolve the owner at execution time, including cache and background callers. */
@Component
public class TenantQueryExtension implements EvaluationContextExtension {
    private final AuthenticatedUserService users;
    public TenantQueryExtension(AuthenticatedUserService users) { this.users = users; }
    @Override public String getExtensionId() { return "tenant"; }
    @Override public Scope getRootObject() { return new Scope(users); }
    public static final class Scope {
        private final AuthenticatedUserService users;
        public Scope(AuthenticatedUserService users) { this.users = users; }
        public long getOwnerId() { return users.requireUserId(); }
    }
}
