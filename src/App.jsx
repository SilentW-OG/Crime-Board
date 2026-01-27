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

// --- MULTIPLAYER CORE ---
// Unified Room Name ensures all users see each other regardless of code updates.
const ydoc = new Y.Doc();
const roomName = "detective-hq-shared-nexus"; 
const provider = new WebrtcProvider(roomName, ydoc);
const sharedNodes = ydoc.getMap("nodes");
const sharedEdges = ydoc.getMap("edges");
const sharedLog = ydoc.getArray("log");
const sharedChat = ydoc.getArray("chat");

// --- THEMES & STYLES ---
const themes = {
  cork: { board: "#a67c52", lines: "#8d643f", panel: "#2c1e12", group: "rgba(0,0,0,0.2)" },
  midnight: { board: "#1a1c1e", lines: "#2d2f31", panel: "#0d0e10", group: "rgba(255,255,255,0.05)" }
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

// --- GHOST CURSOR & PING COMPONENT ---
const GhostCursor = ({ x, y, name, color, isPinging }) => (
  <div style={{ position: 'absolute', left: x, top: y, pointerEvents: 'none', zIndex: 1000, transition: 'transform 0.1s ease-out' }}>
    {isPinging && <div className="ping-effect" />}
    <svg width="24" height="24" viewBox="0 0 24 24" fill={color}><path d="M7 2l12 11.2l-5.8 0.5l3.3 7.3l-2.2 1l-3.2-7.1l-4.1 4z" /></svg>
    <div style={{ background: color, color: 'white', padding: '2px 6px', fontSize: '10px', borderRadius: '4px', whiteSpace: 'nowrap' }}>{name}</div>
    <style>{`
      @keyframes ping-anim { 0% { transform: scale(0.1); opacity: 1; } 100% { transform: scale(2); opacity: 0; } }
      .ping-effect { position: absolute; top: 12px; left: 12px; transform: translate(-50%, -50%); width: 80px; height: 80px; border: 4px solid #e67e22; border-radius: 50%; animation: ping-anim 0.8s ease-out infinite; }
    `}</style>
  </div>
);

// --- CUSTOM EVIDENCE NODE ---
const EvidenceNode = ({ id, data, selected }) => {
  const isGroup = data.type === 'group';
  const isNote = data.type === 'note';
  const isBoardText = data.type === 'boardText';
  const isPhysical = data.type === 'physical';
  
  const liveWidth = useStore((s) => s.nodeInternals.get(id)?.width);
  const dynamicFontSize = isBoardText ? (liveWidth ? liveWidth / 5.5 : 36) : 16;

  const onAssign = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const current = sharedNodes.get(id);
    const newAssign = current.data.assignedTo === data.localUserName ? null : data.localUserName;
    sharedNodes.set(id, { ...current, data: { ...current.data, assignedTo: newAssign } });
  };

  const onToggleStatus = (e) => {
    e.stopPropagation();
    const current = sharedNodes.get(id);
    const statuses = ['OPEN', 'SOLVED', 'DEAD END'];
    const next = statuses[(statuses.indexOf(data.status || 'OPEN') + 1) % 3];
    sharedNodes.set(id, { ...current, data: { ...current.data, status: next } });
  };

  const statusColor = data.status === 'SOLVED' ? '#2ecc71' : data.status === 'DEAD END' ? '#e74c3c' : '#f1c40f';

  if (isGroup) return (
    <div style={{ width: '100%', height: '100%', border: '2px dashed #ffffff55', borderRadius: '8px' }}>
      <NodeResizer minWidth={200} minHeight={200} isVisible={selected} />
      <div style={{ position: 'absolute', top: -25, left: 10, color: 'white', fontSize: '10px', background: 'rgba(0,0,0,0.5)', padding: '2px 8px' }}>{data.label}</div>
    </div>
  );

  return (
    <div onContextMenu={onAssign} onDoubleClick={onToggleStatus} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Handle type="source" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <NodeResizer color="#d63031" isVisible={selected} minWidth={50} minHeight={50} />
      
      {!isBoardText && (
        <div style={{ 
          width: "14px", height: "14px", backgroundColor: "#c0392b", borderRadius: "50%", 
          position: "absolute", top: "-7px", left: "50%", transform: "translateX(-50%)", 
          zIndex: 100, border: '1px solid rgba(0,0,0,0.3)', boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
        }} />
      )}

      {data.assignedTo && <div style={{ position: 'absolute', top: -35, left: 0, background: '#e67e22', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 'bold', zIndex: 10 }}>🕵️ {data.assignedTo}</div>}
      {!isBoardText && <div style={{ position: 'absolute', top: -35, right: 0, background: statusColor, color: 'black', padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 'bold', zIndex: 10 }}>{data.status || 'OPEN'}</div>}

      <div style={{ 
        width: '100%', height: '100%', padding: isNote ? '15px' : '0px', 
        background: isPhysical ? 'transparent' : (isNote ? "#fff9c4" : (isBoardText ? 'transparent' : 'white')),
        boxShadow: (isBoardText || isPhysical) ? 'none' : "0 8px 15px rgba(0,0,0,0.2)",
        display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', 
        overflow: 'hidden', border: data.isDrawingTarget ? `4px solid #d63031` : 'none',
        fontFamily: 'Inter, sans-serif', borderRadius: isPhysical ? 0 : '4px'
      }}>
        {data.image && <img src={data.image} alt="clue" style={{ width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }} />}
        {isNote && <div style={{ fontSize: '14px', color: '#333', textAlign: 'center' }}>{data.label}</div>}
        {isBoardText && <div style={{ color: '#fff', fontSize: `${dynamicFontSize}px`, fontWeight: '900', textAlign: 'center', textTransform: 'uppercase', textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>{data.label}</div>}
        {data.timestamp && <div style={{ position: 'absolute', bottom: 5, right: 5, fontSize: '9px', background: 'rgba(0,0,0,0.6)', color: 'white', padding: '2px 4px', borderRadius: '3px' }}>📅 {data.timestamp}</div>}
      </div>
    </div>
  );
};

const nodeTypes = { evidence: EvidenceNode };

function Board() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [peerCursors, setPeerCursors] = useState({});
  const [peerCount, setPeerCount] = useState(0);
  const [chat, setChat] = useState([]);
  const [log, setLog] = useState([]);
  const [msg, setMsg] = useState("");
  const [userName, setUserName] = useState("");
  const [currentTheme, setCurrentTheme] = useState("cork");
  const [isDrawMode, setIsDrawMode] = useState(false);
  const [drawSource, setDrawSource] = useState(null);
  const [activeColor, setActiveColor] = useState("#d63031");
  const [isTimelineView, setIsTimelineView] = useState(false);
  
  const { fitView } = useReactFlow();
  const chatEndRef = useRef(null);
  const logEndRef = useRef(null);

  useEffect(() => {
    const storedName = localStorage.getItem("detectiveName");
    const name = storedName || prompt("Enter Detective Name:") || "Agent-" + Math.floor(Math.random()*100);
    setUserName(name);
    localStorage.setItem("detectiveName", name);
    provider.awareness.setLocalStateField("user", { name });
  }, []);

  const addLog = (text) => {
    sharedLog.push([`[${new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}] ${userName}: ${text}`]);
    if (sharedLog.length > 30) sharedLog.delete(0, 1);
  };

  const handleRename = () => {
    const newName = prompt("Enter new codename:", userName);
    if (newName && newName.trim() !== "") {
      addLog(`changed handle to "${newName}"`);
      setUserName(newName);
      localStorage.setItem("detectiveName", newName);
      provider.awareness.setLocalStateField("user", { name: newName });
    }
  };

  useEffect(() => {
    const syncNodes = () => setNodes(Array.from(sharedNodes.values()).map(n => ({...n, data: {...n.data, localUserName: userName}})));
    const syncEdges = () => setEdges(Array.from(sharedEdges.values()));
    const syncChat = () => { setChat(sharedChat.toArray()); setTimeout(() => chatEndRef.current?.scrollIntoView({behavior:'smooth'}), 100); };
    const syncLog = () => { setLog(sharedLog.toArray()); setTimeout(() => logEndRef.current?.scrollIntoView({behavior:'smooth'}), 100); };

    sharedNodes.observe(syncNodes); sharedEdges.observe(syncEdges);
    sharedChat.observe(syncChat); sharedLog.observe(syncLog);
    
    provider.awareness.on("change", () => {
      const states = provider.awareness.getStates();
      const cursors = {};
      let count = 0;
      states.forEach((s, id) => {
        if(id !== provider.awareness.clientID) {
          count++;
          if(s.cursor) cursors[id] = {...s.cursor, name: s.user?.name || "Agent"};
        }
      });
      setPeerCount(count);
      setPeerCursors(cursors);
    });

    return () => {
        sharedNodes.unobserve(syncNodes); sharedEdges.unobserve(syncEdges);
        sharedChat.unobserve(syncChat); sharedLog.unobserve(syncLog);
    }
  }, [userName]);

  const onMouseMove = useCallback(throttle((e) => {
    const cur = provider.awareness.getLocalState()?.cursor;
    provider.awareness.setLocalStateField("cursor", { x: e.clientX - 320, y: e.clientY, isPinging: cur?.isPinging });
  }, 50), []);

  useEffect(() => {
    const handlePing = (e) => {
      if (e.code === "Space") {
        provider.awareness.setLocalStateField("cursor", { ...provider.awareness.getLocalState().cursor, isPinging: true });
        setTimeout(() => provider.awareness.setLocalStateField("cursor", { ...provider.awareness.getLocalState().cursor, isPinging: false }), 800);
      }
    };
    window.addEventListener("keydown", handlePing); return () => window.removeEventListener("keydown", handlePing);
  }, []);

  const onNodesChange = useCallback((chs) => {
    setNodes(nds => { const next = applyNodeChanges(chs, nds); next.forEach(n => sharedNodes.set(n.id, n)); return next; });
  }, []);

  const onEdgesChange = useCallback((chs) => {
    setEdges(eds => { const next = applyEdgeChanges(chs, eds); next.forEach(e => sharedEdges.set(e.id, e)); return next; });
  }, []);

  const addNode = (type, label = "", image = null) => {
    const id = `${type}-${Date.now()}`;
    const time = (type !== 'group' && type !== 'boardText') ? prompt("Timestamp (YYYY-MM-DD):") : null;
    const node = {
      id, type: 'evidence', position: { x: 400, y: 300 },
      data: { label, type, image, status: 'OPEN', timestamp: time },
      style: type === 'group' ? { width: 400, height: 400, background: themes[currentTheme].group } : 
             type === 'boardText' ? { width: 300, height: 60 } : { width: 200, height: 100 }
    };
    sharedNodes.set(id, node);
    addLog(`Pinned ${type} "${label || 'New Clue'}"`);
  };

  const onNodeClick = useCallback((_, node) => {
    if (!isDrawMode || node.data.type === 'group') return;
    if (!drawSource) {
      setDrawSource(node.id);
      setNodes(nds => nds.map(n => n.id === node.id ? { ...n, data: { ...n.data, isDrawingTarget: true } } : n));
    } else {
      if (drawSource !== node.id) {
        const reason = prompt("Link reason:");
        const id = `e-${Date.now()}`;
        sharedEdges.set(id, {
          id, source: drawSource, target: node.id, label: reason,
          labelStyle: { fill: 'white', fontWeight: 700, fontSize: '10px' },
          labelBgStyle: { fill: activeColor, fillOpacity: 0.9, rx: 4 },
          markerEnd: { type: MarkerType.ArrowClosed, color: activeColor },
          style: { stroke: activeColor, strokeWidth: 4 },
        });
        addLog(`Linked clues: ${sharedNodes.get(drawSource).data.label} -> ${node.data.label}`);
      }
      setDrawSource(null);
      setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, isDrawingTarget: false } })));
    }
  }, [isDrawMode, drawSource, activeColor]);

  const toggleTimeline = () => {
    if (!isTimelineView) {
      const sorted = nodes.filter(n => n.data.timestamp).sort((a, b) => new Date(a.data.timestamp) - new Date(b.data.timestamp));
      setNodes(nds => nds.map(node => {
        const index = sorted.findIndex(s => s.id === node.id);
        const updated = { ...node, position: index !== -1 ? { x: index * 350, y: 300 } : node.position, draggable: false };
        sharedNodes.set(node.id, updated); return updated;
      }));
    } else {
      setNodes(nds => nds.map(n => { const u = {...n, draggable:true}; sharedNodes.set(n.id, u); return u; }));
    }
    setIsTimelineView(!isTimelineView);
    setTimeout(() => fitView({ duration: 800 }), 50);
  };

  const sendChat = (e) => {
    if (e.key === 'Enter' && msg.trim()) {
      sharedChat.push([{ sender: userName, text: msg }]);
      setMsg("");
    }
  };

  return (
    <div onMouseMove={onMouseMove} style={{ display: "flex", width: "100vw", height: "100vh", backgroundColor: themes[currentTheme].board, overflow: 'hidden' }}>
      
      {/* --- SIDEBAR --- */}
      <div style={{ width: "320px", backgroundColor: themes[currentTheme].panel, color: "#ecf0f1", padding: "15px", display: "flex", flexDirection: "column", zIndex: 10 }}>
        <h2 style={{ fontSize: '16px', fontWeight: '900', marginBottom: '15px' }}>CRIME BOARD v6.1</h2>
        
        {/* IDENTITY SECTION */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '6px', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: peerCount > 0 ? '#2ecc71' : '#f1c40f' }} />
            <span style={{ fontSize: '11px', fontWeight: 'bold' }}>{userName}</span>
          </div>
          <button onClick={handleRename} style={{ border: '1px solid #555', background: 'transparent', color: '#ccc', fontSize: '9px', padding: '2px 5px', borderRadius: '3px', cursor: 'pointer' }}>RENAME</button>
        </div>

        <button onClick={toggleTimeline} style={{ ...btnStyle, backgroundColor: isTimelineView ? "#e67e22" : "#8e44ad" }}>{isTimelineView ? "EXIT TIMELINE" : "⏳ TIMELINE MODE"}</button>
        
        {/* TOOLS */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', marginBottom: '10px' }}>
          <button onClick={() => addNode('boardText', prompt("Heading:"))} style={{ ...btnStyle, backgroundColor: '#c0392b' }}>+ HEADING</button>
          <button onClick={() => addNode('note', prompt("Note:"))} style={btnStyle}>+ NOTE</button>
          <button onClick={() => addNode('group', prompt("Zone Name:"))} style={{ ...btnStyle, backgroundColor: '#8e44ad' }}>+ ZONE</button>
          <label style={{ ...btnStyle, backgroundColor: "#3b82f6", gridColumn: 'span 1' }}> PHOTO
            <input type="file" hidden onChange={(e) => {
               const r = new FileReader(); r.onload = (ev) => addNode('physical', 'Evidence', ev.target.result);
               r.readAsDataURL(e.target.files[0]);
            }} />
          </label>
        </div>
        
        <button onClick={() => { setIsDrawMode(!isDrawMode); setDrawSource(null); }} style={{ ...btnStyle, backgroundColor: isDrawMode ? "#d63031" : "#444" }}>{isDrawMode ? "STOP DRAWING" : "🖋️ DRAW LEAD"}</button>

        {/* LOG */}
        <div style={{ height: '80px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '4px', marginBottom: '10px', border: '1px solid #333' }}>
          <div style={{ fontSize: '9px', fontWeight: 'bold', color: '#888' }}>INVESTIGATION LOG</div>
          {log.map((l, i) => <div key={i} style={{ fontSize: '9px', color: '#bbb' }}>• {l}</div>)}
          <div ref={logEndRef} />
        </div>

        {/* CHAT */}
        <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', background: 'rgba(0,0,0,0.4)', borderRadius: '4px', border: '1px solid #333', overflow: 'hidden' }}>
          <div style={{ flexGrow: 1, overflowY: 'auto', padding: '8px' }}>
            {chat.map((c, i) => (
              <div key={i} style={{ fontSize: '11px', marginBottom: '5px' }}>
                <b style={{ color: '#e67e22' }}>{c.sender}: </b><span style={{ color: '#fff' }}>{c.text}</span>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <input style={{ ...inputStyle, marginBottom: 0, borderRadius: 0, border: 'none', borderTop: '1px solid #333' }} placeholder="Secure message..." value={msg} onChange={e => setMsg(e.target.value)} onKeyDown={sendChat} />
        </div>

        <div style={{ marginTop: '10px' }}>
           <button onClick={() => fitView()} style={{ ...btnStyle, width: '100%' }}>FOCUS BOARD</button>
        </div>
      </div>

      {/* --- CANVAS --- */}
      <div style={{ flexGrow: 1, position: 'relative' }}>
        {Object.entries(peerCursors).map(([id, c]) => <GhostCursor key={id} {...c} color="#e67e22" />)}
        <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onNodeClick={onNodeClick} nodeTypes={nodeTypes} fitView>
          <Background color={themes[currentTheme].lines} variant={isTimelineView ? "dots" : "lines"} />
          <MiniMap style={{ background: themes[currentTheme].panel }} />
          <Controls />
        </ReactFlow>
        <div style={{ position: 'absolute', bottom: 20, right: 20, color: '#fff', fontSize: '10px', background: 'rgba(0,0,0,0.5)', padding: '5px 10px', borderRadius: '4px' }}>
          [SPACE] Ping | [RIGHT-CLICK] Assign | [DBL-CLICK] Status
        </div>
      </div>
    </div>
  );
}

export default function App() { return ( <ReactFlowProvider><Board /></ReactFlowProvider> ); }
