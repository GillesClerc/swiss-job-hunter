import { useState } from "react";
import ProfilesTab from "./tabs/ProfilesTab";
import SearchTab from "./tabs/SearchTab";
import TrackerTab from "./tabs/TrackerTab";

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

export default function App() {
  const [mainTab, setMainTab] = useState("profiles"); // profiles | search | tracker

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Syne:wght@700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        body{background:#f5f7f2;font-family:'JetBrains Mono',monospace;}
        ::-webkit-scrollbar{width:3px;height:3px;}
        ::-webkit-scrollbar-track{background:#dde5d8;}
        ::-webkit-scrollbar-thumb{background:#b0c4b8;border-radius:2px;}
        .jr:hover{background:#e2e8dc!important;}
        .jr.sel{background:#e2e8dc!important;border-left-color:#2e7d52!important;}
        @keyframes logpulse{0%,100%{opacity:1}50%{opacity:0.2}}
        input,textarea{font-family:'JetBrains Mono',monospace;}
        input:focus,textarea:focus{outline:1px solid #2e7d5220;}
      `}</style>

      <div style={{height:"100vh",display:"flex",flexDirection:"column",background:"#f5f7f2",color:"#1a2e20"}}>

        {/* HEADER */}
        <div style={{height:48,borderBottom:"1px solid #d4dece",background:"#f0f3ed",
          display:"flex",alignItems:"center",padding:"0 20px",gap:16,flexShrink:0}}>
          <span style={{fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:800,color:"#2e7d52",letterSpacing:"0.05em"}}>
            🇨🇭 SWISS JOB HUNTER
          </span>
          <div style={{width:1,height:16,background:"#d4dece"}}/>
          <Tab label="PROFILS" active={mainTab==="profiles"} onClick={()=>setMainTab("profiles")}/>
          <Tab label="RECHERCHE" active={mainTab==="search"} onClick={()=>setMainTab("search")}/>
          <Tab label="SUIVI" active={mainTab==="tracker"} onClick={()=>setMainTab("tracker")}/>
        </div>

        {/* BODY */}
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
          {mainTab==="profiles" && <ProfilesTab/>}
          {mainTab==="search" && <SearchTab/>}
          {mainTab==="tracker" && <TrackerTab/>}
        </div>
      </div>
    </>
  );
}
