import React, { useEffect,useState,useMemo} from "react";
import { createPortal } from "react-dom";
import { Researcher } from "../data/mockData"; // or from your types file
import { collabIdx, } from "../data/mockData";
import { getAllCollaboratorsFor,getTopCollaboratorsFor } from "../data/collabUtils";
import { mockAwards,mockGrants, mockResearchOutcomes, mockResearchers, mockProjects } from "../data/mockData";
import { getOutcomesForResearcher,getAllOutcomes, subscribe } from '../data/api';
import { preloadProfile, getGrantsFor, getAwardsFor } from '../data/api';


interface ProfileProps {
  open: boolean;
  onClose: () => void;
  person: Researcher | null;
  dataSource:'api' | 'mock'; 
}

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString() : "");
const dateRange = (s?: string | null, e?: string | null) =>
  s && e ? `${fmt(s)} – ${fmt(e)}` : s ? `${fmt(s)} –` : e ? `– ${fmt(e)}` : "Dates TBD";

const nameOf = (id?: string) => mockResearchers.find(r => r.id === id)?.name || id || "Unknown";



const safeArray = <T,>(v?: T[] | null) => (Array.isArray(v) ? v : []);
// simplified: awards now have a single recipientId
const recipientsOf = (aw: any) => (aw?.recipientId ? [aw.recipientId] : []);

const getInitials = (name?: string) =>
  (name || "")
    .split(/\s+/)
    .filter(Boolean)
    .map(s => s[0]?.toUpperCase())
    .slice(0, 2)
    .join("");

const findResearcher = (id?: string) => mockResearchers.find(r => r.id === id);

const displayAffiliation = (r: any) =>
  r?.institution && r?.title
    ? `${r.institution} – ${r.title}`
    : r?.department && r?.title
      ? `${r.department} – ${r.title}`
      : r?.institution || r?.department || r?.title || "";



export default function Profile({ open, onClose, person ,dataSource}: ProfileProps) {
  console.log('[Profile] rid =', person?.id);
  const [activeTab, setActiveTab] = useState("Overview");
  const [tick, setTick] = useState(0);
useEffect(() => {
  console.log('[Profile] incoming person', person);
}, [person]);
useEffect(() => {
  const unsub = subscribe(() => setTick(t => t + 1));
  return () => unsub();
}, []);

const publications = useMemo(() => {
  if (!person) return [];
  return dataSource === 'api'
    ? getOutcomesForResearcher(person)  // ← outcomes from API store
    : person.recentPublications || [];  // ← mock path
}, [person, dataSource, tick]);
  


useEffect(() => {
  if (open && dataSource === 'api' && person?.id) {
    preloadProfile(person.id); // now grants-only
  }
}, [open, dataSource, person?.id]);



const grants = useMemo(
  () => (person?.id && dataSource === 'api') ? getGrantsFor(person.id) : [],
  [person?.id, dataSource, tick]
);
const awards = useMemo(
  () => (person?.id && dataSource === 'api') ? getAwardsFor(person.id) : [],
  [person?.id, dataSource, tick]
);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const topCollabs = getTopCollaboratorsFor("suzan-perfect", collabIdx, 3).map(c => {
  const r = mockResearchers.find(r => r.id === c.collaboratorId);
  return { ...r, ...c }; // merge collaborator info + counts
});

return createPortal(
  <>
    {/* Backdrop */}
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.65)",
        zIndex: 2147483646
      }}
      aria-hidden="true"
    />

    {/* Modal Panel */}
   <div
  role="dialog"
  aria-modal="true"
  style={{
    position: "fixed",
    top: "5%",              // leave some gap at top/bottom so background shows
    left: "50%",
    transform: "translateX(-50%)",
    width: "55vw",          // much wider
    height: "90vh",         // taller, almost full page
    background: "#fff",
    borderRadius: 14,
    boxShadow: "0 22px 70px rgba(0,0,0,0.35)",
    zIndex: 2147483647,
    overflowY: "auto",      // allow scrolling if content overflows
    display: "flex",
    flexDirection: "column"
  }}
