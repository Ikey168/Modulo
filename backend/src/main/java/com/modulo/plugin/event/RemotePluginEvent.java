package com.modulo.plugin.event;

import java.util.Map;

/**
 * An event that arrived over a process boundary — the gRPC event stream
 * (#390) or the NATS bridge (#391) — re-published onto the in-JVM bus.
 *
 * {@link #getOrigin()} carries where it was born (e.g. {@code plugin:<id>},
 * or another node's {@code core} via the broker); the bridge uses it for
 * loop protection: events whose origin is not this JVM are never re-bridged.
 */
public class RemotePluginEvent extends PluginEvent {

    private final String origin;

    public RemotePluginEvent(String type, String origin, Map<String, Object> metadata) {
        super(type, origin, metadata);
        this.origin = origin;
    }

    public String getOrigin() {
        return origin;
    }
}
