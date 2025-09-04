package com.modulo.chaos;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.concurrent.ThreadLocalRandom;

/**
 * Chaos engineering configuration for testing failure scenarios
 */
@Component
public class ChaosConfig {

    @Value("${modulo.chaos.enabled:false}")
    private boolean chaosEnabled;

    @Value("${modulo.chaos.opa-failure-rate:0.0}")
    private double opaFailureRate;

    @Value("${modulo.chaos.keycloak-failure-rate:0.0}")
    private double keycloakFailureRate;

    @Value("${modulo.chaos.network-delay-ms:0}")
    private int networkDelayMs;

    @Value("${modulo.chaos.database-failure-rate:0.0}")
    private double databaseFailureRate;

    /**
     * Check if chaos engineering is enabled
     */
    public boolean isChaosEnabled() {
        return chaosEnabled;
    }

    /**
     * Simulate OPA authorization service failure
     */
    public boolean shouldSimulateOpaFailure() {
        return chaosEnabled && ThreadLocalRandom.current().nextDouble() < opaFailureRate;
    }

    /**
     * Simulate Keycloak authentication service failure
     */
    public boolean shouldSimulateKeycloakFailure() {
        return chaosEnabled && ThreadLocalRandom.current().nextDouble() < keycloakFailureRate;
    }

    /**
     * Simulate network delay
     */
    public boolean shouldSimulateNetworkDelay() {
        return chaosEnabled && networkDelayMs > 0;
    }

    /**
     * Get network delay in milliseconds
     */
    public int getNetworkDelayMs() {
        return networkDelayMs;
    }

    /**
     * Simulate database failure
     */
    public boolean shouldSimulateDatabaseFailure() {
        return chaosEnabled && ThreadLocalRandom.current().nextDouble() < databaseFailureRate;
    }

    /**
     * Get chaos failure rates for monitoring
     */
    public ChaosMetrics getChaosMetrics() {
        return new ChaosMetrics(
            chaosEnabled,
            opaFailureRate,
            keycloakFailureRate,
            networkDelayMs,
            databaseFailureRate
        );
    }

    public static class ChaosMetrics {
        public final boolean enabled;
        public final double opaFailureRate;
        public final double keycloakFailureRate;
        public final int networkDelayMs;
        public final double databaseFailureRate;

        public ChaosMetrics(boolean enabled, double opaFailureRate, double keycloakFailureRate, 
                           int networkDelayMs, double databaseFailureRate) {
            this.enabled = enabled;
            this.opaFailureRate = opaFailureRate;
            this.keycloakFailureRate = keycloakFailureRate;
            this.networkDelayMs = networkDelayMs;
            this.databaseFailureRate = databaseFailureRate;
        }
    }
}