>
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 16px",
          borderBottom: "1px solid #eee",
          background: "#f8fafc"
        }}
      >
        <div style={{ fontWeight: 600 }}>Profile</div>
        <button
          onClick={onClose}
          aria-label="Close profile"
          style={{
            border: "1px solid #e5e7eb",
            background: "#fff",
            padding: "6px 10px",
            borderRadius: 8,
            cursor: "pointer"
          }}
        >
          Close
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: 20 }}>
        {/* Header row: avatar + name + meta */}
        <div style={{ display: "flex", gap: 16 }}>
          {/* Avatar with initials */}
          <div
            aria-hidden="true"
            style={{
              width: 64,
              height: 64,
              borderRadius: "9999px",
              display: "grid",
              placeItems: "center",
              fontWeight: 700,
              fontSize: 20,
              color: "#0b2a4a",
              // use your figma blue token as a soft avatar bg
              background: "oklch(0.809 0.105 251.813)"
            }}
          >
            {getInitials(person?.name)}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
  {/* Name */}
  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
    <div style={{ fontSize: 20, fontWeight: 700 }}>
      {person?.name ?? "John/Jane Doe"}
    </div>
  </div>

  {/* Title & Department */}
  <div style={{ color: "#6b7280", marginTop: 4 }}>
    {person?.title ?? "Student"} • {person?.department ?? "School of Example Studies"}
  </div>

 {/* Contact Info */}
<div style={{ color: "#374151", fontSize: 14, marginTop: 8 }}>
  {person?.email && (
    <div>
      <b>Email:</b> {person.email}
    </div>
  )}
  {person?.phone && (
    <div>
      <b>Phone:</b> {person.phone}
    </div>
  )}
  {person?.institution && (
    <div>
      <b>Location:</b> {person.institution}
    </div>
  )}
</div>





</div>

        </div>


{/* Profile Tabs (Summary Nav) */}
<div style={{ borderBottom: "1px solid #e5e7eb", marginTop: 20 }}>
  <div style={{ display: "flex", gap: 24, fontSize: 14, fontWeight: 500 }}>
    {["Overview", "Research Outputs", "Grants", "Collaborators"].map(
      (tab) => (
        <button
          key={tab}
          onClick={() => setActiveTab(tab)} // you'll need a state for activeTab
          style={{
            padding: "12px 0",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            color: activeTab === tab ? "#4338ca" : "#4b5563", // active = indigo-700
            borderBottom:
              activeTab === tab
                ? "2px solid #4338ca"
                : "2px solid transparent",
          }}
        >
          {tab}
        </button>
      )
    )}
  </div>
</div>

