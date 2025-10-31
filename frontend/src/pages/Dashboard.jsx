import React, { useEffect, useState } from "react";
import WebcamFace from "../components/WebcamFace";
import HCSMessages from "../components/HCSMessages";
import "../style.css";
import SmallMap from "../components/SmallMap";
import { useNavigate } from "react-router-dom";


export default function Dashboard() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [units, setUnits] = useState([]);
  const [selectedUnit, setSelectedUnit] = useState("");
  const [currentStudent, setCurrentStudent] = useState(null);
  const [latestRecord, setLatestRecord] = useState(null);
  const [activeTab, setActiveTab] = useState("live");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [faceMatched, setFaceMatched] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [studentLocation, setStudentLocation] = useState(null);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();


  useEffect(() => {
    if (studentLocation && units.length > 0) {
      const timer = setTimeout(() => setReady(true), 500);
      return () => clearTimeout(timer);
    } else {
      setReady(false);
    }
  }, [studentLocation?.lat, studentLocation?.lng]);

  // Trigger map resize when ready
  useEffect(() => {
    if (ready) {
      setTimeout(() => window.dispatchEvent(new Event("resize")), 300);
    }
  }, [ready]);


  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setStudentLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        (err) => console.warn("Geolocation error:", err),
        { enableHighAccuracy: true }
      );
    }
  }, []);


  const fetchHistory = async (studentId = null) => {
    try {
      const url = studentId
        ? `${import.meta.env.VITE_API_BASE_URL}/api/attendance/history?student_id=${studentId}`
        : `${import.meta.env.VITE_API_BASE_URL}/api/attendance/history`;
      const res = await fetch(url);
      const data = await res.json();
      setRecords(data.records ?? []);
    } catch (err) {
      console.error("❌ History fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const studentId = currentStudent?.student_id || null;
    fetchHistory(studentId);
    const interval = setInterval(() => fetchHistory(studentId), 5000);
    return () => clearInterval(interval);
  }, [currentStudent]);

  const fetchUnits = async (student_id) => {
    if (!student_id) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/myunits/${student_id}`);
      const data = await res.json();
      let unitsData = data.units ?? [];

      // ✅ Immediately fetch each unit’s status (instead of waiting for interval)
      const unitsWithStatus = await Promise.all(
        unitsData.map(async (u) => {
          const status = await fetchUnitStatus(u.unit_code);
          return status ? { ...u, ...status } : u;
        })
      );

      setUnits(unitsWithStatus);

      if (unitsWithStatus.length > 0 && !selectedUnit)
        setSelectedUnit(unitsWithStatus[0].unit_code);

      // ✅ Trigger map reflow once both data & statuses are ready
      setTimeout(() => {
        window.dispatchEvent(new Event("resize"));
        setReady(true); // ensures map renders immediately
      }, 400);
    } catch (err) {
      console.error("❌ Units fetch error:", err);
    }
  };

  const fetchUnitStatus = async (unit_code) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/unit/status/${unit_code}`);
      const data = await res.json();
      return data; // { is_active, end_time, location_radius, etc. }
    } catch (err) {
      console.error("❌ Unit status fetch error:", err);
      return null;
    }
  };


  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!currentStudent?.student_id) return;
    fetchUnits(currentStudent.student_id);

    const interval = setInterval(async () => {
      if (!Array.isArray(units) || units.length === 0) return;

      try {
        const updatedUnits = await Promise.all(
          units.map(async (u) => {
            const status = await fetchUnitStatus(u.unit_code);
            return status ? { ...u, ...status } : u;
          })
        );
        setUnits(updatedUnits);
      } catch (err) {
        console.error("❌ Error updating unit statuses:", err);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [currentStudent]);


  // Fix for Leaflet map refresh when switching tabs
  useEffect(() => {
    if (activeTab === "units") {
      setTimeout(() => {
        // Trigger resize event so all Leaflet maps adjust properly
        window.dispatchEvent(new Event("resize"));
      }, 300);
    }
  }, [activeTab]);


  const handleAttendanceMarked = ({ student, attendanceRecorded, rewardInfo }) => {
    if (student && !attendanceRecorded) {
      setCurrentStudent(student);
      setFaceMatched(true);
      setActiveTab("units");
    } else if (attendanceRecorded) {
      setLatestRecord({ student, unit: selectedUnit });
      fetchHistory();

      // 🟢 Show modal feedback
      if (rewardInfo) {
        setModalMessage(
          `✅ Attendance marked and reward sent!\nTXID: ${rewardInfo.tx_id || "N/A"}`
        );
      } else {
        setModalMessage(`✅ Attendance marked successfully.`);
      }
      setModalVisible(true);
    }
  };


  const canClaimReward = latestRecord
    ? records.some(
      (r) =>
        r.student_id === latestRecord.student.student_id &&
        r.unit === latestRecord.unit &&
        !r.txid
    )
    : false;

  const claimReward = async () => {
    if (!latestRecord?.student?.wallet) return alert("⚠️ Wallet not found");

    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/reward/give`, {
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

  const safeUnits = Array.isArray(units) ? units : [];
  const selectedUnitObj = safeUnits.find((u) => u.unit_code === selectedUnit);
  const unitDisabled = !selectedUnitObj || !selectedUnitObj.is_active;

  const handleUnitClick = (unit) => {
    setSelectedUnit(unit.unit_code);  // Set which unit we’re marking
    setFaceMatched(false);            // Resume webcam detection
    setActiveTab("live");             // Go back to webcam tab
  };

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "#0f1724",
        color: "#e6eef8",
        fontFamily: "Inter, sans-serif",
      }}
    >
      {/* Circles background */}
      <div className="circle circle1"></div>
      <div className="circle circle2"></div>
      <div className="circle circle3"></div>
      <div className="circle circle4"></div>
      <div className="circle circle5"></div>
      <div className="circle circle6"></div>

      {/* Sidebar */}
      <aside
        style={{
          width: sidebarOpen ? 260 : 72,
          transition: "all 0.3s ease",
          backdropFilter: "blur(14px)",
          background: "rgba(17, 25, 40, 0.6)",
          borderRight: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          transform: sidebarOpen ? "translateX(0)" : "translateX(-20%)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            justifyContent: "space-between",
            padding: 16,
          }}
        >
          {/* --- Top section with logo and toggle button --- */}
          <div>
            {/* Logo */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: sidebarOpen ? "flex-start" : "center",
                marginBottom: 20,
              }}
            >
              <img
                src="/logo.png"
                alt="Logo"
                style={{
                  height: 100,
                  width: 100,
                  borderRadius: "50%",
                  transition: "all 0.3s ease",
                }}
              />

              {sidebarOpen && (
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: "1.1rem",
                    color: "#7dd3fc",
                    transition: "opacity 0.3s ease",
                    marginLeft: 10,
                  }}
                >
                  Student Dashboard
                </span>
              )}
            </div>

            {/* Profile Section */}
            <div
              style={{
                display: "flex",
                flexDirection: sidebarOpen ? "row" : "column",
                alignItems: "center",
                justifyContent: sidebarOpen ? "flex-start" : "center",
                gap: sidebarOpen ? 12 : 6,
                marginBottom: 24,
                transition: "all 0.3s ease",
              }}
            >
              <img
                src="/profile.jpeg"
                alt="Profile"
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: "50%",
                  border: "2px solid #38bdf8",
                  objectFit: "cover",
                  boxShadow: "0 0 10px rgba(56, 189, 248, 0.5)",
                }}
              />

              {sidebarOpen && (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span className="text-white font-semibold text-sm">
                    {currentStudent?.name || "Student"}
                  </span>
                  <span className="text-gray-400 text-xs">
                    ID: {currentStudent?.student_id || "—"}
                  </span>
                </div>
              )}
            </div>


            {/* Toggle Button */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{
                background: "transparent",
                border: "none",
                color: "#22d3ee",
                fontSize: "1.5rem",
                marginBottom: "10px",
                padding: "8px",
                borderRadius: "10px",
                boxShadow: "0 0 8px rgba(34,211,238,0.5)",
                cursor: "pointer",
                transition: "all 0.3s ease",
                textShadow: "0 0 6px rgba(34,211,238,0.7)",
              }}
            >
              {sidebarOpen ? "«" : "☰"}
            </button>

            {/* Navigation */}
            <nav
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                transition: "opacity 0.3s",
              }}
            >
              {[
                { id: "live", icon: "📷", label: "Live Camera" },
                { id: "units", icon: "📘", label: "My Units" },
                { id: "history", icon: "📜", label: "Attendance History" },
                { id: "ledger", icon: "🌐", label: "HCS Ledger" },
                { id: "rewards", icon: "🎁", label: "Rewards" },
                { id: "game", icon: "🎮", label: "Play Game" },
              ].map(({ id, icon, label }) => (
                <button
                  key={id}
                  onClick={() => {
                    if (id === "game") {
                      navigate("/game"); // go to the FaceTallyGame page
                    } else {
                      setActiveTab(id);
                    }
                  }}

                  className={`flex items-center gap-3 p-3 rounded-lg w-full text-left transition-all duration-300 ${activeTab === id ? "text-cyan-400" : "text-slate-200"
                    }`}
                  style={{
                    background: "transparent",
                    border: "none",
                    boxShadow:
                      activeTab === id
                        ? "0 0 10px rgba(34,211,238,0.8)"
                        : "none",
                    textShadow:
                      activeTab === id
                        ? "0 0 8px rgba(34,211,238,0.8)"
                        : "0 0 4px rgba(148,163,184,0.4)",
                  }}
                >
                  <span style={{ fontSize: "1.2rem" }}>{icon}</span>
                  {sidebarOpen && (
                    <span
                      className={`font-semibold ${activeTab === id ? "text-cyan-400" : "text-slate-300"
                        }`}
                    >
                      {label}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>

          {/* --- Footer --- */}
          <div
            style={{
              fontSize: "12px",
              color: "#9ca3af",
              textAlign: sidebarOpen ? "left" : "center",
              paddingTop: 10,
              borderTop: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            © {new Date().getFullYear()} FaceTally
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, padding: "32px" }}>
        {activeTab === "live" && (
          <section>
            <h2>📷 Live Camera</h2>
            <WebcamFace
              selectedUnit={selectedUnit || null}
              onAttendanceMarked={handleAttendanceMarked}
              disabled={!selectedUnit || unitDisabled}
              pauseDetection={faceMatched} // 👈 stop detection after match
            />
          </section>
        )}

        {activeTab === "history" && (
          <section>
            <h2>📜 Attendance History</h2>
            {loading ? (
              <p>Loading...</p>
            ) : (
              <ul>
                {records.map((rec, i) => (
                  <li key={i}>
                    <strong>{rec.student_id}</strong> — {rec.unit}
                    <br />
                    <small>
                      {new Date(rec.timestamp).toLocaleString()}{" "}
                      {rec.txid && <span className="rewarded">Rewarded ✅</span>}
                    </small>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {activeTab === "ledger" && (
          <section>
            <h2>🌐 HCS Ledger</h2>
            <HCSMessages />
          </section>
        )}

        {activeTab === "rewards" && (
          <section>
            <h2>🎁 Rewards</h2>
            <p>Rewards are now sent automatically after marking attendance.</p>

            <ul style={{ marginTop: "16px" }}>
              {records
                .filter((r) => r.txid)
                .map((rec, i) => (
                  <li key={i}>
                    <strong>{rec.unit}</strong> — {new Date(rec.timestamp).toLocaleString()}
                    <br />
                    <small>TXID: {rec.txid}</small>
                  </li>
                ))}
            </ul>
          </section>
        )}

        {activeTab === "units" && (
          <section>
            <h2 style={{ color: "#7dd3fc", marginBottom: "20px" }}>📘 My Units</h2>

            {units.length === 0 ? (
              <p>No units available. Try marking attendance to load them.</p>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                  gap: "20px",
                }}
              >
                {units.map((u, i) => (
                  <div
                    key={i}
                    onClick={() => handleUnitClick(u)}
                    style={{
                      background:
                        selectedUnit === u.unit_code
                          ? "rgba(56,189,248,0.25)"
                          : "rgba(30,41,59,0.6)",
                      cursor: "pointer",
                      border:
                        selectedUnit === u.unit_code
                          ? "1px solid #38bdf8"
                          : "1px solid rgba(255,255,255,0.08)",
                      borderRadius: "16px",
                      padding: "20px",
                      backdropFilter: "blur(10px)",
                      boxShadow: "0 8px 20px rgba(0,0,0,0.4)",
                      transition: "all 0.3s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-5px)";
                      e.currentTarget.style.boxShadow =
                        "0 8px 25px rgba(56,189,248,0.5)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow =
                        "0 8px 20px rgba(0,0,0,0.4)";
                    }}
                  >
                    <h3
                      style={{
                        color: "#38bdf8",
                        marginBottom: "6px",
                        fontWeight: "600",
                        fontSize: "1.1rem",
                      }}
                    >
                      {u.unit_name}
                    </h3>

                    <p style={{ color: "#9ca3af", marginBottom: "10px" }}>
                      Code: {u.unit_code}
                    </p>

                    <p
                      style={{
                        color: u.is_active ? "#34d399" : "#f87171",
                        fontWeight: "500",
                      }}
                    >
                      {u.is_active ? "Active ✅" : "Inactive ❌"}
                    </p>

                    {u.is_active && u.remaining_time && (
                      <p style={{ color: "#93c5fd", marginTop: "6px" }}>
                        ⏰ Ends in: {Math.ceil(u.remaining_time / 60)} mins
                      </p>
                    )}

                    {/* 🗺️ Small Map Preview */}
                    {ready && studentLocation?.lat && studentLocation?.lng ? (
                      u.location_lat && u.location_lng ? (
                        <SmallMap
                          key={`${u.unit_code}-${u.location_lat}-${u.location_lng}-${studentLocation.lat}-${studentLocation.lng}`}
                          unitLocation={{ lat: u.location_lat, lng: u.location_lng }}
                          radius={u.location_radius || 100}
                          studentLocation={studentLocation}
                        />
                      ) : (
                        <p className="text-gray-500">Waiting for unit location data...</p>
                      )
                    ) : (
                      <p className="text-gray-500">Fetching your location...</p>
                    )}

                  </div>
                ))}

              </div>
            )}
          </section>
        )}
        {modalVisible && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              backgroundColor: "rgba(0,0,0,0.7)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 9999,
            }}
          >
            <div
              style={{
                background: "#1e293b",
                borderRadius: "12px",
                padding: "30px",
                color: "#e2e8f0",
                width: "90%",
                maxWidth: "420px",
                boxShadow: "0 0 20px rgba(34,211,238,0.4)",
                textAlign: "center",
              }}
            >
              <h3 style={{ color: "#38bdf8", marginBottom: "10px" }}>🎉 Success!</h3>
              <p
                style={{
                  marginBottom: "20px",
                  whiteSpace: "pre-line",
                }}
              >
                {modalMessage}
              </p>

              <button
                onClick={() => setModalVisible(false)}
                style={{
                  background: "#38bdf8",
                  border: "none",
                  color: "#0f172a",
                  padding: "10px 18px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                OK
              </button>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}