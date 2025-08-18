package com.modulo.config;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@RequiredArgsConstructor
public class MetricsConfig {

    private final MeterRegistry meterRegistry;

    @Bean
    public Counter noteCreatedCounter() {
        return Counter.builder("modulo.notes.created")
                .description("Number of notes created")
                .tag("component", "notes")
                .register(meterRegistry);
    }

    @Bean
    public Counter noteUpdatedCounter() {
        return Counter.builder("modulo.notes.updated")
                .description("Number of notes updated")
                .tag("component", "notes")
                .register(meterRegistry);
    }

    @Bean
    public Counter noteDeletedCounter() {
        return Counter.builder("modulo.notes.deleted")
                .description("Number of notes deleted")
                .tag("component", "notes")
                .register(meterRegistry);
    }

    @Bean
    public Timer noteSaveTimer() {
        return Timer.builder("modulo.notes.save.duration")
                .description("Time taken to save notes")
                .tag("component", "notes")
                .register(meterRegistry);
    }

    @Bean
    public Timer noteSearchTimer() {
        return Timer.builder("modulo.notes.search.duration")
                .description("Time taken to search notes")
                .tag("component", "notes")
                .register(meterRegistry);
    }

    @Bean
    public Counter userLoginCounter() {
        return Counter.builder("modulo.users.login")
                .description("Number of user logins")
                .tag("component", "auth")
                .register(meterRegistry);
    }

    @Bean
    public Counter userLogoutCounter() {
        return Counter.builder("modulo.users.logout")
                .description("Number of user logouts")
                .tag("component", "auth")
                .register(meterRegistry);
    }

    @Bean
    public Counter blockchainTransactionCounter() {
        return Counter.builder("modulo.blockchain.transactions")
                .description("Number of blockchain transactions")
                .tag("component", "blockchain")
                .register(meterRegistry);
    }

    @Bean
    public Timer blockchainTransactionTimer() {
        return Timer.builder("modulo.blockchain.transaction.duration")
                .description("Time taken for blockchain transactions")
                .tag("component", "blockchain")
                .register(meterRegistry);
    }

    @Bean
    public Counter websocketConnectionCounter() {
        return Counter.builder("modulo.websocket.connections")
                .description("Number of WebSocket connections")
                .tag("component", "websocket")
                .register(meterRegistry);
    }

    @Bean
    public Counter websocketMessageCounter() {
        return Counter.builder("modulo.websocket.messages")
                .description("Number of WebSocket messages")
                .tag("component", "websocket")
                .register(meterRegistry);
    }

    @Bean
    public Counter apiErrorCounter() {
        return Counter.builder("modulo.api.errors")
                .description("Number of API errors")
                .tag("component", "api")
                .register(meterRegistry);
    }

    @Bean
    public Counter databaseQueryCounter() {
        return Counter.builder("modulo.database.queries")
                .description("Number of database queries")
                .tag("component", "database")
                .register(meterRegistry);
    }

    @Bean
    public Timer databaseQueryTimer() {
        return Timer.builder("modulo.database.query.duration")
                .description("Time taken for database queries")
                .tag("component", "database")
                .register(meterRegistry);
    }
}
