import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { IFlowData, IFlowNode, IFlowEdge } from '../types';

interface IBuilderState {
    flowData: IFlowData;
    selectedNodeId: string | null;
    undoStack: IFlowData[];
    redoStack: IFlowData[];
    isDirty: boolean;
    lastSaved: string | null;
    zoom: number;
    showGrid: boolean;
    showMinimap: boolean;
}

const initialState: IBuilderState = {
    flowData: { nodes: [], edges: [], variables: { bot: [], session: [] } },
    selectedNodeId: null,
    undoStack: [],
    redoStack: [],
    isDirty: false,
    lastSaved: null,
    zoom: 1,
    showGrid: true,
    showMinimap: true,
};

const MAX_UNDO = 50;

const builderSlice = createSlice({
    name: 'builder',
    initialState,
    reducers: {
        setFlowData(state, action: PayloadAction<IFlowData>) {
            state.flowData = action.payload;
            state.isDirty = false;
        },
        updateFlowData(state, action: PayloadAction<IFlowData>) {
            // Save to undo stack
            state.undoStack.push(JSON.parse(JSON.stringify(state.flowData)));
            if (state.undoStack.length > MAX_UNDO) state.undoStack.shift();
            state.redoStack = [];
            state.flowData = action.payload;
            state.isDirty = true;
        },
        selectNode(state, action: PayloadAction<string | null>) {
            state.selectedNodeId = action.payload;
        },
        updateNodeConfig(state, action: PayloadAction<{ nodeId: string; config: Record<string, unknown> }>) {
            const node = state.flowData.nodes.find((n) => n.nodeId === action.payload.nodeId);
            if (node) {
                state.undoStack.push(JSON.parse(JSON.stringify(state.flowData)));
                if (state.undoStack.length > MAX_UNDO) state.undoStack.shift();
                state.redoStack = [];
                node.config = { ...node.config, ...action.payload.config };
                state.isDirty = true;
            }
        },
        updateNodeLabel(state, action: PayloadAction<{ nodeId: string; label: string }>) {
            const node = state.flowData.nodes.find((n) => n.nodeId === action.payload.nodeId);
            if (node) {
                node.label = action.payload.label;
                state.isDirty = true;
            }
        },
        undo(state) {
            if (state.undoStack.length === 0) return;
            const prev = state.undoStack.pop()!;
            state.redoStack.push(JSON.parse(JSON.stringify(state.flowData)));
            state.flowData = prev;
            state.isDirty = true;
        },
        redo(state) {
            if (state.redoStack.length === 0) return;
            const next = state.redoStack.pop()!;
            state.undoStack.push(JSON.parse(JSON.stringify(state.flowData)));
            state.flowData = next;
            state.isDirty = true;
        },
        markSaved(state) {
            state.isDirty = false;
            state.lastSaved = new Date().toISOString();
        },
        setZoom(state, action: PayloadAction<number>) {
            state.zoom = action.payload;
        },
        toggleGrid(state) {
            state.showGrid = !state.showGrid;
        },
        toggleMinimap(state) {
            state.showMinimap = !state.showMinimap;
        },
        deleteNode(state, action: PayloadAction<string>) {
            // Prevent deleting START nodes
            const nodeToDelete = state.flowData.nodes.find((n) => n.nodeId === action.payload);
            if (!nodeToDelete || nodeToDelete.nodeType === 'START') return;

            state.undoStack.push(JSON.parse(JSON.stringify(state.flowData)));
            if (state.undoStack.length > MAX_UNDO) state.undoStack.shift();
            state.redoStack = [];
            state.flowData.nodes = state.flowData.nodes.filter((n) => n.nodeId !== action.payload);
            state.flowData.edges = state.flowData.edges.filter(
                (e) => e.sourceNodeId !== action.payload && e.targetNodeId !== action.payload
            );
            if (state.selectedNodeId === action.payload) state.selectedNodeId = null;
            state.isDirty = true;
        },
    },
});

export const {
    setFlowData,
    updateFlowData,
    selectNode,
    updateNodeConfig,
    updateNodeLabel,
    undo,
    redo,
    markSaved,
    setZoom,
    toggleGrid,
    toggleMinimap,
    deleteNode,
} = builderSlice.actions;
export default builderSlice.reducer;
