import { Request, Response, NextFunction } from 'express';
import { Flow, FlowVersion, Bot } from '../models';
import { validateFlow } from '../utils/flowValidator';
import { Types } from 'mongoose';

export const createFlow = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { botId } = req.params;
        const { name, description } = req.body;
        const userId = req.user!.userId;

        // Verify bot ownership
        const bot = await Bot.findOne({ _id: botId, userId });
        if (!bot) {
            res.status(404).json({ success: false, error: 'Bot not found' });
            return;
        }

        if (!name) {
            res.status(400).json({ success: false, error: 'Flow name is required' });
            return;
        }

        // All user-created flows are subflows
        const flow = await Flow.create({ botId, name, description, isMainFlow: false });

        // Create initial draft version with SubFlow Start node
        const initialFlowData = {
            nodes: [
                {
                    nodeId: `start_${Date.now()}`,
                    nodeType: 'START',
                    position: { x: 250, y: 100 },
                    label: 'SubFlow Start',
                    config: {},
                },
            ],
            edges: [],
            variables: { bot: [], session: [] },
        };

        await FlowVersion.create({
            flowId: flow._id,
            versionNumber: 1,
            flowData: initialFlowData,
            isDraft: true,
            isProduction: false,
        });

        res.status(201).json({ success: true, data: flow });
    } catch (error) {
        next(error);
    }
};

export const getFlows = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { botId } = req.params;
        const userId = req.user!.userId;

        const bot = await Bot.findOne({ _id: botId, userId });
        if (!bot) {
            res.status(404).json({ success: false, error: 'Bot not found' });
            return;
        }

        const flows = await Flow.find({ botId }).sort({ createdAt: -1 });

        // Get version info for each flow
        const flowsWithVersions = await Promise.all(
            flows.map(async (flow) => {
                const draftVersion = await FlowVersion.findOne({ flowId: flow._id, isDraft: true })
                    .sort({ versionNumber: -1 });
                const prodVersion = await FlowVersion.findOne({ flowId: flow._id, isProduction: true });

                return {
                    ...flow.toObject(),
                    draftVersion: draftVersion?.versionNumber,
                    productionVersion: prodVersion?.versionNumber,
                    isDeployed: !!prodVersion,
                    lastUpdated: draftVersion?.updatedAt || flow.updatedAt,
                };
            })
        );

        res.json({ success: true, data: flowsWithVersions });
    } catch (error) {
        next(error);
    }
};

export const getFlow = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { botId, flowId } = req.params;
        const userId = req.user!.userId;

        const bot = await Bot.findOne({ _id: botId, userId });
        if (!bot) {
            res.status(404).json({ success: false, error: 'Bot not found' });
            return;
        }

        const flow = await Flow.findOne({ _id: flowId, botId });
        if (!flow) {
            res.status(404).json({ success: false, error: 'Flow not found' });
            return;
        }

        // Get latest draft version
        const draftVersion = await FlowVersion.findOne({ flowId: flow._id, isDraft: true })
            .sort({ versionNumber: -1 });
        const prodVersion = await FlowVersion.findOne({ flowId: flow._id, isProduction: true });

        res.json({
            success: true,
            data: {
                ...flow.toObject(),
                draftVersion,
                productionVersion: prodVersion,
            },
        });
    } catch (error) {
        next(error);
    }
};

export const updateFlow = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { botId, flowId } = req.params;
        const userId = req.user!.userId;
        const { name, description } = req.body;

        const bot = await Bot.findOne({ _id: botId, userId });
        if (!bot) {
            res.status(404).json({ success: false, error: 'Bot not found' });
            return;
        }

        const flow = await Flow.findOneAndUpdate(
            { _id: flowId, botId },
            { name, description },
            { new: true }
        );

        if (!flow) {
            res.status(404).json({ success: false, error: 'Flow not found' });
            return;
        }

        res.json({ success: true, data: flow });
    } catch (error) {
        next(error);
    }
};

export const deleteFlow = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { botId, flowId } = req.params;
        const userId = req.user!.userId;

        const bot = await Bot.findOne({ _id: botId, userId });
        if (!bot) {
            res.status(404).json({ success: false, error: 'Bot not found' });
            return;
        }

        // Prevent deletion of main flow
        const flow = await Flow.findOne({ _id: flowId, botId });
        if (!flow) {
            res.status(404).json({ success: false, error: 'Flow not found' });
            return;
        }
        if (flow.isMainFlow) {
            res.status(400).json({ success: false, error: 'Cannot delete the main flow' });
            return;
        }

        await Flow.findByIdAndDelete(flowId);
        await FlowVersion.deleteMany({ flowId });

        res.json({ success: true, message: 'Flow deleted successfully' });
    } catch (error) {
        next(error);
    }
};

