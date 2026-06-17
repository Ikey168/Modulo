package com.modulo.controller;

import com.modulo.service.BlockchainAccessControlService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.Map;
import java.util.concurrent.CompletableFuture;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(locations = "classpath:application-test.properties")
@WithMockUser
class AccessControlControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private BlockchainAccessControlService accessControlService;

    @Test
    void grantPermission() throws Exception {
        when(accessControlService.grantPermission(anyLong(), anyString(), any(), anyString()))
                .thenReturn(CompletableFuture.completedFuture(Map.of("success", true)));

        MvcResult result = mockMvc.perform(post("/api/access-control/notes/1/permissions/grant").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"granteeAddress\":\"0x1\",\"permission\":\"READ\",\"granterAddress\":\"0x2\"}"))
                .andExpect(request().asyncStarted())
                .andReturn();

        mockMvc.perform(asyncDispatch(result))
                .andExpect(status().isOk());
    }

    @Test
    void checkPermission() throws Exception {
        when(accessControlService.checkPermission(anyLong(), anyString()))
                .thenReturn(CompletableFuture.completedFuture(Map.of("hasPermission", true)));

        MvcResult result = mockMvc.perform(get("/api/access-control/notes/1/permissions/check")
                        .param("userAddress", "0xabc"))
                .andExpect(request().asyncStarted())
                .andReturn();

        mockMvc.perform(asyncDispatch(result))
                .andExpect(status().isOk());
    }
}
