package com.modulo.config;

import com.modulo.auth.OAuth2LoginSuccessHandler;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configuration.WebSecurityConfigurerAdapter;

@Configuration
@EnableWebSecurity
public class SecurityConfig extends WebSecurityConfigurerAdapter {

    private static final Logger logger = LoggerFactory.getLogger(SecurityConfig.class);

    @Autowired
    private OAuth2LoginSuccessHandler oauth2LoginSuccessHandler;

    @Override
    protected void configure(HttpSecurity http) throws Exception {
        logger.debug("Configuring HttpSecurity");
        
        http
            .authorizeRequests()
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
            .and()
            .oauth2Login()
                .successHandler(oauth2LoginSuccessHandler)
            .and()
            .logout()
                .logoutUrl("/logout")
                .logoutSuccessUrl("/")
                .invalidateHttpSession(true)
                .deleteCookies("JSESSIONID")
            .and()
            .csrf()
                .ignoringAntMatchers("/actuator/**", "/logout")
                .disable() // Temporarily disabled for testing
            .cors(); // Enable CORS processing

        logger.debug("Security configuration completed");
    }
}