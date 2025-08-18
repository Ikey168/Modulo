package com.modulo.config;

import io.opentelemetry.api.OpenTelemetry;
import io.opentelemetry.api.common.Attributes;
import io.opentelemetry.api.trace.Tracer;
import io.opentelemetry.exporter.jaeger.JaegerGrpcSpanExporter;
import io.opentelemetry.exporter.otlp.trace.OtlpGrpcSpanExporter;
import io.opentelemetry.sdk.OpenTelemetrySdk;
import io.opentelemetry.sdk.resources.Resource;
import io.opentelemetry.sdk.trace.SdkTracerProvider;
import io.opentelemetry.sdk.trace.export.BatchSpanProcessor;
import io.opentelemetry.sdk.trace.export.SpanExporter;
import io.opentelemetry.semconv.resource.attributes.ResourceAttributes;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

@Configuration
public class OpenTelemetryConfig {

    @Value("${otel.service.name:modulo-backend}")
    private String serviceName;

    @Value("${otel.service.version:1.0.0}")
    private String serviceVersion;

    @Value("${otel.exporter.otlp.endpoint:http://localhost:4317}")
    private String otlpEndpoint;

    @Value("${otel.exporter.jaeger.endpoint:http://localhost:14250}")
    private String jaegerEndpoint;

    @Value("${otel.traces.exporter:otlp}")
    private String tracesExporter;

    @Bean
    public OpenTelemetry openTelemetry() {
        Resource resource = Resource.getDefault()
                .merge(Resource.create(Attributes.of(
                        ResourceAttributes.SERVICE_NAME, serviceName,
                        ResourceAttributes.SERVICE_VERSION, serviceVersion,
                        ResourceAttributes.DEPLOYMENT_ENVIRONMENT, "development"
                )));

        SdkTracerProvider tracerProvider = SdkTracerProvider.builder()
                .addSpanProcessor(BatchSpanProcessor.builder(spanExporter())
                        .setMaxExportBatchSize(512)
                        .build())
                .setResource(resource)
                .build();

        // For tests, don't register globally to avoid conflicts
        return OpenTelemetrySdk.builder()
                .setTracerProvider(tracerProvider)
                .build();
    }

    @Bean
    public Tracer tracer(OpenTelemetry openTelemetry) {
        return openTelemetry.getTracer("modulo-backend");
    }

    private SpanExporter spanExporter() {
        switch (tracesExporter.toLowerCase()) {
            case "jaeger":
                return JaegerGrpcSpanExporter.builder()
                        .setEndpoint(jaegerEndpoint)
                        .build();
            case "otlp":
            default:
                return OtlpGrpcSpanExporter.builder()
                        .setEndpoint(otlpEndpoint)
                        .build();
        }
    }
}
