package com.modulo.integrations.praxis;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** The Praxis client exists only when a deployment enables it; its TLS material is checked at startup. */
@Configuration
@EnableConfigurationProperties(PraxisProperties.class)
public class PraxisConfig {
  @Bean
  @ConditionalOnProperty(prefix = "modulo.praxis", name = "enabled", havingValue = "true")
  public PraxisClient praxisClient(PraxisProperties properties, ObjectMapper json) {
    return new PraxisClient(properties, json);
  }
}
