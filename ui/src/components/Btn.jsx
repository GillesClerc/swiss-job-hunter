export default function Btn({ onClick, label, icon, color="#2e7d52", disabled, small, loading }) {
  return (
    <button onClick={onClick} disabled={disabled||loading} style={{
      display:"flex",alignItems:"center",gap:6,
      padding: small ? "4px 8px" : "6px 12px",
      borderRadius:4,border:`1px solid ${color}35`,
      background:`${color}0d`,color:disabled?"#6b8c7a":color,
      fontSize: small?10:11,fontWeight:700,letterSpacing:"0.05em",
      cursor:disabled||loading?"not-allowed":"pointer",
      fontFamily:"monospace",opacity:disabled?0.45:1,
      transition:"background 0.12s",
    }}
      onMouseEnter={e=>{if(!disabled&&!loading)e.currentTarget.style.background=`${color}20`;}}
      onMouseLeave={e=>{if(!disabled&&!loading)e.currentTarget.style.background=`${color}0d`;}}
    >
      <span>{loading?"⟳":icon}</span>{loading?"…":label}
    </button>
  );
}
