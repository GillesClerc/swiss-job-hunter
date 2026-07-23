import { useState } from "react";
import { API, apiFetch } from "../api";
import { APPLY_METHODS, inp } from "../constants";
import Btn from "./Btn";

export default function ApplyModal({ job, coverLetter, onClose, onDone, addLog }) {
  const [method, setMethod] = useState("email");
  const [recipient, setRecipient] = useState("");
  const [contact, setContact] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      const r = await apiFetch(`${API}/jobs/${job.id}/apply`, {
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ method, recipient_email:recipient, contact_name:contact, note, cover_letter:coverLetter }),
      });
      if (!r.ok) { addLog(`✗ Mark-as-applied failed: ${(await r.text()).slice(0,100)}`); setLoading(false); return; }
      addLog(`✓ Job #${job.id} marked as APPLIED (${method})`);
      onDone();
    } catch(e) { addLog(`✗ ${e.message}`); }
    setLoading(false);
  };

  return (
    <div style={{
      position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",
      display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,
    }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:"#e2e8dc",border:"1px solid #d4dece",borderRadius:10,
        padding:28,width:460,boxShadow:"0 24px 64px rgba(0,0,0,0.6)",
      }}>
        <div style={{fontSize:14,fontWeight:700,color:"#1a2e20",marginBottom:4}}>{job.title}</div>
        <div style={{fontSize:11,color:"#5a7a68",marginBottom:20}}>{job.company} · {job.location}</div>

        <div style={{fontSize:10,color:"#5a7a68",letterSpacing:"0.1em",fontWeight:700,marginBottom:8}}>APPLICATION METHOD</div>
        <div style={{display:"flex",gap:8,marginBottom:18}}>
          {APPLY_METHODS.map(m=>(
            <button key={m.id} onClick={()=>setMethod(m.id)} style={{
              flex:1,padding:"8px 0",borderRadius:5,border:`1px solid ${method===m.id?"#34d39940":"#d4dece"}`,
              background:method===m.id?"#34d39915":"transparent",
              color:method===m.id?"#34d399":"#5a7a68",
              fontSize:10,cursor:"pointer",fontFamily:"monospace",fontWeight:600,
            }}>{m.icon} {m.label}</button>
          ))}
        </div>

        {method==="email" && (
          <>
            <input value={recipient} onChange={e=>setRecipient(e.target.value)}
              placeholder="recruiter@company.com" style={{...inp,marginBottom:8}}/>
            <input value={contact} onChange={e=>setContact(e.target.value)}
              placeholder="Contact name (optional)" style={{...inp,marginBottom:8}}/>
          </>
        )}

        <textarea value={note} onChange={e=>setNote(e.target.value)}
          placeholder="Notes (optional) — e.g. applied via company website, referral from..."
          style={{...inp,minHeight:70,resize:"vertical",marginBottom:16,fontFamily:"inherit"}}/>

        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
          <Btn onClick={onClose} label="Cancel" icon="✕" color="#5a7a68" small/>
          <Btn onClick={submit} loading={loading} label="Mark as Applied" icon="✓" color="#34d399" small/>
        </div>
      </div>
    </div>
  );
}
