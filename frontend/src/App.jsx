import React, { useState } from "react";
import Register from "./components/Register";
import WebcamFace from "./components/WebcamFace";

export default function App() {
  const [view, setView] = useState("home");

  return (
    <div style={{ padding: 20, fontFamily: "sans-serif" }}>
      <h2>Face Recognition Attendance System</h2>

      {/* Navigation Buttons */}
      <div style={{ marginBottom: 16 }}>
        <button
          onClick={() => setView("home")}
          style={{ marginRight: 8, padding: "6px 12px" }}
        >
          Home
        </button>
        <button
          onClick={() => setView("register")}
          style={{ marginRight: 8, padding: "6px 12px" }}
        >
          Register Student
        </button>
        <button
          onClick={() => setView("attendance")}
          style={{ padding: "6px 12px" }}
        >
          Attendance
        </button>
      </div>

      {/* Views */}
      {view === "home" && (
        <div>
          <p>Welcome 👋</p>
          <p>Select <b>Register</b> to add a student, or <b>Attendance</b> to mark attendance.</p>
        </div>
      )}

      {view === "register" && <Register />}
      {view === "attendance" && <WebcamFace />}
    </div>
  );
}
