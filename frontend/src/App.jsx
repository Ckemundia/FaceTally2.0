import React from "react";
import { Routes, Route, Link } from "react-router-dom";
import Home from "./pages/Home";
import TutorDashboard from "./pages/TutorDashboard";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";

function App() {
  return (
    <>
      <nav style={{ marginBottom: 20 }}>
        <Link to="/" style={{ marginRight: 10 }}>Home</Link>
        <Link to="/register" style={{ marginRight: 10 }}>Register</Link>
        <Link to="/dashboard" style={{ marginRight: 10 }}>Dashboard</Link>
        <Link to="/tutor" style={{ marginRight: 10 }}>TutorDashboard</Link>
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/tutor" element={<TutorDashboard />} />
      </Routes>
    </>
  );
}

export default App;
