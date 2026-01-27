import React, { useCallback, useState, useEffect, useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  applyEdgeChanges,
  MarkerType,
  NodeResizer,
  Handle,
  Position,
  useStore,
} from "reactflow";
import "reactflow/dist/style.css";
import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";
import { throttle } from "lodash";

// --- MULTIPLAYER SETUP ---
const ydoc = new Y.Doc();
const roomName = "detective-shared-case-v1"; // MUST MATCH FOR BOTH PLAYERS
const provider = new WebrtcProvider(roomName, ydoc);
const sharedNodes = ydoc.getMap("nodes");
const sharedEdges = ydoc.getMap("edges");

// --- THEMES & FONTS ---
const themes = {
  cork: { board: "#a67c52", lines: "#8d643f", panel: "#2c1e12", group: "rgba(0,0,0,0.2)" },
  midnight: { board: "#1a1c1e", lines: "#2d2f31", panel: "#0d0e10", group: "rgba(255,255,255,0.05)" },
  blueprint: { board: "#1e3a8a", lines: "#2563eb", panel: "#1e1b4b", group: "rgba(255,255,255,0.1)" }
};

const fonts = {
  standard: "Inter, sans-serif",
  typewriter: "'Courier New', Courier, monospace",
  handwritten: "'Cursive', 'Brush Script MT', cursive"
};

// --- STYLES ---
const btnStyle = { 
  padding: "10px", marginBottom: "8px", border: "none", borderRadius: "6px", 
  backgroundColor: "#4b5563", color: "white", cursor: "pointer", 
  fontWeight: "600", fontSize: "11px", width: "100%", textAlign: "center", boxSizing: "border-box" 
};

const inputStyle = {
  width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #3f474f",
  backgroundColor: "#1f2937", color: "white", fontSize: "12px", marginBottom: "10px"
};

const accordionHeaderStyle = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '10px 5px', cursor: 'pointer', borderTop: '1px solid #3f474f',
  marginTop: '5px', fontSize: '11px', fontWeight: 'bold', color: '#9ca3af', textTransform: 'uppercase'
};

// --- CURSOR COMPONENT ---
const GhostCursor = ({ x, y, name, color }) => (
  <div style={{
    position: 'absolute', left: x, top: y, pointerEvents: 'none',
    zIndex: 1000, transition: 'transform 0.1s ease-out'
  }}>
    <svg width="24" height="24" viewBox="0 0 24 24" fill={color}>
      <path d="M7 2l12 11.2l-5.8 0.5l3.3 7.3l-2.2 1l-3.2-7.1l-4.1 4z" />
    </svg>
    <div style={{ background: color, color: 'white', padding: '2px 6px', fontSize: '10px', borderRadius: '4px' }}>{name}</div>
  </div>
);

// --- CUSTOM NODE ---
const EvidenceNode = ({ id, data, selected }) => {
  const isNote = data.type === 'note';
  const isBoardText = data.type === 'boardText';
  const isGroup = data.type === 'group';
  const isPhysical = data.type === 'physical';
  
  const liveWidth = useStore((s) => s.nodeInternals.get(id)?.width);
  const dynamicFontSize = isBoardText ? (liveWidth ? liveWidth / 5.5 : 36) : 16;

  if (isGroup) {
    return (
      <div style={{ width: '100%', height: '100%', border: '2px dashed #ffffff55', borderRadius: '8px' }}>
        <NodeResizer minWidth={200} minHeight={200} isVisible={selected} />
        <div style={{ position: 'absolute', top: -25, left: 10, color: 'white', fontSize: '10px', background: 'rgba(0,0,0,0.5)', padding: '2px 8px' }}>{data.label}</div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Handle type="source" position={Position.Top} style={{ top: '50%', left: '50%', opacity: 0 }} />
      <Handle type="target" position={Position.Top} style={{ top: '50%', left: '50%', opacity: 0 }} />
      <NodeResizer color="#d63031" isVisible={selected} minWidth={100} minHeight={50} keepAspectRatio={isPhysical} />
      {!isBoardText && <div style={{ width: "14px", height: "14px", backgroundColor: "#c0392b", borderRadius: "50%", position: "absolute", top: "-7px", left: "50%", transform: "translateX(-50%)", zIndex: 100 }} />}
      <div style={{ 
        width: '100%', height: '100%', padding: isNote ? '15px' : '0px', 
        background: isPhysical ? 'transparent' : (isNote ? "#fff9c4" : (isBoardText ? 'transparent' : 'white')),
        boxShadow: (isBoardText || isPhysical) ? 'none' : "0 8px 15px rgba(0,0,0,0.2)",
        display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', 
        overflow: 'hidden', border: data.isDrawingTarget ? `4px solid #d63031` : 'none',
        fontFamily: data.globalFont, borderRadius: isPhysical ? 0 : '4px'
      }}>
        {data.image && <img src={data.image} alt="clue" style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} />}
        {isNote && <div style={{ fontSize: '14px', color: '#333', textAlign: 'center' }}>{data.label}</div>}
        {isBoardText && <div style={{ color: '#fff', fontSize: `${dynamicFontSize}px`, fontWeight: '900', textAlign: 'center', textTransform: 'uppercase' }}>{data.label}</div>}
        {data.timestamp && <div style={{ position: 'absolute', bottom: 5, right: 5, fontSize: '9px', background: 'rgba(0,0,0,0.6)', color: 'white', padding: '2px 4px', borderRadius: '3px' }}>📅 {data.timestamp}</div>}
      </div>
    </div>
  );
};

