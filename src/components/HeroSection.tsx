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
      <div className="hero-panel"
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
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
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
          <h1>Explore our expertise</h1>

          {/* small line under heading, in a blue chip */}
          <div className="hero-mobile-chip">Connect with 200+ researchers</div>

          <button
            onClick={onExploreClick}
            className="hero-mobile-cta"
          >
            Explore Network →
          </button>
        </div>
      </div>

      {/* Black bar near the bottom on mobile for extra text */}
      <div className="hero-bottom-bar">
        <div className="hero-bottom-inner">
          Advancing marine science, climate resilience, and sustainable ocean stewardship.
        </div>
      </div>

      {/* Scoped styles for responsiveness (additive, doesn’t affect desktop look) */}
      <style>{`
        /* Desktop default: show original panel, hide mobile overlays */
        .oi-hero .hero-mobile-overlay { display: none; }
        .oi-hero .hero-bottom-bar     { display: none; }

        /* Mobile rules */
        @media (max-width: 767px) {
          /* Hide the desktop panel on small screens (without removing it) */
          .oi-hero .hero-panel { display: none; }

          /* Show the mobile overlay */
          .oi-hero .hero-mobile-overlay {
            display: block;
            position: absolute;
            inset: 0;
            z-index: 2;
            background: linear-gradient(
              to bottom,
              rgba(0,0,0,0.35) 0%,
              rgba(0,0,0,0.35) 60%,
              rgba(0,0,0,0.55) 100%
            ); /* subtle darken for readability */
          }

          .oi-hero .hero-mobile-copy {
            position: absolute;
            left: 16px;
            right: 16px;
            top: 18%;
            color: #fff;
            text-align: left;
          }

          .oi-hero .hero-mobile-copy h1 {
            margin: 0 0 10px 0;
            font-size: 28px;
            line-height: 1.15;
            font-weight: 700;
            text-shadow: 0 2px 8px rgba(0,0,0,0.35);
          }

          .oi-hero .hero-mobile-chip {
            display: inline-block;
            background: #3DA4ED;
            color: #001a33;
            font-weight: 700;
            font-size: 13px;
            padding: 6px 10px;
            border-radius: 999px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.15);
          }

          .oi-hero .hero-mobile-cta {
            margin-top: 14px;
            background: #ffffff;
            color: #001a33;
            font-weight: 800;
            border: none;
            padding: 10px 14px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.18);
          }

          /* Bottom black bar for extra text */
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
