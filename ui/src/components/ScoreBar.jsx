function ScoreChip({ label, score, color }) {
  const known = score != null;
  const pct = known ? Math.round(score * 100) : null;
  return (
    <span title={label === "C" ? "Compétence" : "Envie"} style={{
      fontSize:9,fontWeight:700,fontFamily:"monospace",whiteSpace:"nowrap",
      color: known ? color : "#9db0a5",
      background: known ? `${color}18` : "transparent",
      border:`1px solid ${known ? color+"40" : "#d4dece"}`,
      borderRadius:3,padding:"1px 4px",
    }}>{label}{known ? `${pct}%` : "—"}</span>
  );
}

export function DualScore({ skillScore, wishScore }) {
  const skillColor = skillScore == null ? "#6b8c7a" : skillScore >= 0.7 ? "#34d399" : skillScore >= 0.4 ? "#f59e0b" : "#f87171";
  return (
    <div style={{display:"flex",gap:4,alignItems:"center"}}>
      <ScoreChip label="C" score={skillScore} color={skillColor}/>
      <ScoreChip label="E" score={wishScore} color="#a78bfa"/>
    </div>
  );
}

export default function ScoreBar({ score, accent }) {
  if (score == null) return <span style={{color:"#6b8c7a",fontSize:11}}>—</span>;
  const pct = Math.round(score * 100);
  const color = accent || (pct >= 70 ? "#34d399" : pct >= 40 ? "#f59e0b" : "#f87171");
  return (
    <div style={{display:"flex",alignItems:"center",gap:6}}>
      <div style={{width:44,height:3,background:"#d4dece",borderRadius:2,overflow:"hidden"}}>
        <div style={{width:`${pct}%`,height:"100%",background:color,transition:"width 0.6s"}}/>
      </div>
      <span style={{color,fontSize:11,fontFamily:"mono",fontWeight:700}}>{pct}%</span>
    </div>
  );
}
