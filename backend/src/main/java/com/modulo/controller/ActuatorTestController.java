package com.modulo.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.actuate.autoconfigure.endpoint.web.WebEndpointProperties;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class ActuatorTestController {

    @Autowired(required = false)
    private WebEndpointProperties webEndpointProperties;

    @GetMapping("/api/actuator-test")
    public Map<String, Object> getActuatorInfo() {
        return Map.of(
            "actuatorEnabled", webEndpointProperties != null,
            "basePath", webEndpointProperties != null ? webEndpointProperties.getBasePath() : "not configured",
            "exposure", webEndpointProperties != null ? webEndpointProperties.getExposure() : "not configured"
        );
    }
}