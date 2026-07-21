package com.modulo.sandbox.service;

import io.grpc.Server;
import io.grpc.netty.shaded.io.grpc.netty.NettyServerBuilder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Entry point of the script-sandbox plugin workload (#393).
 *
 * Environment:
 *   PORT           gRPC port (default 9090)
 *   SANDBOX_ENGINE wasm (default) | rhino
 */
public final class SandboxPluginServer {

    private static final Logger logger = LoggerFactory.getLogger(SandboxPluginServer.class);

    private SandboxPluginServer() {}

    public static void main(String[] args) throws Exception {
        int port = Integer.parseInt(env("PORT", "9090"));
        String engine = env("SANDBOX_ENGINE", "wasm");

        Server server = NettyServerBuilder.forPort(port)
            .addService(new SandboxPluginService(engine))
            .build()
            .start();
        logger.info("script-sandbox plugin listening on :{} ({} engine)", port, engine);

        Runtime.getRuntime().addShutdownHook(new Thread(server::shutdown, "shutdown"));
        server.awaitTermination();
    }

    private static String env(String name, String fallback) {
        String value = System.getenv(name);
        return value != null && !value.isBlank() ? value : fallback;
    }
}
