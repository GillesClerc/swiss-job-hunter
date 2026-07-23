import { useState } from "react";
import { API } from "../api";

export default function Stars({ stars, jobId, onUpdate }) {
  const [hovered, setHovered] = useState(null);
  const current = hovered ?? stars ?? 0;
  return (
    <span style={{display:"inline-flex",gap:1,lineHeight:1}}>
      {[1,2,3,4,5].map(n => (
        <span key={n}
          onClick={async e => {
            e.stopPropagation();
            const next = n === stars ? 0 : n;
            await fetch(`${API}/jobs/${jobId}/stars`, {
              method:"PATCH", headers:{"Content-Type":"application/json"},
              body: JSON.stringify({stars: next}),
            });
            onUpdate();
          }}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(null)}
          style={{cursor:"pointer", fontSize:14, color: n <= current ? "#f59e0b" : "#d4dece",
            transition:"color 0.1s"}}>★</span>
      ))}
    </span>
  );
}
