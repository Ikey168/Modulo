package com.modulo.plugin.event;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.modulo.entity.Note;
import com.modulo.entity.User;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;

/**
 * Serializes {@link PluginEvent}s into the wire envelope shared by the gRPC
 * event stream (#390) and the NATS bridge (#391), and back.
 *
 * The payload is deliberately shallow — entity identity plus the event's
 * metadata map — not a full entity graph: external consumers fetch what they
 * need through the permission-gated host API instead of receiving entities
 * they may not be allowed to see. schema_version 1; evolution is
 * additive-only, same discipline as the proto contract.
 */
public final class EventEnvelopeCodec {

    public static final int SCHEMA_VERSION = 1;
    /** Origin of events born in this JVM. */
    public static final String ORIGIN_CORE = "core";

    private static final ObjectMapper JSON = new ObjectMapper();

    private EventEnvelopeCodec() {}

    /** One decoded wire event; mirrors the proto/NATS envelope field-for-field. */
    public static final class Envelope {
        public final String id;
        public final String type;
        public final int schemaVersion;
        public final String timestamp;
        public final String origin;
        public final String jsonPayload;

        public Envelope(String id, String type, int schemaVersion,
                        String timestamp, String origin, String jsonPayload) {
            this.id = id;
            this.type = type;
            this.schemaVersion = schemaVersion;
            this.timestamp = timestamp;
            this.origin = origin;
            this.jsonPayload = jsonPayload;
        }
    }

    /** Encode an in-JVM event for the wire, stamping the given origin. */
    public static Envelope encode(PluginEvent event, String origin) {
        ObjectNode payload = JSON.createObjectNode();

        Object source = event.getSource();
        if (source instanceof Note) {
            Note note = (Note) source;
            ObjectNode n = payload.putObject("note");
            if (note.getId() != null) n.put("id", note.getId());
            if (note.getTitle() != null) n.put("title", note.getTitle());
        } else if (source instanceof User) {
            User user = (User) source;
            ObjectNode u = payload.putObject("user");
            if (user.getId() != null) u.put("id", user.getId());
            if (user.getUsername() != null) u.put("username", user.getUsername());
        }

        Map<String, Object> metadata = event.getMetadata();
        if (metadata != null && !metadata.isEmpty()) {
            payload.set("metadata", JSON.valueToTree(metadata));
        }

        return new Envelope(
            event.getId(),
            event.getType(),
            SCHEMA_VERSION,
            event.getTimestamp().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME),
            origin,
            payload.toString());
    }

    /**
     * Decode a wire envelope into a {@link RemotePluginEvent} for the in-JVM
     * bus. The payload's metadata object (if any) is restored; the entity
     * identity fields ride along under their payload keys.
     */
    public static RemotePluginEvent decode(Envelope envelope) {
        Map<String, Object> metadata = new HashMap<>();
        try {
            JsonNode payload = JSON.readTree(
                envelope.jsonPayload == null || envelope.jsonPayload.isEmpty()
                    ? "{}" : envelope.jsonPayload);
            JsonNode meta = payload.get("metadata");
            if (meta != null && meta.isObject()) {
                for (Iterator<String> it = meta.fieldNames(); it.hasNext(); ) {
                    String field = it.next();
                    metadata.put(field, JSON.convertValue(meta.get(field), Object.class));
                }
            }
            for (String entity : new String[] {"note", "user"}) {
                if (payload.has(entity)) {
                    metadata.put(entity, JSON.convertValue(payload.get(entity), Map.class));
                }
            }
        } catch (Exception e) {
            metadata.put("payloadParseError", e.getMessage());
        }
        metadata.put("wireEventId", envelope.id);
        return new RemotePluginEvent(envelope.type, envelope.origin, metadata);
    }
}
