export default function StatCard({ label, value, color="#2e7d52" }) {
  return (
    <div style={{background:"#e2e8dc",border:"1px solid #d4dece",borderRadius:7,padding:"8px 14px",minWidth:80}}>
      <div style={{fontSize:9,color:"#5a7a68",letterSpacing:"0.1em",fontWeight:700,marginBottom:3,fontFamily:"monospace"}}>{label}</div>
      <div style={{fontSize:22,fontWeight:700,color,fontFamily:"monospace",lineHeight:1}}>{value??0}</div>
    </div>
  );
}
