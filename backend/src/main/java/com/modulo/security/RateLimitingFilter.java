package com.modulo.security;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.Bucket4j;
import io.github.bucket4j.Refill;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.servlet.*;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Rate limiting filter to protect against DoS attacks and abuse
 * Addresses Issue #51: Conduct Security Testing on Cloud Deployment
 */
@Component
public class RateLimitingFilter implements Filter {

    private static final Logger logger = LoggerFactory.getLogger(RateLimitingFilter.class);

    @Value("${modulo.security.rate-limit.requests-per-minute:100}")
    private int requestsPerMinute;

    @Value("${modulo.security.rate-limit.burst-capacity:20}")
    private int burstCapacity;

    @Value("${modulo.security.rate-limit.enabled:true}")
    private boolean rateLimitEnabled;

    // Cache for storing buckets per client IP
    private final ConcurrentHashMap<String, Bucket> buckets = new ConcurrentHashMap<>();

    // Bucket for global rate limiting
    private Bucket globalBucket;

    @Override
    public void init(FilterConfig filterConfig) throws ServletException {
        if (rateLimitEnabled) {
            // Create global bucket for overall API protection
            Bandwidth globalLimit = Bandwidth.classic(1000, Refill.intervally(1000, Duration.ofMinutes(1)));
            globalBucket = Bucket4j.builder().addLimit(globalLimit).build();
            
            logger.info("Rate limiting initialized: {} requests/minute per IP, burst: {}", 
                       requestsPerMinute, burstCapacity);
        } else {
            logger.info("Rate limiting is disabled");
        }
    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {

        if (!rateLimitEnabled) {
            chain.doFilter(request, response);
            return;
        }

        HttpServletRequest httpRequest = (HttpServletRequest) request;
        HttpServletResponse httpResponse = (HttpServletResponse) response;

        // Skip rate limiting for health checks and static resources
        String requestURI = httpRequest.getRequestURI();
        if (isExemptFromRateLimit(requestURI)) {
            chain.doFilter(request, response);
            return;
        }

        String clientIp = getClientIpAddress(httpRequest);
        String userAgent = httpRequest.getHeader("User-Agent");

        // Check global rate limit first
        if (!globalBucket.tryConsume(1)) {
            handleRateLimit(httpResponse, "Global rate limit exceeded", clientIp, userAgent);
            return;
        }

        // Get or create bucket for this client
        Bucket bucket = getBucketForClient(clientIp);

        if (bucket.tryConsume(1)) {
            // Request allowed, add rate limit headers
            addRateLimitHeaders(httpResponse, bucket);
            
            // Log suspicious patterns
            if (bucket.getAvailableTokens() < 5) {
                logger.warn("High request rate from IP: {} (User-Agent: {})", clientIp, userAgent);
            }
            
            chain.doFilter(request, response);
        } else {
            // Rate limit exceeded
            handleRateLimit(httpResponse, "Rate limit exceeded for IP: " + clientIp, clientIp, userAgent);
        }
    }

    /**
     * Check if the request should be exempt from rate limiting
     */
    private boolean isExemptFromRateLimit(String requestURI) {
        return requestURI.startsWith("/actuator/health") ||
               requestURI.startsWith("/api/health/status") ||
               requestURI.startsWith("/api/simple-health") ||
               requestURI.startsWith("/static/") ||
               requestURI.endsWith(".css") ||
               requestURI.endsWith(".js") ||
               requestURI.endsWith(".png") ||
               requestURI.endsWith(".jpg") ||
               requestURI.endsWith(".gif") ||
               requestURI.equals("/favicon.ico");
    }

    /**
     * Get or create a bucket for a specific client
     */
    private Bucket getBucketForClient(String clientIp) {
        return buckets.computeIfAbsent(clientIp, k -> {
            // Create per-client bucket
            Bandwidth limit = Bandwidth.classic(requestsPerMinute, 
                                               Refill.intervally(requestsPerMinute, Duration.ofMinutes(1)));
            Bandwidth burst = Bandwidth.classic(burstCapacity, 
                                               Refill.greedy(burstCapacity, Duration.ofSeconds(1)));
            
            return Bucket4j.builder()
                    .addLimit(limit)
                    .addLimit(burst)
                    .build();
        });
    }

    /**
     * Handle rate limit exceeded scenarios
     */
    private void handleRateLimit(HttpServletResponse response, String message, String clientIp, String userAgent) 
            throws IOException {
        
        logger.warn("Rate limit exceeded - IP: {}, User-Agent: {}, Message: {}", clientIp, userAgent, message);
        
        // Set rate limit headers
        response.setHeader("X-RateLimit-Limit", String.valueOf(requestsPerMinute));
        response.setHeader("X-RateLimit-Remaining", "0");
        response.setHeader("X-RateLimit-Reset", String.valueOf(System.currentTimeMillis() + 60000));
        response.setHeader("Retry-After", "60");
        
        // Return 429 Too Many Requests
        response.setStatus(429);
        response.setContentType("application/json");
        response.getWriter().write("{\n" +
                "  \"error\": \"Too Many Requests\",\n" +
                "  \"message\": \"Rate limit exceeded. Please try again later.\",\n" +
                "  \"retryAfter\": 60\n" +
                "}");
        response.getWriter().flush();
    }

    /**
     * Add rate limit headers to successful responses
     */
    private void addRateLimitHeaders(HttpServletResponse response, Bucket bucket) {
        response.setHeader("X-RateLimit-Limit", String.valueOf(requestsPerMinute));
        response.setHeader("X-RateLimit-Remaining", String.valueOf(bucket.getAvailableTokens()));
        response.setHeader("X-RateLimit-Reset", String.valueOf(System.currentTimeMillis() + 60000));
    }

    /**
     * Get the real client IP address, considering proxies and load balancers
     */
    private String getClientIpAddress(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty() && !"unknown".equalsIgnoreCase(xForwardedFor)) {
            // Get the first IP in case of multiple proxies
            return xForwardedFor.split(",")[0].trim();
        }

        String xRealIp = request.getHeader("X-Real-IP");
        if (xRealIp != null && !xRealIp.isEmpty() && !"unknown".equalsIgnoreCase(xRealIp)) {
            return xRealIp;
        }

        String xForwarded = request.getHeader("X-Forwarded");
        if (xForwarded != null && !xForwarded.isEmpty() && !"unknown".equalsIgnoreCase(xForwarded)) {
            return xForwarded;
        }

        String forwarded = request.getHeader("Forwarded");
        if (forwarded != null && !forwarded.isEmpty() && !"unknown".equalsIgnoreCase(forwarded)) {
            return forwarded;
        }

        return request.getRemoteAddr();
    }

    /**
     * Cleanup buckets periodically to prevent memory leaks
     */
    public void cleanupBuckets() {
        if (buckets.size() > 10000) { // Prevent memory exhaustion
            logger.info("Cleaning up rate limit buckets, current size: {}", buckets.size());
            buckets.clear(); // Simple cleanup - in production, use LRU cache
        }
    }

    @Override
    public void destroy() {
        buckets.clear();
        logger.info("Rate limiting filter destroyed, buckets cleared");
    }
}