{/* OVERVIEW CONTENT ONLY */}
{activeTab === "Overview" && (
  <div style={{ marginTop: 16 }}>
   

    {/* Bio card */}
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",   // thin light border
        borderRadius: 8,
        padding: 16
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Bio</div>
      <div style={{ height: 1, background: "#f1f5f9", marginBottom: 12 }} /> {/* thin divider */}
      <div style={{ color: person?.bio ? "#374151" : "#9ca3af" }}>
        {person?.bio || "Empty"}
      </div>
    </div>
    {/* Expertise card */}
<div
  style={{
    marginTop: 20,
    background: "#fff",
    
    borderRadius: 8,
    padding: 8
  }}
>
  <div style={{ fontWeight: 600, marginBottom: 2, fontSize: 16 }}>
    Expertise
  </div>

   <div style={{ color: "#6b7280", fontSize: 14, marginBottom: 15 }}>
    Explore areas where {person?.name ?? "this researcher"} is most active
  </div>
 

  {person?.expertise?.length ? (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {person.expertise.map((tag: string) => (
        <span
          key={tag}
          style={{
            background: "#eef2ff",
            color: "#3730a3",
            padding: "6px 12px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 500,
            border: "1px solid #e0e7ff"
          }}
        >
          {tag}
        </span>
      ))}
    </div>
  ) : (
    <div style={{ color: "#9ca3af" }}>–</div>
  )}
</div>

{/* Recent Publications (with optional type + tags) */}
{(() => {
  type RecentPub = {
    title?: string;
    year?: number;
    journal?: string;
    url?: string;
    type?: string;          // NEW: optional
    keywords?: string[];    // NEW: optional ("tags")
  };

  const pubs: RecentPub[] = (person?.recentPublications ?? [])
    .slice()
    .sort((a: any, b: any) => (b.year ?? 0) - (a.year ?? 0))
    .slice(0, 6);

  return (
    <div style={{ marginTop: 20 }}>
      {/* Header: title + count */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 16 }}>Recent Publications</div>
        <div style={{ color: "#6b7280", fontSize: 13 }}>({pubs.length})</div>
      </div>

      {/* Grid (2 columns) */}
      {pubs.length ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12
          }}
        >
         {pubs.map((pub, i) => (
  <div
    key={`${pub.title}-${i}`}
    style={{
      background: "#fff",
      border: "1px solid #e5e7eb",
      borderRadius: 8,
      padding: 12,
      paddingRight: 64, // so text doesn’t overlap the button
      minHeight: 84,
      position: "relative" // <-- required for absolute button
    }}
  >
    {/* View button (always shown, disabled if no url) */}
    <a
      href={pub.url || "#"}
      target={pub.url ? "_blank" : undefined}
      rel={pub.url ? "noreferrer" : undefined}
      style={{
        position: "absolute",
        top: 8,
        right: 8,
        padding: "4px 10px",
        fontSize: 12,
        fontWeight: 500,
        color: pub.url ? "#2563eb" : "#9ca3af",
        textDecoration: "none",
        cursor: pub.url ? "pointer" : "default",
        whiteSpace: "nowrap"
      }}
    >
      View
    </a>

    {/* Title */}
    <div style={{ fontWeight: 600, color: "#0b2a4a", marginBottom: 6 }}>
      {pub.title || "Untitled"}
    </div>

    {/* Meta row */}
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <div style={{ color: "#6b7280", fontSize: 13 }}>
        {pub.year ? `(${pub.year})` : ""}
        {pub.year && pub.journal ? " · " : ""}
        {pub.journal || ""}
      </div>
      {pub.type && (
        <span
          style={{
            marginLeft: "auto",
            background: "#f1f5f9",
            border: "1px solid #e5e7eb",
            borderRadius: 999,
            padding: "2px 8px",
            fontSize: 12,
            fontWeight: 600,
            color: "#0f172a",
            whiteSpace: "nowrap"
          }}
        >
          {pub.type}
        </span>
      )}
    </div>

    {/* Tags */}
    {pub.keywords?.length ? (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
        {pub.keywords.slice(0, 6).map((tag) => (
          <span
            key={tag}
            style={{
              background: "#eef2ff",
              color: "#3730a3",
              padding: "4px 8px",
              borderRadius: 8,
              fontSize: 12,
              border: "1px solid #e0e7ff"
            }}
          >
            {tag}
          </span>
        ))}
      </div>
    ) : null}
  </div>
))}

        </div>
      ) : (
        <div style={{ color: "#9ca3af" }}>No recent publications</div>
      )}
    </div>
  );
})()}


