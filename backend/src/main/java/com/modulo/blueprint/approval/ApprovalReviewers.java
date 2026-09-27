package com.modulo.blueprint.approval;

import static com.modulo.blueprint.approval.ApprovalErrors.unavailable;

import java.util.Map;
import java.util.Objects;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Reviewer authorization: the Blueprint's {@code approval:request} capability, the owner's
 * explicit reviewer grants (delegation of review to another user) and the checks a reviewer must
 * pass before deciding.
 */
final class ApprovalReviewers {
  private final JdbcTemplate jdbc;

  ApprovalReviewers(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  /** The Blueprint must hold a granted {@code approval:request} permission. */
  void requireCapability(Object blueprint) {
    var grants =
        jdbc.queryForList(
            "SELECT granted FROM plugin_permissions WHERE plugin_id=? AND"
                + " permission='approval:request' FOR SHARE",
            Boolean.class,
            blueprint);
    if (grants.isEmpty() || !Boolean.TRUE.equals(grants.get(0))) throw unavailable();
  }

  /**
   * Record the reviewer named in the persisted node configuration as the initial explicit
   * selection and require an enabled grant. An existing revocation is never overwritten by
   * execution.
   */
  void selectReviewer(Object blueprint, long owner, long reviewer) {
    if (jdbc.queryForList("SELECT id FROM users WHERE id=?", Long.class, reviewer).isEmpty())
      throw unavailable();
    jdbc.update(
        "INSERT INTO approval_grants(blueprint_id,owner_id,approver_id) VALUES (?,?,?) ON"
            + " CONFLICT DO NOTHING",
        blueprint,
        owner,
        reviewer);
    if (!granted(blueprint, owner, reviewer)) throw unavailable();
  }

  /** Only the named, still-granted reviewer, never the owner, may decide. */
  void authorizeDecision(Map<String, Object> approval, long owner, long actor) {
    if (!Objects.equals(approval.get("approver_ref"), Long.toString(actor))
        || actor == owner
        || !granted(approval.get("blueprint_id"), owner, actor)) throw unavailable();
  }

  boolean granted(Object blueprint, long owner, long reviewer) {
    return !jdbc.queryForList(
            "SELECT g.approver_id FROM approval_grants g JOIN users u ON u.id=g.approver_id WHERE"
                + " g.blueprint_id=? AND g.owner_id=? AND g.approver_id=? AND g.enabled FOR SHARE"
                + " OF g",
            Long.class,
            blueprint,
            owner,
            reviewer)
        .isEmpty();
  }

  /** Enable or revoke a reviewer for one of the owner's Blueprints. */
  void grant(long owner, long blueprint, long reviewer, boolean enabled) {
    if (owner == reviewer || reviewer < 1) throw unavailable();
    if (jdbc.update(
            "INSERT INTO approval_grants(blueprint_id,owner_id,approver_id,enabled) SELECT"
                + " p.id,p.owner_id,u.id,? FROM plugin_registry p JOIN users u ON u.id=? WHERE"
                + " p.id=? AND p.owner_id=? AND p.runtime='BLUEPRINT' ON"
                + " CONFLICT(blueprint_id,approver_id) DO UPDATE SET enabled=EXCLUDED.enabled",
            enabled,
            reviewer,
            blueprint,
            owner)
        != 1) throw unavailable();
  }
}
