package com.modulo.blueprint.sandbox;

import com.modulo.plugin.api.Plugin;
import com.modulo.plugin.grpc.ExecuteResponse;
import com.modulo.plugin.manager.ExternalPluginProxy;
import com.modulo.plugin.manager.PluginManager;
import com.modulo.plugin.manager.PluginStatus;
import java.util.Map;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Remote-routing {@link ScriptSandbox} (#393): when a healthy EXTERNAL
 * script-sandbox plugin is attached, {@code action.code.execute} scripts run
 * in that workload (pod isolation as the outer wall); otherwise — no plugin
 * registered, pod unhealthy, or a transport failure mid-call — execution
 * falls back to the in-process engine selected by
 * {@code modulo.blueprint.sandbox}. The Pi/minimal path therefore works
 * with zero configuration: no plugin ever attaches, and this class is a
 * pass-through.
 *
 * Failure semantics are deliberately asymmetric: a *script* failure from
 * the remote engine (SCRIPT_ERROR — syntax error, limit breach) is a real
 * result and is rethrown, never retried locally; only *transport* failures
 * fall back.
 */
public class RemoteScriptSandbox implements ScriptSandbox {

    private static final Logger logger = LoggerFactory.getLogger(RemoteScriptSandbox.class);

    public static final String PLUGIN_NAME = "script-sandbox";
    static final String OPERATION = "script.execute";

    private final Supplier<PluginManager> pluginManager;
    private final ScriptSandbox fallback;

    public RemoteScriptSandbox(Supplier<PluginManager> pluginManager, ScriptSandbox fallback) {
        this.pluginManager = pluginManager;
        this.fallback = fallback;
    }

    /** The in-process engine this facade degrades to (visible for tests/diagnostics). */
    public ScriptSandbox getFallback() {
        return fallback;
    }

    @Override
    public String execute(String code, String noteTitle, String noteContent) {
        ExternalPluginProxy remote = healthyRemote();
        if (remote == null) {
            return fallback.execute(code, noteTitle, noteContent);
        }
        ExecuteResponse response;
        try {
            response = remote.execute(OPERATION, Map.of(
                "code", code != null ? code : "",
                "title", noteTitle != null ? noteTitle : "",
                "content", noteContent != null ? noteContent : ""),
                (int) (WALL_TIMEOUT_MS / 1000) + 1);
        } catch (Exception e) {
            logger.warn("Remote script-sandbox call failed ({}); falling back in-process",
                e.getMessage());
            return fallback.execute(code, noteTitle, noteContent);
        }
        if (response.getSuccess()) {
            return response.getResultPayload().toStringUtf8();
        }
        if ("SCRIPT_ERROR".equals(response.getErrorCode())) {
            // The script genuinely failed — same meaning as a local failure.
            throw new ScriptExecutionException(response.getMessage());
        }
        logger.warn("Remote script-sandbox returned {} ({}); falling back in-process",
            response.getErrorCode(), response.getMessage());
        return fallback.execute(code, noteTitle, noteContent);
    }

    private ExternalPluginProxy healthyRemote() {
        try {
            PluginManager manager = pluginManager.get();
            if (manager == null) {
                return null;
            }
            Plugin plugin = manager.getActivePlugins().get(PLUGIN_NAME);
            if (plugin instanceof ExternalPluginProxy
                    && manager.getPluginStatus(PLUGIN_NAME) == PluginStatus.ACTIVE) {
                return (ExternalPluginProxy) plugin;
            }
        } catch (Exception e) {
            logger.debug("Remote sandbox lookup failed: {}", e.getMessage());
        }
        return null;
    }
}
