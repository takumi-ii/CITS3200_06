// HeroSection.tsx
import React from 'react';

type HeroSectionProps = {
  onExploreClick?: () => void;
};

export default function HeroSection({ onExploreClick }: HeroSectionProps) {
  return (
    <section
      className="oi-hero"
      style={{
        position: "relative",
        height: "450px",
        overflow: "hidden",
        backgroundImage: `url('/images/shifaaz-shamoon-sLAk1guBG90-unsplash.jpg')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Desktop/Tablet CTA panel (unchanged, but we’ll hide it on small screens via CSS) */}
      <div
  className="hero-panel hidden md:flex md:flex-col md:justify-center"
  style={{
    position: "absolute",
    top: "5%",
    bottom: "5%",
    width: "40%",
    maxWidth: "550px",
    maxHeight: "90%",
    boxSizing: "border-box",
    backgroundColor: "rgba(0,0,0,0.9)",
    color: "white",
    padding: "2rem",
    zIndex: 1,
    borderLeft: "2px solid white",
    left: "clamp(5%, 50% - 275px, 50%)",
    transform: "translateX(-50%)",
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

        <button
          onClick={onExploreClick}
          style={{
            alignSelf: "flex-end",
            marginTop: "3rem",
            backgroundColor: "#00AEEF",
            color: "#002042",
            padding: "0.75rem 1.25rem",
            fontWeight: "bold",
            textDecoration: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          Explore Network →
        </button>
      </div>

      {/* Mobile-only overlay: white text over the beach view */}
      <div className="hero-mobile-overlay">
  <div className="hero-mobile-copy">
     <h1 className="hero-mobile-title">
      Explore our world-leading ocean research
    </h1>
    <p className="hero-mobile-subtitle">
      Connect with over 200 + expert researchers .
    </p>

    <button
      onClick={onExploreClick}
      className="hero-mobile-cta"
    >
      Explore Netwok→
    </button>
  </div>
</div>




      {/* Scoped styles for responsiveness (additive, doesn’t affect desktop look) */}
      <style>{`
  /* Desktop default: show original panel, hide mobile overlays */
  .oi-hero .hero-mobile-overlay { display: none; }
  .oi-hero .hero-bottom-bar     { display: none; }

  /* Mobile rules */
  @media (max-width: 767px) {
    /* Hide the desktop panel */
    .oi-hero .hero-panel { display: none !important; }

    /* Show the new mobile overlay */
    .oi-hero .hero-mobile-overlay {
      display: block;
      position: absolute;
      inset: 0;
      z-index: 2;
      background: linear-gradient(
        to bottom,
        rgba(0,0,0,0.4) 0%,
        rgba(0,0,0,0.6) 100%
      );
    }

    .oi-hero .hero-mobile-copy {
      position: absolute;
      left: 16px;
      right: 16px;
      top: 25%;
      color: #fff;
      text-align: center;
    }

    /* 🔹 Large clean heading (like your screenshot) */
    .oi-hero .hero-mobile-title {
  font-size: 2rem;              /* ~32px */
  font-weight: 500;             /* medium weight, cleaner than bold */
  line-height: 1.25;
  margin-bottom: 0.75rem;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
  letter-spacing: 0.3px;        /* subtle spacing for a polished feel */
}

    /* 🔹 Smaller supporting subtitle */
    .oi-hero .hero-mobile-subtitle {
      font-size: 1rem;              /* ~16px */
      line-height: 1.4;
      font-weight: 400;
      opacity: 0.9;
      text-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
      margin-bottom: 1.5rem;
    }

    /* 🔹 CTA button */
    .oi-hero .hero-mobile-cta {
  background: rgba(0, 0, 0, 0);       /* subtle translucent black */
  color: #ffffff;
  font-family: 'Open Sans', 'Helvetica Neue', Arial, sans-serif;
  font-weight: 500;
  letter-spacing: 0.3px;
  border: 2px solid rgba(255, 255, 255, 0.85);  /* crisp white border */
  padding: 9px 22px;                    /* 🔹 smaller padding */
  font-size: 0.95rem;                   /* 🔹 slightly smaller text */
  border-radius: 9999px;                /* full pill shape */
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  transition: 
    background 0.25s ease, 
    transform 0.15s ease, 
    box-shadow 0.25s ease;
}

.oi-hero .hero-mobile-cta:hover {
  background: rgba(0, 0, 0, 0.8);        /* darker on hover */
  transform: translateY(-2px);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.4);
}


    /* Optional: black info bar at bottom */
    .oi-hero .hero-bottom-bar {
      display: block;
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 3;
      background: rgba(0,0,0,0.85);
      padding: 10px 0;
    }

    .oi-hero .hero-bottom-inner {
      color: #e5e7eb;
      font-size: 13px;
      line-height: 1.35;
      text-align: center;
      padding: 0 14px;
    }

  }


`}</style>

    </section>
  );
}
