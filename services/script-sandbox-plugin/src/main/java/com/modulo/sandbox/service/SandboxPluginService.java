package com.modulo.sandbox.service;

import com.google.protobuf.ByteString;
import com.modulo.blueprint.sandbox.RhinoScriptSandbox;
import com.modulo.blueprint.sandbox.ScriptSandbox;
import com.modulo.blueprint.sandbox.WasmScriptSandbox;
import com.modulo.plugin.grpc.*;
import io.grpc.stub.StreamObserver;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * The script-sandbox plugin workload (#393): implements the v1 plugin
 * lifecycle contract and executes {@code script.execute} operations through
 * the same {@link ScriptSandbox} engines the core runs in-process — WASM
 * (QuickJS) by default, with the in-JVM limit regime (2s wall clock, 32 MiB
 * memory cap, 64 KiB output) as the inner wall and the pod's CPU/memory
 * limits as the outer one.
 *
 * Operation contract:
 *   operation  = "script.execute"
 *   parameters = { code, title, content }
 *   response   = result_payload (UTF-8 output) on success;
 *                error_code SCRIPT_ERROR (script/limit failure) or
 *                UNSUPPORTED_OPERATION otherwise.
 */
public class SandboxPluginService extends PluginServiceGrpc.PluginServiceImplBase {

    private static final Logger logger = LoggerFactory.getLogger(SandboxPluginService.class);

    public static final String PLUGIN_NAME = "script-sandbox";
    public static final String PLUGIN_VERSION = "1.0.0";
    public static final String OPERATION = "script.execute";

    private final ScriptSandbox engine;
    private final String engineName;
    private final AtomicReference<PluginStatus> status =
        new AtomicReference<>(PluginStatus.INACTIVE);

    public SandboxPluginService(String engineName) {
        this.engineName = engineName;
        this.engine = "rhino".equals(engineName) ? new RhinoScriptSandbox() : new WasmScriptSandbox();
    }

    // ------------------------------------------------------------------
    // Lifecycle
    // ------------------------------------------------------------------

    @Override
    public void getInfo(InfoRequest request, StreamObserver<InfoResponse> observer) {
        observer.onNext(InfoResponse.newBuilder()
            .setName(PLUGIN_NAME)
            .setVersion(PLUGIN_VERSION)
            .setDescription("Sandboxed script execution (" + engineName + " engine)")
            .setAuthor("Modulo")
            // Pure compute: needs no host callbacks, declares no permissions.
            .putMetadata("engine", engineName)
            .build());
        observer.onCompleted();
    }

    @Override
    public void getCapabilities(CapabilitiesRequest request, StreamObserver<CapabilitiesResponse> observer) {
        observer.onNext(CapabilitiesResponse.newBuilder()
            .addSupportedOperations(OPERATION)
            .setSupportsStreaming(false)
            .build());
        observer.onCompleted();
    }

    @Override
    public void initialize(InitializeRequest request, StreamObserver<InitializeResponse> observer) {
        status.set(PluginStatus.INACTIVE);
        observer.onNext(InitializeResponse.newBuilder()
            .setSuccess(true).setPluginVersion(PLUGIN_VERSION).build());
        observer.onCompleted();
    }

    @Override
    public void start(StartRequest request, StreamObserver<StartResponse> observer) {
        status.set(PluginStatus.ACTIVE);
        logger.info("script-sandbox started ({} engine)", engineName);
        observer.onNext(StartResponse.newBuilder()
            .setSuccess(true).setStatus(PluginStatus.ACTIVE).build());
        observer.onCompleted();
    }

    @Override
    public void stop(StopRequest request, StreamObserver<StopResponse> observer) {
        status.set(PluginStatus.INACTIVE);
        observer.onNext(StopResponse.newBuilder()
            .setSuccess(true).setStatus(PluginStatus.INACTIVE).build());
        observer.onCompleted();
    }

    @Override
    public void getStatus(StatusRequest request, StreamObserver<StatusResponse> observer) {
        observer.onNext(StatusResponse.newBuilder().setStatus(status.get()).build());
        observer.onCompleted();
    }

    @Override
    public void healthCheck(HealthCheckRequest request, StreamObserver<HealthCheckResponse> observer) {
        boolean active = status.get() == PluginStatus.ACTIVE;
        observer.onNext(HealthCheckResponse.newBuilder()
            .setHealth(active ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY)
            .setMessage(active ? "engine ready (" + engineName + ")" : "not started")
            .build());
        observer.onCompleted();
    }

    // ------------------------------------------------------------------
    // Execution
    // ------------------------------------------------------------------

    @Override
    public void execute(ExecuteRequest request, StreamObserver<ExecuteResponse> observer) {
        if (!OPERATION.equals(request.getOperation())) {
            observer.onNext(ExecuteResponse.newBuilder()
                .setSuccess(false)
                .setErrorCode("UNSUPPORTED_OPERATION")
                .setMessage("script-sandbox supports only '" + OPERATION + "'")
                .build());
            observer.onCompleted();
            return;
        }
        String code = request.getParametersOrDefault("code", "");
        String title = request.getParametersOrDefault("title", "");
        String content = request.getParametersOrDefault("content", "");
        try {
            String output = engine.execute(code, title, content);
            observer.onNext(ExecuteResponse.newBuilder()
                .setSuccess(true)
                .setResultPayload(ByteString.copyFrom(output, StandardCharsets.UTF_8))
                .build());
        } catch (ScriptSandbox.ScriptExecutionException e) {
            observer.onNext(ExecuteResponse.newBuilder()
                .setSuccess(false)
                .setErrorCode("SCRIPT_ERROR")
                .setMessage(e.getMessage())
                .build());
        } catch (Exception e) {
            logger.error("Unexpected sandbox failure", e);
            observer.onNext(ExecuteResponse.newBuilder()
                .setSuccess(false)
                .setErrorCode("INTERNAL")
                .setMessage(e.getMessage() != null ? e.getMessage() : "internal error")
                .build());
        }
        observer.onCompleted();
    }
}
