package com.modulo.blueprint.sandbox;

import com.modulo.plugin.manager.PluginManager;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Selects the {@link ScriptSandbox} implementation via
 * {@code modulo.blueprint.sandbox} (#397).
 *
 *   rhino (default) — {@link RhinoScriptSandbox}, the original engine
 *   wasm            — {@link WasmScriptSandbox}, QuickJS-on-WASM (#398)
 *
 * An unknown value fails startup loudly rather than silently falling back:
 * a typo must never quietly select a different isolation engine.
 *
 * Since #393 the selected engine is wrapped in {@link RemoteScriptSandbox}:
 * when a healthy EXTERNAL script-sandbox plugin is attached, execution
 * routes to that workload; otherwise the wrapper is a pass-through to the
 * local engine — zero configuration on the Pi/minimal path.
 */
@Configuration
public class ScriptSandboxConfig {

    private static final Logger logger = LoggerFactory.getLogger(ScriptSandboxConfig.class);

    @Bean
    public ScriptSandbox scriptSandbox(@Value("${modulo.blueprint.sandbox:rhino}") String engine,
                                       ObjectProvider<PluginManager> pluginManager) {
        return new RemoteScriptSandbox(pluginManager::getIfAvailable, localEngine(engine));
    }

    /** The in-process engine selection (#397) — package-visible for tests. */
    ScriptSandbox localEngine(String engine) {
        switch (engine) {
            case "rhino":
                logger.info("Blueprint script sandbox: rhino");
                return new RhinoScriptSandbox();
            case "wasm":
                logger.info("Blueprint script sandbox: wasm (QuickJS via quickjs4j)");
                return new WasmScriptSandbox();
            default:
                throw new IllegalStateException(
                    "Unknown modulo.blueprint.sandbox value '" + engine + "' — expected 'rhino' or 'wasm'");
        }
    }
}
