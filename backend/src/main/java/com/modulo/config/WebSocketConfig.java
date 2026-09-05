package com.modulo.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * WebSocket configuration for real-time note synchronization
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {
    @org.springframework.beans.factory.annotation.Value("${modulo.security.allowed-origins:}")
    private String[] allowedOrigins;
    private final com.modulo.security.OwnedSocketInterceptor ownership;
    public WebSocketConfig(com.modulo.security.OwnedSocketInterceptor ownership) { this.ownership = ownership; }
    @Override public void configureClientInboundChannel(org.springframework.messaging.simp.config.ChannelRegistration registration) {
        registration.interceptors(ownership);
    }
    @Override public void configureClientOutboundChannel(org.springframework.messaging.simp.config.ChannelRegistration registration) {
        registration.interceptors(ownership.outbound());
    }


    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // Enable a simple memory-based message broker to carry messages back to the client
        // on destinations prefixed with "/topic"
        config.enableSimpleBroker("/topic", "/queue");
        config.setUserDestinationPrefix("/user");
        
        // Designate the "/app" prefix for messages bound for @MessageMapping-annotated methods
        config.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // Register the "/ws" endpoint for WebSocket connections
        registry.addEndpoint("/ws")
                .setAllowedOrigins(allowedOrigins)  // Empty means same-origin; additional origins must be configured.
                .withSockJS();  // Enable SockJS fallback options
    }
}
