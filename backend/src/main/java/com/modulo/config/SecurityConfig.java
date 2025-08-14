package com.modulo.config;

import com.modulo.auth.OAuth2LoginSuccessHandler;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private static final Logger logger = LoggerFactory.getLogger(SecurityConfig.class);

    @Autowired
    private OAuth2LoginSuccessHandler oauth2LoginSuccessHandler;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        logger.debug("Configuring HttpSecurity");
        
        http
            .authorizeRequests(authz -> authz
                .antMatchers("/actuator/**").permitAll()
                .antMatchers("/", "/index.html", "/static/**", 
                    "/favicon.ico", "/manifest.json", "/logo*.png",
                    "/*.js", "/*.css").permitAll()
                .antMatchers("/error", "/login").permitAll()
                .antMatchers("/oauth2/**", "/login/**").permitAll()
                .antMatchers("/api/public/**").permitAll()
                .antMatchers("/logout").authenticated() // Ensure only authenticated users can logout
                .antMatchers("/user/me").authenticated()
                .anyRequest().authenticated()
            )
            .oauth2Login(oauth2 -> oauth2
                .successHandler(oauth2LoginSuccessHandler)
            )
            .logout(logout -> logout
                .logoutUrl("/logout")
                .logoutSuccessUrl("/")
                .invalidateHttpSession(true)
                .deleteCookies("JSESSIONID")
            )
            .csrf(csrf -> csrf
                .ignoringAntMatchers("/actuator/**", "/logout")
                .disable() // Temporarily disabled for testing
            )
            .cors(cors -> {}); // Enable CORS processing

        logger.debug("Security configuration completed");
        return http.build();
    }
}