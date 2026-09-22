package com.modulo.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import javax.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.util.ReflectionTestUtils;

class RateLimitingFilterTest {
    @Test void generationReadsBypassAnExhaustedOrdinaryApiBucketButWritesDoNot() throws Exception {
        var filter = new RateLimitingFilter();
        ReflectionTestUtils.setField(filter, "rateLimitEnabled", true);
        ReflectionTestUtils.setField(filter, "requestsPerMinute", 1);
        ReflectionTestUtils.setField(filter, "burstCapacity", 1);
        filter.initializeBuckets();
        FilterChain chain = mock(FilterChain.class);

        var ordinary = new MockHttpServletRequest("GET", "/api/workspaces/personal/plugin-state/workspace-para");
        ordinary.setRemoteAddr("192.0.2.1");
        filter.doFilter(ordinary, new MockHttpServletResponse(), chain);

        var generation = new MockHttpServletRequest("GET", "/api/workspaces/personal/plugin-state/workspace-para");
        generation.setRemoteAddr("192.0.2.1");
        generation.addParameter("generation", "");
        filter.doFilter(generation, new MockHttpServletResponse(), chain);

        var write = new MockHttpServletRequest("PUT", "/api/workspaces/personal/plugin-state/workspace-para/data");
        write.setRemoteAddr("192.0.2.1");
        write.addParameter("generation", "");
        var rejected = new MockHttpServletResponse();
        filter.doFilter(write, rejected, chain);

        verify(chain, times(2)).doFilter(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
        assertEquals(429, rejected.getStatus());
    }
}
