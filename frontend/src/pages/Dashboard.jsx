import React, { useEffect, useState } from "react";
import WebcamFace from "../components/WebcamFace";

export default function Dashboard() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  async function fetchHistory() {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/attendance/history");
      if (!res.ok) throw new Error("Failed to fetch attendance history");
      const json = await res.json();
      setRecords(json.records || []);
    } catch (err) {
      console.error("History fetch error:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 5000); // refresh every 5s
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ display: "flex", gap: "20px", padding: "20px" }}>
      {/* Left: Live Camera */}
      <div style={{ flex: 2 }}>
        <WebcamFace onAttendanceMarked={fetchHistory} />
      </div>

      {/* Right: Attendance History */}
      <div style={{ flex: 1 }}>
        <h3>Attendance History</h3>
        {loading ? (
          <p>Loading...</p>
        ) : records.length === 0 ? (
          <p>No attendance records yet.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {records.map((rec, idx) => (
              <li
                key={idx}
                style={{
                  borderBottom: "1px solid #ddd",
                  padding: "8px 0",
                }}
              >
                <strong>{rec.student_id}</strong> — {rec.unit} <br />
                <small>
                  {new Date(rec.timestamp).toLocaleString()}{" "}
                  {rec.txid && (
                    <span style={{ color: "green" }}> (Rewarded ✅)</span>
                  )}
                </small>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
