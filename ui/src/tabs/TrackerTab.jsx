import { useState, useEffect, useCallback } from "react";
import { API } from "../api";
import { STATUS_META } from "../constants";
import { DualScore } from "../components/ScoreBar";
import DetailPanel from "../components/DetailPanel";

const COLS = ["viewed","considering","applied","interviewing","offer","rejected"];

export default function TrackerTab() {
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [log, setLog] = useState([]);
  const addLog = useCallback(l => setLog(p=>[...p.slice(-100),l]),[]);

  const load = useCallback(async () => {
    const r = await fetch(`${API}/tracker`);
    if (r.ok) setItems(await r.json());
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 15000); return ()=>clearInterval(t); }, [load]);

  const selected = items.find(j => j.id === selectedId) || null;
  const byStatus = Object.fromEntries(COLS.map(c => [c, items.filter(j=>j.status===c)]));
  const fmt = iso => iso ? new Date(iso).toLocaleDateString("de-CH",{day:"2-digit",month:"2-digit"}) : "—";

  return (
    <div style={{flex:1,display:"flex",overflow:"hidden"}}>
      <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}>
        <div style={{
          padding:"10px 20px",borderBottom:"1px solid #d4dece",
          display:"flex",alignItems:"center",gap:12,flexShrink:0,
        }}>
          <span style={{fontSize:10,fontWeight:700,color:"#5a7a68",letterSpacing:"0.1em"}}>SUIVI</span>
          <span style={{fontSize:10,color:"#6b8c7a"}}>·</span>
          <span style={{fontSize:10,color:"#6b8c7a"}}>{items.length} actives</span>
          <div style={{flex:1}}/>
          <button onClick={load} style={{background:"none",border:"none",color:"#5a7a68",cursor:"pointer",fontSize:12}}>↺</button>
        </div>

        <div style={{flex:1,overflow:"hidden",display:"flex"}}>
          <div style={{flex:1,display:"flex",gap:0,overflowX:"auto",padding:10}}>
            {COLS.map(col=>{
              const m = STATUS_META[col];
              const colJobs = byStatus[col] || [];
              return (
                <div key={col} style={{
                  minWidth:190,flex:1,marginRight:8,
                  background:"#e8ede4",border:`1px solid ${m.color}20`,
                  borderTop:`2px solid ${m.color}`,borderRadius:6,
                  display:"flex",flexDirection:"column",maxHeight:"100%",
                }}>
                  <div style={{
                    padding:"6px 9px",display:"flex",
                    justifyContent:"space-between",alignItems:"center",
                    borderBottom:`1px solid ${m.color}15`,
                  }}>
                    <span style={{fontSize:9,fontWeight:700,color:m.color,letterSpacing:"0.06em"}}>{m.label}</span>
                    <span style={{fontSize:9,color:m.color,background:m.bg,
                      padding:"1px 6px",borderRadius:10,fontFamily:"monospace"}}>{colJobs.length}</span>
                  </div>
                  <div style={{flex:1,overflowY:"auto",padding:5}}>
                    {colJobs.length===0
                      ? <div style={{color:"#d4dece",fontSize:9,textAlign:"center",padding:"14px 0"}}>empty</div>
                      : colJobs.map(j=>(
                        <div key={j.id}
                          onClick={()=>setSelectedId(j.id)}
                          title={`${j.title} @ ${j.company}`}
                          style={{
                            background: selectedId===j.id?"#d4dece":"#e2e8dc",
                            border:`1px solid ${selectedId===j.id?m.color+"50":"#d4dece"}`,
                            borderRadius:4,padding:"5px 7px",marginBottom:4,
                            cursor:"pointer",transition:"all 0.1s",
                          }}
                        >
                          <div style={{display:"flex",alignItems:"center",gap:4}}>
                            <div style={{fontSize:10,fontWeight:600,color:"#1a2e20",
                              lineHeight:1.25,overflow:"hidden",textOverflow:"ellipsis",
                              whiteSpace:"nowrap",flex:1,minWidth:0}}>
                              {j.title}
                            </div>
                            {(!j.description || j.description.length < 100) && (
                              <span title="Description pas encore récupérée" style={{
                                fontSize:7,fontFamily:"monospace",fontWeight:700,color:"#f59e0b",
                                background:"#f59e0b15",border:"1px solid #f59e0b40",borderRadius:2,
                                padding:"1px 3px",flexShrink:0,
                              }}>BRUT</span>
                            )}
                          </div>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:2}}>
                            <span style={{fontSize:8,color:"#4a7a60",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:80}}>
                              {j.company}
                            </span>
                            <span style={{fontSize:8,color:"#6b8c7a",fontFamily:"monospace"}}>
                              {col==="applied"?fmt(j.applied_at):fmt(j.viewed_at)}
                            </span>
                          </div>
                          {j.match_score!=null && (
                            <div style={{marginTop:3,display:"flex",justifyContent:"flex-end"}}>
                              <DualScore skillScore={j.match_score} wishScore={j.wish_score}/>
                            </div>
                          )}
                        </div>
                      ))
                    }
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* RIGHT PANEL — shared DetailPanel */}
      <div style={{width:400,borderLeft:"1px solid #d4dece",display:"flex",
        flexDirection:"column",background:"#f0f3ed",flexShrink:0}}>
        {selected
          ? <DetailPanel job={selected} profileName={selected.direction} addLog={addLog} onRefresh={load}/>
          : <div style={{flex:1,color:"#d4dece",fontSize:12,textAlign:"center",marginTop:50}}>← select a job</div>
        }
      </div>
    </div>
  );
}
