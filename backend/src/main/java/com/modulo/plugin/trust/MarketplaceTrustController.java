package com.modulo.plugin.trust;

import com.modulo.security.AuthenticatedUserService;
import java.util.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/marketplace/trust")
@PreAuthorize("isAuthenticated()")
public class MarketplaceTrustController {
  private final MarketplaceTrustService trust; private final AuthenticatedUserService users;
  public MarketplaceTrustController(MarketplaceTrustService trust,AuthenticatedUserService users){this.trust=trust;this.users=users;}
  @GetMapping("/plugins/{plugin}/releases") public Object releases(@PathVariable String plugin){return trust.releases(plugin);}
  @GetMapping("/releases/{id}") public Object detail(@PathVariable UUID id){return trust.detail(id);}
  @GetMapping("/releases/{id}/evidence-history") public Object evidenceHistory(@PathVariable UUID id){return trust.evidenceHistory(id);}
  @PostMapping("/releases/{id}/recheck") public Object recheck(@PathVariable UUID id){return trust.verifyRelease(id);}
  @PostMapping("/releases/{id}/install-check") public Object installCheck(@PathVariable UUID id){return trust.installCheck(id);}
  @GetMapping("/diff") public Object diff(@RequestParam UUID from,@RequestParam UUID to){return trust.permissionDiff(from,to);}
  public record Upgrade(UUID from,UUID to,boolean consented){}
  public record Install(UUID release,boolean consented){}
  public record Deployment(UUID release,String outcome){}
  @PostMapping("/plugins/{plugin}/deployment") @PreAuthorize("hasRole('ADMIN')") public Object deployment(@PathVariable String plugin,@RequestBody Deployment body){return Map.of("operation",trust.recordDeployment(plugin,body.release(),body.outcome()));}
  @PostMapping("/plugins/{plugin}/install") public Object install(@PathVariable String plugin,@RequestBody Install body){return Map.of("operation",trust.approveInstall(plugin,body.release(),body.consented()));}
  @PostMapping("/plugins/{plugin}/upgrade") public Object upgrade(@PathVariable String plugin,@RequestBody Upgrade body){return Map.of("operation",trust.recordUpgrade(plugin,body.from(),body.to(),body.consented()));}
  @PostMapping("/plugins/{plugin}/rollback/{release}") public Object rollback(@PathVariable String plugin,@PathVariable UUID release){return Map.of("operation",trust.rollback(plugin,release));}
  @GetMapping("/plugins/{plugin}/history") public Object history(@PathVariable String plugin){return trust.history(plugin);}
  @GetMapping("/plugins/{plugin}/health") public Object health(@PathVariable String plugin){return trust.health(plugin);}
  public record Report(UUID release,String reason,String detail){}
  @PostMapping("/plugins/{plugin}/report") public Object report(@PathVariable String plugin,@RequestBody Report body){return Map.of("report",trust.report(plugin,body.release(),body.reason(),body.detail()));}
  public record PublisherReview(String level,String signingIdentity,String reason){}
  public record PublisherApplication(String name,String signingIdentity,String evidence){}
  @PostMapping("/publishers/applications") public Object applyPublisher(@RequestBody PublisherApplication body){return Map.of("publisher",trust.applyPublisher(body.name(),body.signingIdentity(),body.evidence()));}
  @GetMapping("/publishers/applications") @PreAuthorize("hasRole('ADMIN')") public Object publisherApplications(){return trust.publisherApplications();}
  @PostMapping("/publishers/{id}/verification") @PreAuthorize("hasRole('ADMIN')") public Object publisher(@PathVariable UUID id,@RequestBody PublisherReview body){trust.verifyPublisher(id,body.level(),body.signingIdentity(),body.reason(),users.requireUserId());return Map.of("updated",true);}
  @PostMapping("/publishers/{id}/revoke") @PreAuthorize("hasRole('ADMIN')") public Object revoke(@PathVariable UUID id,@RequestBody Map<String,String> body){trust.revokePublisher(id,body.getOrDefault("reason","revoked"),users.requireUserId());return Map.of("revoked",true);}
  @GetMapping("/publishers/{id}/history") public Object publisherHistory(@PathVariable UUID id){return trust.publisherHistory(id);}
  @GetMapping public Object catalog(){return trust.catalog();}
}
