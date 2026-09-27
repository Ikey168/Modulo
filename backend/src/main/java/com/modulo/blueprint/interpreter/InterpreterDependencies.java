package com.modulo.blueprint.interpreter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.modulo.blueprint.BlueprintCapabilityService;
import com.modulo.blueprint.BlueprintNodeRegistry;
import com.modulo.blueprint.approval.ApprovalService;
import com.modulo.blueprint.execution.WorkflowCheckpointService;
import com.modulo.blueprint.execution.WorkflowRunService;
import com.modulo.blueprint.execution.WorkflowScheduler;
import com.modulo.blueprint.sandbox.ScriptSandbox;
import com.modulo.plugin.event.PluginEventBus;
import com.modulo.blockchain.BlockchainService;
import com.modulo.integrations.noesis.NoesisBriefService;
import com.modulo.note.NoteService;
import com.modulo.integrations.openai.OpenAIService;
import com.modulo.tag.TagService;
import com.modulo.integrations.vies.ViesService;

/**
 * The collaborators injected into {@link BlueprintInterpreterService}. The
 * interpreter's parts (trigger registration, graph walking, node families) read
 * them at call time. Optional collaborators may return {@code null}.
 */
interface InterpreterDependencies {
    WorkflowCheckpointService checkpoints();
    ApprovalService approvals();
    WorkflowScheduler workflowScheduler();
    WorkflowRunService workflowRuns();
    BlueprintCapabilityService capabilityService();
    PluginEventBus eventBus();
    NoteService noteService();
    TagService tagService();
    OpenAIService openAIService();
    BlockchainService blockchainService();
    ScriptSandbox scriptSandbox();
    ViesService viesService();
    NoesisBriefService noesisBriefService();
    ObjectMapper objectMapper();
    BlueprintNodeRegistry nodeRegistry();
}
