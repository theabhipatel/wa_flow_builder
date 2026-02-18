import { IFlowData, IValidationResult, IValidationError, IValidationWarning } from '../types';

export const validateFlow = (flowData: IFlowData): IValidationResult => {
    const errors: IValidationError[] = [];
    const warnings: IValidationWarning[] = [];

    const { nodes, edges } = flowData;

    // 1. Exactly one Start node
    const startNodes = nodes.filter((n) => n.nodeType === 'START');
    if (startNodes.length === 0) {
        errors.push({ message: 'Flow must have exactly one Start node' });
    } else if (startNodes.length > 1) {
        errors.push({ message: `Flow has ${startNodes.length} Start nodes, only one is allowed` });
    }

    // 2. At least one End node (warning only)
    const endNodes = nodes.filter((n) => n.nodeType === 'END');
    if (endNodes.length === 0) {
        warnings.push({ message: 'Flow has no End node. Flows should terminate properly.' });
    }

    // 3. Check all nodes have required fields
    for (const node of nodes) {
        switch (node.nodeType) {
            case 'MESSAGE': {
                const config = node.config as { text?: string };
                if (!config.text || config.text.trim() === '') {
                    errors.push({ nodeId: node.nodeId, field: 'text', message: 'Message content is required' });
                }
                break;
            }
            case 'BUTTON': {
                const config = node.config as { messageText?: string; buttons?: Array<{ buttonId: string; label: string }> };
                if (!config.messageText || config.messageText.trim() === '') {
                    errors.push({ nodeId: node.nodeId, field: 'messageText', message: 'Button message text is required' });
                } else if (config.messageText.length > 1024) {
                    errors.push({ nodeId: node.nodeId, field: 'messageText', message: 'Message text must not exceed 1024 characters' });
                }
                if (!config.buttons || config.buttons.length === 0) {
                    errors.push({ nodeId: node.nodeId, field: 'buttons', message: 'At least one button is required' });
                } else {
                    if (config.buttons.length > 3) {
                        errors.push({ nodeId: node.nodeId, field: 'buttons', message: 'Maximum 3 buttons allowed' });
                    }
                    config.buttons.forEach((btn, idx) => {
                        if (!btn.label || btn.label.trim() === '') {
                            errors.push({ nodeId: node.nodeId, field: `buttons[${idx}]`, message: `Button ${idx + 1}: label is required` });
                        } else if (btn.label.length > 20) {
                            errors.push({ nodeId: node.nodeId, field: `buttons[${idx}]`, message: `Button ${idx + 1}: label must not exceed 20 characters` });
                        }
                    });
                }
                break;
            }
            case 'INPUT': {
                const config = node.config as { promptText?: string; variableName?: string };
                if (!config.promptText || config.promptText.trim() === '') {
                    errors.push({ nodeId: node.nodeId, field: 'promptText', message: 'Prompt message is required' });
                }
                if (!config.variableName || config.variableName.trim() === '') {
                    errors.push({ nodeId: node.nodeId, field: 'variableName', message: 'Variable name is required' });
                }
                break;
            }
            case 'CONDITION': {
                const config = node.config as { leftOperand?: string; operator?: string; rightOperand?: string };
                if (!config.leftOperand || config.leftOperand.trim() === '') {
                    errors.push({ nodeId: node.nodeId, field: 'leftOperand', message: 'Left operand is required' });
                }
                if (!config.operator) {
                    errors.push({ nodeId: node.nodeId, field: 'operator', message: 'Operator is required' });
                }
                break;
            }
            case 'DELAY': {
                const config = node.config as { delaySeconds?: number };
                if (!config.delaySeconds || config.delaySeconds <= 0) {
                    errors.push({ nodeId: node.nodeId, field: 'delaySeconds', message: 'Delay duration must be greater than 0' });
                }
                break;
            }
            case 'API': {
                const config = node.config as { url?: string; method?: string };
                if (!config.url || config.url.trim() === '') {
                    errors.push({ nodeId: node.nodeId, field: 'url', message: 'API URL is required' });
                }
                // method defaults to GET if not set — no validation needed
                break;
            }
            case 'AI': {
                const config = node.config as { userMessage?: string; responseVariable?: string };
                if (!config.userMessage || config.userMessage.trim() === '') {
                    errors.push({ nodeId: node.nodeId, field: 'userMessage', message: 'User message template is required' });
                }
                if (!config.responseVariable || config.responseVariable.trim() === '') {
                    errors.push({ nodeId: node.nodeId, field: 'responseVariable', message: 'Response variable name is required' });
                }
                break;
            }
            case 'LOOP': {
                const config = node.config as { loopType?: string; arrayVariable?: string; iterationCount?: number; continueCondition?: string; maxIterations?: number };
                const loopType = config.loopType || 'COUNT_BASED';
                if (loopType === 'FOR_EACH' && (!config.arrayVariable || config.arrayVariable.trim() === '')) {
                    errors.push({ nodeId: node.nodeId, field: 'arrayVariable', message: 'Array variable is required for For Each loops' });
                }
                if (loopType === 'COUNT_BASED' && (!config.iterationCount || config.iterationCount <= 0) && (!config.maxIterations || config.maxIterations <= 0)) {
                    errors.push({ nodeId: node.nodeId, field: 'iterationCount', message: 'Iteration count must be set for Count Based loops' });
                }
                if (loopType === 'CONDITION_BASED' && (!config.continueCondition || config.continueCondition.trim() === '')) {
                    errors.push({ nodeId: node.nodeId, field: 'continueCondition', message: 'Continue condition is required for Condition Based loops' });
                }
                break;
            }
            case 'GOTO_SUBFLOW': {
                const config = node.config as { targetFlowId?: string };
                if (!config.targetFlowId || config.targetFlowId.trim() === '') {
                    errors.push({ nodeId: node.nodeId, field: 'targetFlowId', message: 'Target subflow must be selected' });
                }
                break;
            }
        }
    }

    // 4. Check all nodes are reachable from Start
    if (startNodes.length === 1) {
        const startNodeId = startNodes[0].nodeId;
        const reachable = new Set<string>();

        const traverse = (nodeId: string) => {
            if (reachable.has(nodeId)) return;
            reachable.add(nodeId);

            // Find outgoing edges
            const outgoing = edges.filter((e) => e.sourceNodeId === nodeId);
            for (const edge of outgoing) {
                traverse(edge.targetNodeId);
            }

            // Also check nextNodeId in configs
            const node = nodes.find((n) => n.nodeId === nodeId);
            if (node) {
                const config = node.config as Record<string, unknown>;
                if (config.nextNodeId && typeof config.nextNodeId === 'string') {
                    traverse(config.nextNodeId);
                }
                if (config.successNextNodeId && typeof config.successNextNodeId === 'string') {
                    traverse(config.successNextNodeId);
                }
                if (config.failureNextNodeId && typeof config.failureNextNodeId === 'string') {
                    traverse(config.failureNextNodeId);
                }
                if (config.loopBodyNextNodeId && typeof config.loopBodyNextNodeId === 'string') {
                    traverse(config.loopBodyNextNodeId);
                }
                if (config.exitNextNodeId && typeof config.exitNextNodeId === 'string') {
                    traverse(config.exitNextNodeId);
                }
                // Button branches
                if (Array.isArray(config.buttons)) {
                    for (const btn of config.buttons as Array<{ nextNodeId?: string }>) {
                        if (btn.nextNodeId) traverse(btn.nextNodeId);
                    }
                }
                // Condition branches
                if (Array.isArray(config.branches)) {
                    for (const branch of config.branches as Array<{ nextNodeId?: string }>) {
                        if (branch.nextNodeId) traverse(branch.nextNodeId);
                    }
                }
                if (config.defaultBranch && typeof config.defaultBranch === 'object') {
                    const db = config.defaultBranch as { nextNodeId?: string };
                    if (db.nextNodeId) traverse(db.nextNodeId);
                }
                if (config.fallback && typeof config.fallback === 'object') {
                    const fb = config.fallback as { nextNodeId?: string };
                    if (fb.nextNodeId) traverse(fb.nextNodeId);
                }
                if (config.retryConfig && typeof config.retryConfig === 'object') {
                    const rc = config.retryConfig as { failureNextNodeId?: string };
                    if (rc.failureNextNodeId) traverse(rc.failureNextNodeId);
                }
            }
        };

        traverse(startNodeId);

        const orphanNodes = nodes.filter((n) => !reachable.has(n.nodeId));
        for (const orphan of orphanNodes) {
            warnings.push({
                nodeId: orphan.nodeId,
                message: `Node "${orphan.label || orphan.nodeId}" is not reachable from Start node`,
            });
        }
    }

    // 5. Check all edges reference valid nodes
    const nodeIds = new Set(nodes.map((n) => n.nodeId));
    for (const edge of edges) {
        if (!nodeIds.has(edge.sourceNodeId)) {
            errors.push({ message: `Edge ${edge.edgeId} references non-existent source node ${edge.sourceNodeId}` });
        }
        if (!nodeIds.has(edge.targetNodeId)) {
            errors.push({ message: `Edge ${edge.edgeId} references non-existent target node ${edge.targetNodeId}` });
        }
    }

    // 6. End node should not have outgoing edges
    for (const endNode of endNodes) {
        const outgoing = edges.filter((e) => e.sourceNodeId === endNode.nodeId);
        if (outgoing.length > 0) {
            errors.push({ nodeId: endNode.nodeId, message: 'End node cannot have outgoing edges' });
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings,
    };
};
