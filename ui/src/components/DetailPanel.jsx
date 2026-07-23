import { useState, useEffect, useCallback } from "react";
import { API } from "../api";
import { STATUS_META, inp } from "../constants";
import Stars from "./Stars";
import Badge from "./Badge";
import Btn from "./Btn";
import Timeline from "./Timeline";
import ApplyModal from "./ApplyModal";

const Tab = ({ label, active, onClick }) => (
  <button onClick={onClick} style={{
    padding:"7px 16px",border:"none",borderRadius:0,
    background:"transparent",
    color:active?"#1a2e20":"#5a7a68",
    fontSize:10,fontWeight:700,letterSpacing:"0.08em",
    cursor:"pointer",fontFamily:"monospace",
    borderBottom:active?"2px solid #2e7d52":"2px solid transparent",
  }}>{label}</button>
);

/**
 * Shared right-side panel: DETAIL / COMPANY / TIMELINE / APPLY / TAILOR.
 * Used by both the Search tab and the Tracker tab so job detail/interaction
 * logic lives in exactly one place.
 */
export default function DetailPanel({ job, profileName, addLog, onRefresh }) {
  const [rightTab, setRightTab] = useState("detail");
  const [coverLetter, setCoverLetter] = useState("");
  const [coverLang, setCoverLang] = useState("en");
  const [applyModal, setApplyModal] = useState(false);
  const [tailorResult, setTailorResult] = useState(null);
  const [translatedDesc, setTranslatedDesc] = useState("");
  const [translating, setTranslating] = useState(false);
  const [showOriginalDesc, setShowOriginalDesc] = useState(false);
  const [companyCache, setCompanyCache] = useState({});
  const [lookingUpCompany, setLookingUpCompany] = useState(false);
  const [loading, setLoading] = useState({});

  const lookupCompany = useCallback(async (name) => {
    if (!name) return;
    try {
      const r = await fetch(`${API}/companies/${encodeURIComponent(name)}`);
      if (r.ok) {
        const d = await r.json();
        if (d.summary) { setCompanyCache(p => ({...p, [name]: d.summary})); return; }
      }
    } catch {}
    setCompanyCache(p => ({...p, [name]: null}));
  }, []);

  // Reset per-job UI state and auto-mark-viewed whenever the selected job changes.
  useEffect(() => {
    if (!job) return;
    setRightTab("detail");
    setCoverLetter("");
    setTranslatedDesc("");
    setShowOriginalDesc(false);
    setTailorResult(null);
    if (companyCache[job.company] === undefined) lookupCompany(job.company);
    if (!["viewed","considering","applied","interviewing","offer","rejected"].includes(job.status)) {
      fetch(`${API}/jobs/${job.id}/view`, { method:"POST" }).then(onRefresh);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id]);

  if (!job) {
    return <div style={{flex:1,color:"#d4dece",fontSize:12,textAlign:"center",marginTop:50}}>← select a job</div>;
  }

  const triggerCompanyLookup = async (name) => {
    setLookingUpCompany(true);
    try {
      const r = await fetch(`${API}/companies/lookup`, {
        method: "POST", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({name}),
      });
      const d = await r.json();
      if (d.summary) { setCompanyCache(p => ({...p, [name]: d.summary})); addLog(`✓ Company info: ${name}`); }
    } catch (e) { addLog(`✗ ${e.message}`); }
    setLookingUpCompany(false);
  };

  const translateDesc = async (target) => {
    setTranslating(true);
    setTranslatedDesc("");
    setShowOriginalDesc(false);
    try {
      const r = await fetch(`${API}/run/translate`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: job.id, target }),
      });
      const d = await r.json();
      if (d.translated) { setTranslatedDesc(d.translated); addLog(`✓ Translated to ${target === "en" ? "English" : "中文"}`); }
      else addLog("✗ Translation failed");
    } catch (e) { addLog(`✗ ${e.message}`); }
    setTranslating(false);
  };

  const generateCover = async () => {
    setLoading(p=>({...p,cover:true}));
    try {
      const r = await fetch(`${API}/run/cover`,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({job_id:job.id,language:coverLang}),
      });
      const d = await r.json();
      setCoverLetter(d.letter||"");
      setRightTab("apply");
      addLog(`✓ Cover letter generated`);
    } catch(e) { addLog(`✗ ${e.message}`); }
    setLoading(p=>({...p,cover:false}));
  };

  const tailorCv = async () => {
    setLoading(p=>({...p, tailor:true}));
    setTailorResult(null);
    try {
      const r = await fetch(`${API}/run/tailor-cv`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({job_id: job.id, direction: profileName || job.direction || null}),
      });
      const d = await r.json();
      if (d.error) { addLog(`✗ Tailor CV: ${d.error}`); }
      else { setTailorResult(d); setRightTab("tailor"); addLog("✓ CV tailoring done"); }
    } catch(e) { addLog(`✗ ${e.message}`); }
    setLoading(p=>({...p, tailor:false}));
  };

  const updateStatus = async (status) => {
    await fetch(`${API}/jobs/${job.id}/status`,{
      method:"PATCH",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({status}),
    });
    addLog(`✓ #${job.id} → ${status}`);
    onRefresh();
  };

  return (
    <>
      <div style={{display:"flex",borderBottom:"1px solid #d4dece",flexShrink:0}}>
        <Tab label="DETAIL" active={rightTab==="detail"} onClick={()=>setRightTab("detail")}/>
        <Tab label="COMPANY" active={rightTab==="company"} onClick={()=>setRightTab("company")}/>
        <Tab label="TIMELINE" active={rightTab==="timeline"} onClick={()=>setRightTab("timeline")}/>
        <Tab label="APPLY" active={rightTab==="apply"} onClick={()=>setRightTab("apply")}/>
        <Tab label="TAILOR" active={rightTab==="tailor"} onClick={()=>setRightTab("tailor")}/>
      </div>

      {rightTab==="detail" && (
        <div style={{flex:1,overflowY:"auto",padding:18}}>
          <div style={{marginBottom:14}}>
            <div style={{fontSize:14,fontWeight:700,color:"#1a2e20",marginBottom:5,lineHeight:1.3}}>
              {job.title}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
              <span style={{fontSize:11,color:"#4a7a60"}}>{job.company} · {job.location}</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              <Stars stars={job.user_stars} jobId={job.id} onUpdate={onRefresh}/>
              <span style={{fontSize:9,color:"#6b8c7a",fontFamily:"monospace"}}>
                {job.user_stars ? `${job.user_stars}/5` : "rate this job"}
              </span>
            </div>
            <div style={{display:"flex",gap:7,flexWrap:"wrap",alignItems:"center"}}>
              <Badge status={job.status}/>
              {job.employment_type&&<span style={{fontSize:9,color:"#5a7a68",background:"#d4dece",padding:"2px 6px",borderRadius:3}}>{job.employment_type}</span>}
              {job.language_required&&<span style={{fontSize:9,color:"#5a7a68",background:"#d4dece",padding:"2px 6px",borderRadius:3}}>lang: {job.language_required}</span>}
              {job.match_score!=null&&<span style={{fontSize:9,color:"#2e7d52"}}>compétence {Math.round(job.match_score*100)}%</span>}
              {job.wish_score!=null&&<span style={{fontSize:9,color:"#a78bfa"}}>envie {Math.round(job.wish_score*100)}%</span>}
            </div>
          </div>

          {job.match_explanation&&(
            <div style={{background:"#e2e8dc",border:"1px solid #d4dece",borderRadius:5,
              padding:"9px 11px",marginBottom:8,fontSize:10,color:"#4a7a60",lineHeight:1.6}}>
              <div style={{fontSize:8,fontWeight:700,color:"#2e7d52",letterSpacing:"0.08em",marginBottom:3}}>COMPÉTENCE</div>
              {job.match_explanation}
            </div>
          )}
          {job.wish_explanation&&(
            <div style={{background:"#e2e8dc",border:"1px solid #d4dece",borderRadius:5,
              padding:"9px 11px",marginBottom:12,fontSize:10,color:"#4a7a60",lineHeight:1.6}}>
              <div style={{fontSize:8,fontWeight:700,color:"#a78bfa",letterSpacing:"0.08em",marginBottom:3}}>ENVIE</div>
              {job.wish_explanation}
            </div>
          )}

          <div style={{marginBottom:12}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
              <div style={{fontSize:9,color:"#5a7a68",letterSpacing:"0.1em",fontWeight:700}}>JD</div>
              {job.description && (<>
                {["en","zh"].map(lang=>(
                  <button key={lang} onClick={()=>translateDesc(lang)} disabled={translating} style={{
                    fontSize:8,padding:"1px 6px",borderRadius:3,
                    border:"1px solid #2e7d5230",background:"#2e7d5210",
                    color:translating?"#6b8c7a":"#2e7d52",
                    cursor:translating?"not-allowed":"pointer",fontFamily:"monospace",fontWeight:700,
                  }}>{translating?"⟳":lang==="en"?"→EN":"→中文"}</button>
                ))}
                {translatedDesc && (
                  <button onClick={()=>setShowOriginalDesc(p=>!p)} style={{
                    fontSize:8,padding:"1px 6px",borderRadius:3,
                    border:"1px solid #f59e0b30",background:"#f59e0b10",
                    color:"#f59e0b",cursor:"pointer",fontFamily:"monospace",fontWeight:700,
                  }}>{showOriginalDesc?"→译文":"→原文"}</button>
                )}
              </>)}
            </div>
            <div style={{fontSize:10,color:"#708878",lineHeight:1.7,maxHeight:200,overflowY:"auto",
              background:"#e2e8dc",borderRadius:5,padding:"9px 11px",border:"1px solid #d4dece",
              whiteSpace:"pre-wrap"}}>
              {job.description
                ? (translatedDesc && !showOriginalDesc ? translatedDesc : job.description)
                : <span style={{color:"#6b8c7a"}}>no description — run Enrich</span>
              }
            </div>
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:7,marginBottom:14}}>
            <a href={job.url} target="_blank" rel="noreferrer" style={{
              display:"block",padding:"7px 12px",borderRadius:4,
              background:"#d4dece",color:"#2e7d52",fontSize:10,
              textDecoration:"none",textAlign:"center",border:"1px solid #2e7d5220",
            }}>↗ OPEN ORIGINAL LISTING</a>
            <Btn onClick={generateCover} loading={loading.cover}
              label="GENERATE COVER LETTER" icon="✍" color="#a78bfa"/>
            <Btn onClick={tailorCv} loading={loading.tailor}
              disabled={!job.description} label="TAILOR CV FOR THIS JD" icon="📝" color="#f59e0b"/>
          </div>

          <div>
            <div style={{fontSize:9,color:"#5a7a68",letterSpacing:"0.1em",fontWeight:700,marginBottom:7}}>UPDATE STATUS</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:10}}>
              {["viewed","considering","shortlisted","applied","interviewing","offer","rejected","archived"].map(s=>(
                <button key={s} onClick={()=>{
                  if(s==="applied") setApplyModal(true);
                  else updateStatus(s);
                }} style={{
                  fontSize:8,padding:"4px 8px",borderRadius:3,
                  border:`1px solid ${STATUS_META[s]?.color||"#5a7a68"}30`,
                  background:job.status===s?`${STATUS_META[s]?.color}20`:"transparent",
                  color:STATUS_META[s]?.color||"#5a7a68",
                  cursor:"pointer",fontFamily:"monospace",fontWeight:700,letterSpacing:"0.05em",
                }}>{s.toUpperCase()}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {rightTab==="company" && (
        <div style={{flex:1,overflowY:"auto",padding:18}}>
          <div style={{fontSize:14,fontWeight:700,color:"#1a2e20",marginBottom:3}}>{job.company}</div>
          <div style={{fontSize:10,color:"#6b8c7a",marginBottom:16}}>{job.location}</div>
          {companyCache[job.company]
            ? <div style={{fontSize:11,color:"#2a3e2a",lineHeight:1.8,whiteSpace:"pre-wrap"}}>
                {companyCache[job.company]}
              </div>
            : <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:12,marginTop:40}}>
                {companyCache[job.company] === null
                  ? <>
                      <span style={{fontSize:11,color:"#6b8c7a"}}>No info cached yet.</span>
                      <button onClick={()=>triggerCompanyLookup(job.company)}
                        disabled={lookingUpCompany}
                        style={{
                          padding:"6px 14px",borderRadius:4,border:"1px solid #2e7d5235",
                          background:"#2e7d520d",color:"#2e7d52",fontSize:11,
                          fontWeight:700,fontFamily:"monospace",cursor:"pointer",
                        }}>
                        {lookingUpCompany ? "⟳ Looking up…" : "🔍 Lookup company"}
                      </button>
                    </>
                  : <span style={{fontSize:11,color:"#6b8c7a",fontFamily:"monospace"}}>⟳ loading…</span>
                }
              </div>
          }
        </div>
      )}

      {rightTab==="timeline" && (
        <div style={{flex:1,overflowY:"auto",padding:18}}>
          <div style={{fontSize:12,fontWeight:700,color:"#1a2e20",marginBottom:2}}>{job.title}</div>
          <div style={{fontSize:10,color:"#5a7a68",marginBottom:16}}>{job.company}</div>
          <Timeline jobId={job.id} onRefresh={onRefresh}/>
        </div>
      )}

      {rightTab==="tailor" && (
        <div style={{flex:1,overflowY:"auto",padding:18,display:"flex",flexDirection:"column",gap:14}}>
          {!tailorResult
            ? <div style={{display:"flex",flexDirection:"column",gap:10,alignItems:"center",marginTop:40}}>
                <div style={{fontSize:11,color:"#5a7a68",textAlign:"center"}}>
                  Generate tailored suggestions for<br/>
                  <strong style={{color:"#1a2e20"}}>{job.title}</strong>
                </div>
                <Btn onClick={tailorCv} loading={loading.tailor}
                  disabled={!job.description} label="TAILOR CV FOR THIS JD" icon="📝" color="#f59e0b"/>
                {!job.description && <div style={{fontSize:9,color:"#f59e0b"}}>run Enrich first to get full JD</div>}
              </div>
            : <>
              {tailorResult.missing_keywords?.length > 0 && (
                <div>
                  <div style={{fontSize:9,fontWeight:700,color:"#5a7a68",letterSpacing:"0.1em",marginBottom:6}}>MISSING KEYWORDS TO ADD</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                    {tailorResult.missing_keywords.map((kw,i)=>(
                      <span key={i} style={{fontSize:9,padding:"2px 7px",borderRadius:10,
                        background:"#fef3c7",color:"#92400e",border:"1px solid #f59e0b40"}}>
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {tailorResult.suggestions?.length > 0 && (
                <div>
                  <div style={{fontSize:9,fontWeight:700,color:"#5a7a68",letterSpacing:"0.1em",marginBottom:8}}>SUGGESTED REWRITES</div>
                  <div style={{display:"flex",flexDirection:"column",gap:10}}>
                    {tailorResult.suggestions.map((s,i)=>(
                      <div key={i} style={{background:"#e2e8dc",borderRadius:5,padding:"10px 12px",
                        border:"1px solid #d4dece",fontSize:10}}>
                        <div style={{fontWeight:700,color:"#2e7d52",marginBottom:5,fontSize:9,letterSpacing:"0.05em"}}>
                          {s.section}
                        </div>
                        <div style={{color:"#708878",marginBottom:4,textDecoration:"line-through",opacity:0.7}}>
                          {s.original}
                        </div>
                        <div style={{color:"#1a2e20",marginBottom:5,lineHeight:1.5}}>
                          → {s.rewrite}
                        </div>
                        <div style={{fontSize:9,color:"#f59e0b",fontStyle:"italic"}}>
                          {s.reason}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Btn onClick={tailorCv} loading={loading.tailor} label="REGENERATE" icon="↻" color="#f59e0b"/>
            </>
          }
        </div>
      )}

      {rightTab==="apply" && (
        <div style={{flex:1,overflowY:"auto",padding:18,display:"flex",flexDirection:"column",gap:12}}>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:"#1a2e20",marginBottom:2}}>{job.title}</div>
            <div style={{fontSize:10,color:"#5a7a68"}}>{job.company}</div>
          </div>
          <div style={{display:"flex",gap:5,alignItems:"center"}}>
            <span style={{fontSize:9,color:"#5a7a68",fontWeight:700,letterSpacing:"0.08em"}}>LANG:</span>
            {["en","de","fr"].map(l=>(
              <button key={l} onClick={()=>setCoverLang(l)} style={{
                fontSize:9,padding:"3px 8px",borderRadius:3,
                border:`1px solid ${coverLang===l?"#2e7d5240":"#d4dece"}`,
                background:coverLang===l?"#2e7d5215":"transparent",
                color:coverLang===l?"#2e7d52":"#5a7a68",
                cursor:"pointer",fontFamily:"monospace",fontWeight:700,
              }}>{l.toUpperCase()}</button>
            ))}
            <button onClick={generateCover} disabled={loading.cover} style={{
              marginLeft:"auto",fontSize:9,padding:"3px 9px",borderRadius:3,
              border:"1px solid #a78bfa30",background:"#a78bfa10",color:"#a78bfa",
              cursor:"pointer",fontFamily:"monospace",fontWeight:700,
            }}>{loading.cover?"⟳ ...":"↻ GENERATE"}</button>
          </div>
          <textarea value={coverLetter} onChange={e=>setCoverLetter(e.target.value)}
            placeholder="cover letter appears here after generation..."
            style={{flex:1,minHeight:260,background:"#e2e8dc",border:"1px solid #d4dece",
              borderRadius:5,padding:"11px 13px",color:"#708878",fontSize:11,
              lineHeight:1.8,fontFamily:"Georgia,serif"}}/>
          <div style={{display:"flex",flexDirection:"column",gap:7}}>
            <Btn onClick={()=>{navigator.clipboard.writeText(coverLetter);addLog("✓ Copied");}}
              disabled={!coverLetter} label="COPY TO CLIPBOARD" icon="⎘" color="#2e7d52"/>
            <Btn onClick={()=>setApplyModal(true)}
              disabled={!coverLetter} label="MARK AS APPLIED" icon="✓" color="#34d399"/>
          </div>
        </div>
      )}

      {applyModal && (
        <ApplyModal
          job={job}
          coverLetter={coverLetter}
          addLog={addLog}
          onClose={()=>setApplyModal(false)}
          onDone={()=>{ setApplyModal(false); updateStatus("applied"); setRightTab("timeline"); }}
        />
      )}
    </>
  );
}
