package com.modulo.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
public class UserController {

    private static final Logger logger = LoggerFactory.getLogger(UserController.class);

    @GetMapping("/user/me")
    public Map<String, Object> user(@AuthenticationPrincipal OAuth2User principal) {
        logger.debug("Fetching user information for authenticated user");
        
        if (principal == null) {
            logger.debug("No authenticated user found");
            return new HashMap<>();
        }

        Map<String, Object> userDetails = new HashMap<>();
        
        // Common OAuth2 attributes
        userDetails.put("id", principal.getAttribute("sub"));
        userDetails.put("name", principal.getAttribute("name"));
        userDetails.put("email", principal.getAttribute("email"));
        userDetails.put("picture", principal.getAttribute("picture"));
        userDetails.put("givenName", principal.getAttribute("given_name"));
        userDetails.put("familyName", principal.getAttribute("family_name"));
        userDetails.put("locale", principal.getAttribute("locale"));

        // Add authentication provider
        String provider = principal.getAttribute("iss") != null ? 
            principal.getAttribute("iss").toString().contains("google") ? "google" : "azure" 
            : "unknown";
        userDetails.put("provider", provider);

        // Remove null values
        userDetails.values().removeIf(value -> value == null);

        logger.debug("Returning user details: {}", userDetails);
        return userDetails;
    }
}