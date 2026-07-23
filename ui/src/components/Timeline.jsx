import { useState, useEffect, useCallback } from "react";
import { API, apiFetch } from "../api";
import { EVENT_META, ADDABLE_EVENTS, inp } from "../constants";
import Btn from "./Btn";

export default function Timeline({ jobId, onRefresh, addLog }) {
  const [events, setEvents] = useState([]);
  const [adding, setAdding] = useState(false);
  const [evType, setEvType] = useState("note");
  const [evNote, setEvNote] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await apiFetch(`${API}/jobs/${jobId}/events`);
      if (r.ok) setEvents(await r.json());
    } catch (e) { addLog?.(`✗ ${e.message}`); }
  }, [jobId, addLog]);

  useEffect(() => { load(); }, [load]);

  const addEvent = async () => {
    setLoading(true);
    try {
      const r = await apiFetch(`${API}/jobs/${jobId}/events`, {
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ event_type:evType, note:evNote }),
      });
      if (!r.ok) { addLog?.(`✗ Add event failed: ${(await r.text()).slice(0,80)}`); setLoading(false); return; }
    } catch (e) { addLog?.(`✗ ${e.message}`); setLoading(false); return; }
    setEvNote(""); setAdding(false);
    await load(); onRefresh?.();
    setLoading(false);
  };

  const fmt = iso => {
    const d = new Date(iso);
    return d.toLocaleDateString("de-CH",{day:"2-digit",month:"2-digit"}) + " " +
           d.toLocaleTimeString("de-CH",{hour:"2-digit",minute:"2-digit"});
  };

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{fontSize:10,color:"#5a7a68",letterSpacing:"0.1em",fontWeight:700}}>TIMELINE</div>
        <button onClick={()=>setAdding(p=>!p)} style={{
          fontSize:9,padding:"3px 9px",borderRadius:3,border:"1px solid #2e7d5230",
          background:"#2e7d5210",color:"#2e7d52",cursor:"pointer",fontFamily:"monospace",fontWeight:700,
        }}>+ ADD EVENT</button>
      </div>

      {adding && (
        <div style={{background:"#ffffff",border:"1px solid #c8d8c4",borderRadius:6,padding:12,marginBottom:12}}>
          <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>
            {ADDABLE_EVENTS.map(t=>(
              <button key={t} onClick={()=>setEvType(t)} style={{
                fontSize:9,padding:"2px 7px",borderRadius:3,
                border:`1px solid ${evType===t?(EVENT_META[t]?.color||"#2e7d52")+"40":"#d4dece"}`,
                background:evType===t?`${EVENT_META[t]?.color||"#2e7d52"}15`:"transparent",
                color:evType===t?(EVENT_META[t]?.color||"#2e7d52"):"#5a7a68",
                cursor:"pointer",fontFamily:"monospace",fontWeight:600,
              }}>{EVENT_META[t]?.icon} {EVENT_META[t]?.label}</button>
            ))}
          </div>
          <input value={evNote} onChange={e=>setEvNote(e.target.value)}
            placeholder="Note (optional)..." style={{...inp,marginBottom:8,fontSize:10}}/>
          <div style={{display:"flex",gap:6,justifyContent:"flex-end"}}>
            <Btn onClick={()=>setAdding(false)} label="Cancel" icon="✕" color="#5a7a68" small/>
            <Btn onClick={addEvent} loading={loading} label="Add" icon="+" color="#2e7d52" small/>
          </div>
        </div>
      )}

      {events.length===0
        ? <div style={{color:"#6b8c7a",fontSize:11,padding:"8px 0"}}>No events yet</div>
        : (
          <div style={{position:"relative",paddingLeft:20}}>
            <div style={{position:"absolute",left:7,top:6,bottom:6,width:1,background:"#d4dece"}}/>
            {events.map((e,i)=>{
              const m = EVENT_META[e.event_type] || {icon:"•",label:e.event_type,color:"#4a7a60"};
              return (
                <div key={e.id} style={{position:"relative",marginBottom:14}}>
                  <div style={{
                    position:"absolute",left:-20,top:1,width:14,height:14,
                    borderRadius:"50%",background:"#e2e8dc",border:`2px solid ${m.color}`,
                    display:"flex",alignItems:"center",justifyContent:"center",
                    fontSize:8,
                  }}>{m.icon}</div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div style={{fontSize:11,fontWeight:700,color:m.color}}>{m.label}</div>
                    <div style={{fontSize:9,color:"#6b8c7a",fontFamily:"monospace"}}>{fmt(e.occurred_at)}</div>
                  </div>
                  {e.note && <div style={{fontSize:10,color:"#4a7a60",marginTop:2,lineHeight:1.5}}>{e.note}</div>}
                </div>
              );
            })}
          </div>
        )
      }
    </div>
  );
}
