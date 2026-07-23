import { useEffect, useRef } from "react";

export default function LogPane({ lines, running }) {
  const ref = useRef();
  useEffect(()=>{ if(ref.current) ref.current.scrollTop=ref.current.scrollHeight; },[lines, running]);
  return (
    <div ref={ref} style={{
      flex:1,overflowY:"auto",background:"#e2e8dc",borderRadius:6,
      padding:"8px 10px",fontFamily:"monospace",fontSize:10,
      lineHeight:1.5,color:"#5a7a68",border:"1px solid #d4dece",
    }}>
      {lines.length===0
        ? <span style={{color:"#d4dece"}}>// output appears here</span>
        : lines.map((l,i)=>(
          <div key={i} style={{color:
            l.startsWith("✓")?"#34d399":
            l.startsWith("✗")||l.includes("error")?"#f87171":
            l.startsWith("→")?"#2e7d52":
            l.startsWith("[")?"#f59e0b":"#4a7a60"
          }}>{l}</div>
        ))
      }
      {running && (
        <div style={{display:"flex",alignItems:"center",gap:5,marginTop:3,color:"#2e7d52"}}>
          <span style={{animation:"logpulse 1s ease-in-out infinite"}}>●</span>
          <span style={{fontSize:9,color:"#5a7a68"}}>running...</span>
        </div>
      )}
    </div>
  );
}
