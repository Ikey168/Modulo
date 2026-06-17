package com.modulo.controller;

import com.modulo.plugin.api.HealthCheck;
import com.modulo.plugin.api.PluginException;
import com.modulo.plugin.manager.PluginManager;
import com.modulo.plugin.manager.PluginStatus;
import com.modulo.plugin.manager.RemotePluginLoader;
import com.modulo.plugin.registry.PluginRegistry;
import com.modulo.plugin.repository.PluginRepositoryService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(locations = "classpath:application-test.properties")
@WithMockUser
class PluginControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private PluginManager pluginManager;
    @MockBean
    private PluginRegistry pluginRegistry;
    @MockBean
    private RemotePluginLoader remotePluginLoader;
    @MockBean
    private PluginRepositoryService repositoryService;

    @Test
    void getAllPlugins() throws Exception {
        when(pluginRegistry.getAllRegisteredPlugins()).thenReturn(List.of());

        mockMvc.perform(get("/api/plugins"))
                .andExpect(status().isOk());
    }

    @Test
    void getPluginNotFound() throws Exception {
        when(pluginRegistry.getByName("missing")).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/plugins/missing"))
                .andExpect(status().isNotFound());
    }

    @Test
    void uninstallPlugin() throws Exception {
        mockMvc.perform(delete("/api/plugins/p1").with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        verify(pluginManager).uninstallPlugin("p1");
    }

    @Test
    void uninstallPluginFailure() throws Exception {
        doThrow(new PluginException("nope")).when(pluginManager).uninstallPlugin("bad");

        mockMvc.perform(delete("/api/plugins/bad").with(csrf()))
                .andExpect(status().isBadRequest());
    }

    @Test
    void startPlugin() throws Exception {
        mockMvc.perform(post("/api/plugins/p1/start").with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        verify(pluginManager).startPlugin("p1");
    }

    @Test
    void stopPlugin() throws Exception {
        mockMvc.perform(post("/api/plugins/p1/stop").with(csrf()))
                .andExpect(status().isOk());

        verify(pluginManager).stopPlugin("p1");
    }

    @Test
    void getPluginStatus() throws Exception {
        when(pluginManager.getPluginStatus("p1")).thenReturn(PluginStatus.ACTIVE);
        when(pluginManager.checkPluginHealth("p1")).thenReturn(HealthCheck.healthy("ok"));

        mockMvc.perform(get("/api/plugins/p1/status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pluginId").value("p1"));
    }
}
