package com.modulo.blueprint;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

/**
 * Compatible execution-history view backed by structured runs and ordered steps.
 * Historical plugin_execution_logs remain readable when no run ID exists.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class BlueprintExecution {

    private String runId;
    public String getRunId() { return runId; }
    public void setRunId(String runId) { this.runId = runId; }
    private String executionType;
    private String status;
    private String message;
    private List<String> executedNodes;
    private Long executionTimeMs;
    private String createdAt;

    public String getExecutionType() { return executionType; }
    public void setExecutionType(String executionType) { this.executionType = executionType; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public List<String> getExecutedNodes() { return executedNodes; }
    public void setExecutedNodes(List<String> executedNodes) { this.executedNodes = executedNodes; }

    public Long getExecutionTimeMs() { return executionTimeMs; }
    public void setExecutionTimeMs(Long executionTimeMs) { this.executionTimeMs = executionTimeMs; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
}
