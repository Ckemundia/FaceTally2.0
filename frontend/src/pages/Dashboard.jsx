import React, { useEffect, useState } from "react";
import WebcamFace from "../components/WebcamFace";
import HCSMessages from "../components/HCSMessages";

export default function Dashboard() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [units, setUnits] = useState([]);
  const [selectedUnit, setSelectedUnit] = useState("");
  const [currentStudent, setCurrentStudent] = useState(null);
  const [latestRecord, setLatestRecord] = useState(null);

  /** Fetch attendance history */
  /** Fetch attendance history */
const fetchHistory = async (studentId = null) => {
  try {
    const url = studentId
      ? `/api/attendance/history?student_id=${studentId}`
      : `/api/attendance/history`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch attendance history");
    const data = await res.json();
    setRecords(data.records ?? []);
  } catch (err) {
    console.error("❌ History fetch error:", err);
  } finally {
    setLoading(false);
  }
};

/** Re-fetch history every 5 seconds */
useEffect(() => {
  // 🔹 Always fetch history for the current student (if available)
  const studentId = currentStudent?.student_id || null;
  fetchHistory(studentId);
  const interval = setInterval(() => fetchHistory(studentId), 5000);
  return () => clearInterval(interval);
}, [currentStudent]);

  /** Fetch units for selected student */
  const fetchUnits = async (student_id) => {
    if (!student_id) return;
    try {
      const res = await fetch(`/api/units/myunits/${student_id}`);
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

  /** Re-fetch history every 5 seconds */
  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 5000);
    return () => clearInterval(interval);
  }, []);

  /** Re-fetch units when current student changes */
  useEffect(() => {
    if (currentStudent?.student_id) {
      fetchUnits(currentStudent.student_id);
    }
  }, [currentStudent]);

  /** Handle face recognition or attendance marking */
  const handleAttendanceMarked = ({ student, attendanceRecorded }) => {
    if (student && !attendanceRecorded) {
      setCurrentStudent(student);
    } else if (attendanceRecorded) {
      setLatestRecord({ student, unit: selectedUnit });
      fetchHistory();
    }
  };

  /** Reward check */
const canClaimReward = latestRecord
  ? records.some(
      (r) =>
        r.student_id === latestRecord.student.student_id &&
        r.unit === latestRecord.unit &&
        !r.txid
    )
  : false;

  /** Claim reward */
const claimReward = async () => {
  if (!latestRecord?.student?.wallet) return alert("⚠️ Wallet not found");

  try {
    const res = await fetch("/api/reward/give", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        student_wallet: latestRecord.student.wallet,
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
  const unitDisabled = !selectedUnitObj || !selectedUnitObj.is_active;

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
      {[...Array(6)].map((_, i) => (
        <div key={i} className={`circle circle${i + 1}`} />
      ))}

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
        {/* LEFT */}
        <div style={{ flex: 2 }}>
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

          {/* Unit Selector + Mark Button */}
          {units.length > 0 && (
            <div style={{ marginBottom: "15px", display: "flex", alignItems: "center", gap: "10px" }}>
              <label style={{ color: "#cbd5e1" }}>Select Unit:</label>
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
                  <option key={u.unit_code} value={u.unit_code} disabled={!u.is_active}>
                    {u.unit_name} {u.is_active ? "" : "(Disabled)"}
                  </option>
                ))}
              </select>

              {currentStudent && selectedUnit && (
                  <button
            onClick={async () => {
              if (!currentStudent) return;
              if (!selectedUnitObj?.is_active) {
                alert("⚠️ Cannot mark attendance for disabled unit.");
                return;
              }
              try {
                const res = await fetch("/api/attendance", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    student_id: currentStudent.student_id,
                    unit: selectedUnit,
                  }),
                });
                const data = await res.json();
                if (data.ok) {
                  alert(`🎉 Attendance marked for ${selectedUnit}`);
                  handleAttendanceMarked({ student: currentStudent, attendanceRecorded: true });

                  // 🔹 Publish to Hedera Consensus Service
                  await fetch("/api/hcs/publish", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      student_id: currentStudent.student_id,
                      unit: selectedUnit,
                      status: "present",
                    }),
                  });

                  // 🔹 Reset student so detection resumes
                  setCurrentStudent(null);
                } else {
                  alert("⚠️ Attendance failed: " + (data.detail || "Unknown error"));
                }
              } catch (err) {
                console.error(err);
                alert("❌ Attendance request failed");
              }
            }}
            disabled={unitDisabled}
            style={{
              padding: "8px 16px",
              background: unitDisabled ? "#ccc" : "#34d399",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              cursor: unitDisabled ? "not-allowed" : "pointer",
            }}
          >
            Mark Attendance
          </button>

                )}
            </div>
          )}

          {/* Webcam */}

            <WebcamFace
              selectedUnit={selectedUnit || null}
              onAttendanceMarked={handleAttendanceMarked}
              disabled={!selectedUnit || unitDisabled}
              pauseDetection={!!currentStudent} // 🔹 added prop
            />


          {unitDisabled && selectedUnit && (
            <p style={{ color: "#f87171", marginTop: "10px" }}>
              ⚠️ This unit is currently unavailable for attendance.
            </p>
          )}
        </div>

        {/* RIGHT */}
        <div style={{ flex: 1 }}>
          <h2 style={{ color: "#34d399", textShadow: "0 0 6px #34d399" }}>📜 Attendance History</h2>
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
        {/* 🌐 Hedera Ledger Viewer */}
<h2 style={{ color: "#60a5fa", textShadow: "0 0 6px #60a5fa" }}>🌐 HCS Ledger</h2>
<div
  style={{
    maxHeight: "300px",
    overflowY: "auto",
    border: "1px solid #374151",
    padding: "15px",
    borderRadius: "10px",
    background: "#111827",
  }}
>
  <HCSMessages />
</div>

      </div>

      {/* Reward Modal */}
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
