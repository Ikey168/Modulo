package com.modulo.aspect;

import com.modulo.service.TracingService;
import io.opentelemetry.api.trace.SpanKind;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

@Aspect
@Component
@RequiredArgsConstructor
@Slf4j
public class TracingAspect {

    private final TracingService tracingService;

    @Around("@annotation(traced)")
    public Object traceMethod(ProceedingJoinPoint joinPoint, Traced traced) throws Throwable {
        String className = joinPoint.getTarget().getClass().getSimpleName();
        String methodName = joinPoint.getSignature().getName();
        String operationName = traced.value().isEmpty() ? 
            className + "." + methodName : traced.value();

        Map<String, String> attributes = new HashMap<>();
        attributes.put("component", "service");
        attributes.put("class", className);
        attributes.put("method", methodName);

        // Add parameter information if available
        Object[] args = joinPoint.getArgs();
        if (args != null && args.length > 0) {
            attributes.put("args.count", String.valueOf(args.length));
            for (int i = 0; i < Math.min(args.length, 3); i++) { // Limit to first 3 args
                if (args[i] != null) {
                    String argValue = args[i].toString();
                    if (argValue.length() > 100) {
                        argValue = argValue.substring(0, 97) + "...";
                    }
                    attributes.put("args." + i, argValue);
                }
            }
        }

        return tracingService.traceFunction(operationName, SpanKind.INTERNAL, attributes, () -> {
            try {
                return joinPoint.proceed();
            } catch (Throwable throwable) {
                throw new RuntimeException(throwable);
            }
        });
    }

    @Around("@within(org.springframework.stereotype.Service) && " +
            "!@annotation(com.modulo.aspect.NoTrace) && " +
            "execution(public * *(..))")
    public Object traceServiceMethods(ProceedingJoinPoint joinPoint) throws Throwable {
        String className = joinPoint.getTarget().getClass().getSimpleName();
        String methodName = joinPoint.getSignature().getName();
        String operationName = className + "." + methodName;

        Map<String, String> attributes = new HashMap<>();
        attributes.put("component", "service");
        attributes.put("class", className);
        attributes.put("method", methodName);

        return tracingService.traceFunction(operationName, SpanKind.INTERNAL, attributes, () -> {
            try {
                return joinPoint.proceed();
            } catch (Throwable throwable) {
                throw new RuntimeException(throwable);
            }
        });
    }

    @Around("@within(org.springframework.stereotype.Repository) && " +
            "!@annotation(com.modulo.aspect.NoTrace) && " +
            "execution(public * *(..))")
    public Object traceRepositoryMethods(ProceedingJoinPoint joinPoint) throws Throwable {
        String className = joinPoint.getTarget().getClass().getSimpleName();
        String methodName = joinPoint.getSignature().getName();
        String operationName = "db." + className + "." + methodName;

        Map<String, String> attributes = new HashMap<>();
        attributes.put("component", "database");
        attributes.put("db.operation", methodName);
        attributes.put("class", className);

        return tracingService.traceFunction(operationName, SpanKind.CLIENT, attributes, () -> {
            try {
                return joinPoint.proceed();
            } catch (Throwable throwable) {
                throw new RuntimeException(throwable);
            }
        });
    }
}
