import React, { useCallback, useState, useEffect, useMemo, useRef } from "react";
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
const roomName = "detective-shared-case-2026-v3"; 
const provider = new WebrtcProvider(roomName, ydoc);
const sharedNodes = ydoc.getMap("nodes");
const sharedEdges = ydoc.getMap("edges");
const sharedLog = ydoc.getArray("log");
const sharedChat = ydoc.getArray("chat");

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

const btnStyle = { 
  padding: "10px", marginBottom: "8px", border: "none", borderRadius: "6px", 
  backgroundColor: "#4b5563", color: "white", cursor: "pointer", 
  fontWeight: "600", fontSize: "11px", width: "100%", textAlign: "center", boxSizing: "border-box" 
};

const inputStyle = {
  width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #3f474f",
  backgroundColor: "#1f2937", color: "white", fontSize: "12px", marginBottom: "10px"
};

// --- CURSOR & PING COMPONENT ---
const GhostCursor = ({ x, y, name, color, isPinging }) => (
  <div style={{ position: 'absolute', left: x, top: y, pointerEvents: 'none', zIndex: 1000, transition: 'transform 0.1s ease-out' }}>
    {isPinging && (
      <div className="ping-ring" style={{
        position: 'absolute', top: 12, left: 12, transform: 'translate(-50%, -50%)',
        width: '100px', height: '100px', border: `4px solid ${color}`, borderRadius: '50%',
        animation: 'ping-anim 1s ease-out infinite'
      }} />
    )}
    <svg width="24" height="24" viewBox="0 0 24 24" fill={color}><path d="M7 2l12 11.2l-5.8 0.5l3.3 7.3l-2.2 1l-3.2-7.1l-4.1 4z" /></svg>
    <div style={{ background: color, color: 'white', padding: '2px 6px', fontSize: '10px', borderRadius: '4px', whiteSpace: 'nowrap' }}>{name}</div>
    <style>{`
      @keyframes ping-anim { 0% { transform: scale(0.1); opacity: 1; } 100% { transform: scale(1.5); opacity: 0; } }
    `}</style>
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

  const onAssign = (e) => {
    e.stopPropagation();
    const current = sharedNodes.get(id);
    const newAssign = current.data.assignedTo === data.localUserName ? null : data.localUserName;
    sharedNodes.set(id, { ...current, data: { ...current.data, assignedTo: newAssign } });
  };

  if (isGroup) {
    return (
      <div style={{ width: '100%', height: '100%', border: '2px dashed #ffffff55', borderRadius: '8px' }}>
        <NodeResizer minWidth={200} minHeight={200} isVisible={selected} />
        <div style={{ position: 'absolute', top: -25, left: 10, color: 'white', fontSize: '10px', background: 'rgba(0,0,0,0.5)', padding: '2px 8px' }}>{data.label}</div>
      </div>
    );
  }

  return (
    <div onContextMenu={(e) => { e.preventDefault(); onAssign(e); }} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Handle type="source" position={Position.Top} style={{ top: '50%', left: '50%', opacity: 0 }} />
      <Handle type="target" position={Position.Top} style={{ top: '50%', left: '50%', opacity: 0 }} />
      <NodeResizer color="#d63031" isVisible={selected} minWidth={100} minHeight={50} keepAspectRatio={isPhysical} />
      
      {data.assignedTo && (
        <div style={{ position: 'absolute', top: -25, right: 0, background: '#f39c12', color: 'black', padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 'bold', zIndex: 10 }}>
          📍 {data.assignedTo}
        </div>
      )}

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
  const [logEntries, setLogEntries] = useState([]);
  const [chatEntries, setChatEntries] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [currentTheme, setCurrentTheme] = useState("cork");
  const [currentFont, setCurrentFont] = useState("standard");
  const [isDrawMode, setIsDrawMode] = useState(false);
  const [drawSource, setDrawSource] = useState(null);
  const [activeColor, setActiveColor] = useState("#d63031");
  const [isTimelineView, setIsTimelineView] = useState(false);
  const [userName, setUserName] = useState("");

  const { setCenter, fitView, toObject } = useReactFlow();
  const logEndRef = useRef(null);
  const chatEndRef = useRef(null);

  // --- INITIAL IDENTITY ---
  useEffect(() => {
    const name = prompt("Enter your Detective Name:", `Agent ${Math.floor(Math.random() * 1000)}`) || "Anonymous";
    setUserName(name);
    provider.awareness.setLocalStateField("user", { name, color: "#e67e22" });
  }, []);

  const addLog = (msg) => {
    sharedLog.push([`[${new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}] ${userName}: ${msg}`]);
    if (sharedLog.length > 30) sharedLog.delete(0, 1);
  };

  const sendChat = (e) => {
    if (e.key === 'Enter' && chatInput.trim()) {
      sharedChat.push([{ sender: userName, text: chatInput, time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) }]);
      if (sharedChat.length > 50) sharedChat.delete(0, 1);
      setChatInput("");
    }
  };

  // --- SYNC ENGINE ---
  useEffect(() => {
    const syncNodes = () => setNodes(Array.from(sharedNodes.values()).map(n => ({...n, data: {...n.data, localUserName: userName}})));
    const syncEdges = () => setEdges(Array.from(sharedEdges.values()));
    const syncLog = () => { setLogEntries(sharedLog.toArray()); setTimeout(() => logEndRef.current?.scrollIntoView(), 50); };
    const syncChat = () => { setChatEntries(sharedChat.toArray()); setTimeout(() => chatEndRef.current?.scrollIntoView(), 50); };

    sharedNodes.observe(syncNodes);
    sharedEdges.observe(syncEdges);
    sharedLog.observe(syncLog);
    sharedChat.observe(syncChat);
    
    provider.awareness.on("change", () => {
      const states = provider.awareness.getStates();
      const cursors = {};
      let count = 0;
      states.forEach((state, clientID) => {
        if (clientID !== provider.awareness.clientID) {
          count++;
          if (state.cursor) cursors[clientID] = { ...state.cursor, name: state.user?.name || "Agent" };
        }
      });
      setPeerCount(count);
      setOtherCursors(cursors);
    });

    return () => {
      sharedNodes.unobserve(syncNodes); sharedEdges.unobserve(syncEdges);
      sharedLog.unobserve(syncLog); sharedChat.unobserve(syncChat);
    };
  }, [userName]);

  // --- MOUSE & PING ---
  const onMouseMove = useCallback(throttle((e) => {
    const currentState = provider.awareness.getLocalState();
    provider.awareness.setLocalStateField("cursor", { 
      x: e.clientX - 320, y: e.clientY, 
      isPinging: currentState?.cursor?.isPinging || false 
    });
  }, 50), []);

  useEffect(() => {
    const handlePing = (e) => {
      if (e.code === "Space") {
        provider.awareness.setLocalStateField("cursor", { ...provider.awareness.getLocalState().cursor, isPinging: true });
        setTimeout(() => provider.awareness.setLocalStateField("cursor", { ...provider.awareness.getLocalState().cursor, isPinging: false }), 1000);
      }
    };
    window.addEventListener("keydown", handlePing);
    return () => window.removeEventListener("keydown", handlePing);
  }, []);

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

  const addNode = (type, label = "", image = null) => {
    const time = (type !== 'group' && type !== 'boardText') ? prompt("Timestamp (YYYY-MM-DD HH:MM):") : null;
    const id = `${type}-${Date.now()}`;
    const newNode = {
      id, type: 'evidence', position: { x: 300, y: 200 },
      data: { label, type, image, name: label, globalFont: fonts[currentFont], timestamp: time, assignedTo: null },
      style: type === 'group' ? { width: 400, height: 400, backgroundColor: themes[currentTheme].group } : { width: 200, height: 100 }
    };
    sharedNodes.set(id, newNode);
    addLog(`Pinned ${type}: "${label || 'Unnamed'}"`);
  };

  const onNodeClick = useCallback((_, node) => {
    if (!isDrawMode || node.data.type === 'group') return;
    if (!drawSource) {
      setDrawSource(node.id);
      setNodes(nds => nds.map(n => n.id === node.id ? { ...n, data: { ...n.data, isDrawingTarget: true } } : n));
    } else {
      if (drawSource !== node.id) {
        const reason = prompt("Connection reason:") || "";
        const id = `e-${Date.now()}`;
        sharedEdges.set(id, {
          id, source: drawSource, target: node.id, label: reason,
          labelStyle: { fill: 'white', fontWeight: 700, fontSize: '10px' },
          labelBgStyle: { fill: activeColor, fillOpacity: 0.9, rx: 4 },
          markerEnd: { type: MarkerType.ArrowClosed, color: activeColor },
          style: { stroke: activeColor, strokeWidth: 4 },
        });
        addLog(`Linked clues: "${sharedNodes.get(drawSource).data.label}" → "${node.data.label}"`);
      }
      setDrawSource(null);
      setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, isDrawingTarget: false } })));
    }
  }, [isDrawMode, drawSource, activeColor, userName]);

  return (
    <div onMouseMove={onMouseMove} style={{ display: "flex", width: "100vw", height: "100vh", backgroundColor: themes[currentTheme].board, overflow: 'hidden' }}>
      {/* SIDEBAR */}
      <div style={{ width: "320px", backgroundColor: themes[currentTheme].panel, color: "#ecf0f1", padding: "15px", display: "flex", flexDirection: "column", zIndex: 10 }}>
        <h2 style={{ fontSize: '16px', fontWeight: '900', marginBottom: '5px' }}>CRIME BOARD v3</h2>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '6px', marginBottom: '10px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: peerCount > 0 ? '#2ecc71' : '#f1c40f' }} />
          <span style={{ fontSize: '10px', fontWeight: 'bold' }}>{userName} | {peerCount} Peers Online</span>
        </div>

        <button onClick={toggleTimeline} style={{ ...btnStyle, backgroundColor: isTimelineView ? "#e67e22" : "#8e44ad" }}>{isTimelineView ? "EXIT TIMELINE" : "⏳ TIMELINE MODE"}</button>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', marginBottom: '10px' }}>
          <button onClick={() => addNode('note', prompt("Note:"))} style={btnStyle}>+ NOTE</button>
          <button onClick={() => addNode('group', prompt("Zone Name:"))} style={{ ...btnStyle, backgroundColor: '#8e44ad' }}>+ ZONE</button>
          <label style={{ ...btnStyle, backgroundColor: "#3b82f6", gridColumn: 'span 2' }}> UPLOAD PHOTO
            <input type="file" hidden onChange={(e) => {
               const r = new FileReader(); r.onload = (ev) => addNode('physical', e.target.files[0].name, ev.target.result);
               if(e.target.files[0]) r.readAsDataURL(e.target.files[0]);
            }} />
          </label>
        </div>
        
        <button onClick={() => { setIsDrawMode(!isDrawMode); setDrawSource(null); }} style={{ ...btnStyle, backgroundColor: isDrawMode ? "#d63031" : "#444" }}>{isDrawMode ? "STOP DRAWING" : "🖋️ DRAW LEAD"}</button>

        {/* LOG SECTION */}
        <div style={{ height: '120px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '4px', marginBottom: '10px', border: '1px solid #333' }}>
          <div style={{ fontSize: '9px', fontWeight: 'bold', color: '#888', marginBottom: '5px' }}>INVESTIGATION LOG</div>
          {logEntries.map((log, i) => <div key={i} style={{ fontSize: '9px', color: '#bbb', marginBottom: '2px' }}>{log}</div>)}
          <div ref={logEndRef} />
        </div>

        {/* CHAT SECTION */}
        <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', background: 'rgba(0,0,0,0.4)', borderRadius: '4px', border: '1px solid #333' }}>
          <div style={{ flexGrow: 1, overflowY: 'auto', padding: '8px' }}>
            <div style={{ fontSize: '9px', fontWeight: 'bold', color: '#888', marginBottom: '5px' }}>SECURE COMMS</div>
            {chatEntries.map((c, i) => (
              <div key={i} style={{ fontSize: '11px', marginBottom: '5px' }}>
                <span style={{ color: '#e67e22', fontWeight: 'bold' }}>{c.sender}: </span>
                <span style={{ color: '#fff' }}>{c.text}</span>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <input 
            style={{ ...inputStyle, marginBottom: 0, borderRadius: '0 0 4px 4px', border: 'none', borderTop: '1px solid #333' }} 
            placeholder="Type message..." value={chatInput} 
            onChange={(e) => setChatInput(e.target.value)} onKeyDown={sendChat}
          />
        </div>

        <div style={{ marginTop: '10px' }}>
           <button onClick={onSave} style={{ ...btnStyle, backgroundColor: "#27ae60" }}>SAVE CASE FILE</button>
        </div>
      </div>

      {/* BOARD CANVAS */}
      <div style={{ flexGrow: 1, position: 'relative' }}>
        {Object.entries(otherCursors).map(([id, cursor]) => (
          <GhostCursor key={id} x={cursor.x} y={cursor.y} name={cursor.name} color="#e67e22" isPinging={cursor.isPinging} />
        ))}
        <ReactFlow 
          nodes={nodes} edges={edges} 
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick} nodeTypes={nodeTypes}
          snapToGrid={!isTimelineView} snapGrid={[20, 20]} deleteKeyCode={["Backspace", "Delete"]} fitView
        >
          <Background color={themes[currentTheme].lines} variant={isTimelineView ? "dots" : "lines"} />
          <MiniMap style={{ background: themes[currentTheme].panel }} nodeColor={(n) => n.data.type === 'group' ? '#ffffff22' : '#d63031'} />
          <Controls />
        </ReactFlow>
        <div style={{ position: 'absolute', bottom: 20, right: 20, color: '#fff', fontSize: '10px', background: 'rgba(0,0,0,0.5)', padding: '5px 10px', borderRadius: '4px' }}>
          [SPACE] to Ping | [RIGHT-CLICK] to Assign Clue
        </div>
      </div>
    </div>
  );
}

export default function App() { return ( <ReactFlowProvider><Board /></ReactFlowProvider> ); }
