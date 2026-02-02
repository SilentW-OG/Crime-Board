import React, { useCallback, useState, useEffect, useRef, useMemo } from "react";
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

// --- MULTIPLAYER ENGINE ---
const ydoc = new Y.Doc();

const themes = {
  cork: { board: "#a67c52", lines: "#8d643f", panel: "#2c1e12", group: "rgba(0,0,0,0.2)" }
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

// --- GHOST CURSOR ---
const GhostCursor = ({ x, y, name, color }) => (
  <div style={{ position: 'absolute', left: x, top: y, pointerEvents: 'none', zIndex: 1000, transition: 'transform 0.1s ease-out' }}>
    <svg width="24" height="24" viewBox="0 0 24 24" fill={color}><path d="M7 2l12 11.2l-5.8 0.5l3.3 7.3l-2.2 1l-3.2-7.1l-4.1 4z" /></svg>
    <div style={{ background: color, color: 'white', padding: '2px 6px', fontSize: '10px', borderRadius: '4px', whiteSpace: 'nowrap' }}>{name}</div>
  </div>
);

// --- CUSTOM EVIDENCE NODES ---
const EvidenceNode = ({ id, data, selected }) => {
  const isGroup = data.type === 'group';
  const isNote = data.type === 'note';
  const isBoardText = data.type === 'boardText';
  const isPhysical = data.type === 'physical';
  const isSuspect = data.type === 'suspect';
  
  const liveWidth = useStore((s) => s.nodeInternals.get(id)?.width);
  const dynamicFontSize = isBoardText ? (liveWidth ? liveWidth / 5.5 : 36) : 16;

  const onAssign = (e) => {
    e.preventDefault(); e.stopPropagation();
    const current = ydoc.getMap("nodes").get(id);
    const newAssign = current.data.assignedTo === data.localUserName ? null : data.localUserName;
    ydoc.getMap("nodes").set(id, { ...current, data: { ...current.data, assignedTo: newAssign } });
  };

  const onToggleStatus = (e) => {
    e.stopPropagation();
    const current = ydoc.getMap("nodes").get(id);
    const statuses = ['OPEN', 'SOLVED', 'DEAD END'];
    const next = statuses[(statuses.indexOf(data.status || 'OPEN') + 1) % 3];
    ydoc.getMap("nodes").set(id, { ...current, data: { ...current.data, status: next } });
  };

  const onEditClick = (e) => {
    e.stopPropagation();
    if (data.onEditNode) data.onEditNode(id, data);
  };

  const onUploadClick = (e) => {
    e.stopPropagation();
    if (data.onSuspectImage) data.onSuspectImage();
  };

  const statusColor = data.status === 'SOLVED' ? '#2ecc71' : data.status === 'DEAD END' ? '#e74c3c' : '#f1c40f';

  if (isGroup) return (
    <div style={{ width: '100%', height: '100%', border: '2px dashed #ffffff55', borderRadius: '8px' }}>
      <NodeResizer minWidth={200} minHeight={200} isVisible={selected} />
      <div style={{ position: 'absolute', top: -25, left: 10, color: 'white', fontSize: '10px', background: 'rgba(0,0,0,0.5)', padding: '2px 8px' }}>{data.label}</div>
    </div>
  );

  return (
    <div onContextMenu={data.onRightClick} onDoubleClick={onToggleStatus} style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* HANDLES */}
      <Handle type="source" position={Position.Top} id="top" style={{ opacity: 0, top: 0 }} />
      <Handle type="target" position={Position.Top} id="top" style={{ opacity: 0, top: 0 }} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={{ opacity: 0, bottom: 0 }} />
      <Handle type="target" position={Position.Bottom} id="bottom" style={{ opacity: 0, bottom: 0 }} />

      <NodeResizer color="#d63031" isVisible={selected} minWidth={100} minHeight={100} />
      
      {/* Visual Pin */}
      {!isBoardText && <div style={{ width: "14px", height: "14px", backgroundColor: "#c0392b", borderRadius: "50%", position: "absolute", top: "-7px", left: "50%", transform: "translateX(-50%)", zIndex: 100, border: '1px solid rgba(0,0,0,0.3)', boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }} />}
      
      {/* Badges */}
      {data.assignedTo && <div style={{ position: 'absolute', top: -35, left: 0, background: '#e67e22', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 'bold', zIndex: 10 }}>🕵️ {data.assignedTo}</div>}
      {!isBoardText && <div style={{ position: 'absolute', top: -35, right: 0, background: statusColor, color: 'black', padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 'bold', zIndex: 10 }}>{data.status || 'OPEN'}</div>}

      {/* Edit Button (Pencil) */}
      {(isSuspect || isNote || isBoardText) && (
        <div onClick={onEditClick} style={{ 
          position: 'absolute', top: 5, right: 5, zIndex: 50, cursor: 'pointer', 
          background: 'rgba(0,0,0,0.5)', borderRadius: '4px', padding: '2px 5px', color: 'white', fontSize: '10px' 
        }}>✎</div>
      )}

      <div style={{ 
        width: '100%', height: '100%', 
        background: isSuspect ? '#1a1c1e' : (isNote ? "#fff9c4" : (isBoardText ? 'transparent' : 'white')),
        color: isSuspect ? 'white' : 'black',
        boxShadow: (isBoardText || isPhysical) ? 'none' : "0 8px 15px rgba(0,0,0,0.2)",
        display: 'flex', flexDirection: 'column', 
        overflow: 'hidden', border: data.isDrawingTarget ? `4px solid #d63031` : (isSuspect ? '2px solid #555' : 'none'),
        borderRadius: isPhysical ? 0 : '4px',
        fontFamily: 'Inter, sans-serif'
      }}>
        {isSuspect && (
          <div style={{ padding: '10px', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '10px', color: '#888', fontWeight: 'bold', textTransform: 'uppercase' }}>Suspect Profile</div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '5px', flexGrow: 1 }}>
              <div 
                onClick={onUploadClick}
                title="Click to upload mugshot"
                style={{ width: '80px', height: '100px', background: '#333', borderRadius: '4px', overflow: 'hidden', flexShrink: 0, cursor: 'pointer', position: 'relative' }}
              >
                {data.image ? <img src={data.image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Suspect" /> : <div style={{ padding: '20px', textAlign: 'center', fontSize: '20px' }}>👤</div>}
              </div>
              <div style={{ flexGrow: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: 'bold', borderBottom: '1px solid #444', paddingBottom: '2px' }}>{data.label}</div>
                <div style={{ fontSize: '9px', marginTop: '5px' }}><b>ALIBI:</b> {data.alibi || 'Unknown'}</div>
                <div style={{ fontSize: '9px', marginTop: '5px' }}><b>ASSOCIATES:</b> {data.associates || 'None listed'}</div>
              </div>
            </div>
          </div>
        )}

        {!isSuspect && data.image && <img src={data.image} alt="clue" style={{ width: '100%', height: '100%', display: 'block', pointerEvents: 'none', objectFit: 'cover' }} />}
        {isNote && <div style={{ padding: '15px', fontSize: '14px', textAlign: 'center' }}>{data.label}</div>}
        {isBoardText && <div style={{ color: '#fff', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: `${dynamicFontSize}px`, fontWeight: '900', textAlign: 'center', textTransform: 'uppercase', textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>{data.label}</div>}
        
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
  const [connStatus, setConnStatus] = useState("Offline");
  const [chat, setChat] = useState([]);
  const [log, setLog] = useState([]);
  const [msg, setMsg] = useState("");
  const [userName, setUserName] = useState("");
  const [roomID, setRoomID] = useState("");
  const [isDrawMode, setIsDrawMode] = useState(false);
  const [isTimelineMode, setIsTimelineMode] = useState(false);
  const [drawSource, setDrawSource] = useState(null);
  const [provider, setProvider] = useState(null);
  
  // Image Upload State
  const [uploadTarget, setUploadTarget] = useState(null);
  const suspectUploadRef = useRef(null);
  const loadFileRef = useRef(null);
  
  const { fitView } = useReactFlow();
  const chatEndRef = useRef(null);
  const logEndRef = useRef(null);

  // --- "DEEP DIG" CONNECTIVITY ---
  useEffect(() => {
    const name = localStorage.getItem("detectiveName") || "Agent-" + Math.floor(Math.random()*900);
    const room = prompt("Enter CASE ID (Must be identical for all peers):", "CASE-001") || "GLOBAL-CASE";
    setUserName(name); setRoomID(room);
    localStorage.setItem("detectiveName", name);

    const p = new WebrtcProvider(`crimeboard-v10-${room}`, ydoc, {
      signaling: [
        "wss://y-webrtc-signaling-eu.herokuapp.com",
        "wss://y-webrtc-signaling-us.herokuapp.com",
        "wss://signaling.yjs.dev",
        "wss://y-webrtc.fly.dev"
      ],
      peerOpts: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          { urls: "stun:stun2.l.google.com:19302" },
          { urls: "stun:global.stun.twilio.com:3478" }
        ]
      }
    });

    p.awareness.setLocalStateField("user", { name });
    setProvider(p);

    return () => p.destroy();
  }, []);

  // --- EDITING LOGIC ---
  const handleEditNode = (id, data) => {
    const current = ydoc.getMap("nodes").get(id);
    if (!current) return;

    if (data.type === 'suspect') {
        const newName = prompt("Update Name:", data.label);
        const newAlibi = prompt("Update Alibi:", data.alibi);
        const newAssoc = prompt("Update Associates:", data.associates);
        if (newName !== null) {
            ydoc.getMap("nodes").set(id, {
                ...current,
                data: { ...current.data, label: newName, alibi: newAlibi || data.alibi, associates: newAssoc || data.associates }
            });
        }
    } else {
        const newLabel = prompt("Update Text:", data.label);
        if (newLabel !== null) {
            ydoc.getMap("nodes").set(id, { ...current, data: { ...current.data, label: newLabel } });
        }
    }
  };

  // --- RIGHT CLICK DELETE LOGIC ---
  const onNodeContextMenu = useCallback((event, node) => {
    event.preventDefault();
    const confirmDelete = window.confirm(`DELETE ITEM?\n\nAre you sure you want to permanently remove "${node.data.label}" from the case board?`);
    if (confirmDelete) {
        ydoc.getMap("nodes").delete(node.id);
        ydoc.getArray("log").push([{ text: `Agent ${userName} deleted evidence: ${node.data.label}`, time: new Date().toLocaleTimeString() }]);
    }
  }, [userName]);

  // --- TIMELINE LOGIC ---
  const filteredNodes = useMemo(() => {
    if (!isTimelineMode) return nodes;
    return nodes
      .filter(n => n.data.type !== 'group')
      .sort((a, b) => {
        const dateA = new Date(a.data.timestamp || 0);
        const dateB = new Date(b.data.timestamp || 0);
        return dateA - dateB;
      })
      .map((n, index) => ({
        ...n,
        position: { x: index * 350, y: 300 },
        draggable: false 
      }));
  }, [nodes, isTimelineMode]);

  useEffect(() => {
    if (!provider) return;
    const sharedNodes = ydoc.getMap("nodes");
    const sharedEdges = ydoc.getMap("edges");
    const sharedChat = ydoc.getArray("chat");
    const sharedLog = ydoc.getArray("log");

    const syncNodes = () => setNodes(Array.from(sharedNodes.values()).map(n => ({
        ...n, 
        data: {
            ...n.data, 
            localUserName: userName,
            onSuspectImage: () => { setUploadTarget(n.id); suspectUploadRef.current.click(); },
            onEditNode: handleEditNode,
            onRightClick: (e) => onNodeContextMenu(e, n)
        }
    })));
    
    const syncEdges = () => setEdges(Array.from(sharedEdges.values()));
    const syncChat = () => { setChat(sharedChat.toArray()); setTimeout(() => chatEndRef.current?.scrollIntoView({behavior:'smooth'}), 50); };
    const syncLog = () => { setLog(sharedLog.toArray()); setTimeout(() => logEndRef.current?.scrollIntoView({behavior:'smooth'}), 50); };

    sharedNodes.observe(syncNodes); sharedEdges.observe(syncEdges); 
    sharedChat.observe(syncChat); sharedLog.observe(syncLog);

    provider.on("status", ({ status }) => setConnStatus(status === "connected" ? "ONLINE" : "CONNECTING..."));
    
    provider.awareness.on("change", () => {
      const states = provider.awareness.getStates();
      const cursors = {}; let count = 0;
      states.forEach((s, id) => {
        if(id !== provider.awareness.clientID) {
          count++; if(s.cursor) cursors[id] = {...s.cursor, name: s.user?.name || "Agent"};
        }
      });
      setPeerCount(count); setPeerCursors(cursors);
    });
  }, [provider, userName, onNodeContextMenu]);

  const onMouseMove = useCallback(throttle((e) => {
    if (provider) provider.awareness.setLocalStateField("cursor", { x: e.clientX - 320, y: e.clientY });
  }, 40), [provider]);

  const onNodesChange = useCallback((chs) => {
    if (isTimelineMode) return; 
    setNodes(nds => { 
        const next = applyNodeChanges(chs, nds); 
        next.forEach(n => ydoc.getMap("nodes").set(n.id, n)); 
        return next; 
    });
  }, [isTimelineMode]);

  const onEdgesChange = useCallback((chs) => {
    setEdges(eds => { 
        const next = applyEdgeChanges(chs, eds); 
        next.forEach(e => ydoc.getMap("edges").set(e.id, e)); 
        return next; 
    });
  }, []);

  // --- SAVE & LOAD ---
  const saveCaseFile = () => {
    const data = {
        nodes: Array.from(ydoc.getMap("nodes").values()),
        edges: Array.from(ydoc.getMap("edges").values()),
        chat: ydoc.getArray("chat").toArray(),
        log: ydoc.getArray("log").toArray(),
        exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `CASE-${roomID}-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadCaseFile = (e) => {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const data = JSON.parse(ev.target.result);
            if(confirm("WARNING: Loading a file will OVERWRITE the current board for ALL users. Continue?")) {
                ydoc.transact(() => {
                    ydoc.getMap("nodes").clear();
                    ydoc.getMap("edges").clear();
                    ydoc.getArray("chat").delete(0, ydoc.getArray("chat").length);
                    ydoc.getArray("log").delete(0, ydoc.getArray("log").length);

                    data.nodes.forEach(n => ydoc.getMap("nodes").set(n.id, n));
                    data.edges.forEach(e => ydoc.getMap("edges").set(e.id, e));
                    if(data.chat) ydoc.getArray("chat").push(data.chat);
                    if(data.log) ydoc.getArray("log").push(data.log);
                    
                    ydoc.getArray("log").push([{ text: `Agent ${userName} loaded backup case file.`, time: new Date().toLocaleTimeString() }]);
                });
            }
        } catch(err) {
            alert("Error loading file: " + err.message);
        }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const addNode = (type, label = "", image = null) => {
    const id = `${type}-${Date.now()}`;
    let extraData = {};
    if (type === 'suspect') {
        extraData = { alibi: prompt("Suspect Alibi:"), associates: prompt("Known Associates:"), image };
    }
    const node = {
      id, type: 'evidence', position: { x: 400, y: 300 },
      data: { label, type, image, status: 'OPEN', timestamp: (type !== 'group' && type !== 'boardText') ? prompt("Date of Evidence (YYYY-MM-DD):", "2026-01-01") : null, ...extraData },
      style: type === 'group' ? { width: 400, height: 400, background: themes.cork.group } : 
             type === 'suspect' ? { width: 300, height: 180 } :
             type === 'boardText' ? { width: 300, height: 80 } : { width: 200, height: 100 }
    };
    ydoc.getMap("nodes").set(id, node);
    ydoc.getArray("log").push([{ text: `Agent ${userName} added ${type}: ${label}`, time: new Date().toLocaleTimeString() }]);
  };

  const handleSuspectImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file || !uploadTarget) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        const current = ydoc.getMap("nodes").get(uploadTarget);
        if (current) {
            ydoc.getMap("nodes").set(uploadTarget, {
                ...current,
                data: { ...current.data, image: ev.target.result }
            });
            ydoc.getArray("log").push([{ text: `Agent ${userName} updated suspect mugshot`, time: new Date().toLocaleTimeString() }]);
        }
        setUploadTarget(null);
    };
    reader.readAsDataURL(file);
    e.target.value = ""; 
  };

  const onNodeClick = useCallback((_, node) => {
    if (!isDrawMode || node.data.type === 'group') return;
    
    if (!drawSource) {
      setDrawSource(node.id);
      setNodes(nds => nds.map(n => n.id === node.id ? { ...n, data: { ...n.data, isDrawingTarget: true } } : n));
    } else {
      if (drawSource !== node.id) {
        const id = `e-${Date.now()}`;
        const sourceNode = nodes.find(n => n.id === drawSource);
        let srcHandle = 'bottom';
        let tgtHandle = 'top';

        if (sourceNode && node) {
            if (sourceNode.position.y > node.position.y) {
                srcHandle = 'top'; tgtHandle = 'bottom';
            } else {
                srcHandle = 'bottom'; tgtHandle = 'top';
            }
        }

        ydoc.getMap("edges").set(id, {
          id, 
          source: drawSource, 
          target: node.id, 
          sourceHandle: srcHandle,
          targetHandle: tgtHandle,
          label: prompt("Connection reason:"),
          labelStyle: { fill: 'white', fontWeight: 700, fontSize: '10px' },
          labelBgStyle: { fill: "#d63031", fillOpacity: 0.9, rx: 4 },
          markerEnd: { type: MarkerType.ArrowClosed, color: "#d63031" },
          style: { stroke: "#d63031", strokeWidth: 4 },
        });
      }
      setDrawSource(null);
      setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, isDrawingTarget: false } })));
    }
  }, [isDrawMode, drawSource, nodes]);

  return (
    <div onMouseMove={onMouseMove} style={{ display: "flex", width: "100vw", height: "100vh", backgroundColor: themes.cork.board, overflow: 'hidden' }}>
      
      <input type="file" ref={suspectUploadRef} onChange={handleSuspectImageUpload} hidden accept="image/*" />
      <input type="file" ref={loadFileRef} onChange={loadCaseFile} hidden accept=".json" />

      {/* SIDEBAR */}
      <div style={{ width: "320px", backgroundColor: themes.cork.panel, color: "#ecf0f1", padding: "15px", display: "flex", flexDirection: "column", zIndex: 10, boxShadow: '5px 0 15px rgba(0,0,0,0.3)' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '900', marginBottom: '5px', letterSpacing: '1px' }}>CASE EVIDENCE BOARD v10.0</h2>
        
        <div style={{ background: 'rgba(0,0,0,0.5)', padding: '10px', borderRadius: '6px', marginBottom: '15px', borderLeft: `4px solid ${connStatus === "ONLINE" ? '#2ecc71' : '#e74c3c'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff' }}>🕵️ {userName}</span>
                <span style={{ fontSize: '10px', color: connStatus === "ONLINE" ? '#2ecc71' : '#e74c3c', fontWeight: '900' }}>{connStatus}</span>
            </div>
            <div style={{ fontSize: '10px', color: '#aaa', marginTop: '4px' }}>CASE ID: <b style={{color:'#eee'}}>{roomID}</b> | {peerCount} PEERS</div>
        </div>

        <button onClick={() => setIsTimelineMode(!isTimelineMode)} style={{ ...btnStyle, backgroundColor: isTimelineMode ? '#2ecc71' : '#8e44ad', border: isTimelineMode ? '2px solid white' : 'none' }}>
            {isTimelineMode ? "🔓 EXIT TIMELINE" : "⏳ ENTER TIMELINE MODE"}
        </button>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', marginBottom: '10px' }}>
          <button onClick={() => addNode('boardText', prompt("Title:"))} style={{ ...btnStyle, backgroundColor: '#c0392b' }}>+ HEADING</button>
          <button onClick={() => addNode('note', prompt("Note:"))} style={btnStyle}>+ NOTE</button>
          <button onClick={() => addNode('group', prompt("Zone Name:"))} style={{ ...btnStyle, backgroundColor: '#8e44ad' }}>+ ZONE</button>
          <button onClick={() => addNode('suspect', prompt("Suspect Name:"))} style={{ ...btnStyle, backgroundColor: '#2c3e50' }}>+ SUSPECT</button>
          <label style={{ ...btnStyle, backgroundColor: "#3b82f6", gridColumn: 'span 2' }}> 📷 ADD PHOTO EVIDENCE
            <input type="file" hidden onChange={(e) => {
               const r = new FileReader(); r.onload = (ev) => addNode('physical', 'Evidence', ev.target.result);
               r.readAsDataURL(e.target.files[0]);
            }} />
          </label>
        </div>
        
        <button onClick={() => setIsDrawMode(!isDrawMode)} style={{ ...btnStyle, backgroundColor: isDrawMode ? "#d63031" : "#444" }}>
            {isDrawMode ? "STOP DRAWING" : "🖋️ DRAW LEAD"}
        </button>

        <div style={{ borderTop: '1px solid #444', margin: '10px 0', padding: '10px 0', display: 'flex', gap: '5px' }}>
             <button onClick={saveCaseFile} style={{...btnStyle, marginBottom: 0, backgroundColor: '#16a085'}}>💾 SAVE CASE</button>
             <button onClick={() => loadFileRef.current.click()} style={{...btnStyle, marginBottom: 0, backgroundColor: '#e67e22'}}>📂 LOAD FILE</button>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', minHeight: 0 }}>
          <div style={{ height: '100px', background: 'rgba(0,0,0,0.4)', borderRadius: '4px', overflowY: 'auto', padding: '8px', border: '1px solid #333' }}>
             <div style={{ fontSize: '9px', color: '#888', marginBottom: '5px', textTransform: 'uppercase' }}>Investigation Log</div>
             {log.map((l, i) => (<div key={i} style={{ fontSize: '9px', color: '#ccc', padding: '2px 0' }}>• {l.text}</div>))}
             <div ref={logEndRef} />
          </div>

          <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', background: 'rgba(0,0,0,0.6)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ flexGrow: 1, overflowY: 'auto', padding: '10px' }}>
              {chat.map((c, i) => (<div key={i} style={{ fontSize: '11px', marginBottom: '8px', lineHeight: '1.4' }}><b style={{ color: '#e67e22' }}>{c.sender}: </b><span style={{color: '#ddd'}}>{c.text}</span></div>))}
              <div ref={chatEndRef} />
            </div>
            <input style={{ ...inputStyle, marginBottom: 0, borderRadius: 0, border: 'none', borderTop: '1px solid #444' }} placeholder="Send secure message..." value={msg} onChange={e => setMsg(e.target.value)} onKeyDown={(e) => {
              if (e.key === 'Enter' && msg.trim()) { ydoc.getArray("chat").push([{ sender: userName, text: msg }]); setMsg(""); }
            }} />
          </div>
        </div>
      </div>

      {/* BOARD AREA */}
      <div style={{ flexGrow: 1, position: 'relative' }}>
        {Object.entries(peerCursors).map(([id, c]) => <GhostCursor key={id} {...c} color="#e67e22" />)}
        <ReactFlow 
            nodes={filteredNodes} 
            edges={edges} 
            onNodesChange={onNodesChange} 
            onEdgesChange={onEdgesChange} 
            onNodeClick={onNodeClick} 
            onNodeContextMenu={onNodeContextMenu}
            nodeTypes={nodeTypes} 
            fitView
        >
          <Background color="#8d643f" variant="lines" />
          <MiniMap style={{ background: '#2c1e12' }} maskColor="rgba(0,0,0,0.4)" />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}

export default function App() { return ( <ReactFlowProvider><Board /></ReactFlowProvider> ); }