export const saveDraft = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { botId, flowId } = req.params;
        const userId = req.user!.userId;
        const { flowData } = req.body;

        const bot = await Bot.findOne({ _id: botId, userId });
        if (!bot) {
            res.status(404).json({ success: false, error: 'Bot not found' });
            return;
        }

        const flow = await Flow.findOne({ _id: flowId, botId });
        if (!flow) {
            res.status(404).json({ success: false, error: 'Flow not found' });
            return;
        }

        // Ensure flowData always contains a START node
        const hasStartNode = flowData.nodes?.some((n: { nodeType: string }) => n.nodeType === 'START');
        if (!hasStartNode) {
            if (!flowData.nodes) flowData.nodes = [];
            flowData.nodes.unshift({
                nodeId: `start_${Date.now()}`,
                nodeType: 'START',
                position: { x: 250, y: 100 },
                label: 'Start',
                config: {},
            });
        }

        // Find or create latest draft
        let draftVersion = await FlowVersion.findOne({ flowId, isDraft: true })
            .sort({ versionNumber: -1 });

        if (draftVersion) {
            draftVersion.flowData = flowData;
            await draftVersion.save();
        } else {
            const latestVersion = await FlowVersion.findOne({ flowId })
                .sort({ versionNumber: -1 });
            const nextVersion = (latestVersion?.versionNumber || 0) + 1;

            draftVersion = await FlowVersion.create({
                flowId,
                versionNumber: nextVersion,
                flowData,
                isDraft: true,
                isProduction: false,
            });
        }

        res.json({ success: true, data: draftVersion });
    } catch (error) {
        next(error);
    }
};

export const validateFlowEndpoint = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { botId, flowId } = req.params;
        const userId = req.user!.userId;

        const bot = await Bot.findOne({ _id: botId, userId });
        if (!bot) {
            res.status(404).json({ success: false, error: 'Bot not found' });
            return;
        }

        const flow = await Flow.findOne({ _id: flowId, botId });
        if (!flow) {
            res.status(404).json({ success: false, error: 'Flow not found' });
            return;
        }

        const draftVersion = await FlowVersion.findOne({ flowId, isDraft: true })
            .sort({ versionNumber: -1 });

        if (!draftVersion) {
            res.status(404).json({ success: false, error: 'No draft version found' });
            return;
        }

        const validationResult = validateFlow(draftVersion.flowData, flow.name);

        res.json({ success: true, data: validationResult });
    } catch (error) {
        next(error);
    }
};

