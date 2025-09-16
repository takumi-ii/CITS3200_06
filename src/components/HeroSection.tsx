export default function HeroSection() {
  return (
    <section
      style={{
        position: "relative",
        height: "450px",
        overflow: "hidden", // <- keeps everything inside the hero
        backgroundImage: `url('/images/shifaaz-shamoon-sLAk1guBG90-unsplash.jpg')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Left CTA panel */}
      <div
        style={{
          position: "absolute",
          top: "5%",
          left: "5%",
          bottom: "5%",
          width: "40%",
          maxWidth: "550px",
          maxHeight: "90%",     // <- prevents panel from exceeding hero height
          boxSizing: "border-box",
          backgroundColor: "rgba(0,0,0,0.9)",
          color: "white",
          padding: "2rem",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          zIndex: 1,
          borderLeft: "2px solid white"
        }}
      >
        <h1 style={{ fontSize: "2.5rem", fontWeight: 600, marginBottom: "1rem" }}>
          Explore Our Expertise
        </h1>
        <p style={{ fontSize: "1.2rem", marginBottom: "1.5rem", lineHeight: 1.4 }}>
          Connect with 400+ researchers across marine science, climate,
          and sustainable ocean management.
        </p>

          <p style={{ margin: 0, opacity: 0.85, fontSize: "0.95rem" }}>
               Browse 400+ researchers and filter by theme, skills, methods, or region.
          </p>
        <a
          href="/expertise"
          style={{
            alignSelf: "flex-end",
             marginTop: "3rem",
            backgroundColor: "#00AEEF",
            color: "#002042",
            padding: "0.75rem 1.25rem",
            fontWeight: "bold",
            textDecoration: "none",
          }}
        >
          Explore Expertise →
        </a>
      </div>
    </section>
  );
}
