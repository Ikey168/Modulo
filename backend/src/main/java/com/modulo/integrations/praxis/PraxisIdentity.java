package com.modulo.integrations.praxis;

import com.modulo.security.AuthenticatedUserService;
import org.springframework.stereotype.Component;

/**
 * The identity Modulo asserts to Praxis in {@code X-Praxis-On-Behalf-Of}.
 *
 * <p>Praxis trusts this header from Modulo, so it comes only from the verified session
 * through {@link AuthenticatedUserService}; nothing from a request body, parameter or
 * header can influence it. It is the persisted account id rather than a username or
 * email, because Praxis ties process ownership to it: a renamed account keeps its
 * processes. Praxis audits actions as {@code modulo/user-<id>}.
 */
@Component
public class PraxisIdentity {
  private final AuthenticatedUserService users;

  public PraxisIdentity(AuthenticatedUserService users) {
    this.users = users;
  }

  /** Owner id and delegated principal of the signed-in user. */
  public Principal current() {
    long id = users.requireUserId();
    return new Principal(id, "user-" + id);
  }

  public record Principal(long ownerId, String onBehalfOf) {}
}
