package com.modulo.plugin.manager;

import com.modulo.plugin.api.HealthCheck;
import com.modulo.plugin.api.Plugin;
import com.modulo.plugin.api.PluginException;
import com.modulo.plugin.api.PluginInfo;
import com.modulo.plugin.api.PluginRuntime;
import com.modulo.plugin.api.PluginType;
import com.modulo.plugin.grpc.*;
import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import io.grpc.StatusRuntimeException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * An EXTERNAL plugin as seen from inside the core (#392): a {@link Plugin}
 * whose lifecycle methods are gRPC calls against the workload's endpoint
 * (contract v1, {@code PluginService}). Because it implements the same
 * interface as in-process plugins, {@link PluginManager} tracks, starts,
 * stops, health-checks, and event-subscribes it with the machinery it
 * already has.
 *
 * Lifecycle calls retry with backoff ({@value #MAX_ATTEMPTS} attempts);
 * health checks do not retry — the health monitor owns failure counting.
 * All failures surface as {@link PluginException}/unhealthy results, never
 * as crashes: a plugin pod being down must never take the core with it
 * (ADR 0004 §5).
 */
public class ExternalPluginProxy implements Plugin, AutoCloseable {

    private static final Logger logger = LoggerFactory.getLogger(ExternalPluginProxy.class);

    static final int MAX_ATTEMPTS = 3;
    private static final long BACKOFF_BASE_MS = 500;
    private static final long CALL_DEADLINE_SECONDS = 10;

    private final String endpoint;
    private final ManagedChannel channel;
    private final PluginServiceGrpc.PluginServiceBlockingStub stub;

    /** Identity is fetched once at attach; the pod owns the live values. */
    private volatile PluginInfo cachedInfo;
    private volatile List<String> requiredPermissions = new ArrayList<>();
    private volatile List<String> subscribedEvents = new ArrayList<>();

    public ExternalPluginProxy(String endpoint) {
        this(endpoint, ManagedChannelBuilder.forTarget(endpoint).usePlaintext().build());
    }

    /** Channel-injecting constructor for tests. */
    ExternalPluginProxy(String endpoint, ManagedChannel channel) {
        this.endpoint = endpoint;
        this.channel = channel;
        this.stub = PluginServiceGrpc.newBlockingStub(channel);
    }

    public String getEndpoint() {
        return endpoint;
    }

    private PluginServiceGrpc.PluginServiceBlockingStub timed() {
        return stub.withDeadlineAfter(CALL_DEADLINE_SECONDS, TimeUnit.SECONDS);
    }

    /** Fetch identity + capability metadata from the workload. */
    public void attach() throws PluginException {
        InfoResponse info = withRetry("GetInfo", () ->
            timed().getInfo(InfoRequest.newBuilder().build()));
        cachedInfo = new PluginInfo(
            info.getName(), info.getVersion(), info.getDescription(), info.getAuthor(),
            PluginType.EXTERNAL, PluginRuntime.GRPC);
        requiredPermissions = new ArrayList<>(info.getRequiredPermissionsList());
        try {
            CapabilitiesResponse capabilities =
                timed().getCapabilities(CapabilitiesRequest.newBuilder().build());
            subscribedEvents = new ArrayList<>(capabilities.getSupportedEventsList());
        } catch (StatusRuntimeException e) {
            logger.warn("External plugin at {} did not report capabilities: {}", endpoint, e.getStatus());
            subscribedEvents = new ArrayList<>();
        }
    }

    @Override
    public PluginInfo getInfo() {
        PluginInfo info = cachedInfo;
        if (info == null) {
            return new PluginInfo("unattached-external-plugin", "unknown",
                "external plugin at " + endpoint, "unknown",
                PluginType.EXTERNAL, PluginRuntime.GRPC);
        }
        return info;
    }

    @Override
    public void initialize(Map<String, Object> config) throws PluginException {
        Map<String, String> wireConfig = new HashMap<>();
        if (config != null) {
            config.forEach((k, v) -> wireConfig.put(k, v != null ? String.valueOf(v) : ""));
        }
        InitializeResponse response = withRetry("Initialize", () ->
            timed().initialize(InitializeRequest.newBuilder()
                .setPluginId(getInfo().getName())
                .putAllConfig(wireConfig)
                .addAllRequiredPermissions(requiredPermissions)
                .build()));
        if (!response.getSuccess()) {
            throw new PluginException("External plugin rejected initialize: " + response.getMessage());
        }
    }

    @Override
    public void start() throws PluginException {
        StartResponse response = withRetry("Start", () ->
            timed().start(StartRequest.newBuilder().setPluginId(getInfo().getName()).build()));
        if (!response.getSuccess()) {
            throw new PluginException("External plugin rejected start: " + response.getMessage());
        }
    }

    @Override
    public void stop() throws PluginException {
        try {
            StopResponse response = withRetry("Stop", () ->
                timed().stop(StopRequest.newBuilder().setPluginId(getInfo().getName()).build()));
            if (!response.getSuccess()) {
                logger.warn("External plugin at {} rejected stop: {}", endpoint, response.getMessage());
            }
        } catch (PluginException e) {
            // Stopping an already-dead workload is fine — log, don't fail teardown.
            logger.warn("Could not stop external plugin at {}: {}", endpoint, e.getMessage());
        }
    }

    @Override
    public HealthCheck healthCheck() {
        try {
            HealthCheckResponse response = stub
                .withDeadlineAfter(5, TimeUnit.SECONDS)
                .healthCheck(HealthCheckRequest.newBuilder().setPluginId(getInfo().getName()).build());
            switch (response.getHealth()) {
                case HEALTHY:
                    return HealthCheck.healthy(response.getMessage());
                case DEGRADED:
                    return HealthCheck.unhealthy("degraded: " + response.getMessage());
                default:
                    return HealthCheck.unhealthy(response.getMessage());
            }
        } catch (StatusRuntimeException e) {
            return HealthCheck.unhealthy("endpoint " + endpoint + " unreachable: " + e.getStatus());
        }
    }

    @Override
    public List<String> getCapabilities() {
        try {
            return new ArrayList<>(timed()
                .getCapabilities(CapabilitiesRequest.newBuilder().build())
                .getSupportedOperationsList());
        } catch (StatusRuntimeException e) {
            return new ArrayList<>();
        }
    }

    @Override
    public List<String> getRequiredPermissions() {
        return requiredPermissions;
    }

    @Override
    public List<String> getSubscribedEvents() {
        return subscribedEvents;
    }

    @Override
    public List<String> getPublishedEvents() {
        return new ArrayList<>();
    }

    @Override
    public void close() {
        channel.shutdown();
        try {
            if (!channel.awaitTermination(3, TimeUnit.SECONDS)) {
                channel.shutdownNow();
            }
        } catch (InterruptedException e) {
            channel.shutdownNow();
            Thread.currentThread().interrupt();
        }
    }

    private interface GrpcCall<T> {
        T call() throws StatusRuntimeException;
    }

    private <T> T withRetry(String operation, GrpcCall<T> call) throws PluginException {
        StatusRuntimeException last = null;
        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                return call.call();
            } catch (StatusRuntimeException e) {
                last = e;
                logger.warn("{} on external plugin at {} failed (attempt {}/{}): {}",
                    operation, endpoint, attempt, MAX_ATTEMPTS, e.getStatus());
                if (attempt < MAX_ATTEMPTS) {
                    try {
                        Thread.sleep(BACKOFF_BASE_MS * (1L << (attempt - 1)));
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        throw new PluginException(operation + " interrupted", ie);
                    }
                }
            }
        }
        throw new PluginException(operation + " failed against " + endpoint + ": "
            + (last != null ? last.getStatus().toString() : "unknown"), last);
    }
}
