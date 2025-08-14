package com.modulo.auth;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.IOException;

@Component("oauth2LoginSuccessHandler")
public class OAuth2LoginSuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private String frontendCallbackUrl = "http://localhost:3000/auth/callback";

    public OAuth2LoginSuccessHandler() {
        setDefaultTargetUrl(frontendCallbackUrl);
        setTargetUrlParameter("redirectTo"); 
    }

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response, Authentication authentication) throws IOException, ServletException {
        if (response.isCommitted()) {
            logger.debug("Response has already been committed. Unable to redirect to " + frontendCallbackUrl);
            return;
        }
        String targetUrl = UriComponentsBuilder.fromUriString(frontendCallbackUrl)
                .queryParam("loginSuccess", "true")
                .build().toUriString();
        
        getRedirectStrategy().sendRedirect(request, response, targetUrl);
        super.clearAuthenticationAttributes(request); 
    }
}