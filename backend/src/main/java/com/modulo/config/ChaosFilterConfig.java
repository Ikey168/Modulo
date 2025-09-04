package com.modulo.config;

import com.modulo.chaos.ChaosFilter;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;

/**
 * Configuration for chaos engineering filter registration
 */
@Configuration
public class ChaosFilterConfig {

    @Bean
    public FilterRegistrationBean<ChaosFilter> chaosFilterRegistration(ChaosFilter chaosFilter) {
        FilterRegistrationBean<ChaosFilter> registration = new FilterRegistrationBean<>();
        registration.setFilter(chaosFilter);
        registration.addUrlPatterns("/api/*");
        registration.setName("chaosFilter");
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE + 10); // Run after security but before business logic
        return registration;
    }
}