export const deployFlow = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { botId, flowId } = req.params;
        const userId = req.user!.userId;

        const bot = await Bot.findOne({ _id: botId, userId });
        if (!bot) {
            res.status(404).json({ success: false, error: 'Bot not found' });
            return;
        }

        // Deploy ALL flows for this bot at once
        const allFlows = await Flow.find({ botId });
        const allErrors: Array<{ flowName: string; errors: unknown[] }> = [];
        const deployedVersions: unknown[] = [];

        for (const flow of allFlows) {
            const draftVersion = await FlowVersion.findOne({ flowId: flow._id, isDraft: true })
                .sort({ versionNumber: -1 });

            if (!draftVersion) {
                allErrors.push({ flowName: flow.name, errors: [{ message: 'No draft version found' }] });
                continue;
            }

            // Validate each flow
            const validationResult = validateFlow(draftVersion.flowData, flow.name);
            if (!validationResult.isValid) {
                allErrors.push({ flowName: flow.name, errors: validationResult.errors });
                continue;
            }
        }

        if (allErrors.length > 0) {
            res.status(400).json({
                success: false,
                error: 'Some flows have validation errors',
                data: allErrors,
            });
            return;
        }

        // All validated — deploy all flows
        for (const flow of allFlows) {
            const draftVersion = await FlowVersion.findOne({ flowId: flow._id, isDraft: true })
                .sort({ versionNumber: -1 });

            if (!draftVersion) continue;

            // Archive current production version
            await FlowVersion.updateMany(
                { flowId: flow._id, isProduction: true },
                { isProduction: false }
            );

            // Create new production version
            const latestVersion = await FlowVersion.findOne({ flowId: flow._id })
                .sort({ versionNumber: -1 });
            const nextVersion = (latestVersion?.versionNumber || 0) + 1;

            const productionVersion = await FlowVersion.create({
                flowId: flow._id,
                versionNumber: nextVersion,
                flowData: draftVersion.flowData,
                isDraft: false,
                isProduction: true,
                deployedAt: new Date(),
                deployedBy: new Types.ObjectId(userId),
            });

            deployedVersions.push({ flowId: flow._id, flowName: flow.name, version: productionVersion.versionNumber });
        }

        // Set main flow as active
        const mainFlow = allFlows.find((f) => f.isMainFlow);
        if (mainFlow) {
            await Bot.findByIdAndUpdate(botId, { activeFlowId: mainFlow._id });
        }

        // Cleanup: keep only last 3 non-draft versions per flow, delete older ones
        const MAX_VERSIONS_TO_KEEP = 3;
        for (const flow of allFlows) {
            const archivedVersions = await FlowVersion.find({ flowId: flow._id, isDraft: false })
                .sort({ versionNumber: -1 })
                .select('_id');

            if (archivedVersions.length > MAX_VERSIONS_TO_KEEP) {
                const idsToDelete = archivedVersions.slice(MAX_VERSIONS_TO_KEEP).map((v) => v._id);
                await FlowVersion.deleteMany({ _id: { $in: idsToDelete } });
            }
        }

        res.json({
            success: true,
            data: deployedVersions,
            message: `Deployed ${deployedVersions.length} flow(s) to production`,
        });
    } catch (error) {
        next(error);
    }
};

export const rollbackFlow = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { botId, flowId } = req.params;
        const { versionNumber } = req.body;
        const userId = req.user!.userId;

        const bot = await Bot.findOne({ _id: botId, userId });
        if (!bot) {
            res.status(404).json({ success: false, error: 'Bot not found' });
            return;
        }

        const targetVersion = await FlowVersion.findOne({ flowId, versionNumber });
        if (!targetVersion) {
            res.status(404).json({ success: false, error: 'Version not found' });
            return;
        }

        // Archive current production
        await FlowVersion.updateMany(
            { flowId, isProduction: true },
            { isProduction: false }
        );

        // Set target as production
        targetVersion.isProduction = true;
        targetVersion.deployedAt = new Date();
        targetVersion.deployedBy = new Types.ObjectId(userId);
        await targetVersion.save();

        res.json({ success: true, data: targetVersion, message: 'Rolled back successfully' });
    } catch (error) {
        next(error);
    }
};

export const getFlowVersions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { botId, flowId } = req.params;
        const userId = req.user!.userId;

        const bot = await Bot.findOne({ _id: botId, userId });
        if (!bot) {
            res.status(404).json({ success: false, error: 'Bot not found' });
            return;
        }

        const versions = await FlowVersion.find({ flowId })
            .select('-flowData')
            .sort({ versionNumber: -1 });

        res.json({ success: true, data: versions });
    } catch (error) {
        next(error);
    }
};

export const duplicateFlow = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { botId, flowId } = req.params;
        const userId = req.user!.userId;

        const bot = await Bot.findOne({ _id: botId, userId });
        if (!bot) {
            res.status(404).json({ success: false, error: 'Bot not found' });
            return;
        }

        const sourceFlow = await Flow.findOne({ _id: flowId, botId });
        if (!sourceFlow) {
            res.status(404).json({ success: false, error: 'Flow not found' });
            return;
        }

        // Create duplicate flow
        const newFlow = await Flow.create({
            botId,
            name: `${sourceFlow.name} (copy)`,
            description: sourceFlow.description,
            isMainFlow: false,
        });

        // Clone the latest draft version
        const sourceDraft = await FlowVersion.findOne({ flowId, isDraft: true })
            .sort({ versionNumber: -1 });

        if (sourceDraft) {
            await FlowVersion.create({
                flowId: newFlow._id,
                versionNumber: 1,
                flowData: JSON.parse(JSON.stringify(sourceDraft.flowData)),
                isDraft: true,
                isProduction: false,
            });
        }

        res.status(201).json({ success: true, data: newFlow });
    } catch (error) {
        next(error);
    }
};
