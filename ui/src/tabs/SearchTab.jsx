import { useState, useEffect, useCallback } from "react";
import { API } from "../api";
import { SOURCES, ENRICHABLE, LANGUAGES, STATUS_META, inp } from "../constants";
import Btn from "../components/Btn";
import Badge from "../components/Badge";
import LogPane from "../components/LogPane";
import StatCard from "../components/StatCard";
import { DualScore } from "../components/ScoreBar";
import DetailPanel from "../components/DetailPanel";

const MAIN_STATUS_FILTERS = [
  { id: "all",         label: "TOUS" },
  { id: "viewed",      label: "VUE" },
  { id: "considering", label: "SUIVIE" },
  { id: "applied",     label: "POSTULÉE" },
];
const OTHER_STATUSES = ["new","analyzed","shortlisted","interviewing","offer","rejected","archived"];

export default function SearchTab() {
  const [log, setLog] = useState([]);
  const addLog = useCallback(l => setLog(p=>[...p.slice(-300),l]),[]);
  const [loading, setLoading] = useState({});

  const [jobs, setJobs] = useState([]);
  const [stats, setStats] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [backendOk, setBackendOk] = useState(true);

  const [profiles, setProfiles] = useState([]);
  const [profileName, setProfileName] = useState(""); // "" = no profile selected

  const [searchKws, setSearchKws] = useState([]);
  const [searchKwInput, setSearchKwInput] = useState("");
  const [searchLoc, setSearchLoc] = useState(""); // blank = all Switzerland by default
  const [searchSrc, setSearchSrc] = useState(["jobs.ch"]);
  const [searchPages, setSearchPages] = useState(3);
  const [linkedinTimeRange, setLinkedinTimeRange] = useState("r604800");
  const [linkedinExpLevel, setLinkedinExpLevel] = useState("3,4");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [newSinceId, setNewSinceId] = useState(null);

  const [watchedCompanies, setWatchedCompanies] = useState([]);
  const [companyInput, setCompanyInput] = useState("");

  const [filterStatus, setFilterStatus] = useState("all");
  const [filterOtherOpen, setFilterOtherOpen] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [filterMinStars, setFilterMinStars] = useState(0);
  const [filterLanguage, setFilterLanguage] = useState("all");
  const [threshold, setThreshold] = useState(10); // percent — shared by archive/purge/filter
  const [sortBy, setSortBy] = useState("competence"); // "competence" | "envie"

  const selected = jobs.find(j => j.id === selectedId) || null;

  // ── data loading ─────────────────────────────────────────────────────────
  const fetchJobs = useCallback(async () => {
    try {
      const dir = profileName || "all";
      const r = await fetch(`${API}/jobs?status=${filterStatus}&q=${encodeURIComponent(filterText)}&direction=${dir}&min_stars=${filterMinStars}&language=${filterLanguage}`);
      if (r.ok) { setJobs(await r.json()); setBackendOk(true); }
    } catch {
      if (backendOk) addLog("✗ Backend offline — run: python server.py");
      setBackendOk(false);
    }
  }, [filterStatus, filterText, profileName, filterMinStars, filterLanguage, addLog, backendOk]);

  const fetchStats = useCallback(async () => {
    try { const r = await fetch(`${API}/stats?threshold=${threshold/100}`); if (r.ok) setStats(await r.json()); } catch {}
  }, [threshold]);

  useEffect(() => { fetchJobs(); fetchStats(); }, [fetchJobs, fetchStats]);

  const loadProfiles = useCallback(async () => {
    try { const r = await fetch(`${API}/profiles`); if (r.ok) setProfiles(await r.json()); } catch {}
  }, []);
  useEffect(() => { loadProfiles(); }, [loadProfiles]);

  const loadWatchlist = useCallback(async () => {
    try { const r = await fetch(`${API}/watched-companies`); if (r.ok) setWatchedCompanies(await r.json()); } catch {}
  }, []);
  useEffect(() => { loadWatchlist(); }, [loadWatchlist]);

  const selectProfile = (name) => {
    setProfileName(name);
    const p = profiles.find(p => p.name === name);
    setSearchKws(p ? (p.search_keywords || []) : []);
    setSearchKwInput("");
    setNewSinceId(null);
  };

  // ── watchlist CRUD (placeholder — no effect on results yet) ─────────────
  const addCompany = async () => {
    const name = companyInput.trim();
    if (!name) return;
    setCompanyInput("");
    try {
      const r = await fetch(`${API}/watched-companies`, {
        method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({name}),
      });
      if (r.ok) loadWatchlist(); else addLog(`✗ ${(await r.text()).slice(0,80)}`);
    } catch (e) { addLog(`✗ ${e.message}`); }
  };
  const removeCompany = async (id) => {
    try { await fetch(`${API}/watched-companies/${id}`, { method:"DELETE" }); loadWatchlist(); } catch {}
  };

  // ── SSE runner ────────────────────────────────────────────────────────────
  const runStream = useCallback((endpoint, body, key) => {
    setLoading(p=>({...p,[key]:true}));
    addLog(`→ ${key} started`);
    return fetch(`${API}/${endpoint}`, {
      method:"POST",
      headers:{"Content-Type":"application/json","Accept":"text/event-stream"},
      body:JSON.stringify(body),
    }).then(async r => {
      if (!r.ok) {
        const err = await r.text();
        addLog(`✗ ${key} error: ${r.status} ${err.slice(0,100)}`);
        return;
      }
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const {done,value} = await reader.read();
        if (done) break;
        buf += dec.decode(value, {stream:true});
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        lines.forEach(line => {
          if (line.startsWith("data: ")) {
            const msg = line.slice(6).trim();
            if (msg && msg !== "[DONE]") addLog(msg);
          }
        });
      }
      addLog(`✓ ${key} done`);
    }).catch(e => {
      addLog(`✗ ${key} failed: ${e.message}`);
    }).finally(() => {
      setLoading(p=>({...p,[key]:false}));
      fetchJobs(); fetchStats();
    });
  }, [addLog, fetchJobs, fetchStats]);

  const currentKeywords = useCallback(() =>
    searchKwInput.trim() ? [...searchKws, searchKwInput.trim()] : searchKws, [searchKws, searchKwInput]);

  // Splits on every comma in the value (not just a trailing one) so pasting a
  // whole comma-separated list at once adds each keyword as its own tag.
  const handleKwInput = useCallback((v) => {
    if (!v.includes(",")) { setSearchKwInput(v); return; }
    const parts = v.split(",");
    const remainder = parts.pop().trim();
    const toAdd = [];
    for (const raw of parts) {
      const kw = raw.trim();
      if (kw && !searchKws.includes(kw) && !toAdd.includes(kw)) toAdd.push(kw);
    }
    if (toAdd.length) setSearchKws(p => [...p, ...toAdd]);
    setSearchKwInput(remainder);
  }, [searchKws]);

  const scrape = useCallback(() => {
    const kws = currentKeywords();
    if (!kws.length) { addLog("✗ No keywords — pick a profile with search keywords, or add some"); return Promise.resolve(); }
    return runStream("run/search", {
      keywords:kws, keyword:kws[0]||"", location:searchLoc, sources:searchSrc, pages:searchPages,
      semantic:false, direction: profileName || null,
      linkedin_time_range:linkedinTimeRange, linkedin_experience_level:linkedinExpLevel,
    }, "search");
  }, [currentKeywords, profileName, searchLoc, searchSrc, searchPages, linkedinTimeRange, linkedinExpLevel, runStream, addLog]);

  const enrichScore = useCallback(() => {
    const sources = searchSrc.filter(s => ENRICHABLE.includes(s));
    const list = sources.length ? sources : [searchSrc[0] || "jobs.ch"];
    list.forEach(src => runStream("run/enrich", {limit:9999, source:src, rescore_llm:true, direction:profileName || null}, `enrich-llm-${src}`));
  }, [profileName, searchSrc, runStream]);

  const checkAgain = useCallback(async () => {
    const baseId = jobs.reduce((m,j)=>Math.max(m, j.id), 0);
    addLog("━━━ CHECK AGAIN ━━━");
    await scrape();
    setNewSinceId(baseId);
    addLog("→ Showing only newly found jobs (clear the banner to see all)");
  }, [jobs, scrape, addLog]);

  const deleteJob = async (jobId) => {
    await fetch(`${API}/jobs/${jobId}`, { method: "DELETE" });
    if (selectedId === jobId) setSelectedId(null);
    fetchJobs(); fetchStats();
  };

  const sortKey = sortBy === "competence" ? "match_score" : "wish_score";
  const visible = jobs.filter(j=>
    (threshold===0 || (j.match_score!=null && j.match_score*100 >= threshold)) &&
    (newSinceId===null || j.id > newSinceId)
  ).sort((a,b)=>{
    const av = a[sortKey], bv = b[sortKey];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    return bv - av;
  });

  return (
    <>
      {/* STATS */}
      <div style={{
        display:"flex",gap:8,padding:"8px 16px",
        borderBottom:"1px solid #d4dece",overflowX:"auto",flexShrink:0,
        background:"#f0f3ed",
      }}>
        <StatCard label="TOTAL" value={stats.total??0} color="#4a7a60"/>
        <StatCard label="VUE" value={stats.by_status?.viewed??0} color="#7aa090"/>
        <StatCard label="POSTULÉE" value={stats.by_status?.applied??0} color="#34d399"/>
        <StatCard label="ENTRETIEN" value={stats.by_status?.interviewing??0} color="#a78bfa"/>
        <StatCard label="OFFRES" value={stats.by_status?.offer??0} color="#fb923c"/>
        <StatCard label="SHORTLIST" value={stats.by_status?.shortlisted??0} color="#f59e0b"/>
        <div style={{flex:1}}/>
        {stats.avg_score && <StatCard label="AVG MATCH" value={`${Math.round(stats.avg_score*100)}%`} color="#2e7d52"/>}
      </div>

      <div style={{flex:1,display:"flex",overflow:"hidden"}}>
        {/* LEFT PANEL */}
        <div style={{width:300,borderRight:"1px solid #d4dece",display:"flex",
          flexDirection:"column",background:"#f0f3ed",flexShrink:0,overflow:"hidden"}}>

          <div style={{overflowY:"auto",flexShrink:0,maxHeight:"65%"}}>

            {/* ── PROFILE ─────────────────────────────────── */}
            <div style={{padding:"8px 10px",borderBottom:"1px solid #d4dece"}}>
              <div style={{fontSize:9,color:"#5a7a68",letterSpacing:"0.12em",fontWeight:700,marginBottom:6}}>PROFIL</div>
              <select value={profileName} onChange={e=>selectProfile(e.target.value)} style={{...inp,marginBottom:7}}>
                <option value="">— tous profils —</option>
                {profiles.map(p => <option key={p.name} value={p.name}>{p.name.toUpperCase()}</option>)}
              </select>
              {profiles.length===0 && (
                <div style={{fontSize:9,color:"#f59e0b",marginBottom:6}}>Aucun profil — créez-en un dans l'onglet Profils.</div>
              )}

              {/* Keyword tags (editable for this run) */}
              <div style={{display:"flex",flexWrap:"wrap",gap:3,margin:"5px 0 3px"}}>
                {searchKws.map((kw,i)=>(
                  <span key={i} style={{
                    display:"inline-flex",alignItems:"center",gap:3,fontSize:9,padding:"2px 6px",borderRadius:3,
                    background:"#2e7d5220",border:"1px solid #2e7d5240",color:"#2e7d52",fontFamily:"monospace",fontWeight:700,
                  }}>{kw}<span onClick={()=>setSearchKws(p=>p.filter((_,j)=>j!==i))}
                    style={{cursor:"pointer",fontWeight:900,opacity:0.6,lineHeight:1}}>×</span></span>
                ))}
              </div>
              <input value={searchKwInput}
                onChange={e=>handleKwInput(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"){const kw=searchKwInput.trim();if(kw&&!searchKws.includes(kw))setSearchKws(p=>[...p,kw]);setSearchKwInput("");}else if(e.key==="Backspace"&&!searchKwInput&&searchKws.length>0)setSearchKws(p=>p.slice(0,-1));}}
                placeholder={searchKws.length?"add keyword (Enter/,)":"keyword (Enter to add)"}
                style={{...inp,marginBottom:6}}/>

              <Btn onClick={scrape} loading={loading.search} disabled={!searchKws.length && !searchKwInput.trim()}
                label="SCRAPE" icon="⬇" color="#2e7d52"/>
              <div style={{marginTop:4}}>
                <Btn onClick={enrichScore}
                  loading={Object.keys(loading).some(k=>k.startsWith("enrich-llm")&&loading[k])}
                  disabled={!stats.total} label="ENRICH + LLM SCORE" icon="🧠" color="#a78bfa"/>
              </div>
              <div style={{marginTop:4}}>
                <Btn onClick={checkAgain} loading={loading.search}
                  disabled={!searchKws.length && !searchKwInput.trim()}
                  label="LET'S CHECK AGAIN" icon="🔄" color="#6366f1"/>
              </div>
            </div>

            {/* ── WATCHED COMPANIES (placeholder) ────────────── */}
            <div style={{padding:"8px 10px",borderBottom:"1px solid #d4dece"}}>
              <div style={{fontSize:9,color:"#5a7a68",letterSpacing:"0.12em",fontWeight:700,marginBottom:6}}>
                SOCIÉTÉS SURVEILLÉES <span style={{opacity:0.6,fontWeight:400}}>(à venir)</span>
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:5}}>
                {watchedCompanies.map(c=>(
                  <span key={c.id} style={{
                    display:"inline-flex",alignItems:"center",gap:3,fontSize:9,padding:"2px 6px",borderRadius:3,
                    background:"#6366f120",border:"1px solid #6366f140",color:"#6366f1",fontFamily:"monospace",fontWeight:700,
                  }}>{c.name}<span onClick={()=>removeCompany(c.id)}
                    style={{cursor:"pointer",fontWeight:900,opacity:0.6,lineHeight:1}}>×</span></span>
                ))}
              </div>
              <input value={companyInput} onChange={e=>setCompanyInput(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addCompany();}}}
                placeholder="company name (Enter to add)" style={{...inp}}/>
            </div>

            {/* ── ADVANCED ─────────────────────────────────────── */}
            <div style={{borderBottom:"1px solid #d4dece"}}>
              <button onClick={()=>setAdvancedOpen(o=>!o)} style={{
                width:"100%",textAlign:"left",padding:"7px 10px",background:"none",border:"none",cursor:"pointer",
                fontSize:9,color:"#5a7a68",letterSpacing:"0.12em",fontWeight:700,fontFamily:"monospace",
                display:"flex",alignItems:"center",gap:6,
              }}>{advancedOpen?"▾":"▸"} ADVANCED</button>
              {advancedOpen && (
                <div style={{padding:"0 10px 8px",display:"flex",flexDirection:"column",gap:5}}>
                  {/* location + pages */}
                  <div style={{display:"flex",gap:5}}>
                    <input value={searchLoc} onChange={e=>setSearchLoc(e.target.value)}
                      placeholder="city (blank = all CH)" style={{...inp,flex:1}}/>
                    <button onClick={()=>setSearchLoc("")} title="Search all Switzerland" style={{
                      padding:"4px 7px",borderRadius:4,border:"1px solid",
                      borderColor:searchLoc===""?"#2e7d5240":"#d4dece",
                      background:searchLoc===""?"#2e7d5215":"transparent",
                      color:searchLoc===""?"#2e7d52":"#6b8c7a",
                      fontSize:9,fontWeight:700,fontFamily:"monospace",cursor:"pointer",whiteSpace:"nowrap",
                    }}>ALL CH</button>
                    <input type="number" min={1} max={40} value={searchPages}
                      onChange={e=>setSearchPages(Math.max(1,parseInt(e.target.value)||1))}
                      title="pages per source" style={{...inp,width:64,textAlign:"center"}}/>
                  </div>
                  {/* sources */}
                  <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
                    <button onClick={()=>setSearchSrc(searchSrc.length===SOURCES.length?[]:SOURCES)} style={{
                      fontSize:8,padding:"2px 6px",borderRadius:3,border:"1px solid",
                      borderColor:searchSrc.length===SOURCES.length?"#2e7d5240":"#d4dece",
                      background:searchSrc.length===SOURCES.length?"#2e7d5215":"transparent",
                      color:searchSrc.length===SOURCES.length?"#2e7d52":"#6b8c7a",
                      cursor:"pointer",letterSpacing:"0.04em",fontFamily:"monospace",fontWeight:700,
                    }}>ALL</button>
                    {SOURCES.map(s=>(
                      <button key={s} onClick={()=>setSearchSrc(p=>p.includes(s)?p.filter(x=>x!==s):[...p,s])} style={{
                        fontSize:8,padding:"2px 6px",borderRadius:3,border:"1px solid",
                        borderColor:searchSrc.includes(s)?"#2e7d5240":"#d4dece",
                        background:searchSrc.includes(s)?"#2e7d5215":"transparent",
                        color:searchSrc.includes(s)?"#2e7d52":"#6b8c7a",
                        cursor:"pointer",letterSpacing:"0.04em",fontFamily:"monospace",
                      }}>{s.replace(/\.(ch|com)/,"")}</button>
                    ))}
                  </div>
                  {searchSrc.includes("linkedin.com") && (<>
                    <select value={linkedinTimeRange} onChange={e=>setLinkedinTimeRange(e.target.value)}
                      style={{...inp,marginBottom:0,fontSize:9,color:"#4a6a58"}}>
                      <option value="r86400">LinkedIn · 24h</option>
                      <option value="r604800">LinkedIn · 7 days</option>
                      <option value="r2592000">LinkedIn · 30 days</option>
                    </select>
                    <select value={linkedinExpLevel} onChange={e=>setLinkedinExpLevel(e.target.value)}
                      style={{...inp,marginBottom:0,fontSize:9,color:"#4a6a58"}}>
                      <option value="2,3,4">LinkedIn · Entry–Senior</option>
                      <option value="3,4">LinkedIn · Associate–Senior</option>
                      <option value="4">LinkedIn · Senior only</option>
                      <option value="4,5">LinkedIn · Senior–Director</option>
                    </select>
                  </>)}
                  <div style={{height:1,background:"#d4dece",margin:"2px 0"}}/>
                  <Btn onClick={()=>runStream("run/company-lookup",{min_score:threshold/100},"company-lookup")}
                    loading={loading["company-lookup"]} label="LOOKUP COMPANIES" icon="🏢" color="#2e7d52" disabled={!stats.total}/>
                  <div style={{display:"flex",alignItems:"center",gap:5}}>
                    <Btn onClick={()=>runStream("run/purge-archived",{max_score:threshold/100,dry_run:true},"purge-preview")}
                      loading={loading["purge-preview"]} label="PREVIEW" icon="🔍" small color="#6b8c7a"/>
                    <Btn onClick={()=>runStream("run/purge-archived",{max_score:threshold/100,dry_run:false},"purge")}
                      loading={loading["purge"]} label="PURGE" icon="🗑" small color="#f87171"/>
                  </div>
                </div>
              )}
            </div>

            {/* Filter */}
            <div style={{padding:"6px 10px",borderBottom:"1px solid #d4dece"}}>
              <div style={{fontSize:9,color:"#5a7a68",letterSpacing:"0.12em",fontWeight:700,marginBottom:4}}>FILTER</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:4}}>
                {MAIN_STATUS_FILTERS.map(s=>(
                  <button key={s.id} onClick={()=>setFilterStatus(s.id)} style={{
                    fontSize:8,padding:"2px 7px",borderRadius:3,border:"1px solid",
                    borderColor:filterStatus===s.id?(STATUS_META[s.id]?.color||"#2e7d52")+"40":"#d4dece",
                    background:filterStatus===s.id?(STATUS_META[s.id]?.color||"#2e7d52")+"15":"transparent",
                    color:filterStatus===s.id?(STATUS_META[s.id]?.color||"#2e7d52"):"#6b8c7a",
                    cursor:"pointer",fontFamily:"monospace",letterSpacing:"0.05em",fontWeight:700,
                  }}>{s.label}</button>
                ))}
                <button onClick={()=>setFilterOtherOpen(o=>!o)} style={{
                  fontSize:8,padding:"2px 7px",borderRadius:3,border:"1px solid #d4dece",
                  background:"transparent",color:"#6b8c7a",cursor:"pointer",fontFamily:"monospace",fontWeight:700,
                }}>{filterOtherOpen?"▾":"▸"} PLUS</button>
              </div>
              {filterOtherOpen && (
                <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:5}}>
                  {OTHER_STATUSES.map(s=>(
                    <button key={s} onClick={()=>setFilterStatus(s)} style={{
                      fontSize:8,padding:"2px 7px",borderRadius:3,border:"1px solid",
                      borderColor:filterStatus===s?(STATUS_META[s]?.color||"#2e7d52")+"40":"#d4dece",
                      background:filterStatus===s?(STATUS_META[s]?.color||"#2e7d52")+"15":"transparent",
                      color:filterStatus===s?(STATUS_META[s]?.color||"#2e7d52"):"#6b8c7a",
                      cursor:"pointer",fontFamily:"monospace",letterSpacing:"0.05em",fontWeight:700,
                    }}>{s.toUpperCase()}</button>
                  ))}
                </div>
              )}
              <div style={{display:"flex",gap:5,alignItems:"center",marginBottom:4}}>
                <input value={filterText} onChange={e=>setFilterText(e.target.value)}
                  placeholder="search title / company..." style={{...inp,fontSize:10,flex:1}}/>
                <div style={{display:"flex",alignItems:"center",gap:3,flexShrink:0}}>
                  <span style={{fontSize:9,color:"#5a7a68",fontFamily:"monospace",whiteSpace:"nowrap"}}>seuil ≥</span>
                  <input type="number" min={0} max={100} step={5} value={threshold}
                    onChange={e=>{const v=Math.max(0,Math.min(100,parseInt(e.target.value)||0));setThreshold(v);}}
                    title="score threshold % — used by filter, archive, purge, lookup" style={{...inp,width:52,textAlign:"center",fontSize:10}}/>
                  <span style={{fontSize:9,color:"#5a7a68",fontFamily:"monospace"}}>%</span>
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:4}}>
                <span style={{fontSize:9,color:"#5a7a68",fontFamily:"monospace"}}>★≥</span>
                {[0,1,2,3,4,5].map(n=>(
                  <button key={n} onClick={()=>setFilterMinStars(n)} style={{
                    fontSize:n===0?9:12, padding:"1px 5px", borderRadius:3, border:"1px solid",
                    borderColor:filterMinStars===n?"#f59e0b40":"#d4dece",
                    background:filterMinStars===n?"#f59e0b15":"transparent",
                    color:filterMinStars===n?"#f59e0b":"#6b8c7a",
                    cursor:"pointer", fontFamily:"monospace", fontWeight:700, lineHeight:1,
                  }}>{n===0?"ALL":"★".repeat(n)}</button>
                ))}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:4}}>
                <span style={{fontSize:9,color:"#5a7a68",fontFamily:"monospace"}}>langue</span>
                {LANGUAGES.map(l=>(
                  <button key={l.id} onClick={()=>setFilterLanguage(l.id)} style={{
                    fontSize:8,padding:"2px 7px",borderRadius:3,border:"1px solid",
                    borderColor:filterLanguage===l.id?"#2e7d5240":"#d4dece",
                    background:filterLanguage===l.id?"#2e7d5215":"transparent",
                    color:filterLanguage===l.id?"#2e7d52":"#6b8c7a",
                    cursor:"pointer",fontFamily:"monospace",fontWeight:700,
                  }}>{l.label}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Log */}
          <div style={{flex:1,minHeight:90,padding:"8px 10px",display:"flex",flexDirection:"column",gap:4,overflow:"hidden"}}>
            <div style={{display:"flex",justifyContent:"space-between",
              fontSize:9,color:"#5a7a68",letterSpacing:"0.12em",fontWeight:700}}>
              <span>LOG</span>
              <button onClick={()=>setLog([])} style={{background:"none",border:"none",color:"#6b8c7a",cursor:"pointer",fontSize:9}}>CLEAR</button>
            </div>
            <LogPane lines={log} running={Object.values(loading).some(Boolean)}/>
          </div>
        </div>

        {/* CENTER: Job list */}
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>
          <div style={{
            padding:"8px 14px",borderBottom:"1px solid #d4dece",
            display:"flex",alignItems:"center",gap:8,fontSize:9,color:"#5a7a68",flexShrink:0,
          }}>
            <span style={{fontWeight:700,letterSpacing:"0.1em"}}>{visible.length} JOBS</span>
            {newSinceId!==null
              ? <span style={{
                  display:"inline-flex",alignItems:"center",gap:6,fontSize:9,fontWeight:700,
                  color:"#6366f1",background:"#6366f115",border:"1px solid #6366f140",
                  borderRadius:3,padding:"2px 8px",letterSpacing:"0.05em",
                }}>🔄 NEW SINCE LAST CHECK
                  <span onClick={()=>setNewSinceId(null)} style={{cursor:"pointer",opacity:0.7,fontWeight:900}}>✕ show all</span>
                </span>
              : <span>· click to inspect · opens URL · auto-marks VIEWED</span>
            }
            <div style={{flex:1}}/>
            <span style={{color:"#6b8c7a"}}>trier par</span>
            <button onClick={()=>setSortBy("competence")} style={{
              fontSize:9,padding:"2px 7px",borderRadius:3,border:"1px solid",
              borderColor:sortBy==="competence"?"#2e7d5240":"#d4dece",
              background:sortBy==="competence"?"#2e7d5215":"transparent",
              color:sortBy==="competence"?"#2e7d52":"#6b8c7a",
              cursor:"pointer",fontFamily:"monospace",fontWeight:700,
            }}>COMPÉTENCE</button>
            <button onClick={()=>setSortBy("envie")} style={{
              fontSize:9,padding:"2px 7px",borderRadius:3,border:"1px solid",
              borderColor:sortBy==="envie"?"#a78bfa40":"#d4dece",
              background:sortBy==="envie"?"#a78bfa15":"transparent",
              color:sortBy==="envie"?"#a78bfa":"#6b8c7a",
              cursor:"pointer",fontFamily:"monospace",fontWeight:700,
            }}>ENVIE</button>
            <button onClick={fetchJobs} style={{background:"none",border:"none",color:"#5a7a68",cursor:"pointer"}}>↺</button>
          </div>
          <div style={{flex:1,overflowY:"auto"}}>
            {visible.length===0
              ? <div style={{padding:40,textAlign:"center",color:"#d4dece",fontSize:12}}>
                  no jobs — run a search first
                </div>
              : visible.map(j=>(
                <div key={j.id}
                  className={`jr${selectedId===j.id?" sel":""}`}
                  onClick={()=>setSelectedId(j.id)}
                  style={{
                    padding:"9px 14px",borderBottom:"1px solid #e8ede4",
                    borderLeft:"2px solid transparent",
                    display:"grid",gridTemplateColumns:"26px 1fr 100px 96px 60px 52px 18px",
                    alignItems:"center",gap:8,cursor:"pointer",transition:"background 0.1s",
                  }}>
                  <span style={{fontSize:9,color:"#6b8c7a",fontWeight:700}}>#{j.id}</span>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:11,fontWeight:600,color:"#1a2e20",marginBottom:2,
                      overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{j.title}</div>
                    <div style={{fontSize:9,color:"#5a7a68",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {j.company} · {j.location}
                    </div>
                  </div>
                  <Badge status={j.status}/>
                  <DualScore skillScore={j.match_score} wishScore={j.wish_score}/>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2}}>
                    {j.direction&&<span style={{fontSize:7,fontFamily:"monospace",fontWeight:700,
                      color:"#fff",background:"#2e7d52",padding:"1px 4px",borderRadius:2,letterSpacing:"0.06em"}}>
                      {j.direction.toUpperCase()}</span>}
                    <div style={{fontSize:8,color:"#6b8c7a",fontFamily:"monospace"}}>
                      {j.source?.replace(/\.(ch|com)/,"")}
                    </div>
                  </div>
                  <button onClick={e=>{e.stopPropagation();deleteJob(j.id);}} title="Delete"
                    style={{border:"none",background:"none",color:"#b0c4b8",cursor:"pointer",
                      padding:0,fontSize:12,lineHeight:1,display:"flex",alignItems:"center",
                      justifyContent:"center",borderRadius:3,width:18,height:18,
                      transition:"color 0.15s, background 0.15s"}}
                    onMouseEnter={e=>{e.currentTarget.style.color="#c0392b";e.currentTarget.style.background="#fde8e4";}}
                    onMouseLeave={e=>{e.currentTarget.style.color="#b0c4b8";e.currentTarget.style.background="none";}}>
                    ✕
                  </button>
                </div>
              ))
            }
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div style={{width:400,borderLeft:"1px solid #d4dece",display:"flex",
          flexDirection:"column",background:"#f0f3ed",flexShrink:0}}>
          {selected
            ? <DetailPanel job={selected} profileName={profileName||null} addLog={addLog}
                onRefresh={()=>{fetchJobs();fetchStats();}}/>
            : <div style={{flex:1,color:"#d4dece",fontSize:12,textAlign:"center",marginTop:50}}>← select a job</div>
          }
        </div>
      </div>
    </>
  );
}
