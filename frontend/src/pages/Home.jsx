import React, { useState, useEffect } from "react";

export default function Home() {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [wallet, setWallet] = useState("");
  const [headingText, setHeadingText] = useState("");
  const [showContent, setShowContent] = useState(false);

  const heading = "WELCOME TO FACE TALLY";

  useEffect(() => {
  let i = 0;
  let forward = true;
  let interval;

  const typeEffect = () => {
    interval = setInterval(() => {
      if (forward) {
        setHeadingText(heading.slice(0, i + 1));
        i++;

        if (i === heading.length) {
          clearInterval(interval);
          setShowContent(true);

          // Hold for 60 seconds before fading and erasing
          setTimeout(() => {
            const headingEl = document.querySelector("h1");
            if (headingEl) {
              headingEl.style.transition = "opacity 1s ease";
              headingEl.style.opacity = "0"; // Fade out
            }

            // Wait for fade to complete before erasing
            setTimeout(() => {
              if (headingEl) headingEl.style.opacity = "1"; // Reset opacity
              forward = false;
              typeEffect(); // Restart interval for erase
            }, 1000); // 1s fade duration
          }, 60000);
        }
      } else {
        setHeadingText(heading.slice(0, i - 1));
        i--;

        if (i === 0) {
          clearInterval(interval);
          forward = true;
          setShowContent(false);

          // small pause before retyping again
          setTimeout(() => {
            typeEffect();
          }, 1000);
        }
      }
    }, 120);
  };

  typeEffect();

  return () => clearInterval(interval);
}, []);


  return (
    <div style={{ position: "relative", minHeight: "100vh", overflow: "hidden" }}>
      {/* Floating Circles */}
      {[...Array(6)].map((_, i) => <div key={i} className={`circle circle${i+1}`}></div>)}

      {/* Navbar */}
          <nav style={navBar}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <img
                src="/logo.png"
                alt="Facetally Logo"
                className="logo-glow"
                style={{
                  width: "100px",
                  height: "100px",
                  objectFit: "contain",
                  filter: "drop-shadow(0 0 5px #3b82f6)",
                  transition: "transform 0.3s ease, filter 0.3s ease",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "scale(1.1)";
                  e.currentTarget.style.filter = "drop-shadow(0 0 15px #60a5fa)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                  e.currentTarget.style.filter = "drop-shadow(0 0 5px #3b82f6)";
                }}
              />
              <h2 style={{ margin: 0, color: "#fff", fontWeight: 800 }}></h2>
            </div>
            <a href="/register" style={navLink}>Register</a>

            {/* Logo animation style */}
            <style>{`
              @keyframes softGlow {
                0% { filter: drop-shadow(0 0 5px #3b82f6); }
                50% { filter: drop-shadow(0 0 15px #60a5fa); }
                100% { filter: drop-shadow(0 0 5px #3b82f6); }
              }

              .logo-glow {
                animation: softGlow 2.5s infinite ease-in-out;
              }
            `}</style>
          </nav>


      {/* Main content */}
      <div style={{ textAlign: "center", marginTop: "120px", position: "relative", zIndex: 5 }}>
        <h1 style={headingStyle}>
          {headingText}
          <span style={cursorStyle}>|</span>
        </h1>

        <div style={{ opacity: showContent ? 1 : 0, transform: showContent ? "translateY(0)" : "translateY(20px)", transition: "all 1s ease-out" }}>
          <p style={subText}>
            A SMART ATTENDANCE MANAGEMENT SYSTEM POWERED BY FACE RECOGNITION AND HEDERA
          </p>

          <button onClick={() => setShowLoginModal(true)} style={{ ...btnStyle, marginTop: "10px" }}>
            Login
          </button>
          <button
            onClick={() => setShowGuideModal(true)}
            style={{ ...btnStyle, marginLeft: "15px", background: "#6b7280" }}
          >
            Getting Started
          </button>
        </div>
      </div>

      {/* Login Modal */}
      {showLoginModal && (
        <div style={modalOverlay}>
          <div style={modalContent}>
            <h2>Enter Wallet Address</h2>
            <input
              type="text"
              placeholder="0.0.xxxxx"
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              style={inputStyle}
            />
            <div style={{ marginTop: "20px" }}>
              <button onClick={handleLogin} style={btnStyle}>Continue</button>
              <button
                onClick={() => setShowLoginModal(false)}
                style={{ ...btnStyle, background: "#6b7280", marginLeft: "10px" }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Getting Started Modal */}
      {showGuideModal && (
        <div style={modalOverlay}>
          <div style={modalContent}>
            <h2>How to Use Attendify</h2>
            <ul style={{ textAlign: "left", marginTop: "15px", lineHeight: "1.8" }}>
              <li>Register your face once through the registration page.</li>
              <li>During class, face the camera to mark attendance.</li>
              <li>Tutors can view attendance per unit on their dashboard.</li>
              <li>Tutors can export attendance records for any date.</li>
              <li>Reward tokens are sent to your wallet based on attendance.</li>
            </ul>
            <button
              onClick={() => setShowGuideModal(false)}
              style={{ ...btnStyle, marginTop: "20px" }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Cursor blink animation */}
      <style>{`
        @keyframes blink {
          0%, 50%, 100% { opacity: 1; }
          25%, 75% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// --- Styles ---
const navBar = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100%",
  padding: "15px 40px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  background: "rgba(15, 23, 36, 0.9)",
  zIndex: 10,
};

const navLink = {
  color: "#93c5fd",
  textDecoration: "none",
  fontWeight: "700",
  marginRight: "60px",
};

const headingStyle = {
  fontSize: "5rem",
  fontWeight: "900",
  color: "#60a5fa",
  textAlign: "center",
  textShadow: "0 0 10px #60a5fa, 0 0 20px #3b82f6",
  marginBottom: "20px",
  fontFamily: "'Bungee', cursive",
};

const cursorStyle = {
  display: "inline-block",
  marginLeft: "5px",
  color: "#facc15",
  animation: "blink 1s infinite",
};

const subText = {
  fontSize: "1.2rem",
  marginBottom: "30px",
  color: "#a8b3c8",
};

const btnStyle = {
  padding: "12px 24px",
  fontSize: "1rem",
  border: "none",
  borderRadius: "8px",
  background: "#2563eb",
  color: "white",
  cursor: "pointer",
  transition: "0.3s",
};

const inputStyle = {
  padding: "10px",
  width: "100%",
  borderRadius: "8px",
  border: "1px solid #374151",
  background: "#0f172a",
  color: "#e6eef8",
};

const modalOverlay = {
  position: "fixed",
  top: 0, left: 0,
  width: "100%", height: "100%",
  background: "rgba(0,0,0,0.6)",
  display: "flex", justifyContent: "center", alignItems: "center",
  zIndex: 20,
};

const modalContent = {
  background: "#1e293b",
  padding: "30px",
  borderRadius: "12px",
  width: "400px",
  maxWidth: "90%",
  textAlign: "center",
  color: "#e6eef8",
  boxShadow: "0 8px 20px rgba(0,0,0,0.7)",
};
