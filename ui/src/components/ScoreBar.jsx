export function DualScore({ skillScore, wishScore }) {
  return (
    <div style={{display:"flex",flexDirection:"column",gap:2,alignItems:"flex-end"}}>
      <div style={{display:"flex",alignItems:"center",gap:4}}>
        <span style={{fontSize:8,color:"#6b8c7a",width:14,textAlign:"right"}}>C</span>
        <ScoreBar score={skillScore}/>
      </div>
      {wishScore != null && (
        <div style={{display:"flex",alignItems:"center",gap:4}}>
          <span style={{fontSize:8,color:"#6b8c7a",width:14,textAlign:"right"}}>E</span>
          <ScoreBar score={wishScore} accent="#a78bfa"/>
        </div>
      )}
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