{/* Top Collaborators (UI-only, horizontal tiles) */}
{(() => {
  // Normalise to a simple list the UI can read
type CollabLike = {
  id?: string;
  name?: string;
  title?: string;
  institution?: string;
  department?: string;
  affiliation?: string;
  photoUrl?: string;
};
const collabs = person?.id
  ? getTopCollaboratorsFor(person.id, collabIdx, 5).map(c => {
      const r = mockResearchers.find(r => r.id === c.collaboratorId);
      return {
        id: r?.id,
        name: r?.name,
        title: r?.title,
        institution: r?.institution,
        department: r?.department,
        affiliation: (r as any)?.affiliation,
        total: c.total // 👈 this is the count
      };
    })
  : [];


  return (
    <div style={{ marginTop: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 16 }}>Top Collaborators</div>
        <div style={{ color: "#6b7280", fontSize: 13 }}>({collabs.length})</div>
      </div>

      {collabs.length ? (
        <div
          style={{
            display: "flex",
            gap: 12,
            overflowX: "auto",
            paddingBottom: 4,
            scrollbarWidth: "thin"
          }}
        >
          {collabs.map((c, i) => {
            const name = c.name ?? "Unknown";
            const sub =
              c.title ??
              c.department ??
              c.institution ??
              c.affiliation ??
              "—";

            return (
              <div
                key={c.id ?? `${name}-${i}`}
                style={{
                  flex: "0 0 auto",
                  width: 148,
                  height: 148,
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 12,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center"
                }}
                title={name}
              >
                {/* Avatar */}
                <div
                  aria-hidden="true"
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 999,
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 700,
                    fontSize: 16,
                    color: "#0b2a4a",
                    background: "#eef2ff",
                    border: "1px solid #e0e7ff",
                    marginBottom: 8
                  }}
                >
                  {getInitials(name)}
                </div>

                {/* Name */}
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 14,
                    lineHeight: 1.2,
                    color: "#0b2a4a",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    width: "100%"
                  }}
                >
                  {name}
                </div>

                {/* Subtext */}
                <div
                  style={{
                    color: "#6b7280",
                    fontSize: 12,
                    marginTop: 4,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    width: "100%"
                  }}
                >
                  {sub}
                </div>
                {/* Shared count */}
<div
  style={{
    color: "#4338ca",
    fontSize: 12,
    fontWeight: 600,
    marginTop: 6
  }}
>
  {c.total} shared collaborations
</div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ color: "#9ca3af" }}>No collaborators yet</div>
      )}
    </div>
  );
})()}





  </div>
)}
{/* RESEARCH OUTPUTS CONTENT ONLY */}
{activeTab === "Research Outputs" && (
  <div style={{ marginTop: 16 }}>
    {(() => {
      // --- helpers ----------------------------------------------------------
      const isApi = dataSource === "api";

      // Normalize "string | object" author forms
      const toL = (v: any) => (v ?? "").toString().trim().toLowerCase();
      const authoredBy = (o: any, person: any) => {
        const authors = Array.isArray(o?.authors) ? o.authors : [];
        const rid = toL(person?.id || person?.uuid);
        const rname = toL(person?.name);
        const rorcid = toL(person?.orcid);

        return authors.some((a: any) => {
          if (!a) return false;
          if (typeof a === "string") {
            const s = toL(a);
            // could be an id or name string depending on backend
            return (rid && s === rid) || (rname && s === rname);
          }
          const aid = toL(a.id || a.uuid);
          const aname = toL(a.name);
          const aorcid = toL(a.orcid);
          return (rid && aid && rid === aid) ||
                 (rorcid && aorcid && rorcid === aorcid) ||
                 (rname && aname && rname === aname);
        });
      };

      // --- compute outputs once --------------------------------------------
      // MOCK path: keep your existing publicationIds -> mockResearchOutcomes
      // API path: derive from the already-loaded store outcomes by author match
      let outputs: any[] = [];

      if (isApi) {
        // IMPORTANT: import getAllOutcomes from ../data/api at the top of Profile.tsx
        //   import { getAllOutcomes, subscribe } from '../data/api';
        const all = getAllOutcomes();
        outputs = all
          .filter(o => authoredBy(o, person))
          .sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
      } else {
        // IMPORTANT: import mockResearchOutcomes from ../data/mockData
        //   import { mockResearchOutcomes } from '../data/mockData';
        outputs = (person?.publicationIds ?? [])
          .map((id: string) => mockResearchOutcomes.find(o => o.id === id))
          .filter((o: any): o is NonNullable<typeof o> => Boolean(o))
          .sort((a: any, b: any) => (b.year ?? 0) - (a.year ?? 0));
      }

      return (
        <>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 16 }}>Research Outputs</div>
            <div style={{ color: "#6b7280", fontSize: 13 }}>({outputs.length})</div>
          </div>

          {/* Empty state */}
          {!outputs.length && (
            <div style={{ color: "#9ca3af" }}>No research outputs for this researcher.</div>
          )}

          {/* List */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
            {outputs.map(o => (
              <div
                key={o.id}
                style={{
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  padding: 12
                }}
              >
                {/* Title (link) */}
                <div style={{ fontWeight: 600, color: "#0b2a4a" }}>
                  {o.url ? (
                    <a href={o.url} target="_blank" rel="noreferrer" style={{ color: "inherit", textDecoration: "none" }}>
                      {o.title}
                    </a>
                  ) : (
                    o.title
                  )}
                </div>

                {/* Meta row: year • journal/type • badges */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", color: "#6b7280", fontSize: 13, marginTop: 4 }}>
                  <span>{o.year ? `(${o.year})` : ""}{o.year && (o.journal || o.type) ? " · " : ""}{o.journal || o.type || ""}</span>
                  {o.status && (
                    <span style={{ marginLeft: "auto", background: "#f1f5f9", border: "1px solid #e5e7eb", borderRadius: 999, padding: "2px 8px", fontSize: 12, fontWeight: 600, color: "#0f172a" }}>
                      {o.status}
                    </span>
                  )}
                  {o.category && (
                    <span style={{ background: "#eef2ff", border: "1px solid #e0e7ff", borderRadius: 999, padding: "2px 8px", fontSize: 12, fontWeight: 600, color: "#3730a3" }}>
                      {o.category}
                    </span>
                  )}
                </div>

                {/* Authors */}
                {!!o.authors?.length && (
                  <div style={{ color: "#374151", fontSize: 13, marginTop: 6 }}>
                    <b>Authors:</b>{" "}
                    {Array.isArray(o.authors)
                      ? o.authors
                          .map((a: any) => (typeof a === "string" ? a : (a?.name ?? a?.id ?? "")))
                          .filter(Boolean)
                          .join(", ")
                      : ""}
                  </div>
                )}

                {/* Abstract (collapsible) */}
                {typeof o.abstract === "string" && o.abstract.trim().length > 0 && (
                  <details style={{ marginTop: 8 }}>
                    <summary style={{ cursor: "pointer", color: "#2563eb", fontSize: 13 }}>Show abstract</summary>
                    <div style={{ color: "#374151", fontSize: 14, marginTop: 6, whiteSpace: "pre-wrap" }}>
                      {o.abstract}
                    </div>
                  </details>
                )}

                {/* Keywords */}
                {!!o.keywords?.length && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                    {o.keywords.slice(0, 8).map((k: string) => (
                      <span key={k} style={{ background: "#eef2ff", color: "#3730a3", padding: "4px 8px", borderRadius: 8, fontSize: 12, border: "1px solid #e0e7ff" }}>
                        {k}
                      </span>
                    ))}
                  </div>
                )}

                {/* Citations */}
                {typeof o.citations === "number" && (
                  <div style={{ color: "#6b7280", fontSize: 12, marginTop: 6 }}>
                    Citations: {o.citations}
                  </div>
                )}

                {/* Funding */}
                {(o.grantFundingText || o.grantFundingDetails?.length) && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "#0b2a4a" }}>Funding</div>
                    {o.grantFundingText && (
                      <div style={{ color: "#374151", fontSize: 13, marginTop: 4 }}>{o.grantFundingText}</div>
                    )}
                    {!!o.grantFundingDetails?.length && (
                      <ul style={{ margin: "6px 0 0 16px", color: "#374151", fontSize: 13 }}>
                        {o.grantFundingDetails.map((f: any, i: number) => (
                          <li key={`${o.id}-fund-${i}`}>
                            {[f.orgName, f.acronym].filter(Boolean).join(" — ")}
                            {f.fundingNumbers?.length ? ` · ${f.fundingNumbers.join(", ")}` : ""}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* Links */}
                {!!o.links?.length && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                    {o.links.map((l: any, i: number) => (
                      <a
                        key={`${o.id}-link-${i}`}
                        href={l.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 10px", fontSize: 12, textDecoration: "none", color: "#2563eb", whiteSpace: "nowrap" }}
                        title={l.description || l.alias || l.url}
                      >
                        {l.alias || l.description || "Link"}
                      </a>
                    ))}
                  </div>
                )}

                {/* Files */}
                {!!o.files?.length && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                    {o.files.map((f: any, idx: number) => (
                      <a
                        key={`${o.id}-f-${idx}`}
                        href={f.url ?? "#"}
                        target={f.url ? "_blank" : undefined}
                        rel={f.url ? "noreferrer" : undefined}
                        style={{
                          pointerEvents: f.url ? "auto" : "none",
                          opacity: f.url ? 1 : 0.5,
                          border: "1px solid #e5e7eb",
                          borderRadius: 6,
                          padding: "6px 10px",
                          fontSize: 12,
                          textDecoration: "none",
                          color: "#2563eb",
                          whiteSpace: "nowrap"
                        }}
                      >
                        {f.fileName || f.title || f.mimeType || "Download"}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      );
    })()}
  </div>
)}


{/* GRANTS CONTENT ONLY */}
{activeTab === "Grants" && (
  <div style={{ marginTop: 16 }}>
    {(() => {
      const isApi = dataSource === "api";

      // Build grants list (API vs Mock)
      let grants: any[] = [];
      if (isApi) {
        grants = person?.id ? getGrantsFor(person.id) : [];
      } else {
        // If your mock researcher carries an array of grant objects:
        if (Array.isArray((person as any)?.grants)) {
          grants = (person as any).grants;
        } else {
          // Or if it carries IDs, resolve them against mockGrants
          const ids: string[] = Array.isArray((person as any)?.grantIds) ? (person as any).grantIds : [];
          grants = ids
            .map(id => mockGrants.find(g => g.id === id))
            .filter(Boolean) as any[];
        }
      }

      // Sort newest-first (by endDate, then startDate)
      grants = grants.sort((a: any, b: any) => {
        const at = a.endDate ? Date.parse(a.endDate) : (a.startDate ? Date.parse(a.startDate) : 0);
        const bt = b.endDate ? Date.parse(b.endDate) : (b.startDate ? Date.parse(b.startDate) : 0);
        return bt - at;
      });

      return (
        <>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 16 }}>Grants</div>
            <div style={{ color: "#6b7280", fontSize: 13 }}>({grants.length})</div>
          </div>

          {/* Empty state */}
          {!grants.length && (
            <div style={{ color: "#9ca3af" }}>No grants found for this researcher.</div>
          )}

          {/* List */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
            {grants.map((g: any) => (
              <div
                key={g.id}
                style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 12 }}
              >
                {/* Title */}
                <div style={{ fontWeight: 600, color: "#0b2a4a" }}>{g.title || "Untitled grant"}</div>

                {/* Meta row */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", color: "#6b7280", fontSize: 13, marginTop: 4 }}>
                  <span>{dateRange(g.startDate, g.endDate)}</span>
                  {g.funder && (
                    <span style={{ marginLeft: "auto", background: "#f1f5f9", border: "1px solid #e5e7eb", borderRadius: 999, padding: "2px 8px", fontSize: 12, fontWeight: 600, color: "#0f172a" }}>
                      {g.funder}
                    </span>
                  )}
                </div>

                {/* Funding sources (optional) */}
                {Array.isArray(g.fundingSources) && g.fundingSources.length > 0 && (
                  <div style={{ color: "#374151", fontSize: 13, marginTop: 6 }}>
                    <b>Funding sources:</b>{" "}
                    {g.fundingSources.map((fs: any) =>
                      [fs.name, (typeof fs.amount === "number" ? `$${fs.amount}` : null)].filter(Boolean).join(" — ")
                    ).join(", ")}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      );
    })()}
  </div>
)}


{/* AWARDS CONTENT ONLY */}

{activeTab === "Awards1" && (
  <div style={{ marginTop: 16 }}>
    {(() => {
      // Resolve IDs → award objects, newest first (by date)
      const awards = (person?.awardIds ?? [])
        .map(id => mockAwards.find(a => a.id === id))
        .filter((a): a is NonNullable<typeof a> => Boolean(a))
        .sort((a, b) => {
          const at = a.date ? Date.parse(a.date) : 0;
          const bt = b.date ? Date.parse(b.date) : 0;
          return bt - at;
        });

      return (
        <>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 16 }}>Awards</div>
            <div style={{ color: "#6b7280", fontSize: 13 }}>({awards.length})</div>
          </div>

          {/* Empty state */}
          {!awards.length && (
            <div style={{ color: "#9ca3af" }}>No awards recorded for this researcher.</div>
          )}

          {/* List */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
            {awards.map(a => {
              const recips = a.recipientId ? [a.recipientId] : [];
              const meIncluded = recips.includes(person!.id);
              return (
                <div
                  key={a.id}
                  style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 12 }}
                >
                  {/* Title */}
                  <div style={{ fontWeight: 600, color: "#0b2a4a" }}>{a.name}</div>

                  {/* Meta row: date */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", color: "#6b7280", fontSize: 13, marginTop: 4 }}>
                    <span>{a.date ? fmt(a.date) : "Date TBD"}</span>
                    {meIncluded && (
                      <span style={{ marginLeft: "auto", background: "#ecfeff", border: "1px solid #a5f3fc", borderRadius: 999, padding: "2px 8px", fontSize: 12, fontWeight: 600, color: "#075985" }}>
                        Recipient
                      </span>
                    )}
                  </div>

                  {/* Recipient */}
                  {!!recips.length && (
                    <div style={{ color: "#374151", fontSize: 13, marginTop: 6 }}>
                      <b>Recipient:</b>{" "}
                      {recips.map(nameOf).join(", ")}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      );
    })()}
  </div>
)}


{/* ALL COLLABORATORS (GRID) */}
{activeTab === "Collaborators" && (
  <div style={{ marginTop: 16 }}>
    {(() => {
      if (!person?.id) return null;

      // Use the index → get everybody they’ve collaborated with + counts
      const rows = getAllCollaboratorsFor(person.id, collabIdx)
        .map(c => {
          const r = findResearcher(c.collaboratorId);
          return r
            ? {
                id: r.id,
                name: r.name,
                email: r.email,
                institution: r.institution,
                department: r.department,
                title: r.title,
                total: c.total,
                pubCount: c.pubCount,
                grantCount: c.grantCount
              }
            : null;
        })
        .filter(Boolean) as {
          id: string; name?: string; email?: string;
          institution?: string; department?: string; title?: string;
          total: number; pubCount: number; grantCount: number;
        }[];

      // Sort strongest-first
      rows.sort((a, b) => b.total - a.total || b.pubCount - a.pubCount);

      return (
        <>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 16 }}>All collaborators</div>
            <div style={{ color: "#6b7280", fontSize: 13 }}>({rows.length})</div>
          </div>

          {/* Empty state */}
          {!rows.length && (
            <div style={{ color: "#9ca3af" }}>No collaborators found for this researcher.</div>
          )}

          {/* Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 12
            }}
          >
            {rows.map(r => (
              <div
                key={r.id}
                style={{
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  padding: 12,
                  display: "grid",
                  gridTemplateColumns: "40px 1fr",
                  columnGap: 12,
                  alignItems: "center"
                }}
              >
                {/* Avatar */}
                <div
                  style={{
                    width: 40, height: 40, borderRadius: "50%",
                    background: "#e5e7eb",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 700, color: "#374151"
                  }}
                  aria-hidden
                >
                  {getInitials(r.name)}
                </div>

                {/* Text */}
                <div>
                  <div style={{ fontWeight: 700, color: "#0b2a4a" }}>{r.name || r.id}</div>
                  {r.email && (
                    <div style={{ color: "#2563eb", fontSize: 13 }}>
                      <a href={`mailto:${r.email}`} style={{ color: "inherit", textDecoration: "none" }}>
                        {r.email}
                      </a>
                    </div>
                  )}
                  <div style={{ color: "#6b7280", fontSize: 13, marginTop: 2 }}>
                    {displayAffiliation(r)}
                  </div>

                  {/* Shared counts */}
                  <div style={{ color: "#4338ca", fontSize: 12, fontWeight: 600, marginTop: 6 }}>
                    {r.total} shared collaborations
                    {/* If you want a breakdown, uncomment: */}
                    {/* <span style={{ color: "#6b7280", fontWeight: 500 }}>
                      {" "}· {r.pubCount} outputs · {r.grantCount} grants
                    </span> */}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      );
    })()}
  </div>
)}












        
      </div>
    </div>
  </>,
  document.body
);

// helper — initials from name
function getInitials(name?: string) {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map(p => p[0]?.toUpperCase() ?? "").join("") || "??";
}

}
