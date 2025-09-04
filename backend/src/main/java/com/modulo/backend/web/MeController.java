package com.modulo.backend.web;

import org.springframework.context.annotation.Profile;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/me")
@Profile("oidc")
public class MeController {

    @GetMapping
    public Map<String, Object> getMe(@AuthenticationPrincipal Jwt principal) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("sub", principal.getSubject());
        claims.put("email", principal.getClaim("email"));
        claims.put("roles", principal.getClaim("realm_access"));
        return claims;
    }
}
