import { useState, useEffect, useCallback, useRef } from "react";
import { API } from "../api";
import { inp } from "../constants";
import Btn from "../components/Btn";
import LogPane from "../components/LogPane";

const NEW = "__new__";

export default function ProfilesTab() {
  const [log, setLog] = useState([]);
  const addLog = useCallback(l => setLog(p=>[...p.slice(-100),l]),[]);

  const [profiles, setProfiles] = useState([]);
  const [selectedName, setSelectedName] = useState(null); // null | NEW | profile name

  const [name, setName] = useState("");
  const [cvText, setCvText] = useState("");
  const [wishDescription, setWishDescription] = useState("");
  const [searchKeywords, setSearchKeywords] = useState([]);
  const [kwInput, setKwInput] = useState("");

  const [saving, setSaving] = useState(false);
  const [extractingKw, setExtractingKw] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const fileInputRef = useRef();

  const loadProfiles = useCallback(async () => {
    try {
      const r = await fetch(`${API}/profiles`);
      if (r.ok) { setProfiles(await r.json()); }
    } catch {}
  }, []);

  useEffect(() => { loadProfiles(); }, [loadProfiles]);

  const resetForm = () => {
    setName(""); setCvText(""); setWishDescription("");
    setSearchKeywords([]); setKwInput("");
  };

  const selectProfile = (p) => {
    setSelectedName(p.name);
    setName(p.name);
    setCvText(p.cv_text);
    setWishDescription(p.wish_description || "");
    setSearchKeywords(p.search_keywords || []);
    setKwInput("");
  };

  const startNew = () => {
    setSelectedName(NEW);
    resetForm();
  };

  const onFilePicked = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const text = await f.text();
    setCvText(text);
    if (!name) setName(f.name.replace(/\.txt$/i, "").replace(/^cv[_-]?/i, ""));
  };

  const save = async () => {
    if (!name.trim()) { addLog("✗ Profile name required"); return; }
    if (!cvText.trim()) { addLog("✗ CV content required"); return; }
    setSaving(true);
    try {
      const isNew = selectedName === NEW;
      const url = isNew ? `${API}/profiles` : `${API}/profiles/${selectedName}`;
      const method = isNew ? "POST" : "PUT";
      const body = isNew
        ? { name, cv_text: cvText, wish_description: wishDescription, search_keywords: searchKeywords }
        : { cv_text: cvText, wish_description: wishDescription, search_keywords: searchKeywords };
      const r = await fetch(url, { method, headers: {"Content-Type":"application/json"}, body: JSON.stringify(body) });
      if (!r.ok) { addLog(`✗ Save failed: ${(await r.text()).slice(0,100)}`); return; }
      const d = await r.json();
      addLog(`✓ Profile "${d.name}" saved`);
      setSelectedName(d.name);
      await loadProfiles();
    } catch (e) { addLog(`✗ ${e.message}`); }
    setSaving(false);
  };

  const extractKeywords = async () => {
    if (selectedName === NEW || !selectedName) { addLog("✗ Save the profile first"); return; }
    setExtractingKw(true);
    try {
      const r = await fetch(`${API}/profiles/${selectedName}/search-keywords/extract`, { method:"POST" });
      if (!r.ok) { addLog(`✗ Extract failed: ${(await r.text()).slice(0,100)}`); }
      else {
        const d = await r.json();
        setSearchKeywords(d.search_keywords); setKwInput("");
        addLog(`✓ Extracted ${d.search_keywords.length} search keywords`);
        loadProfiles();
      }
    } catch (e) { addLog(`✗ ${e.message}`); }
    setExtractingKw(false);
  };

  const renameProfile = async (raw) => {
    const newName = (raw || "").trim();
    setRenaming(false);
    if (!newName || newName === selectedName) return;
    try {
      const r = await fetch(`${API}/profiles/${selectedName}`, {
        method:"PATCH", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ new_name: newName }),
      });
      if (!r.ok) { addLog(`✗ Rename failed: ${(await r.text()).slice(0,80)}`); return; }
      const d = await r.json();
      addLog(`✓ Renamed "${selectedName}" → "${d.name}"`);
      setSelectedName(d.name); setName(d.name);
      await loadProfiles();
    } catch (e) { addLog(`✗ ${e.message}`); }
  };

  const deleteProfile = async () => {
    if (!window.confirm(`Delete profile "${selectedName}"? Jobs are kept but untagged.`)) return;
    try {
      const r = await fetch(`${API}/profiles/${selectedName}`, { method:"DELETE" });
      if (!r.ok) { addLog(`✗ Delete failed: ${(await r.text()).slice(0,80)}`); return; }
      addLog(`✓ Deleted profile "${selectedName}"`);
      setSelectedName(null); resetForm();
      await loadProfiles();
    } catch (e) { addLog(`✗ ${e.message}`); }
  };

  const addKeyword = () => {
    const kw = kwInput.trim();
    if (kw && !searchKeywords.includes(kw)) setSearchKeywords(p=>[...p, kw]);
    setKwInput("");
  };

  return (
    <div style={{flex:1,display:"flex",overflow:"hidden"}}>
      {/* LEFT: profile list */}
      <div style={{width:280,borderRight:"1px solid #d4dece",display:"flex",flexDirection:"column",
        background:"#f0f3ed",flexShrink:0,overflow:"hidden"}}>
        <div style={{padding:"10px 12px",borderBottom:"1px solid #d4dece"}}>
          <Btn onClick={startNew} label="+ NEW PROFILE" icon="👤" color="#2e7d52"/>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:8}}>
          {profiles.length===0 && (
            <div style={{fontSize:10,color:"#6b8c7a",fontStyle:"italic",padding:"8px 4px"}}>
              No profile yet — create one to start searching.
            </div>
          )}
          {profiles.map(p => (
            <div key={p.name} onClick={()=>selectProfile(p)} style={{
              padding:"10px 11px",marginBottom:6,borderRadius:5,cursor:"pointer",
              background: selectedName===p.name ? "#2e7d5215" : "#e2e8dc",
              border:`1px solid ${selectedName===p.name?"#2e7d5240":"#d4dece"}`,
            }}>
              <div style={{fontSize:11,fontWeight:700,color:"#1a2e20",marginBottom:3}}>{p.name.toUpperCase()}</div>
              <div style={{fontSize:9,color:"#5a7a68"}}>
                {p.search_keywords.length} keyword{p.search_keywords.length===1?"":"s"} · {p.job_count} job{p.job_count===1?"":"s"}
              </div>
              {p.wish_description && <div style={{fontSize:9,color:"#a78bfa",marginTop:3}}>✓ envie definie</div>}
            </div>
          ))}
        </div>
        <div style={{height:110,padding:"6px 10px",borderTop:"1px solid #d4dece",display:"flex",flexDirection:"column",gap:4}}>
          <div style={{fontSize:9,color:"#5a7a68",letterSpacing:"0.12em",fontWeight:700}}>LOG</div>
          <LogPane lines={log} running={saving||extractingKw}/>
        </div>
      </div>

      {/* RIGHT: edit form */}
      <div style={{flex:1,overflowY:"auto",padding:24,maxWidth:640}}>
        {!selectedName ? (
          <div style={{color:"#d4dece",fontSize:12,textAlign:"center",marginTop:60}}>
            ← select a profile, or create a new one
          </div>
        ) : (
          <>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:18}}>
              {renaming ? (
                <input autoFocus defaultValue={name}
                  onKeyDown={e=>{if(e.key==="Enter")renameProfile(e.target.value);else if(e.key==="Escape")setRenaming(false);}}
                  onBlur={e=>renameProfile(e.target.value)}
                  style={{...inp,width:220,fontSize:14,fontWeight:700}}/>
              ) : (
                <div style={{fontSize:16,fontWeight:700,color:"#1a2e20"}}>
                  {selectedName===NEW ? "NEW PROFILE" : selectedName.toUpperCase()}
                </div>
              )}
              {selectedName!==NEW && !renaming && (
                <>
                  <span onClick={()=>setRenaming(true)} title="Rename" style={{cursor:"pointer",fontSize:12,opacity:0.5}}>✎</span>
                  <span onClick={deleteProfile} title="Delete" style={{cursor:"pointer",fontSize:12,opacity:0.5}}>🗑</span>
                </>
              )}
            </div>

            {selectedName===NEW && (
              <div style={{marginBottom:14}}>
                <div style={{fontSize:9,color:"#5a7a68",letterSpacing:"0.1em",fontWeight:700,marginBottom:5}}>PROFILE NAME</div>
                <input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. agent, perception..."
                  style={{...inp,maxWidth:280}}/>
              </div>
            )}

            <div style={{marginBottom:14}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                <div style={{fontSize:9,color:"#5a7a68",letterSpacing:"0.1em",fontWeight:700}}>CV</div>
                <input ref={fileInputRef} type="file" accept=".txt,text/plain" style={{display:"none"}} onChange={onFilePicked}/>
                <button onClick={()=>fileInputRef.current?.click()} style={{
                  fontSize:8,padding:"2px 7px",borderRadius:3,border:"1px solid #2e7d5230",
                  background:"#2e7d5210",color:"#2e7d52",cursor:"pointer",fontFamily:"monospace",fontWeight:700,
                }}>⬆ IMPORT .TXT</button>
              </div>
              <textarea value={cvText} onChange={e=>setCvText(e.target.value)}
                placeholder="Paste your CV as plain text, or import a .txt file..."
                style={{...inp,minHeight:180,resize:"vertical",fontFamily:"inherit",lineHeight:1.5}}/>
            </div>

            <div style={{marginBottom:14}}>
              <div style={{fontSize:9,color:"#5a7a68",letterSpacing:"0.1em",fontWeight:700,marginBottom:5}}>
                WHAT ARE YOU LOOKING FOR? <span style={{opacity:0.6,fontWeight:400}}>(mission type, culture, values — used for the "envie" score)</span>
              </div>
              <textarea value={wishDescription} onChange={e=>setWishDescription(e.target.value)}
                placeholder="e.g. small autonomous team, hands-on technical work, no management track, hybrid remote, mission-driven company..."
                style={{...inp,minHeight:90,resize:"vertical",fontFamily:"inherit",lineHeight:1.5}}/>
            </div>

            <div style={{marginBottom:18}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                <div style={{fontSize:9,color:"#5a7a68",letterSpacing:"0.1em",fontWeight:700}}>SEARCH KEYWORDS</div>
                <Btn onClick={extractKeywords} loading={extractingKw} disabled={selectedName===NEW}
                  small label="EXTRACT FROM CV" icon="🧠" color="#a78bfa"/>
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:6}}>
                {searchKeywords.map((kw,i)=>(
                  <span key={i} style={{
                    display:"inline-flex",alignItems:"center",gap:3,fontSize:9,padding:"2px 6px",borderRadius:3,
                    background:"#2e7d5220",border:"1px solid #2e7d5240",color:"#2e7d52",fontFamily:"monospace",fontWeight:700,
                  }}>{kw}<span onClick={()=>setSearchKeywords(p=>p.filter((_,j)=>j!==i))}
                    style={{cursor:"pointer",fontWeight:900,opacity:0.6,lineHeight:1}}>×</span></span>
                ))}
              </div>
              <input value={kwInput}
                onChange={e=>{const v=e.target.value; if(v.endsWith(",")){setKwInput(v.slice(0,-1)); } else setKwInput(v);}}
                onKeyDown={e=>{
                  if(e.key==="Enter"){ e.preventDefault(); addKeyword(); }
                  else if(e.key===","){ e.preventDefault(); addKeyword(); }
                  else if(e.key==="Backspace"&&!kwInput&&searchKeywords.length>0) setSearchKeywords(p=>p.slice(0,-1));
                }}
                placeholder="add keyword (Enter or ,)" style={{...inp,maxWidth:320}}/>
            </div>

            <Btn onClick={save} loading={saving} label={selectedName===NEW?"CREATE PROFILE":"SAVE CHANGES"} icon="✓" color="#2e7d52"/>
          </>
        )}
      </div>
    </div>
  );
}
