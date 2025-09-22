import { useEffect } from "react";
import { createPortal } from "react-dom";

type Person = {
  id?: number | string;
  uuid?: string;
  name?: string;
  title?: string;
  department?: string;
  bio?: string;
  expertise?: string[];
};

type ProfileProps = {
  open: boolean;
  onClose: () => void;
  person: Person | null | undefined;
};

export default function Profile({ open, onClose, person }: ProfileProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

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
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        width: "min(92vw, 720px)",
        background: "#fff",
        borderRadius: 14,
        boxShadow: "0 22px 70px rgba(0,0,0,0.35)",
        zIndex: 2147483647,
        overflow: "hidden"
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
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div style={{ fontSize: 20, fontWeight: 700 }}>
                {person?.name ?? "John/Jane Doe"}
              </div>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  background: "#e8f5e9",
                  color: "#166534",
                  padding: "4px 8px",
                  borderRadius: 999
                }}
                title="Availability"
              >
                <span
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: "#22c55e"
                  }}
                />
                Available • 9–5
              </span>
            </div>
            <div style={{ color: "#6b7280", marginTop: 4 }}>
              {person?.title ?? "Student"} • {person?.department ?? "School of Example Studies"}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "#eee", margin: "16px 0" }} />

        {/* Two-column content */}
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
          {/* Overview (dummy) */}
          <div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Overview</div>
            <div
              style={{
                background: "#f9fafb",
                border: "1px solid #eef2f7",
                borderRadius: 10,
                padding: 12,
                color: "#374151"
              }}
            >
              <div style={{ marginBottom: 6 }}>
                <b>Role:</b> {person?.jobTitle ?? "Undergraduate Student"}
              </div>
              <div style={{ marginBottom: 6 }}>
                <b>Work hours:</b> 8:00 AM – 5:00 PM
              </div>
              <div>
                <b>About:</b>{" "}
                {person?.bio ??
                  "This is placeholder text for a short bio. Replace with real details when you connect to your data source."}
              </div>
            </div>
          </div>

          {/* Contact (dummy) */}
          <div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Contact</div>
            <div
              style={{
                background: "#f9fafb",
                border: "1px solid #eef2f7",
                borderRadius: 10,
                padding: 12,
                color: "#374151"
              }}
            >
              <div style={{ marginBottom: 6 }}>
                <b>Email:</b> {person?.email ?? "example@student.university.edu"}
              </div>
              <div style={{ marginBottom: 6 }}>
                <b>Chat:</b> {person?.email ?? "example@student.university.edu"}
              </div>
              <div>
                <b>Location:</b> Main Campus, Building A
              </div>
            </div>
          </div>
        </div>

        {/* Expertise (dummy list) */}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Expertise</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {(person?.expertise?.length ? person.expertise : ["Marine Biology", "Data Science", "Placeholder Research"]).map(
              (tag) => (
                <span
                  key={tag}
                  style={{
                    background: "#eef2ff",
                    color: "#3730a3",
                    padding: "6px 10px",
                    borderRadius: 999,
                    fontSize: 12,
                    border: "1px solid #e0e7ff"
                  }}
                >
                  {tag}
                </span>
              )
            )}
          </div>
        </div>
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
