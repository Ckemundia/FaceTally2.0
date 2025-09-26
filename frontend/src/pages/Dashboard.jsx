import React, { useEffect, useState } from "react";
import WebcamFace from "../components/WebcamFace";

export default function Dashboard() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [units, setUnits] = useState([]);
  const [selectedUnit, setSelectedUnit] = useState("");
  const [currentStudent, setCurrentStudent] = useState(null);
  const [latestRecord, setLatestRecord] = useState(null);

  /** ✅ Fetch attendance history */
  const fetchHistory = async () => {
    try {
      const res = await fetch("/api/attendance/history");
      if (!res.ok) throw new Error("Failed to fetch attendance history");
      const data = await res.json();
      setRecords(data.records ?? data.rows ?? []);
    } catch (err) {
      console.error("❌ History fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  /** ✅ Fetch units for selected student */
  const fetchUnits = async () => {
    if (!currentStudent?.student_id) return; // 🛑 Skip if no student selected
    try {
      const res = await fetch(`/api/units/myunits/${currentStudent.student_id}`);
      if (!res.ok) throw new Error("Failed to fetch units");
      const data = await res.json();
      const unitsData = data.units ?? [];
      setUnits(unitsData);
      if (unitsData.length > 0 && !selectedUnit) {
        setSelectedUnit(unitsData[0].unit_code);
      }
    } catch (err) {
      console.error("❌ Units fetch error:", err);
    }
  };

  /** ⏱ Fetch attendance history every 5 seconds */
  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 5000);
    return () => clearInterval(interval);
  }, []);

  /** 🔁 Re-fetch units when student changes */
  useEffect(() => {
    fetchUnits();
  }, [currentStudent]);

  /** 📸 Triggered when attendance is marked */
  const handleAttendanceMarked = ({ student, attendanceRecorded }) => {
    setCurrentStudent(student);
    if (attendanceRecorded) {
      setLatestRecord({ student, unit: selectedUnit });
      fetchHistory(); // refresh list
    }
  };

  /** 🎯 Check if latest record is eligible for reward */
  const canClaimReward = latestRecord
    ? records.some(
        (r) =>
          r.student_id === latestRecord.student.student_id &&
          r.unit === latestRecord.unit &&
          !r.txid
      )
    : false;

  /** 💰 Claim reward */
  const claimReward = async () => {
    if (!currentStudent?.wallet) return alert("⚠️ Wallet not found");
    try {
      const res = await fetch("/api/reward/give", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_wallet: currentStudent.wallet,
          amount: 1,
        }),
      });
      const data = await res.json();
      if (data.status === "success") {
        alert("🎉 Reward sent! TXID: " + data.tx_id);
        fetchHistory();
        setLatestRecord(null);
      } else {
        alert("⚠️ Reward failed: " + (data.message || "Unknown error"));
      }
    } catch (err) {
      console.error("❌ Reward request failed:", err);
      alert("⚠️ Reward request failed");
    }
  };

  const selectedUnitObj = units.find((u) => u.unit_code === selectedUnit);
  const unitDisabled =
    !selectedUnitObj ||
    selectedUnitObj.status !== "active" ||
    selectedUnitObj.remaining_slots === 0;

  return (
    <div
      style={{
        position: "relative",
        minHeight: "100vh",
        overflow: "hidden",
        background: "#0f172a",
        padding: "20px",
      }}
    >
      {/* Background Circles */}
      {[...Array(6)].map((_, i) => (
        <div key={i} className={`circle circle${i + 1}`} />
      ))}

      {/* Main Dashboard Card */}
      <div
        style={{
          margin: "40px auto",
          padding: "30px",
          maxWidth: "1300px",
          display: "flex",
          gap: "30px",
          borderRadius: "20px",
          background: "rgba(15,23,42,0.95)",
          boxShadow: "0 0 30px rgba(0,0,0,0.7)",
        }}
      >
        {/* LEFT SECTION */}
        <div style={{ flex: 2 }}>
          {/* Greeting */}
          {currentStudent && (
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "25px" }}>
              <div
                style={{
                  width: "55px",
                  height: "55px",
                  borderRadius: "50%",
                  background: "#2563eb",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontWeight: "bold",
                  fontSize: "1.3rem",
                  boxShadow: "0 0 20px #2563eb",
                }}
              >
                {currentStudent.name?.[0]?.toUpperCase()}
              </div>
              <h2 style={{ color: "#60a5fa", textShadow: "0 0 6px #60a5fa" }}>
                Welcome, {currentStudent.name} 👋
              </h2>
            </div>
          )}

          <h2 style={{ color: "#60a5fa", textShadow: "0 0 5px #60a5fa" }}>📷 Live Camera</h2>

          {/* Unit Selector */}
          {units.length > 0 && (
            <div style={{ marginBottom: "15px" }}>
              <label style={{ color: "#cbd5e1", marginRight: "10px" }}>
                Select Unit:
              </label>
              <select
                value={selectedUnit}
                onChange={(e) => setSelectedUnit(e.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid #2563eb",
                  background: "#1e293b",
                  color: "#fff",
                }}
              >
                {units.map((u) => (
                  <option
                    key={u.unit_code}
                    value={u.unit_code}
                    disabled={u.status !== "active" || u.remaining_slots === 0}
                  >
                    {u.unit_name}{" "}
                    {u.status !== "active" ? "(Disabled)" : ""}{" "}
                    {u.remaining_slots !== undefined
                      ? `(${u.remaining_slots} left)`
                      : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Webcam Component */}
          <WebcamFace
            selectedUnit={selectedUnit || null}
            onAttendanceMarked={handleAttendanceMarked}
            disabled={!selectedUnit || unitDisabled}
          />

          {unitDisabled && selectedUnit && (
            <p style={{ color: "#f87171", marginTop: "10px" }}>
              ⚠️ This unit is currently unavailable for attendance.
            </p>
          )}
        </div>

        {/* RIGHT SECTION */}
        <div style={{ flex: 1 }}>
          <h2 style={{ color: "#34d399", textShadow: "0 0 6px #34d399" }}>
            📜 Attendance History
          </h2>
          <div
            style={{
              maxHeight: "500px",
              overflowY: "auto",
              border: "1px solid #374151",
              padding: "15px",
              borderRadius: "10px",
              background: "#111827",
            }}
          >
            {loading ? (
              <p style={{ color: "#fff" }}>Loading...</p>
            ) : records.length === 0 ? (
              <p style={{ color: "#fff" }}>No attendance records yet.</p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0 }}>
                {records.map((rec, idx) => (
                  <li key={idx} style={{ padding: "10px 0", color: "#e6eef8", borderBottom: "1px solid #374151" }}>
                    <strong style={{ color: "#fbbf24" }}>{rec.student_id}</strong> —{" "}
                    <span style={{ color: "#93c5fd" }}>{rec.unit}</span>
                    <br />
                    <small>
                      {new Date(rec.timestamp).toLocaleString()}{" "}
                      {rec.txid && <span style={{ color: "#22c55e" }}> (Rewarded ✅)</span>}
                    </small>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* 🎁 Reward Modal */}
      {latestRecord && (
        <div
          onClick={() => setLatestRecord(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#1f2937",
              padding: "30px",
              borderRadius: "15px",
              textAlign: "center",
              maxWidth: "400px",
              width: "100%",
            }}
          >
            <h2 style={{ color: "#fbbf24", textShadow: "0 0 10px #fbbf24" }}>🎁 Claim Your Reward</h2>
            <p style={{ color: "#e6eef8" }}>Attendance recorded for {latestRecord.unit}.</p>

            {canClaimReward ? (
              <button
                onClick={claimReward}
                style={{
                  marginTop: "10px",
                  padding: "12px 22px",
                  background: "#facc15",
                  borderRadius: "10px",
                  border: "none",
                  fontWeight: "bold",
                  color: "#0f172a",
                  cursor: "pointer",
                }}
              >
                Claim Today’s Reward
              </button>
            ) : (
              <p style={{ color: "#34d399" }}>Reward already claimed ✅</p>
            )}

            <button
              onClick={() => setLatestRecord(null)}
              style={{
                marginTop: "20px",
                padding: "10px 20px",
                background: "#ef4444",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
