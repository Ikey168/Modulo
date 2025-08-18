package com.modulo.service;

import io.opentelemetry.api.OpenTelemetry;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.SpanKind;
import io.opentelemetry.api.trace.StatusCode;
import io.opentelemetry.api.trace.Tracer;
import io.opentelemetry.context.Context;
import io.opentelemetry.context.Scope;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.function.Supplier;

@Service
@RequiredArgsConstructor
@Slf4j
public class TracingService {

    private final Tracer tracer;
    private final OpenTelemetry openTelemetry;

    /**
     * Execute a function within a traced span
     */
    public <T> T traceFunction(String operationName, Supplier<T> function) {
        return traceFunction(operationName, SpanKind.INTERNAL, null, function);
    }

    /**
     * Execute a function within a traced span with attributes
     */
    public <T> T traceFunction(String operationName, Map<String, String> attributes, Supplier<T> function) {
        return traceFunction(operationName, SpanKind.INTERNAL, attributes, function);
    }

    /**
     * Execute a function within a traced span with kind and attributes
     */
    public <T> T traceFunction(String operationName, SpanKind spanKind, Map<String, String> attributes, Supplier<T> function) {
        Span span = tracer.spanBuilder(operationName)
                .setSpanKind(spanKind)
                .startSpan();

        if (attributes != null) {
            attributes.forEach(span::setAttribute);
        }

        try (Scope scope = span.makeCurrent()) {
            T result = function.get();
            span.setStatus(StatusCode.OK);
            return result;
        } catch (Exception e) {
            span.setStatus(StatusCode.ERROR, e.getMessage());
            span.recordException(e);
            throw e;
        } finally {
            span.end();
        }
    }

    /**
     * Execute a runnable within a traced span
     */
    public void traceRunnable(String operationName, Runnable runnable) {
        traceRunnable(operationName, SpanKind.INTERNAL, null, runnable);
    }

    /**
     * Execute a runnable within a traced span with attributes
     */
    public void traceRunnable(String operationName, Map<String, String> attributes, Runnable runnable) {
        traceRunnable(operationName, SpanKind.INTERNAL, attributes, runnable);
    }

    /**
     * Execute a runnable within a traced span with kind and attributes
     */
    public void traceRunnable(String operationName, SpanKind spanKind, Map<String, String> attributes, Runnable runnable) {
        Span span = tracer.spanBuilder(operationName)
                .setSpanKind(spanKind)
                .startSpan();

        if (attributes != null) {
            attributes.forEach(span::setAttribute);
        }

        try (Scope scope = span.makeCurrent()) {
            runnable.run();
            span.setStatus(StatusCode.OK);
        } catch (Exception e) {
            span.setStatus(StatusCode.ERROR, e.getMessage());
            span.recordException(e);
            throw e;
        } finally {
            span.end();
        }
    }

    /**
     * Get current span
     */
    public Span getCurrentSpan() {
        return Span.current();
    }

    /**
     * Add attribute to current span
     */
    public void addAttribute(String key, String value) {
        Span.current().setAttribute(key, value);
    }

    /**
     * Add event to current span
     */
    public void addEvent(String name) {
        Span.current().addEvent(name);
    }

    /**
     * Add event to current span with attributes
     */
    public void addEvent(String name, Map<String, String> attributes) {
        Span currentSpan = Span.current();
        if (attributes != null && !attributes.isEmpty()) {
            io.opentelemetry.api.common.AttributesBuilder builder = io.opentelemetry.api.common.Attributes.builder();
            attributes.forEach(builder::put);
            currentSpan.addEvent(name, builder.build());
        } else {
            currentSpan.addEvent(name);
        }
    }

    /**
     * Get trace ID from current context
     */
    public String getCurrentTraceId() {
        return Span.current().getSpanContext().getTraceId();
    }

    /**
     * Get span ID from current context
     */
    public String getCurrentSpanId() {
        return Span.current().getSpanContext().getSpanId();
    }
}
