package com.modulo.config;

import com.modulo.service.TracingService;
import io.opentelemetry.api.trace.SpanKind;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.handler.WebSocketHandlerDecorator;

import java.util.HashMap;
import java.util.Map;

@Configuration
@EnableWebSocket
@RequiredArgsConstructor
@Slf4j
public class WebSocketTracingConfig {

    private final TracingService tracingService;

    public WebSocketHandlerDecorator createTracingDecorator(org.springframework.web.socket.WebSocketHandler handler) {
        return new WebSocketHandlerDecorator(handler) {
            @Override
            public void afterConnectionEstablished(WebSocketSession session) throws Exception {
                tracingService.traceRunnable("websocket.connection_established", 
                    SpanKind.SERVER, 
                    createSessionAttributes(session), 
                    () -> {
                        try {
                            super.afterConnectionEstablished(session);
                        } catch (Exception e) {
                            throw new RuntimeException(e);
                        }
                    });
            }

            @Override
            public void handleMessage(WebSocketSession session, WebSocketMessage<?> message) throws Exception {
                Map<String, String> attributes = createSessionAttributes(session);
                attributes.put("message.type", message.getClass().getSimpleName());
                attributes.put("message.size", String.valueOf(message.getPayloadLength()));

                tracingService.traceRunnable("websocket.message_received", 
                    SpanKind.SERVER, 
                    attributes, 
                    () -> {
                        try {
                            super.handleMessage(session, message);
                        } catch (Exception e) {
                            throw new RuntimeException(e);
                        }
                    });
            }

            @Override
            public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
                tracingService.traceRunnable("websocket.transport_error", 
                    SpanKind.SERVER, 
                    createSessionAttributes(session), 
                    () -> {
                        try {
                            super.handleTransportError(session, exception);
                        } catch (Exception e) {
                            throw new RuntimeException(e);
                        }
                    });
            }

            @Override
            public void afterConnectionClosed(WebSocketSession session, CloseStatus closeStatus) throws Exception {
                Map<String, String> attributes = createSessionAttributes(session);
                attributes.put("close.status.code", String.valueOf(closeStatus.getCode()));
                attributes.put("close.status.reason", closeStatus.getReason());

                tracingService.traceRunnable("websocket.connection_closed", 
                    SpanKind.SERVER, 
                    attributes, 
                    () -> {
                        try {
                            super.afterConnectionClosed(session, closeStatus);
                        } catch (Exception e) {
                            throw new RuntimeException(e);
                        }
                    });
            }

            private Map<String, String> createSessionAttributes(WebSocketSession session) {
                Map<String, String> attributes = new HashMap<>();
                attributes.put("websocket.session.id", session.getId());
                attributes.put("websocket.remote.address", 
                    session.getRemoteAddress() != null ? session.getRemoteAddress().toString() : "unknown");
                attributes.put("websocket.uri", 
                    session.getUri() != null ? session.getUri().toString() : "unknown");
                return attributes;
            }
        };
    }
}