const nodeTypes = { evidence: EvidenceNode };

function Board() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [otherCursors, setOtherCursors] = useState({});
  const [peerCount, setPeerCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentTheme, setCurrentTheme] = useState("cork");
  const [currentFont, setCurrentFont] = useState("standard");
  const [isDrawMode, setIsDrawMode] = useState(false);
  const [drawSource, setDrawSource] = useState(null);
  const [activeColor, setActiveColor] = useState("#d63031");
  const [isTimelineView, setIsTimelineView] = useState(false);
  const [isEvidenceOpen, setIsEvidenceOpen] = useState(true);
  const [isNotesOpen, setIsNotesOpen] = useState(true);

  const { setCenter, fitView, toObject } = useReactFlow();

  // --- MULTIPLAYER & CONNECTION INDICATOR ---
  useEffect(() => {
    const syncNodes = () => setNodes(Array.from(sharedNodes.values()));
    const syncEdges = () => setEdges(Array.from(sharedEdges.values()));
    sharedNodes.observe(syncNodes);
    sharedEdges.observe(syncEdges);
    
    provider.awareness.on("change", () => {
      const states = provider.awareness.getStates();
      const cursors = {};
      let count = 0;
      states.forEach((state, clientID) => {
        if (clientID !== provider.awareness.clientID) {
          count++;
          if (state.cursor) cursors[clientID] = state.cursor;
        }
      });
      setPeerCount(count);
      setOtherCursors(cursors);
    });

    return () => {
      sharedNodes.unobserve(syncNodes);
      sharedEdges.unobserve(syncEdges);
    };
  }, []);

  const onMouseMove = useCallback(throttle((e) => {
    provider.awareness.setLocalStateField("cursor", {
      x: e.clientX - 320, 
      y: e.clientY,
      name: `Agent ${provider.awareness.clientID % 100}`,
      color: "#e67e22"
    });
  }, 50), []);

  const onNodesChange = useCallback((changes) => {
    setNodes((nds) => {
      const nextNodes = applyNodeChanges(changes, nds);
      nextNodes.forEach(n => sharedNodes.set(n.id, n));
      return nextNodes;
    });
  }, []);

  const onEdgesChange = useCallback((changes) => {
    setEdges((eds) => {
      const nextEdges = applyEdgeChanges(changes, eds);
      nextEdges.forEach(e => sharedEdges.set(e.id, e));
      return nextEdges;
    });
  }, []);

  const onSave = useCallback(() => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(toObject()));
    const link = document.createElement('a');
    link.setAttribute("href", dataStr); link.setAttribute("download", "case_file.json");
    link.click();
  }, [toObject]);

  const onLoad = (e) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const flow = JSON.parse(ev.target.result);
      if (flow) { 
        flow.nodes.forEach(n => sharedNodes.set(n.id, n));
        flow.edges.forEach(e => sharedEdges.set(e.id, e));
      }
    };
    if(e.target.files[0]) reader.readAsText(e.target.files[0]);
  };

  const toggleTimeline = () => {
    if (!isTimelineView) {
      const sorted = nodes.filter(n => n.data.timestamp).sort((a, b) => new Date(a.data.timestamp) - new Date(b.data.timestamp));
      setNodes(nds => {
        const next = nds.map(node => {
          const index = sorted.findIndex(s => s.id === node.id);
          const pos = index !== -1 ? { x: index * 350, y: 300 } : node.position;
          const updated = { ...node, position: pos, draggable: false };
          sharedNodes.set(node.id, updated);
          return updated;
        });
        return next;
      });
    } else {
      setNodes(nds => nds.map(node => {
        const updated = { ...node, draggable: true };
        sharedNodes.set(node.id, updated);
        return updated;
      }));
    }
    setIsTimelineView(!isTimelineView);
    setTimeout(() => fitView({ duration: 800 }), 50);
  };

  const onNodeClick = useCallback((_, node) => {
    if (!isDrawMode || node.data.type === 'group') return;
    if (!drawSource) {
      setDrawSource(node.id);
      setNodes(nds => nds.map(n => n.id === node.id ? { ...n, data: { ...n.data, isDrawingTarget: true } } : n));
    } else {
      if (drawSource !== node.id) {
        const reason = prompt("Connection reason:") || "";
        const newEdge = {
          id: `e-${Date.now()}`, source: drawSource, target: node.id, label: reason,
          labelStyle: { fill: 'white', fontWeight: 700, fontSize: '10px' },
          labelBgStyle: { fill: activeColor, fillOpacity: 0.9, rx: 4 },
          markerEnd: { type: MarkerType.ArrowClosed, color: activeColor },
          style: { stroke: activeColor, strokeWidth: 4 },
        };
        sharedEdges.set(newEdge.id, newEdge);
      }
      setDrawSource(null);
      setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, isDrawingTarget: false } })));
    }
  }, [isDrawMode, drawSource, activeColor]);

  const addNode = (type, label = "", image = null) => {
    const time = (type !== 'group' && type !== 'boardText') ? prompt("Timestamp (YYYY-MM-DD HH:MM):") : null;
    const id = `${type}-${Date.now()}`;
    const newNode = {
      id, type: 'evidence', position: { x: 300, y: 200 },
      data: { label, type, image, name: label, globalFont: fonts[currentFont], timestamp: time },
      style: type === 'group' ? { width: 400, height: 400, backgroundColor: themes[currentTheme].group } : { width: 200, height: 100 }
    };
    sharedNodes.set(id, newNode);
  };

  const filteredItems = (type) => nodes.filter(n => n.data.type === type && (n.data.name || n.data.label).toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div onMouseMove={onMouseMove} style={{ display: "flex", width: "100vw", height: "100vh", backgroundColor: themes[currentTheme].board }}>
      <div style={{ width: "320px", backgroundColor: themes[currentTheme].panel, color: "#ecf0f1", padding: "20px", display: "flex", flexDirection: "column", zIndex: 10, overflowY: 'auto' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '900', marginBottom: '5px' }}>DETECTIVE BOARD</h2>
        
        {/* CONNECTION INDICATOR */}
        <div style={{ 
          display: 'flex', alignItems: 'center', gap: '8px', 
          background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '6px', marginBottom: '15px'
        }}>
          <div style={{ 
            width: '10px', height: '10px', borderRadius: '50%', 
            backgroundColor: peerCount > 0 ? '#2ecc71' : '#f1c40f',
            boxShadow: peerCount > 0 ? '0 0 10px #2ecc71' : 'none'
          }} />
          <span style={{ fontSize: '10px', fontWeight: 'bold' }}>
            {peerCount > 0 ? `COMMS SECURE (${peerCount} Peer)` : 'SEARCHING FOR PEERS...'}
          </span>
        </div>

        <button onClick={toggleTimeline} style={{ ...btnStyle, backgroundColor: isTimelineView ? "#e67e22" : "#8e44ad" }}>{isTimelineView ? "EXIT TIMELINE" : "⏳ TIMELINE MODE"}</button>
        <div style={{ display: "flex", gap: "8px", marginBottom: "15px" }}>
           <button onClick={onSave} style={{ ...btnStyle, backgroundColor: "#27ae60", flex: 1 }}>SAVE</button>
           <label style={{ ...btnStyle, backgroundColor: "#2980b9", flex: 1 }}>LOAD<input type="file" hidden accept=".json" onChange={onLoad} /></label>
        </div>
        <input style={inputStyle} placeholder="Search clues..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <button onClick={() => addNode('boardText', prompt("Heading:"))} style={btnStyle}>+ TEXT</button>
          <button onClick={() => addNode('note', prompt("Note:"))} style={btnStyle}>+ NOTE</button>
          <button onClick={() => addNode('group', prompt("Zone Name:"))} style={{ ...btnStyle, backgroundColor: '#8e44ad' }}>+ ZONE</button>
          <button onClick={() => fitView()} style={btnStyle}>🔍 RESET</button>
        </div>
        <label style={{ ...btnStyle, backgroundColor: "#3b82f6" }}> UPLOAD PHOTO
          <input type="file" hidden onChange={(e) => {
             const r = new FileReader(); r.onload = (ev) => addNode('physical', e.target.files[0].name, ev.target.result);
             if(e.target.files[0]) r.readAsDataURL(e.target.files[0]);
          }} />
        </label>
        <button onClick={() => { setIsDrawMode(!isDrawMode); setDrawSource(null); }} style={{ ...btnStyle, backgroundColor: isDrawMode ? "#d63031" : "#444" }}>{isDrawMode ? "STOP DRAWING" : "🖋️ DRAW LEAD"}</button>

        <div style={{ flexGrow: 1 }}>
          <div style={accordionHeaderStyle} onClick={() => setIsEvidenceOpen(!isEvidenceOpen)}><span>📁 Evidence ({filteredItems('physical').length})</span><span>{isEvidenceOpen ? '−' : '+'}</span></div>
          {isEvidenceOpen && filteredItems('physical').map(n => (<div key={n.id} onClick={() => setCenter(n.position.x+100, n.position.y+100, {zoom:2.2})} style={{ cursor: 'pointer', fontSize: '11px', padding: '6px 10px' }}>• {n.data.name}</div>))}
          <div style={accordionHeaderStyle} onClick={() => setIsNotesOpen(!isNotesOpen)}><span>📝 Notes ({filteredItems('note').length})</span><span>{isNotesOpen ? '−' : '+'}</span></div>
          {isNotesOpen && filteredItems('note').map(n => (<div key={n.id} onClick={() => setCenter(n.position.x+100, n.position.y+100, {zoom:2.2})} style={{ cursor: 'pointer', fontSize: '11px', padding: '6px 10px' }}>• {n.data.label}</div>))}
        </div>

        <div style={{ marginTop: '20px', padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
          <select style={inputStyle} value={currentTheme} onChange={(e) => setCurrentTheme(e.target.value)}>
             <option value="cork">Theme: Corkboard</option>
             <option value="midnight">Theme: Midnight</option>
             <option value="blueprint">Theme: Blueprint</option>
          </select>
          <select style={inputStyle} value={currentFont} onChange={(e) => {
            setCurrentFont(e.target.value);
            setNodes(nds => {
              const updated = nds.map(n => ({ ...n, data: { ...n.data, globalFont: fonts[e.target.value] } }));
              updated.forEach(n => sharedNodes.set(n.id, n));
              return updated;
            });
          }}>
             <option value="standard">Font: Modern</option>
             <option value="typewriter">Font: Typewriter</option>
             <option value="handwritten">Font: Notes</option>
          </select>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            {['#d63031', '#3498db', '#9b59b6'].map(c => <button key={c} onClick={() => setActiveColor(c)} style={{ width: '20px', height: '20px', borderRadius: '50%', background: c, border: activeColor === c ? '2px solid white' : 'none' }} />)}
          </div>
        </div>
      </div>

      <div style={{ flexGrow: 1, position: 'relative' }}>
        {Object.entries(otherCursors).map(([id, cursor]) => (
          <GhostCursor key={id} x={cursor.x} y={cursor.y} name={cursor.name} color={cursor.color} />
        ))}
        <ReactFlow 
          nodes={nodes} edges={edges} 
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick} nodeTypes={nodeTypes}
          snapToGrid={!isTimelineView} snapGrid={[20, 20]} deleteKeyCode={["Backspace", "Delete"]} fitView
        >
          <Background color={themes[currentTheme].lines} variant={isTimelineView ? "dots" : "lines"} />
          {isTimelineView && <div style={{ position: 'absolute', top: '50%', left: 0, width: '10000px', height: '2px', background: 'white', opacity: 0.2, pointerEvents: 'none' }} />}
          <MiniMap style={{ background: themes[currentTheme].panel }} nodeColor={(n) => n.data.type === 'group' ? '#ffffff22' : '#d63031'} />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}

export default function App() { return ( <ReactFlowProvider><Board /></ReactFlowProvider> ); }