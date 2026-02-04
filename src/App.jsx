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

const themes = {
  cork: { board: "#a67c52", lines: "#8d643f", panel: "#2c1e12", group: "rgba(0,0,0,0.2)" }
};

const btnStyle = { 
  padding: "10px", marginBottom: "8px", border: "none", borderRadius: "6px", 
  backgroundColor: "#4b5563", color: "white", cursor: "pointer", 
  fontWeight: "600", fontSize: "11px", width: "100%", textAlign: "center", boxSizing: "border-box" 
};

// --- CUSTOM EVIDENCE NODES ---
const EvidenceNode = ({ id, data, selected }) => {
  const isGroup = data.type === 'group';
  const isNote = data.type === 'note';
  const isBoardText = data.type === 'boardText';
  const isPhysical = data.type === 'physical';
  const isSuspect = data.type === 'suspect';
  
  // Heading Text logic: Check both Width and Height
  const liveNode = useStore((s) => s.nodeInternals.get(id));
  const liveWidth = liveNode?.width;
  const liveHeight = liveNode?.height;

  const dynamicFontSize = isBoardText 
    ? Math.min((liveWidth || 300) / 6, (liveHeight || 80) * 0.8) 
    : 16;

  const onToggleStatus = (e) => {
    e.stopPropagation();
    if (data.onToggleStatus) data.onToggleStatus(id);
  };

  const onEditClick = (e) => {
    e.stopPropagation();
    if (data.onEditNode) data.onEditNode(id, data);
  };

  const onUploadClick = (e) => {
    e.stopPropagation();
    if (data.onSuspectImage) data.onSuspectImage();
  };

  const onMagnify = (e) => {
    e.stopPropagation();
    if (data.onMagnify && data.image) data.onMagnify(data.image);
  };

  const statusColor = data.status === 'SOLVED' ? '#2ecc71' : data.status === 'DEAD END' ? '#e74c3c' : '#f1c40f';

  if (isGroup) return (
    <div style={{ width: '100%', height: '100%', border: '2px dashed #ffffff55', borderRadius: '8px' }}>
      <NodeResizer minWidth={200} minHeight={200} isVisible={selected} />
      <div style={{ position: 'absolute', top: -25, left: 10, color: 'white', fontSize: '10px', background: 'rgba(0,0,0,0.5)', padding: '2px 8px' }}>{data.label}</div>
    </div>
  );

  return (
    <div onDoubleClick={onToggleStatus} style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* HANDLES */}
      <Handle type="source" position={Position.Top} id="top" style={{ opacity: 0, top: 0 }} />
      <Handle type="target" position={Position.Top} id="top" style={{ opacity: 0, top: 0 }} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={{ opacity: 0, bottom: 0 }} />
      <Handle type="target" position={Position.Bottom} id="bottom" style={{ opacity: 0, bottom: 0 }} />

      <NodeResizer color="#d63031" isVisible={selected} minWidth={100} minHeight={50} />
      
      {/* Visual Pin */}
      {!isBoardText && <div style={{ width: "14px", height: "14px", backgroundColor: "#c0392b", borderRadius: "50%", position: "absolute", top: "-7px", left: "50%", transform: "translateX(-50%)", zIndex: 100, border: '1px solid rgba(0,0,0,0.3)', boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }} />}
      
      {/* Badges */}
      {!isBoardText && <div style={{ position: 'absolute', top: -35, right: 0, background: statusColor, color: 'black', padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 'bold', zIndex: 10 }}>{data.status || 'OPEN'}</div>}

      {/* Edit Button (Pencil) */}
      {(isSuspect || isNote || isBoardText) && (
        <div onClick={onEditClick} title="Edit Text" style={{ 
          position: 'absolute', top: isBoardText ? -20 : 5, right: isBoardText ? 0 : 5, zIndex: 50, cursor: 'pointer', 
          background: 'rgba(0,0,0,0.5)', borderRadius: '4px', padding: '2px 5px', color: 'white', fontSize: '10px' 
        }}>✎</div>
      )}

      {/* Magnify Button (Glass) */}
      {data.image && (
         <div onClick={onMagnify} title="Inspect Evidence" style={{ 
            position: 'absolute', top: 5, left: 5, zIndex: 50, cursor: 'pointer', 
            background: 'rgba(0,0,0,0.5)', borderRadius: '4px', padding: '2px 5px', color: 'white', fontSize: '10px' 
          }}>🔍</div>
      )}

      <div style={{ 
        width: '100%', height: '100%', 
        background: isSuspect ? '#1a1c1e' : (isNote ? "#fff9c4" : (isBoardText ? 'transparent' : 'white')),
        color: isSuspect ? 'white' : 'black',
        boxShadow: (isBoardText || isPhysical) ? 'none' : "0 8px 15px rgba(0,0,0,0.2)",
        display: 'flex', flexDirection: 'column', 
        overflow: isBoardText ? 'visible' : 'hidden', 
        border: data.isDrawingTarget ? `4px solid #d63031` : (isSuspect ? '2px solid #555' : 'none'),
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
        
        {isBoardText && (
          <div style={{ 
            color: '#fff', 
            width: '100%', 
            height: '100%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            fontSize: `${dynamicFontSize}px`, 
            fontWeight: '900', 
            textAlign: 'center', 
            textTransform: 'uppercase', 
            textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
            lineHeight: 1.1 
          }}>
            {data.label}
          </div>
        )}
        
        {data.timestamp && <div style={{ position: 'absolute', bottom: 5, right: 5, fontSize: '9px', background: 'rgba(0,0,0,0.6)', color: 'white', padding: '2px 4px', borderRadius: '3px' }}>📅 {data.timestamp}</div>}
      </div>
    </div>
  );
};

const nodeTypes = { evidence: EvidenceNode };

function Board() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [log, setLog] = useState([]);
  const [userName, setUserName] = useState("");
  const [caseName, setCaseName] = useState("CASE-001");
  const [isDrawMode, setIsDrawMode] = useState(false);
  const [isTimelineMode, setIsTimelineMode] = useState(false);
  const [drawSource, setDrawSource] = useState(null);
  
  // Sidebar Toggle State
  const [isSidebarOpen, setSidebarOpen] = useState(true);

  // Locker State
  const [isLockerOpen, setIsLockerOpen] = useState(true);

  // Zoom State
  const [zoomedImage, setZoomedImage] = useState(null);
  
  // Image Upload State
  const [uploadTarget, setUploadTarget] = useState(null);
  const suspectUploadRef = useRef(null);
  const evidenceUploadRef = useRef(null);
  const loadFileRef = useRef(null);
  
  const { fitView, setCenter } = useReactFlow();
  const logEndRef = useRef(null);

  // --- INITIALIZATION ---
  useEffect(() => {
    const name = localStorage.getItem("detectiveName") || "Agent-" + Math.floor(Math.random()*900);
    setUserName(name);
    localStorage.setItem("detectiveName", name);
  }, []);

  // --- LOGGING ---
  const addToLog = (text) => {
    setLog(prev => [...prev, { text, time: new Date().toLocaleTimeString() }]);
    setTimeout(() => logEndRef.current?.scrollIntoView({behavior:'smooth'}), 50);
  };

  // --- ACTIONS ---
  const handleToggleStatus = (id) => {
    setNodes(nds => nds.map(n => {
      if (n.id === id) {
        const statuses = ['OPEN', 'SOLVED', 'DEAD END'];
        const next = statuses[(statuses.indexOf(n.data.status || 'OPEN') + 1) % 3];
        return { ...n, data: { ...n.data, status: next } };
      }
      return n;
    }));
  };

  const handleEditNode = (id, data) => {
    if (data.type === 'suspect') {
        const newName = prompt("Update Name:", data.label);
        const newAlibi = prompt("Update Alibi:", data.alibi);
        const newAssoc = prompt("Update Associates:", data.associates);
        if (newName !== null) {
            setNodes(nds => nds.map(n => n.id === id ? {
              ...n, data: { ...n.data, label: newName, alibi: newAlibi || data.alibi, associates: newAssoc || data.associates }
            } : n));
        }
    } else {
        const newLabel = prompt("Update Text:", data.label);
        if (newLabel !== null) {
            setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, label: newLabel } } : n));
        }
    }
  };

  const handleSuspectImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file || !uploadTarget) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        setNodes(nds => nds.map(n => n.id === uploadTarget ? {
            ...n, data: { ...n.data, image: ev.target.result }
        } : n));
        addToLog(`Updated suspect photo.`);
        setUploadTarget(null);
    };
    reader.readAsDataURL(file);
    e.target.value = ""; 
  };

  const handleNewEvidenceUpload = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const name = prompt("Name this evidence:", "New Evidence");
      if (!name) {
          e.target.value = "";
          return;
      }

      const reader = new FileReader();
      reader.onload = (ev) => {
          addNode('physical', name, ev.target.result);
      };
      reader.readAsDataURL(file);
      e.target.value = "";
  };

  const focusOnNode = (node) => {
     setCenter(node.position.x + 100, node.position.y + 50, { zoom: 1.2, duration: 1000 });
  };

  // --- TIMELINE LOGIC ---
  const filteredNodes = useMemo(() => {
    const nodesWithCallbacks = nodes.map(n => ({
      ...n,
      data: {
        ...n.data,
        onToggleStatus: handleToggleStatus,
        onEditNode: handleEditNode,
        onSuspectImage: () => { setUploadTarget(n.id); suspectUploadRef.current.click(); },
        onMagnify: (img) => setZoomedImage(img)
      }
    }));

    if (!isTimelineMode) return nodesWithCallbacks;
    
    // Updated Logic: Filter out nodes without timestamps and sort including time
    return nodesWithCallbacks
      .filter(n => n.data.type !== 'group' && n.data.timestamp && n.data.timestamp.trim() !== "")
      .sort((a, b) => {
        const dateA = new Date(a.data.timestamp);
        const dateB = new Date(b.data.timestamp);
        return dateA - dateB;
      })
      .map((n, index) => ({
        ...n,
        position: { x: index * 350, y: 300 },
        draggable: false 
      }));
  }, [nodes, isTimelineMode]);

  const onNodesChange = useCallback((chs) => {
    if (isTimelineMode) return; 
    setNodes(nds => applyNodeChanges(chs, nds));
  }, [isTimelineMode]);

  const onEdgesChange = useCallback((chs) => {
    setEdges(eds => applyEdgeChanges(chs, eds));
  }, []);

  const onNodeContextMenu = useCallback((event, node) => {
    event.preventDefault();
    const confirmDelete = window.confirm(`DELETE ITEM?\n\nPermanently remove "${node.data.label}"?`);
    if (confirmDelete) {
        setNodes(nds => nds.filter(n => n.id !== node.id));
        setEdges(eds => eds.filter(e => e.source !== node.id && e.target !== node.id));
        addToLog(`Deleted: ${node.data.label}`);
    }
  }, []);

  const addNode = (type, label = "", image = null) => {
    const id = `${type}-${Date.now()}`;
    let extraData = {};
    if (type === 'suspect') {
        extraData = { alibi: prompt("Suspect Alibi:"), associates: prompt("Known Associates:"), image };
    }
    
    // Updated Prompt for Time and Date
    const timestampPrompt = (type !== 'group' && type !== 'boardText') 
        ? prompt("Enter Date/Time (e.g. 2026-01-27 14:00)\nLeave empty to omit from timeline:", "2026-01-01") 
        : null;

    const node = {
      id, type: 'evidence', position: { x: 400, y: 300 },
      data: { 
        label, type, image, status: 'OPEN', 
        timestamp: timestampPrompt, // Stores the date/time string or null
        ...extraData 
      },
      style: type === 'group' ? { width: 400, height: 400, background: themes.cork.group } : 
             type === 'suspect' ? { width: 300, height: 180 } :
             type === 'boardText' ? { width: 300, height: 80 } : { width: 200, height: 100 }
    };
    setNodes(prev => [...prev, node]);
    addToLog(`Added ${type}: ${label}`);
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

        setEdges(prev => [...prev, {
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
        }]);
      }
      setDrawSource(null);
      setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, isDrawingTarget: false } })));
    }
  }, [isDrawMode, drawSource, nodes]);

  // --- SAVE & LOAD ---
  const saveCaseFile = () => {
    const data = { nodes, edges, log, caseName, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${caseName}-${new Date().toISOString().slice(0,10)}.json`;
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
            if(confirm("Load file? This will overwrite your current board.")) {
                setNodes(data.nodes || []);
                setEdges(data.edges || []);
                setLog(data.log || []);
                setCaseName(data.caseName || "LOADED-CASE");
                addToLog(`Loaded backup file.`);
            }
        } catch(err) {
            alert("Error loading file: " + err.message);
        }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const renameCase = () => {
    const newName = prompt("Enter new Case Name:", caseName);
    if(newName) setCaseName(newName.toUpperCase().replace(/\s/g, '-'));
  };

  const evidenceList = nodes.filter(n => n.data.image);

  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh", backgroundColor: themes.cork.board, overflow: 'hidden' }}>
      
      <input type="file" ref={suspectUploadRef} onChange={handleSuspectImageUpload} hidden accept="image/*" />
      <input type="file" ref={evidenceUploadRef} onChange={handleNewEvidenceUpload} hidden accept="image/*" />
      <input type="file" ref={loadFileRef} onChange={loadCaseFile} hidden accept=".json" />

      {/* ZOOM MODAL */}
      {zoomedImage && (
        <div onClick={() => setZoomedImage(null)} style={{ 
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', 
            backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 9999, display: 'flex', 
            alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out'
        }}>
            <img src={zoomedImage} style={{ maxWidth: '95%', maxHeight: '95%', border: '2px solid white', boxShadow: '0 0 30px black' }} alt="Zoomed Evidence" />
        </div>
      )}

      {/* SIDEBAR */}
      <div style={{ 
          width: "320px", 
          backgroundColor: themes.cork.panel, 
          color: "#ecf0f1", 
          padding: "15px", 
          display: isSidebarOpen ? "flex" : "none", 
          flexDirection: "column", 
          zIndex: 10, 
          boxShadow: '5px 0 15px rgba(0,0,0,0.3)' 
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '900', letterSpacing: '1px', margin: 0 }}>CASE EVIDENCE BOARD v11.3</h2>
            <button 
                onClick={() => setSidebarOpen(false)} 
                title="Collapse Sidebar"
                style={{ background: 'transparent', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: '14px' }}>
                ◀
            </button>
        </div>
        
        <div style={{ background: 'rgba(0,0,0,0.5)', padding: '10px', borderRadius: '6px', marginBottom: '15px', borderLeft: '4px solid #f1c40f' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff' }}>🕵️ {userName}</span>
                <span style={{ fontSize: '10px', color: '#f1c40f', fontWeight: '900' }}>LOCAL</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                <div style={{ fontSize: '10px', color: '#aaa' }}>CASE ID: <b style={{color:'#eee'}}>{caseName}</b></div>
                <div onClick={renameCase} style={{ cursor: 'pointer', fontSize: '12px' }}>✏️</div>
            </div>
        </div>

        <button onClick={() => setIsTimelineMode(!isTimelineMode)} style={{ ...btnStyle, backgroundColor: isTimelineMode ? '#2ecc71' : '#8e44ad', border: isTimelineMode ? '2px solid white' : 'none' }}>
            {isTimelineMode ? "🔓 EXIT TIMELINE" : "⏳ ENTER TIMELINE MODE"}
        </button>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', marginBottom: '10px' }}>
          <button onClick={() => addNode('boardText', prompt("Title:"))} style={{ ...btnStyle, backgroundColor: '#c0392b' }}>+ HEADING</button>
          <button onClick={() => addNode('note', prompt("Note:"))} style={btnStyle}>+ NOTE</button>
          <button onClick={() => addNode('group', prompt("Zone Name:"))} style={{ ...btnStyle, backgroundColor: '#8e44ad' }}>+ ZONE</button>
          <button onClick={() => addNode('suspect', prompt("Suspect Name:"))} style={{ ...btnStyle, backgroundColor: '#2c3e50' }}>+ SUSPECT</button>
          <button onClick={() => evidenceUploadRef.current.click()} style={{ ...btnStyle, backgroundColor: "#3b82f6", gridColumn: 'span 2' }}> 
            📷 ADD PHOTO EVIDENCE
          </button>
        </div>
        
        <button onClick={() => setIsDrawMode(!isDrawMode)} style={{ ...btnStyle, backgroundColor: isDrawMode ? "#d63031" : "#444" }}>
            {isDrawMode ? "STOP DRAWING" : "🖋️ DRAW LEAD"}
        </button>

        {/* EVIDENCE LOCKER */}
        <div style={{ marginTop: '10px', border: '1px solid #444', borderRadius: '4px', background: '#1f2937' }}>
            <div 
                onClick={() => setIsLockerOpen(!isLockerOpen)} 
                style={{ padding: '8px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', background: '#374151', borderTopLeftRadius: '4px', borderTopRightRadius: '4px' }}
            >
                <span>📂 EVIDENCE LOCKER ({evidenceList.length})</span>
                <span>{isLockerOpen ? '▼' : '▶'}</span>
            </div>
            {isLockerOpen && (
                <div style={{ maxHeight: '150px', overflowY: 'auto', padding: '5px' }}>
                    {evidenceList.length === 0 && <div style={{fontSize:'10px', color:'#777', padding:'5px'}}>No photo evidence yet.</div>}
                    {evidenceList.map(n => (
                        <div 
                            key={n.id} 
                            onClick={() => focusOnNode(n)}
                            style={{ fontSize: '11px', padding: '6px', cursor: 'pointer', borderBottom: '1px solid #333', color: '#ccc', display: 'flex', alignItems: 'center' }}
                            onMouseEnter={(e) => e.target.style.background = '#4b5563'}
                            onMouseLeave={(e) => e.target.style.background = 'transparent'}
                        >
                            <span style={{ marginRight: '5px' }}>{n.data.type === 'suspect' ? '👤' : '📄'}</span> 
                            {n.data.label}
                        </div>
                    ))}
                </div>
            )}
        </div>

        <div style={{ borderTop: '1px solid #444', margin: '10px 0', padding: '10px 0', display: 'flex', gap: '5px' }}>
             <button onClick={saveCaseFile} style={{...btnStyle, marginBottom: 0, backgroundColor: '#16a085'}}>💾 SAVE CASE</button>
             <button onClick={() => loadFileRef.current.click()} style={{...btnStyle, marginBottom: 0, backgroundColor: '#e67e22'}}>📂 LOAD FILE</button>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', minHeight: 0 }}>
          <div style={{ flexGrow: 1, background: 'rgba(0,0,0,0.4)', borderRadius: '4px', overflowY: 'auto', padding: '8px', border: '1px solid #333' }}>
             <div style={{ fontSize: '9px', color: '#888', marginBottom: '5px', textTransform: 'uppercase' }}>Investigation Log</div>
             {log.map((l, i) => (<div key={i} style={{ fontSize: '9px', color: '#ccc', padding: '2px 0' }}>[{l.time}] {l.text}</div>))}
             <div ref={logEndRef} />
          </div>
        </div>
      </div>

      {/* FLOATING OPEN MENU BUTTON */}
      {!isSidebarOpen && (
         <div style={{ position: 'absolute', top: 15, left: 15, zIndex: 100 }}>
            <button onClick={() => setSidebarOpen(true)} style={{ ...btnStyle, width: 'auto', padding: '10px 15px', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
                ☰ MENU
            </button>
         </div>
      )}

      {/* BOARD AREA */}
      <div style={{ flexGrow: 1, position: 'relative' }}>
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
