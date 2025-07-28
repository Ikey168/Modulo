package com.modulo.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpSession;

@RestController
public class AuthController {

    private static final Logger logger = LoggerFactory.getLogger(AuthController.class);

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request) {
        logger.debug("Processing logout request");
        
        // Clear security context
        SecurityContextHolder.clearContext();
        
        // Invalidate session if it exists
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
            logger.debug("Session invalidated");
        }
        
        logger.debug("Logout completed successfully");
        return ResponseEntity.ok().build();
    }
}