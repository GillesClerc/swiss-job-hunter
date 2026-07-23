import { STATUS_META } from "../constants";

export default function Badge({ status }) {
  const m = STATUS_META[status] || STATUS_META.new;
  return (
    <span style={{
      fontSize:9,fontWeight:700,letterSpacing:"0.08em",
      color:m.color,background:m.bg,padding:"2px 7px",borderRadius:3,
      border:`1px solid ${m.color}30`,fontFamily:"monospace",whiteSpace:"nowrap",
    }}>{m.label}</span>
  );
}
