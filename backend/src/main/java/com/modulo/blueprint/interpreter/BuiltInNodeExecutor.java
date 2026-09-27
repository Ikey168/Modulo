package com.modulo.blueprint.interpreter;

import com.modulo.blueprint.execution.WorkflowRunService;

import java.util.Map;

/**
 * Executes the core (built-in) Blueprint node types. Each node family lives in its
 * own class; this class only maps a node type to its implementation.
 */
final class BuiltInNodeExecutor {

    private final NoteNodes notes;
    private final AuditNodes audit;
    private final BookkeepingNodes bookkeeping;
    private final ServiceNodes services;
    private final SandboxNodes sandbox;
    private final LogicNodes logic;

    BuiltInNodeExecutor(InterpreterDependencies deps) {
        this.notes = new NoteNodes(deps);
        this.audit = new AuditNodes(deps);
        this.bookkeeping = new BookkeepingNodes(deps);
        this.services = new ServiceNodes(deps);
        this.sandbox = new SandboxNodes(deps);
        this.logic = new LogicNodes(deps);
    }

    NodeResult execute(BlueprintIRGraph.IRNode node, Map<String, Object> inputs, WorkflowRunService.Lease lease) {
        Map<String, Object> config = node.getConfig();
        return switch (node.getType()) {
            case "action.note.create" -> notes.createNote(inputs);
            case "action.tag.add" -> notes.addTag(inputs);
            case "action.note.anchor" -> services.anchorNote(inputs);
            case "action.ai.summarize" -> services.summarize(inputs);
            case "action.noesis.brief" -> services.noesisBrief(inputs);
            case "action.code.execute" -> sandbox.executeScript(config, inputs);
            case "action.wasm.execute" -> sandbox.executeWasm(config, inputs);
            case "action.audit.reaudit" -> audit.reaudit(inputs);
            case "action.audit.digest" -> audit.digest(inputs);
            case "action.tax.deadline.reminder" -> bookkeeping.deadlineReminder(config);
            case "action.invoice.chase" -> bookkeeping.chaseInvoices();
            case "action.vies.check" -> bookkeeping.viesCheck(inputs);
            case "action.approval.request" -> logic.requestApproval(node, inputs, lease);
            case "logic.approval.wait" -> logic.waitForApproval(inputs);
            case "logic.approval.result" -> logic.approvalResult(inputs, lease);
            case "logic.wait" -> logic.validateWait(config);
            case "logic.branch" -> logic.branch(inputs);
            case "logic.notes.filter" -> logic.filterNotes(inputs);
            default -> throw new UnsupportedOperationException("Unknown node type: " + node.getType());
        };
    }
}
