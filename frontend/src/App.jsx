import React, { useState } from "react";
import { Routes, Route, NavLink, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Home from "./pages/Home";
import TutorDashboard from "./pages/TutorDashboard";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import FacetallyGame from "./components/FacetallyGame";
import "leaflet/dist/leaflet.css";

function App() {
  const location = useLocation();
  const showNav = location.pathname !== "/";
  const [isVisible, setIsVisible] = useState(true);

  // Handle mouse position to show/hide navbar
  const handleMouseMove = (e) => {
    if (e.clientY < 80) {
      // near top of screen
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  };

  const navStyle = {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "1.2rem",
    padding: "14px 24px",
    borderRadius: "16px",
    backdropFilter: "blur(14px) saturate(160%)",
    background: "rgba(255, 255, 255, 0.04)",
    boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    transition: "opacity 0.4s ease, transform 0.4s ease",
  };

  const linkBase = {
    textDecoration: "none",
    fontWeight: 500,
    padding: "10px 18px",
    borderRadius: "10px",
    transition: "all 0.25s ease",
    position: "relative",
  };

  return (
    <div onMouseMove={handleMouseMove}>
      <AnimatePresence>
        {showNav && isVisible && (
          <motion.nav
            style={navStyle}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {[
              { to: "/", label: "🏠 Home" },
              { to: "/register", label: "🧍 Register" },
              { to: "/dashboard", label: "📊 Dashboard" },
              { to: "/tutor", label: "🎓 Tutor Dashboard" },
              { to: "/game", label: "🎮 Game" },
            ].map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                style={({ isActive }) => ({
                  ...linkBase,
                  color: isActive ? "#7fe9ff" : "#aebbe3",
                  textShadow: isActive
                    ? "0 0 6px rgba(127,233,255,0.6)"
                    : "0 0 3px rgba(127,233,255,0.2)",
                })}
              >
                {({ isActive }) => (
                  <>
                    {link.label}
                    {isActive && (
                      <motion.div
                        layoutId="nav-underline"
                        style={{
                          position: "absolute",
                          bottom: 0,
                          left: 0,
                          right: 0,
                          height: 3,
                          borderRadius: 8,
                          background:
                            "linear-gradient(90deg, rgba(127,233,255,0.8), rgba(0,200,255,0.5))",
                          boxShadow: "0 0 10px rgba(127,233,255,0.5)",
                        }}
                        transition={{
                          type: "spring",
                          stiffness: 350,
                          damping: 25,
                        }}
                      />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </motion.nav>
        )}
      </AnimatePresence>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/tutor" element={<TutorDashboard />} />
        <Route path="/game" element={<FacetallyGame />} />
      </Routes>
    </div>
  );
}

export default App;
