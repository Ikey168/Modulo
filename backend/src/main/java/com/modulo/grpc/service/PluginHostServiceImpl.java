package com.modulo.grpc.service;

import com.modulo.entity.Note;
import com.modulo.grpc.PluginAuthInterceptor;
import com.modulo.plugin.api.NotePluginAPI;
import com.modulo.plugin.api.SearchCriteria;
import com.modulo.plugin.event.EventEnvelopeCodec;
import com.modulo.plugin.event.PluginEvent;
import com.modulo.plugin.event.PluginEventBus;
import com.modulo.plugin.event.PluginEventListener;
import com.modulo.plugin.event.RemotePluginEvent;
import com.modulo.plugin.grpc.*;
import com.modulo.plugin.manager.PluginSecurityManager;
import io.grpc.Status;
import io.grpc.StatusRuntimeException;
import io.grpc.stub.ServerCallStreamObserver;
import io.grpc.stub.StreamObserver;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import net.devh.boot.grpc.server.service.GrpcService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

/**
 * Host surface external plugins call back into (#390): the NotePluginAPI
 * subset plus the event bridge, every RPC gated by the calling plugin's
 * granted permissions. Identity is established by {@link PluginAuthInterceptor};
 * this class only ever trusts {@code PLUGIN_ID} from the gRPC context.
 *
 * v1 note: {@code NotePayload.tags} is populated on reads; writes ignore it
 * (tag mutation stays with the interpreter/services that own tag semantics).
 */
@GrpcService
@ConditionalOnProperty(name = "modulo.features.enable-grpc", havingValue = "true")
public class PluginHostServiceImpl extends PluginHostServiceGrpc.PluginHostServiceImplBase {

    private static final Logger logger = LoggerFactory.getLogger(PluginHostServiceImpl.class);

    private static final int MAX_SEARCH_LIMIT = 100;
    private static final int DEFAULT_SEARCH_LIMIT = 20;

    @Autowired private NotePluginAPI notePluginAPI;
    @Autowired private PluginSecurityManager securityManager;
    @Autowired private PluginEventBus eventBus;

    // ------------------------------------------------------------------
    // Note operations
    // ------------------------------------------------------------------

    @Override
    public void getNote(GetNoteRequest request, StreamObserver<GetNoteResponse> observer) {
        try {
            requirePermission("notes.read");
            Optional<Note> note = notePluginAPI.findById(request.getNoteId());
            GetNoteResponse.Builder response = GetNoteResponse.newBuilder().setFound(note.isPresent());
            note.ifPresent(n -> response.setNote(toPayload(n)));
            observer.onNext(response.build());
            observer.onCompleted();
        } catch (StatusRuntimeException e) {
            observer.onError(e);
        } catch (Exception e) {
            observer.onError(internal(e));
        }
    }

    @Override
    public void saveNote(SaveNoteRequest request, StreamObserver<SaveNoteResponse> observer) {
        try {
            requirePermission("notes.write");
            NotePayload payload = request.getNote();
            Note note;
            if (payload.getId() > 0) {
                note = notePluginAPI.findById(payload.getId()).orElseThrow(() ->
                    Status.NOT_FOUND.withDescription("note " + payload.getId() + " not found")
                        .asRuntimeException());
            } else {
                note = new Note();
            }
            note.setTitle(payload.getTitle());
            note.setContent(payload.getContent());
            Note saved = notePluginAPI.save(note);
            observer.onNext(SaveNoteResponse.newBuilder().setNoteId(saved.getId()).build());
            observer.onCompleted();
        } catch (StatusRuntimeException e) {
            observer.onError(e);
        } catch (Exception e) {
            observer.onError(internal(e));
        }
    }

    @Override
    public void deleteNote(DeleteNoteRequest request, StreamObserver<DeleteNoteResponse> observer) {
        try {
            requirePermission("notes.delete");
            notePluginAPI.delete(request.getNoteId());
            observer.onNext(DeleteNoteResponse.newBuilder().setDeleted(true).build());
            observer.onCompleted();
        } catch (StatusRuntimeException e) {
            observer.onError(e);
        } catch (Exception e) {
            observer.onError(internal(e));
        }
    }

    @Override
    public void searchNotes(HostSearchNotesRequest request,
                            StreamObserver<HostSearchNotesResponse> observer) {
        try {
            requirePermission("notes.read");
            SearchCriteria criteria = new SearchCriteria();
            if (!request.getText().isEmpty()) {
                criteria.setQuery(request.getText());
            }
            if (request.getTagsCount() > 0) {
                criteria.setTags(new ArrayList<>(request.getTagsList()));
            }
            int limit = request.getLimit() <= 0 ? DEFAULT_SEARCH_LIMIT
                : Math.min(request.getLimit(), MAX_SEARCH_LIMIT);
            criteria.setLimit(limit);
            List<Note> notes = notePluginAPI.search(criteria);
            observer.onNext(HostSearchNotesResponse.newBuilder()
                .addAllNotes(notes.stream().map(this::toPayload).collect(Collectors.toList()))
                .build());
            observer.onCompleted();
        } catch (StatusRuntimeException e) {
            observer.onError(e);
        } catch (Exception e) {
            observer.onError(internal(e));
        }
    }

