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
        logger.debug("Configuring SecurityFilterChain");
        
        http
            .authorizeHttpRequests(authorizeRequests -> {
                logger.debug("Configuring authorization rules");
                authorizeRequests
                    .requestMatchers("/actuator/**").permitAll()
                    .requestMatchers("/", "/index.html", "/static/**", 
                        "/favicon.ico", "/manifest.json", "/logo*.png",
                        "/*.js", "/*.css").permitAll()
                    .requestMatchers("/error", "/login").permitAll()
                    .requestMatchers("/oauth2/**", "/login/**").permitAll()
                    .requestMatchers("/api/public/**").permitAll()
                    .requestMatchers("/logout").authenticated() // Ensure only authenticated users can logout
                    .requestMatchers("/user/me").authenticated()
                    .anyRequest().authenticated();
            })
            .oauth2Login(oauth2Login -> {
                logger.debug("Configuring OAuth2 login");
                oauth2Login
                    .successHandler(oauth2LoginSuccessHandler);
            })
            .logout(logout -> {
                logger.debug("Configuring logout");
                logout
                    .logoutUrl("/logout")
                    .logoutSuccessUrl("/")
                    .invalidateHttpSession(true)
                    .deleteCookies("JSESSIONID");
            })
            .csrf(csrf -> {
                logger.debug("Configuring CSRF");
                csrf
                    .ignoringRequestMatchers("/actuator/**", "/logout")
                    .disable(); // Temporarily disabled for testing
            })
            .cors(); // Enable CORS processing

        logger.debug("Security configuration completed");
        return http.build();
    }
}