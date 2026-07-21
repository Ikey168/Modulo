package com.modulo.blueprint;

import com.modulo.blueprint.interpreter.BlueprintInterpreterService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Inbound webhook ingress for blueprints (#363). Lives under /api/public (no
 * session), so authentication is the per-blueprint shared secret configured on
 * the trigger.webhook node and sent as X-Webhook-Secret. Responses are
 * deliberately identical for "unknown endpoint" and "wrong secret" so the URL
 * space cannot be probed.
 */
@RestController
@RequestMapping("/api/public/blueprints/webhook")
public class BlueprintWebhookController {

    @Autowired
    private BlueprintInterpreterService interpreter;

    @PostMapping("/{registryId}/{nodeId}")
    public ResponseEntity<?> fire(
            @PathVariable Long registryId,
            @PathVariable String nodeId,
            @RequestHeader(value = "X-Webhook-Secret", required = false) String secret,
            @RequestBody(required = false) String payload) {

        BlueprintInterpreterService.WebhookResult result =
            interpreter.fireWebhook(registryId, nodeId, secret, payload == null ? "" : payload);

        if (result == BlueprintInterpreterService.WebhookResult.ACCEPTED) {
            return ResponseEntity.accepted().body(Map.of("status", "accepted"));
        }
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("status", "rejected"));
    }
}