    @Override
    public void addNoteMetadata(AddNoteMetadataRequest request,
                                StreamObserver<AddNoteMetadataResponse> observer) {
        try {
            requirePermission("notes.write");
            Map<String, Object> metadata = new HashMap<>(request.getMetadataMap());
            notePluginAPI.addMetadata(request.getNoteId(), metadata);
            observer.onNext(AddNoteMetadataResponse.newBuilder().setSuccess(true).build());
            observer.onCompleted();
        } catch (StatusRuntimeException e) {
            observer.onError(e);
        } catch (Exception e) {
            observer.onError(internal(e));
        }
    }

    // ------------------------------------------------------------------
    // Event bridge
    // ------------------------------------------------------------------

    @Override
    public void publishEvent(PublishEventRequest request, StreamObserver<PublishEventResponse> observer) {
        try {
            String pluginId = requirePermission("system.events.publish");
            EventEnvelope wire = request.getEvent();
            // Origin is asserted by the host from the authenticated identity —
            // a plugin cannot spoof 'core' and trip someone's loop protection.
            RemotePluginEvent event = EventEnvelopeCodec.decode(new EventEnvelopeCodec.Envelope(
                wire.getId(), wire.getType(), wire.getSchemaVersion(),
                wire.getTimestamp(), "plugin:" + pluginId, wire.getJsonPayload()));
            eventBus.publish(event);
            observer.onNext(PublishEventResponse.newBuilder().setAccepted(true).build());
            observer.onCompleted();
        } catch (StatusRuntimeException e) {
            observer.onError(e);
        } catch (Exception e) {
            observer.onError(internal(e));
        }
    }

    @Override
    public void subscribeEvents(SubscribeEventsRequest request, StreamObserver<EventEnvelope> observer) {
        String pluginId;
        try {
            pluginId = requirePermission("system.events.subscribe");
        } catch (StatusRuntimeException e) {
            observer.onError(e);
            return;
        }

        ServerCallStreamObserver<EventEnvelope> stream =
            (ServerCallStreamObserver<EventEnvelope>) observer;
        List<Runnable> unsubscribes = new ArrayList<>();
        Object sendLock = new Object();

        for (String type : request.getEventTypesList()) {
            PluginEventListener<PluginEvent> listener = event -> {
                EventEnvelopeCodec.Envelope env =
                    EventEnvelopeCodec.encode(event, EventEnvelopeCodec.ORIGIN_CORE);
                EventEnvelope wire = EventEnvelope.newBuilder()
                    .setId(env.id).setType(env.type).setSchemaVersion(env.schemaVersion)
                    .setTimestamp(env.timestamp).setOrigin(env.origin)
                    .setJsonPayload(env.jsonPayload)
                    .build();
                synchronized (sendLock) {
                    if (!stream.isCancelled()) {
                        stream.onNext(wire);
                    }
                }
            };
            eventBus.subscribe(type, listener);
            unsubscribes.add(() -> eventBus.unsubscribe(type, listener));
        }

        stream.setOnCancelHandler(() -> {
            unsubscribes.forEach(Runnable::run);
            logger.debug("Plugin '{}' event stream cancelled; {} subscriptions removed",
                pluginId, unsubscribes.size());
        });
        logger.info("Plugin '{}' subscribed to events {}", pluginId, request.getEventTypesList());
    }

    // ------------------------------------------------------------------

    /** Returns the authenticated plugin id, or throws PERMISSION_DENIED/UNAUTHENTICATED. */
    private String requirePermission(String permission) {
        String pluginId = PluginAuthInterceptor.PLUGIN_ID.get();
        if (pluginId == null) {
            throw Status.UNAUTHENTICATED.withDescription("no authenticated plugin identity")
                .asRuntimeException();
        }
        if (!securityManager.hasPermission(pluginId, permission)) {
            throw Status.PERMISSION_DENIED.withDescription(
                "plugin '" + pluginId + "' lacks permission '" + permission + "'")
                .asRuntimeException();
        }
        return pluginId;
    }

    private NotePayload toPayload(Note note) {
        NotePayload.Builder builder = NotePayload.newBuilder()
            .setId(note.getId() != null ? note.getId() : 0)
            .setTitle(note.getTitle() != null ? note.getTitle() : "")
            .setContent(note.getContent() != null ? note.getContent() : "");
        if (note.getTags() != null) {
            note.getTags().forEach(tag -> {
                if (tag.getName() != null) builder.addTags(tag.getName());
            });
        }
        return builder.build();
    }

    private static StatusRuntimeException internal(Exception e) {
        return Status.INTERNAL.withDescription(
            e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName())
            .asRuntimeException();
    }
}
