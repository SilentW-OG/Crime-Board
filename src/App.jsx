import React, { useCallback, useState, useRef } from "react";
import ReactFlow, { 
  Background, 
  Controls, 
  ReactFlowProvider, 
  applyNodeChanges, 
  applyEdgeChanges,
  NodeResizer, 
  Handle, 
  Position, 
  useStore,
  useReactFlow
} from "reactflow";
import "reactflow/dist/style.css";

// --- CUSTOM EVIDENCE NODES ---
const EvidenceNode = ({ id, data, selected }) => {
  const liveWidth = useStore((s) => s.nodeInternals.get(id)?.width);
  const isBoardText = data.type === 'boardText';
  const dynamicFontSize = isBoardText ? (liveWidth ? liveWidth / 5.5 : 36) : 16;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Handle type="source" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <NodeResizer color="#d63031" isVisible={selected} minWidth={100} minHeight={100} />
      <div style={{ 
        width: '100%', height: '100%', 
        background: data.type === 'suspect' ? '#1a1c1e' : (data.type === 'note' ? "#fff9c4" : 'white'), 
        color: data.type === 'suspect' ? 'white' : 'black', 
        borderRadius: '4px', border: '1px solid #333', overflow: 'hidden',
        boxShadow: "0 4px 10px rgba(0,0,0,0.3)"
      }}>
        <div style={{ padding: '10px', fontSize: `${dynamicFontSize}px`, textAlign: 'center', fontWeight: 'bold' }}>
          {data.label}
        </div>
      </div>
    </div>
  );
};

const nodeTypes = { evidence: EvidenceNode };

// --- MAIN BOARD ---
function Board() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const { setViewport } = useReactFlow();
  const fileInputRef = useRef(null);

  const onNodesChange = useCallback((chs) => setNodes((nds) => applyNodeChanges(chs, nds)), []);
  const onEdgesChange = useCallback((chs) => setEdges((eds) => applyEdgeChanges(chs, eds)), []);

  const addNode = (type) => {
    const label = prompt(`Enter ${type} text:`);
    if (!label) return;
    const newNode = {
      id: `node-${Date.now()}`,
      type: 'evidence',
      position: { x: 100, y: 100 },
      data: { label, type },
      style: { width: 180, height: 80 }
    };
    setNodes((nds) => nds.concat(newNode));
  };

  // --- SAVE CASE TO FILE ---
  const saveCase = () => {
    const caseData = JSON.stringify({ nodes, edges }, null, 2);
    const blob = new Blob([caseData], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Case_File_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  // --- LOAD CASE FROM FILE ---
  const loadCase = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const { nodes: loadedNodes, edges: loadedEdges } = JSON.parse(e.target.result);
        setNodes(loadedNodes || []);
        setEdges(loadedEdges || []);
      } catch (err) {
        alert("Error: This file is not a valid Case File.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh", background: "#2c1e12" }}>
      {/* SIDEBAR */}
      <div style={{ width: "300px", background: "#1a1c1e", color: "white", padding: "20px", zIndex: 10, display: "flex", flexDirection: "column", gap: "10px" }}>
        <h2 style={{ marginBottom: "20px" }}>OFFLINE ARCHIVE</h2>
        
        <button onClick={() => addNode('note')} style={btnStyle}>+ ADD NOTE</button>
        <button onClick={() => addNode('suspect')} style={btnStyle}>+ ADD SUSPECT</button>
        
        <hr style={{ width: "100%", border: "0.5px solid #444", margin: "10px 0" }} />
        
        <button onClick={saveCase} style={{ ...btnStyle, background: "#27ae60" }}>💾 SAVE CASE (.json)</button>
        
        <button onClick={() => fileInputRef.current.click()} style={{ ...btnStyle, background: "#8e44ad" }}>📂 LOAD CASE FILE</button>
        <input type="file" ref={fileInputRef} onChange={loadCase} style={{ display: "none" }} accept=".json" />

        <div style={{ flexGrow: 1 }} />
        <p style={{ fontSize: "10px", color: "#666" }}>v9.0 - Storage is local only. No internet required.</p>
      </div>

      {/* CANVAS */}
      <div style={{ flexGrow: 1 }}>
        <ReactFlow 
          nodes={nodes} 
          edges={edges} 
          onNodesChange={onNodesChange} 
          onEdgesChange={onEdgesChange} 
          nodeTypes={nodeTypes}
          fitView
        >
          <Background color="#8d643f" variant="lines" /><Controls />
        </ReactFlow>
      </div>
    </div>
  );
}

const btnStyle = { padding: "12px", background: "#4b5563", color: "white", border: "none", borderRadius: "5px", cursor: "pointer", fontWeight: "bold" };

export default function App() { 
  return ( 
    <div style={{ width: '100vw', height: '100vh' }}>
      <ReactFlowProvider><Board /></ReactFlowProvider> 
    </div>
  ); 
}
