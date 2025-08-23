package com.modulo.util;

import java.util.regex.Pattern;

/**
 * Utility class for sanitizing log inputs to prevent log injection attacks
 * Removes or escapes dangerous characters that could be used for log forging
 */
public class LogSanitizer {

    // Pattern to match CRLF injection characters and other dangerous log characters
    private static final Pattern CRLF_PATTERN = Pattern.compile("[\r\n\t]");
    private static final Pattern LOG_INJECTION_PATTERN = Pattern.compile("[\r\n\t\u0000-\u001f\u007f-\u009f]");
    
    // Maximum length for logged strings to prevent log flooding
    private static final int MAX_LOG_LENGTH = 1000;

    /**
     * Sanitize a string for safe logging by removing CRLF and control characters
     * @param input The input string to sanitize
     * @return Sanitized string safe for logging
     */
    public static String sanitize(String input) {
        if (input == null) {
            return "null";
        }
        
        // Truncate if too long
        String result = input;
        if (result.length() > MAX_LOG_LENGTH) {
            result = result.substring(0, MAX_LOG_LENGTH) + "...[truncated]";
        }
        
        // Remove dangerous characters
        result = LOG_INJECTION_PATTERN.matcher(result).replaceAll("_");
        
        return result;
    }

    /**
     * Sanitize a CID (Content Identifier) for logging
     * CIDs should only contain base58 characters, so we can be more strict
     * @param cid The CID to sanitize
     * @return Sanitized CID safe for logging
     */
    public static String sanitizeCid(String cid) {
        if (cid == null) {
            return "null";
        }
        
        // CIDs should only contain alphanumeric characters
        // Remove any non-alphanumeric characters for safety
        String sanitized = cid.replaceAll("[^a-zA-Z0-9]", "_");
        
        // Limit length
        if (sanitized.length() > 100) {
            sanitized = sanitized.substring(0, 100) + "...[truncated]";
        }
        
        return sanitized;
    }

    /**
     * Sanitize an ID (Long) for logging
     * @param id The ID to sanitize
     * @return String representation safe for logging
     */
    public static String sanitizeId(Long id) {
        return id != null ? id.toString() : "null";
    }

    /**
     * Sanitize response content for logging
     * @param response The response content to sanitize
     * @return Sanitized response safe for logging
     */
    public static String sanitizeResponse(String response) {
        if (response == null) {
            return "null";
        }
        
        // For responses, be more aggressive about length limits
        String result = response;
        if (result.length() > 500) {
            result = result.substring(0, 500) + "...[truncated]";
        }
        
        // Remove dangerous characters
        result = LOG_INJECTION_PATTERN.matcher(result).replaceAll("_");
        
        return result;
    }

    /**
     * Sanitize an exception message for logging
     * @param message The exception message to sanitize
     * @return Sanitized message safe for logging
     */
    public static String sanitizeMessage(String message) {
        if (message == null) {
            return "null";
        }
        
        // Exception messages can be longer but still need sanitization
        String result = message;
        if (result.length() > 2000) {
            result = result.substring(0, 2000) + "...[truncated]";
        }
        
        // Remove dangerous characters but preserve basic punctuation
        result = CRLF_PATTERN.matcher(result).replaceAll(" ");
        
        return result;
    }
}
