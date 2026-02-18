import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
    ReactFlow,
    ReactFlowProvider,
    Background,
    Controls,
    MiniMap,
    useReactFlow,
    type Node,
    type Edge,
    type Connection,
    type NodeTypes,
    type EdgeTypes,
    type OnNodesChange,
    type OnEdgesChange,
    type OnConnect,
    addEdge,
    applyNodeChanges,
    applyEdgeChanges,
    BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import api from '../lib/api';
import { RootState } from '../store';
import { setFlowData, markSaved, selectNode, updateNodeConfig, updateNodeLabel, deleteNode } from '../store/builderSlice';
import { IFlowData, IFlowNode, IValidationResult, TNodeType } from '../types';
import FlowNode from '../components/FlowBuilder/FlowNode';
import DeletableEdge from '../components/FlowBuilder/DeletableEdge';
import NodeLibrary from '../components/FlowBuilder/NodeLibrary';
import NodeSettingsPanel from '../components/FlowBuilder/NodeSettingsPanel';
import SimulatorPanel from '../components/FlowBuilder/SimulatorPanel';
import ConfirmModal from '../components/FlowBuilder/ConfirmModal';
import { autoLayoutNodes } from '../utils/autoLayout';
import {
    Save,
    ArrowLeft,
    Loader2,
    Rocket,
    CheckCircle,
    AlertTriangle,
    MessageSquare,
    LayoutGrid,
} from 'lucide-react';

