package com.modulo.filter;

import com.modulo.service.TracingService;
import com.modulo.util.LogSanitizer;
import io.opentelemetry.api.trace.Span;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import javax.servlet.*;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Collections;
import java.util.UUID;

@Component
@Order(1)
@RequiredArgsConstructor
@Slf4j
public class TracingFilter implements Filter {

    private final TracingService tracingService;

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        
        HttpServletRequest httpRequest = (HttpServletRequest) request;
        HttpServletResponse httpResponse = (HttpServletResponse) response;

        // Get or create request ID
        String requestId = httpRequest.getHeader("X-Request-ID");
        if (requestId == null || requestId.isEmpty()) {
            requestId = UUID.randomUUID().toString();
        }

        // Add request ID to response headers
        httpResponse.setHeader("X-Request-ID", requestId);

        try {
            // Get current trace context
            Span currentSpan = Span.current();
            String traceId = currentSpan.getSpanContext().getTraceId();
            String spanId = currentSpan.getSpanContext().getSpanId();

            // Add trace context to MDC for logging
            MDC.put("traceId", traceId);
            MDC.put("spanId", spanId);
            MDC.put("requestId", requestId);

            // Add custom attributes to current span
            currentSpan.setAttribute("http.request_id", requestId);
            currentSpan.setAttribute("http.method", httpRequest.getMethod());
            currentSpan.setAttribute("http.url", httpRequest.getRequestURL().toString());
            currentSpan.setAttribute("http.scheme", httpRequest.getScheme());
            currentSpan.setAttribute("http.host", httpRequest.getServerName());
            currentSpan.setAttribute("http.target", httpRequest.getRequestURI());
            
            String userAgent = httpRequest.getHeader("User-Agent");
            if (userAgent != null) {
                currentSpan.setAttribute("http.user_agent", userAgent);
            }

            String clientIp = getClientIpAddress(httpRequest);
            if (clientIp != null) {
                currentSpan.setAttribute("http.client_ip", clientIp);
            }

            // Add trace context to response headers for client-side correlation
            httpResponse.setHeader("X-Trace-ID", traceId);
            httpResponse.setHeader("X-Span-ID", spanId);

            log.debug("Processing request: {} {} with trace ID: {}", 
                LogSanitizer.sanitize(httpRequest.getMethod()), 
                LogSanitizer.sanitize(httpRequest.getRequestURI()), 
                LogSanitizer.sanitize(traceId));

            chain.doFilter(request, response);

            // Add response status to span
            currentSpan.setAttribute("http.status_code", String.valueOf(httpResponse.getStatus()));

        } finally {
            // Clean up MDC
            MDC.remove("traceId");
            MDC.remove("spanId");
            MDC.remove("requestId");
        }
    }

    private String getClientIpAddress(HttpServletRequest request) {
        String[] headers = {
            "X-Forwarded-For",
            "X-Real-IP",
            "X-Originating-IP",
            "CF-Connecting-IP",
            "Proxy-Client-IP",
            "WL-Proxy-Client-IP",
            "HTTP_X_FORWARDED_FOR",
            "HTTP_X_FORWARDED",
            "HTTP_X_CLUSTER_CLIENT_IP",
            "HTTP_CLIENT_IP",
            "HTTP_FORWARDED_FOR",
            "HTTP_FORWARDED",
            "HTTP_VIA",
            "REMOTE_ADDR"
        };

        for (String header : headers) {
            String ip = request.getHeader(header);
            if (ip != null && !ip.isEmpty() && !"unknown".equalsIgnoreCase(ip)) {
                // Get first IP if there are multiple (comma-separated)
                return ip.split(",")[0].trim();
            }
        }

        return request.getRemoteAddr();
    }
}
