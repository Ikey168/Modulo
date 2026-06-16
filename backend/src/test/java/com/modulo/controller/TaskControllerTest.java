package com.modulo.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.modulo.entity.Task;
import com.modulo.service.TaskService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(locations = "classpath:application-test.properties")
@WithMockUser
class TaskControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private TaskService taskService;

    private Task task;

    @BeforeEach
    void setUp() {
        task = new Task("Title", "Desc", 100L);
        task.setId(1L);
        task.setStatus(Task.TaskStatus.TODO);
        task.setPriority(Task.TaskPriority.MEDIUM);
    }

    @Test
    void getAllTasksByUser() throws Exception {
        when(taskService.findByUserId(100L)).thenReturn(List.of(task));

        mockMvc.perform(get("/api/tasks").param("userId", "100"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].title").value("Title"));

        verify(taskService).findByUserId(100L);
    }

    @Test
    void getAllTasksByStatus() throws Exception {
        when(taskService.findByUserIdAndStatus(100L, Task.TaskStatus.TODO)).thenReturn(List.of(task));

        mockMvc.perform(get("/api/tasks").param("userId", "100").param("status", "TODO"))
                .andExpect(status().isOk());

        verify(taskService).findByUserIdAndStatus(100L, Task.TaskStatus.TODO);
    }

    @Test
    void getAllTasksByPriority() throws Exception {
        when(taskService.findByUserIdAndPriority(100L, Task.TaskPriority.MEDIUM)).thenReturn(List.of(task));

        mockMvc.perform(get("/api/tasks").param("userId", "100").param("priority", "MEDIUM"))
                .andExpect(status().isOk());

        verify(taskService).findByUserIdAndPriority(100L, Task.TaskPriority.MEDIUM);
    }

    @Test
    void getTaskByIdFound() throws Exception {
        when(taskService.findById(1L)).thenReturn(Optional.of(task));

        mockMvc.perform(get("/api/tasks/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1));
    }

    @Test
    void getTaskByIdNotFound() throws Exception {
        when(taskService.findById(2L)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/tasks/2"))
                .andExpect(status().isNotFound());
    }

    @Test
    void createTask() throws Exception {
        when(taskService.createTask(any(Task.class))).thenReturn(task);

        mockMvc.perform(post("/api/tasks").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(task)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.title").value("Title"));
    }

    @Test
    void updateTask() throws Exception {
        when(taskService.updateTask(any(Task.class))).thenReturn(task);

        mockMvc.perform(put("/api/tasks/1").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(task)))
                .andExpect(status().isOk());

        verify(taskService).updateTask(any(Task.class));
    }

    @Test
    void deleteTask() throws Exception {
        doNothing().when(taskService).deleteTask(1L);

        mockMvc.perform(delete("/api/tasks/1").with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        verify(taskService).deleteTask(1L);
    }

    @Test
    void completeTask() throws Exception {
        when(taskService.completeTask(1L)).thenReturn(task);

        mockMvc.perform(put("/api/tasks/1/complete").with(csrf()))
                .andExpect(status().isOk());
    }

    @Test
    void updateProgressValid() throws Exception {
        when(taskService.updateProgress(1L, 60)).thenReturn(task);

        mockMvc.perform(put("/api/tasks/1/progress").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("progressPercentage", 60))))
                .andExpect(status().isOk());

        verify(taskService).updateProgress(1L, 60);
    }

    @Test
    void updateProgressInvalid() throws Exception {
        mockMvc.perform(put("/api/tasks/1/progress").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("progressPercentage", 150))))
                .andExpect(status().isBadRequest());

        verify(taskService, never()).updateProgress(anyLong(), anyInt());
    }

    @Test
    void getOverdueTasks() throws Exception {
        when(taskService.findOverdueTasksByUserId(100L)).thenReturn(List.of(task));

        mockMvc.perform(get("/api/tasks/overdue").param("userId", "100"))
                .andExpect(status().isOk());
    }

    @Test
    void getTasksDueToday() throws Exception {
        when(taskService.findTasksDueTodayByUserId(100L)).thenReturn(List.of(task));

        mockMvc.perform(get("/api/tasks/due-today").param("userId", "100"))
                .andExpect(status().isOk());
    }

    @Test
    void getTasksDueThisWeek() throws Exception {
        when(taskService.findTasksDueThisWeekByUserId(100L)).thenReturn(List.of(task));

        mockMvc.perform(get("/api/tasks/due-this-week").param("userId", "100"))
                .andExpect(status().isOk());
    }
}
