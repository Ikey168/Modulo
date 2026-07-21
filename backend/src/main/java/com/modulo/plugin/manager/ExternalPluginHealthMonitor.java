package com.modulo.plugin.manager;

import com.modulo.plugin.api.HealthCheck;
import com.modulo.plugin.api.Plugin;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import javax.annotation.PostConstruct;
import javax.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Periodic health polling for EXTERNAL plugins (#392).
 *
 * Every {@code modulo.plugins.external.health-interval-ms} (default 30s)
 * each attached {@link ExternalPluginProxy} is health-checked;
 * {@value #FAILURE_THRESHOLD} consecutive failures mark it ERROR in the
 * manager's status map (surfacing through the existing status endpoints),
 * and a later success restores ACTIVE. The core never crashes or blocks on
 * a down plugin pod — polling runs on its own daemon thread and each check
 * carries the proxy's own short deadline.
 */
@Component
public class ExternalPluginHealthMonitor {

    private static final Logger logger = LoggerFactory.getLogger(ExternalPluginHealthMonitor.class);

    static final int FAILURE_THRESHOLD = 3;

    @Autowired private PluginManager pluginManager;

    @Value("${modulo.plugins.external.health-interval-ms:30000}")
    private long intervalMs;

    private final Map<String, AtomicInteger> consecutiveFailures = new ConcurrentHashMap<>();
    private ScheduledExecutorService scheduler;

    @PostConstruct
    void start() {
        scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "external-plugin-health");
            t.setDaemon(true);
            return t;
        });
        scheduler.scheduleWithFixedDelay(this::pollOnce, intervalMs, intervalMs, TimeUnit.MILLISECONDS);
    }

    @PreDestroy
    void stop() {
        if (scheduler != null) {
            scheduler.shutdownNow();
        }
    }

    /** One polling pass — package-visible so tests drive it deterministically. */
    void pollOnce() {
        for (Map.Entry<String, Plugin> entry : pluginManager.getActivePlugins().entrySet()) {
            if (!(entry.getValue() instanceof ExternalPluginProxy)) {
                continue;
            }
            String pluginId = entry.getKey();
            ExternalPluginProxy proxy = (ExternalPluginProxy) entry.getValue();
            try {
                HealthCheck health = proxy.healthCheck();
                if (health.isHealthy()) {
                    if (consecutiveFailures.remove(pluginId) != null) {
                        logger.info("External plugin {} recovered", pluginId);
                    }
                    pluginManager.markPluginStatus(pluginId, PluginStatus.ACTIVE);
                } else {
                    onFailure(pluginId, health.getMessage());
                }
            } catch (Exception e) {
                onFailure(pluginId, e.getMessage());
            }
        }
    }

    private void onFailure(String pluginId, String reason) {
        int failures = consecutiveFailures
            .computeIfAbsent(pluginId, k -> new AtomicInteger())
            .incrementAndGet();
        logger.warn("External plugin {} health check failed ({}/{}): {}",
            pluginId, failures, FAILURE_THRESHOLD, reason);
        if (failures >= FAILURE_THRESHOLD) {
            pluginManager.markPluginStatus(pluginId, PluginStatus.ERROR);
        }
    }
}
