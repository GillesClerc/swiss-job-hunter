export const STATUS_META = {
  new:          { label: "NEW",         color: "#4a7a60", bg: "rgba(74,122,96,0.12)" },
  analyzed:     { label: "ANALYZED",    color: "#2e7d52", bg: "rgba(46,125,82,0.12)" },
  shortlisted:  { label: "SHORTLISTED", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  viewed:       { label: "VIEWED",      color: "#7aa090", bg: "rgba(122,160,144,0.12)" },
  considering:  { label: "CONSIDERING", color: "#38bdf8", bg: "rgba(56,189,248,0.12)" },
  applied:      { label: "APPLIED",     color: "#34d399", bg: "rgba(52,211,153,0.12)" },
  interviewing: { label: "INTERVIEW",   color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
  offer:        { label: "OFFER 🎉",    color: "#fb923c", bg: "rgba(251,146,60,0.12)" },
  rejected:     { label: "REJECTED",    color: "#f87171", bg: "rgba(248,113,113,0.08)" },
  archived:     { label: "ARCHIVED",    color: "#6b8c7a", bg: "rgba(107,140,122,0.12)" },
};

export const EVENT_META = {
  viewed:         { icon: "👁",  label: "Viewed",            color: "#7aa090" },
  applied:        { icon: "📤",  label: "Applied",           color: "#34d399" },
  confirmation:   { icon: "✉️",  label: "Confirmation",      color: "#2e7d52" },
  recruiter_call: { icon: "📞",  label: "Recruiter Call",    color: "#f59e0b" },
  interview_1:    { icon: "🤝",  label: "1st Interview",     color: "#a78bfa" },
  interview_2:    { icon: "🤝",  label: "2nd Interview",     color: "#a78bfa" },
  technical:      { icon: "💻",  label: "Technical Test",    color: "#f59e0b" },
  offer_received: { icon: "🎁",  label: "Offer Received",    color: "#fb923c" },
  offer_accepted: { icon: "✅",  label: "Offer Accepted",    color: "#34d399" },
  offer_declined: { icon: "🚫",  label: "Offer Declined",    color: "#f87171" },
  rejected:       { icon: "❌",  label: "Rejected",          color: "#f87171" },
  note:           { icon: "📝",  label: "Note",              color: "#4a7a60" },
};

export const JOB_BOARD_SOURCES = ["jobs.ch","jobscout24.ch","swissdevjobs.ch","jobup.ch","züri.jobs","efinancialcareers.ch","linkedin.com","michael-page.ch"];

// Per-company career-page scrapers ("reliable" tier — no headless browser needed)
export const COMPANY_SOURCES = ["BKW","Romande Énergie","Helion","Juice","Move","La Goule","Swisscom","Swisscom Broadcast","Samsung","ABB","Hitachi Energy","Logitech"];

export const SOURCES = [...JOB_BOARD_SOURCES, ...COMPANY_SOURCES];

// Sources whose scraper implements fetch_full_description (used by Enrich)
export const ENRICHABLE = [...JOB_BOARD_SOURCES, "Helion","Swisscom","Swisscom Broadcast","Samsung","ABB","Hitachi Energy","Logitech"];

export const LANGUAGES = [
  { id: "all", label: "ALL" },
  { id: "de",  label: "DE" },
  { id: "en",  label: "EN" },
  { id: "fr",  label: "FR" },
  { id: "it",  label: "IT" },
];

export const APPLY_METHODS = [
  { id: "email",    label: "Email",    icon: "📧" },
  { id: "form",     label: "Web Form", icon: "🌐" },
  { id: "linkedin", label: "LinkedIn", icon: "💼" },
  { id: "manual",   label: "Manual",   icon: "✍️" },
];

export const ADDABLE_EVENTS = [
  "confirmation","recruiter_call","interview_1","interview_2",
  "technical","offer_received","offer_accepted","offer_declined","rejected","note",
];

// Shared input/textarea style
export const inp = {
  width:"100%",padding:"6px 9px",borderRadius:4,
  background:"#ffffff",border:"1px solid #c8d8c4",
  color:"#2c4a38",fontSize:11,
};