function FlowBuilderInner() {
    const { botId, flowId } = useParams();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { flowData, isDirty, selectedNodeId, lastSaved } = useSelector((state: RootState) => state.builder);
    const { fitView, getNodes: getRfNodes, getEdges: getRfEdges, screenToFlowPosition } = useReactFlow();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deploying, setDeploying] = useState(false);
    const [validation, setValidation] = useState<IValidationResult | null>(null);
    const [showSimulator, setShowSimulator] = useState(false);
    const [flowName, setFlowName] = useState('');

    // Confirm modal state
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        variant?: 'danger' | 'warning';
        confirmLabel?: string;
    }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    // React Flow state — typed explicitly
    const [nodes, setNodes] = useState<Node[]>([]);
    const [edges, setEdges] = useState<Edge[]>([]);

    // --- Callbacks passed into node data ---
    const handleNodeDuplicate = useCallback((nodeId: string) => {
        setNodes((nds) => {
            const sourceNode = nds.find((n) => n.id === nodeId);
            if (!sourceNode) return nds;

            const newNodeId = `${(sourceNode.data as Record<string, unknown>).nodeType as string}_${Date.now()}`.toLowerCase();
            const duplicated: Node = {
                id: newNodeId,
                type: 'flowNode',
                position: {
                    x: sourceNode.position.x + 60,
                    y: sourceNode.position.y + 80,
                },
                data: {
                    ...(sourceNode.data as Record<string, unknown>),
                    label: `${(sourceNode.data as Record<string, unknown>).label} (copy)`,
                    nodeId: newNodeId,
                },
            };
            return [...nds, duplicated];
        });
    }, []);

    const requestDeleteNode = useCallback((nodeId: string) => {
        setNodes((nds) => {
            const node = nds.find((n) => n.id === nodeId);
            // Prevent deleting START nodes
            if (node && (node.data as Record<string, unknown>).nodeType === 'START') return nds;

            const label = node ? (node.data as Record<string, unknown>).label as string || nodeId : nodeId;

            setConfirmModal({
                isOpen: true,
                title: 'Delete Node',
                message: `Are you sure you want to delete "${label}"? This will also remove all connections to and from this node. This action cannot be undone.`,
                variant: 'danger',
                confirmLabel: 'Delete Node',
                onConfirm: () => {
                    performDeleteNode(nodeId);
                    setConfirmModal((prev) => ({ ...prev, isOpen: false }));
                },
            });
            return nds;
        });
    }, []);

    const performDeleteNode = useCallback((nodeId: string) => {
        // Double-check: never delete a START node
        setNodes((nds) => {
            const node = nds.find((n) => n.id === nodeId);
            if (node && (node.data as Record<string, unknown>).nodeType === 'START') return nds;
            dispatch(deleteNode(nodeId));
            dispatch(selectNode(null));
            setEdges((eds) => eds.filter((e: Edge) => e.source !== nodeId && e.target !== nodeId));
            return nds.filter((n: Node) => n.id !== nodeId);
        });
    }, [dispatch]);

    // --- Edge deletion ---
    const handleEdgeDelete = useCallback((edgeId: string) => {
        setEdges((eds) => eds.filter((e) => e.id !== edgeId));
    }, []);

    // Node types memoized
    const nodeTypes: NodeTypes = useMemo(() => ({
        flowNode: FlowNode,
    }), []);

    // Edge types memoized
    const edgeTypes: EdgeTypes = useMemo(() => ({
        deletable: DeletableEdge,
    }), []);

    // Load flow data
    useEffect(() => {
        const fetchFlow = async () => {
            try {
                const res = await api.get(`/bots/${botId}/flows/${flowId}`);
                if (res.data.success) {
                    const flow = res.data.data;
                    setFlowName(flow.name);

                    const draft = flow.draftVersion;
                    if (draft?.flowData) {
                        dispatch(setFlowData(draft.flowData));
                        syncToReactFlow(draft.flowData);
                    }
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchFlow();
    }, [botId, flowId]);

    const syncToReactFlow = (data: IFlowData) => {
        // Ensure a START node always exists
        let nodesData = data.nodes;
        const hasStartNode = nodesData.some((n) => n.nodeType === 'START');
        if (!hasStartNode) {
            const defaultStartNode: IFlowNode = {
                nodeId: `start_${Date.now()}`,
                nodeType: 'START',
                position: { x: 250, y: 100 },
                label: 'Start',
                config: {},
            };
            nodesData = [defaultStartNode, ...nodesData];
            // Also update the Redux store with the start node included
            dispatch(setFlowData({ ...data, nodes: nodesData }));
        }

        const rfNodes: Node[] = nodesData.map((n) => ({
            id: n.nodeId,
            type: 'flowNode',
            position: n.position,
            deletable: n.nodeType !== 'START',
            data: {
                label: n.label || n.nodeType,
                nodeType: n.nodeType,
                config: n.config,
                description: n.description,
                nodeId: n.nodeId,
                onDuplicate: handleNodeDuplicate,
                onDelete: requestDeleteNode,
            },
        }));
        const rfEdges: Edge[] = data.edges.map((e) => ({
            id: e.edgeId,
            source: e.sourceNodeId,
            target: e.targetNodeId,
            sourceHandle: e.sourceHandle,
            targetHandle: e.targetHandle,
            type: 'deletable',
            animated: true,
            style: { stroke: '#818cf8', strokeWidth: 2.5 },
            data: { onDelete: handleEdgeDelete },
        }));
        setNodes(rfNodes);
        setEdges(rfEdges);
    };

    // Sync React Flow changes back to Redux
    const buildFlowDataFromReactFlow = useCallback((): IFlowData => {
        const flowNodes: IFlowNode[] = nodes.map((n: Node) => ({
            nodeId: n.id,
            nodeType: (n.data as Record<string, unknown>).nodeType as TNodeType,
            position: n.position,
            label: (n.data as Record<string, unknown>).label as string,
            description: (n.data as Record<string, unknown>).description as string,
            config: ((n.data as Record<string, unknown>).config || {}) as Record<string, unknown>,
        }));
        const flowEdges = edges.map((e: Edge) => ({
            edgeId: e.id,
            sourceNodeId: e.source,
            targetNodeId: e.target,
            sourceHandle: e.sourceHandle ?? undefined,
            targetHandle: e.targetHandle ?? undefined,
        }));
        return { nodes: flowNodes, edges: flowEdges, variables: flowData.variables };
    }, [nodes, edges, flowData.variables]);

    // Handle node/edge changes
    const onNodesChange: OnNodesChange = useCallback(
        (changes) => setNodes((nds) => {
            // Filter out 'remove' changes for START nodes (prevents keyboard Delete key from removing them)
            const safeChanges = changes.filter((change) => {
                if (change.type === 'remove') {
                    const node = nds.find((n) => n.id === change.id);
                    if (node && (node.data as Record<string, unknown>).nodeType === 'START') return false;
                }
                return true;
            });
            return applyNodeChanges(safeChanges, nds);
        }),
        [setNodes]
    );

    const onEdgesChange: OnEdgesChange = useCallback(
        (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
        [setEdges]
    );

    // Handle connections
    const onConnect: OnConnect = useCallback((connection: Connection) => {
        setEdges((eds) =>
            addEdge(
                {
                    ...connection,
                    id: `edge_${Date.now()}`,
                    type: 'deletable',
                    animated: true,
                    style: { stroke: '#818cf8', strokeWidth: 2.5 },
                    data: { onDelete: handleEdgeDelete },
                },
                eds
            )
        );
    }, [setEdges, handleEdgeDelete]);

    // Handle node selection
    const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
        dispatch(selectNode(node.id));
    }, [dispatch]);

    const onPaneClick = useCallback(() => {
        dispatch(selectNode(null));
    }, [dispatch]);

    // Drag-and-drop from NodeLibrary
    const reactFlowWrapper = useRef<HTMLDivElement>(null);

    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault();
            const nodeType = event.dataTransfer.getData('application/reactflow') as TNodeType;
            if (!nodeType) return;

            const position = screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });

            const newNodeId = `${nodeType.toLowerCase()}_${Date.now()}`;
            const newNode: Node = {
                id: newNodeId,
                type: 'flowNode',
                position,
                data: {
                    label: nodeType.charAt(0) + nodeType.slice(1).toLowerCase(),
                    nodeType,
                    config: {},
                    nodeId: newNodeId,
                    onDuplicate: handleNodeDuplicate,
                    onDelete: requestDeleteNode,
                },
            };
            setNodes((nds) => [...nds, newNode]);
        },
        [screenToFlowPosition, setNodes, handleNodeDuplicate, requestDeleteNode]
    );

    // --- Auto-arrange nodes ---
    const handleAutoArrange = useCallback(() => {
        const currentNodes = getRfNodes();
        const currentEdges = getRfEdges();
        const { nodes: layoutNodes } = autoLayoutNodes(currentNodes, currentEdges);
        setNodes(layoutNodes);
        // Fit view after React Flow rerenders with new positions
        setTimeout(() => {
            fitView({ padding: 0.15, duration: 500 });
        }, 50);
    }, [getRfNodes, getRfEdges, setNodes, fitView]);

    // Save draft
    const handleSave = async () => {
        setSaving(true);
        try {
            const data = buildFlowDataFromReactFlow();
            await api.put(`/bots/${botId}/flows/${flowId}/draft`, { flowData: data });
            dispatch(setFlowData(data));
            dispatch(markSaved());
        } catch (err) {
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    // Validate
    const handleValidate = async () => {
        await handleSave();
        try {
            const res = await api.post(`/bots/${botId}/flows/${flowId}/validate`);
            if (res.data.success) {
                setValidation(res.data.data);
            }
        } catch (err) {
            console.error(err);
        }
    };

    // Deploy — uses custom confirm modal instead of browser confirm()
    const handleDeploy = async () => {
        setConfirmModal({
            isOpen: true,
            title: 'Deploy to Production',
            message: 'This will replace the currently running flow with this draft. All active sessions will be reset. Are you sure you want to deploy?',
            variant: 'warning',
            confirmLabel: 'Deploy',
            onConfirm: async () => {
                setConfirmModal((prev) => ({ ...prev, isOpen: false }));
                setDeploying(true);
                await handleSave();
                try {
                    const res = await api.post(`/bots/${botId}/flows/${flowId}/deploy`);
                    if (res.data.success) {
                        setValidation({ isValid: true, errors: [], warnings: [] });
                    } else {
                        // Deploy returns data as array of {flowName, errors} — flatten into IValidationResult
                        const deployErrors = res.data.data;
                        if (Array.isArray(deployErrors)) {
                            const allErrors = deployErrors.flatMap((f: { flowName: string; errors: Array<{ message?: string; field?: string; nodeId?: string }> }) =>
                                (f.errors || []).map((e) => ({ ...e, message: e.message || `Validation error in ${f.flowName}` }))
                            );
                            setValidation({ isValid: false, errors: allErrors, warnings: [] });
                        } else {
                            setValidation(deployErrors);
                        }
                    }
                } catch (err: unknown) {
                    const axiosErr = err as { response?: { data?: { data?: unknown; error?: string } } };
                    if (axiosErr.response?.data?.data) {
                        const deployErrors = axiosErr.response.data.data;
                        if (Array.isArray(deployErrors)) {
                            const allErrors = deployErrors.flatMap((f: { flowName: string; errors: Array<{ message?: string; field?: string; nodeId?: string }> }) =>
                                (f.errors || []).map((e) => ({ ...e, message: e.message || `Validation error in ${f.flowName}` }))
                            );
                            setValidation({ isValid: false, errors: allErrors, warnings: [] });
                        } else {
                            setValidation(deployErrors as IValidationResult);
                        }
                    }
                } finally {
                    setDeploying(false);
                }
            },
        });
    };

    // Handle node updates from settings panel
    const handleNodeConfigChange = (nodeId: string, config: Record<string, unknown>) => {
        dispatch(updateNodeConfig({ nodeId, config }));
        setNodes((nds) =>
            nds.map((n: Node) =>
                n.id === nodeId
                    ? { ...n, data: { ...(n.data as Record<string, unknown>), config: { ...((n.data as Record<string, unknown>).config as Record<string, unknown>), ...config } } }
                    : n
            )
        );
    };

    const handleNodeLabelChange = (nodeId: string, label: string) => {
        dispatch(updateNodeLabel({ nodeId, label }));
        setNodes((nds) =>
            nds.map((n: Node) =>
                n.id === nodeId ? { ...n, data: { ...(n.data as Record<string, unknown>), label } } : n
            )
        );
    };

    const handleDeleteNode = (nodeId: string) => {
        requestDeleteNode(nodeId);
    };

    const selectedNode = nodes.find((n: Node) => n.id === selectedNodeId);

    if (loading) {
        return (
            <div className="h-screen flex items-center justify-center bg-surface-50 dark:bg-surface-950">
                <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col bg-surface-50 dark:bg-surface-950">
            {/* Toolbar */}
            <div className="h-14 bg-white dark:bg-surface-900 border-b border-surface-200 dark:border-surface-700 flex items-center justify-between px-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(`/bots/${botId}/flows`)} className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="font-semibold text-sm">{flowName}</h1>
                        <p className="text-xs text-surface-500">
                            {isDirty ? 'Unsaved changes' : lastSaved ? `Saved ${new Date(lastSaved).toLocaleTimeString()}` : 'Draft'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save
                    </button>
                    <button onClick={handleValidate} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors">
                        <CheckCircle className="w-4 h-4" /> Validate
                    </button>
                    <button onClick={() => setShowSimulator(!showSimulator)} className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-colors ${showSimulator ? 'bg-brand-500 text-white' : 'bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700'}`}>
                        <MessageSquare className="w-4 h-4" /> Test
                    </button>
                    <button onClick={handleDeploy} disabled={deploying} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white transition-colors">
                        {deploying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                        Deploy
                    </button>
                </div>
            </div>

            {/* Validation banner */}
            {validation && !validation.isValid && (
                <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 px-4 py-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    <span className="text-sm text-red-600 dark:text-red-400">
                        {(validation.errors?.length || 0)} error{(validation.errors?.length || 0) !== 1 ? 's' : ''}: {validation.errors?.[0]?.message || 'Validation failed'}
                    </span>
                    <button onClick={() => setValidation(null)} className="ml-auto text-xs text-red-500 hover:text-red-700">Dismiss</button>
                </div>
            )}

            {/* Main content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Node Library sidebar */}
                <NodeLibrary />

                {/* Canvas */}
                <div className="flex-1 relative" ref={reactFlowWrapper}>
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onNodeClick={onNodeClick}
                        onPaneClick={onPaneClick}
                        onDrop={onDrop}
                        onDragOver={onDragOver}
                        nodeTypes={nodeTypes}
                        edgeTypes={edgeTypes}
                        defaultEdgeOptions={{
                            type: 'deletable',
                            animated: true,
                            style: { stroke: '#818cf8', strokeWidth: 2.5 },
                        }}
                        fitView
                        snapToGrid
                        snapGrid={[20, 20]}
                        deleteKeyCode="Delete"
                        proOptions={{ hideAttribution: true }}
                    >
                        <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} color="#cbd5e1" />
                        <Controls
                            className="!rounded-xl !border-surface-200 dark:!border-surface-700 !bg-white dark:!bg-surface-800 !shadow-lg"
                            showInteractive={false}
                        />
                        <MiniMap
                            className="!rounded-xl !border-surface-200 dark:!border-surface-700 !bg-white/90 dark:!bg-surface-800/90 !shadow-lg !backdrop-blur-sm"
                            nodeStrokeWidth={3}
                            pannable
                            zoomable
                            maskColor="rgba(0,0,0,0.05)"
                        />
                    </ReactFlow>

                    {/* Auto-arrange floating button */}
                    <div className="absolute top-4 left-4 z-10">
                        <button
                            onClick={handleAutoArrange}
                            className="
                                group flex items-center gap-2
                                px-3.5 py-2.5 rounded-xl
                                bg-white/90 dark:bg-surface-800/90
                                backdrop-blur-md
                                border border-surface-200 dark:border-surface-700
                                shadow-lg shadow-black/5 dark:shadow-black/20
                                hover:bg-white dark:hover:bg-surface-700
                                hover:shadow-xl hover:shadow-brand-500/10
                                hover:border-brand-300 dark:hover:border-brand-600
                                transition-all duration-200
                                active:scale-95
                            "
                            title="Auto-arrange all nodes"
                        >
                            <LayoutGrid className="w-4 h-4 text-brand-500 group-hover:text-brand-600 transition-colors" />
                            <span className="text-xs font-semibold text-surface-600 dark:text-surface-300 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                                Auto Arrange
                            </span>
                        </button>
                    </div>
                </div>

                {/* Settings panel */}
                {selectedNode && (
                    <NodeSettingsPanel
                        node={selectedNode}
                        onConfigChange={handleNodeConfigChange}
                        onLabelChange={handleNodeLabelChange}
                        onDelete={handleDeleteNode}
                        onClose={() => dispatch(selectNode(null))}
                    />
                )}

                {/* Simulator */}
                {showSimulator && (
                    <SimulatorPanel
                        botId={botId!}
                        flowId={flowId!}
                        onClose={() => setShowSimulator(false)}
                    />
                )}
            </div>

            {/* Confirm Modal */}
            <ConfirmModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                message={confirmModal.message}
                variant={confirmModal.variant}
                confirmLabel={confirmModal.confirmLabel}
                onConfirm={confirmModal.onConfirm}
                onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
            />
        </div>
    );
}

export default function FlowBuilderPage() {
    return (
        <ReactFlowProvider>
            <FlowBuilderInner />
        </ReactFlowProvider>
    );
}
