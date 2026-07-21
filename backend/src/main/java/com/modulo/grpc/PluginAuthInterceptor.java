package com.modulo.grpc;

import com.modulo.plugin.manager.PluginSecurityManager;
import io.grpc.Context;
import io.grpc.Contexts;
import io.grpc.Metadata;
import io.grpc.ServerCall;
import io.grpc.ServerCallHandler;
import io.grpc.ServerInterceptor;
import io.grpc.Status;
import net.devh.boot.grpc.server.interceptor.GrpcGlobalServerInterceptor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

/**
 * Authenticates calls to the plugin host surface (#390).
 *
 * External plugins send {@code plugin-id} and {@code plugin-token} metadata
 * headers (token issued by {@link PluginSecurityManager} at registration).
 * On success the plugin id is placed in {@link #PLUGIN_ID} for per-call
 * permission checks in the service implementation. Only
 * {@code PluginHostService} is guarded here — the lifecycle service is
 * core-operator surface, not plugin-callback surface.
 */
@GrpcGlobalServerInterceptor
@ConditionalOnProperty(name = "modulo.features.enable-grpc", havingValue = "true")
public class PluginAuthInterceptor implements ServerInterceptor {

    private static final Logger logger = LoggerFactory.getLogger(PluginAuthInterceptor.class);

    static final String GUARDED_SERVICE = "com.modulo.plugin.grpc.PluginHostService";

    public static final Context.Key<String> PLUGIN_ID = Context.key("modulo-plugin-id");

    public static final Metadata.Key<String> PLUGIN_ID_HEADER =
        Metadata.Key.of("plugin-id", Metadata.ASCII_STRING_MARSHALLER);
    public static final Metadata.Key<String> PLUGIN_TOKEN_HEADER =
        Metadata.Key.of("plugin-token", Metadata.ASCII_STRING_MARSHALLER);

    @Autowired
    private PluginSecurityManager securityManager;

    @Override
    public <ReqT, RespT> ServerCall.Listener<ReqT> interceptCall(
            ServerCall<ReqT, RespT> call, Metadata headers, ServerCallHandler<ReqT, RespT> next) {

        if (!GUARDED_SERVICE.equals(call.getMethodDescriptor().getServiceName())) {
            return next.startCall(call, headers);
        }

        String pluginId = headers.get(PLUGIN_ID_HEADER);
        String token = headers.get(PLUGIN_TOKEN_HEADER);
        if (pluginId == null || token == null) {
            call.close(Status.UNAUTHENTICATED.withDescription(
                "plugin-id and plugin-token metadata are required"), new Metadata());
            return new ServerCall.Listener<ReqT>() {};
        }

        String tokenOwner = securityManager.validatePluginToken(token);
        if (tokenOwner == null || !tokenOwner.equals(pluginId)) {
            logger.warn("Rejected plugin host call: bad token for plugin '{}'", pluginId);
            call.close(Status.UNAUTHENTICATED.withDescription("invalid plugin token"), new Metadata());
            return new ServerCall.Listener<ReqT>() {};
        }

        Context ctx = Context.current().withValue(PLUGIN_ID, pluginId);
        return Contexts.interceptCall(ctx, call, headers, next);
    }
}
