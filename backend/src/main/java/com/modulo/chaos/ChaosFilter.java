package com.modulo.chaos;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import javax.servlet.Filter;
import javax.servlet.FilterChain;
import javax.servlet.FilterConfig;
import javax.servlet.ServletException;
import javax.servlet.ServletRequest;
import javax.servlet.ServletResponse;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;

/**
 * Chaos engineering filter for injecting failures during testing
 */
@Component
public class ChaosFilter implements Filter {

    private static final Logger logger = LoggerFactory.getLogger(ChaosFilter.class);

    @Autowired
    private ChaosConfig chaosConfig;

    @Override
    public void init(FilterConfig filterConfig) throws ServletException {
        logger.info("ChaosFilter initialized with chaos enabled: {}", chaosConfig.isChaosEnabled());
    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        
        HttpServletRequest httpRequest = (HttpServletRequest) request;
        HttpServletResponse httpResponse = (HttpServletResponse) response;

        // Check for chaos parameter in request
        String chaosMode = httpRequest.getParameter("chaos");
        
        if (chaosConfig.isChaosEnabled() && chaosMode != null) {
            logger.debug("Chaos mode activated: {}", chaosMode);
            
            switch (chaosMode) {
                case "opa_down":
                    simulateOpaFailure(httpResponse);
                    return;
                    
                case "keycloak_down":
                    simulateKeycloakFailure(httpResponse);
                    return;
                    
                case "network_delay":
                    simulateNetworkDelay();
                    break;
                    
                case "database_error":
                    if (chaosConfig.shouldSimulateDatabaseFailure()) {
                        simulateDatabaseFailure(httpResponse);
                        return;
                    }
                    break;
                    
                default:
                    logger.warn("Unknown chaos mode: {}", chaosMode);
            }
        }

        // Apply random failures if configured
        if (chaosConfig.isChaosEnabled()) {
            if (chaosConfig.shouldSimulateOpaFailure()) {
                simulateOpaFailure(httpResponse);
                return;
            }
            
            if (chaosConfig.shouldSimulateKeycloakFailure()) {
                simulateKeycloakFailure(httpResponse);
                return;
            }
            
            if (chaosConfig.shouldSimulateNetworkDelay()) {
                simulateNetworkDelay();
            }
        }

        // Continue with normal request processing
        chain.doFilter(request, response);
    }

    private void simulateOpaFailure(HttpServletResponse response) throws IOException {
        logger.info("CHAOS: Simulating OPA authorization service failure");
        
        response.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
        response.setContentType("application/json");
        response.getWriter().write(
            "{\"error\":\"Authorization service unavailable\",\"code\":\"OPA_UNAVAILABLE\"," +
            "\"message\":\"The authorization service is currently unavailable. Please try again later.\",\"timestamp\":\"" +
            java.time.Instant.now().toString() + "\"}"
        );
        response.getWriter().flush();
    }

    private void simulateKeycloakFailure(HttpServletResponse response) throws IOException {
        logger.info("CHAOS: Simulating Keycloak authentication service failure");
        
        response.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
        response.setContentType("application/json");
        response.getWriter().write(
            "{\"error\":\"Authentication service unavailable\",\"code\":\"KEYCLOAK_UNAVAILABLE\"," +
            "\"message\":\"The authentication service is currently unavailable. Please try again later.\",\"timestamp\":\"" +
            java.time.Instant.now().toString() + "\"}"
        );
        response.getWriter().flush();
    }

    private void simulateNetworkDelay() {
        int delayMs = chaosConfig.getNetworkDelayMs();
        if (delayMs > 0) {
            logger.debug("CHAOS: Simulating network delay of {}ms", delayMs);
            try {
                Thread.sleep(delayMs);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                logger.warn("Network delay simulation interrupted", e);
            }
        }
    }

    private void simulateDatabaseFailure(HttpServletResponse response) throws IOException {
        logger.info("CHAOS: Simulating database failure");
        
        response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
        response.setContentType("application/json");
        response.getWriter().write(
            "{\"error\":\"Database unavailable\",\"code\":\"DATABASE_ERROR\"," +
            "\"message\":\"A database error occurred. Please try again later.\",\"timestamp\":\"" +
            java.time.Instant.now().toString() + "\"}"
        );
        response.getWriter().flush();
    }

    @Override
    public void destroy() {
        logger.info("ChaosFilter destroyed");
    }
}
