import React, { useEffect, useMemo, useState } from "react";
import {
  FiUsers,
  FiGift,
  FiDownload,
  FiMenu,
  FiChevronLeft,
  FiCalendar,
  FiClock,
  FiBook
} from "react-icons/fi";
import RecordsView from "../components/RecordsView";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Dialog } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Progress } from "../components/ui/progress";
import { Select } from "../components/ui/select";

import "../style.css";
import logo from "../logo.png";


export default function TutorDashboard() {
  // --- State as before ---
  const [attendance, setAttendance] = useState([]);
  const [students, setStudents] = useState([]);
  const [stats, setStats] = useState({ rewards: 0, total: 0, present: 0 });
  const [allUnits, setAllUnits] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedUnit, setSelectedUnit] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [search, setSearch] = useState("");

  const [unitEnabled, setUnitEnabled] = useState({});


  const [showUnitModal, setShowUnitModal] = useState(false);
  const [unitModalValue, setUnitModalValue] = useState("");
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadUnit, setDownloadUnit] = useState("");
  const [downloadDate, setDownloadDate] = useState("");

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("units");

  const [timeLimitMap, setTimeLimitMap] = useState({});
  const [geoLimitMap, setGeoLimitMap] = useState({});

  const [activeLimits, setActiveLimits] = useState({});
  const [savingMap, setSavingMap] = useState({});



  useEffect(() => {
    if (allUnits.length > 0) {
      loadLimits();
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allUnits.length]);

  // Keep the function clean (NO hooks inside)
  const loadLimits = async () => {
    if (!allUnits.length) return;
    try {
      const newTimeMap = {};
      const newGeoMap = {};
      const newActive = {};

      for (const u of allUnits) {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/unit/status/${u.code}`);
        if (!res.ok) continue;
        const data = await res.json();

        newTimeMap[u.code] = data.time_limit
          ? {
            start: data.time_limit.split("-")[0],
            end: data.time_limit.split("-")[1],
          }
          : { start: "", end: "" };

        newGeoMap[u.code] = {
          enabled: !!data.location_lat,
          lat: data.location_lat || "",
          lng: data.location_lng || "",
          radius: data.location_radius || "",
        };

        if (data.time_limit || data.location_radius) {
          newActive[u.code] = {
            time_limit: data.time_limit,
            location_radius: data.location_radius || null,
          };
        }
      }

      // update state here 
      setTimeLimitMap(newTimeMap);
      setGeoLimitMap(newGeoMap);
      setActiveLimits(newActive);
    } catch (err) {
      console.error("❌ Failed to fetch limits:", err);
    }
  };



  // --- Data fetching ---
  useEffect(() => {
    let mounted = true;
    async function fetchAll() {
      setLoading(true);
      setError(null);
      try {
        const [attRes, statRes, usersRes, statusRes, unitsRes] =
          await Promise.allSettled([
            fetch(`${import.meta.env.VITE_API_BASE_URL}/api/attendance/history`),
            fetch(`${import.meta.env.VITE_API_BASE_URL}/api/tutor/stats`),
            fetch(`${import.meta.env.VITE_API_BASE_URL}/api/users`),
            fetch(`${import.meta.env.VITE_API_BASE_URL}/api/tutor/units/status`),
            fetch(`${import.meta.env.VITE_API_BASE_URL}/api/units`),
          ]);

        if (attRes.status === "fulfilled" && attRes.value.ok) {
          const a = await attRes.value.json();
          const rows = a.records ?? a.rows ?? a;
          if (mounted) setAttendance(Array.isArray(rows) ? rows : []);
        }

        if (statRes.status === "fulfilled" && statRes.value.ok) {
          const s = await statRes.value.json();
          if (mounted) setStats((p) => ({ ...p, ...s }));
        }

        if (unitsRes.status === "fulfilled" && unitsRes.value.ok) {
          const u = await unitsRes.value.json();
          const rows = u.units ?? u.rows ?? u;
          if (Array.isArray(rows) && mounted) {
            setAllUnits(
              rows.map((r) => ({
                code: r.unit_code ?? r.code ?? "N/A",
                name: r.unit_name ?? r.name ?? r.title ?? "Unnamed Unit",
              }))
            );
          }
        }

        if (usersRes.status === "fulfilled" && usersRes.value.ok) {
          const u = await usersRes.value.json();
          const rows = u.rows ?? u.users ?? u;
          if (Array.isArray(rows) && mounted) {
            const normalized = rows.map((r) => ({
              student_id: r.student_id ?? r.id,
              name: r.name ?? r.student_id ?? r.id,
            }));
            setStudents(normalized);
          }
        }

        if (statusRes.status === "fulfilled" && statusRes.value.ok) {
          const data = await statusRes.value.json();
          if (mounted && data.enabledMap) setUnitEnabled(data.enabledMap);
        }
      } catch {
        if (mounted) setError("Failed to load data");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchAll();
    return () => (mounted = false);
  }, []);

  // --- Derived and filtered data ---
  const units = useMemo(() => {
    const map = new Map();
    allUnits.forEach((u) => map.set(u.code, u));
    attendance.forEach((r) => {
      if (r.unit && !map.has(r.unit))
        map.set(r.unit, { code: r.unit, name: r.unit });
    });
    return Array.from(map.values());
  }, [attendance, allUnits]);

  const filteredAttendance = useMemo(() => {
    return attendance.filter((r) => {
      const ts = r.timestamp ?? r.created_at ?? "";
      const dateOk = selectedDate ? ts.startsWith(selectedDate) : true;
      const unitOk = selectedUnit ? r.unit === selectedUnit : true;
      return dateOk && unitOk;
    });
  }, [attendance, selectedUnit, selectedDate]);

  const searchedStudents = useMemo(() => {
    const q = (search || "").trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        (s.name ?? "").toLowerCase().includes(q) ||
        (s.student_id ?? "").toLowerCase().includes(q)
    );
  }, [students, search]);

  // --- Helpers ---
  const presentCountForUnit = (u) =>
    attendance.filter((r) => r.unit === u && r.txid).length || 0;

  const toggleUnitEnabled = async (u) => {
    const newValue = !unitEnabled[u];
    setUnitEnabled((prev) => ({ ...prev, [u]: newValue }));
    try {
      await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/tutor/units/${u}/toggle?enabled=${newValue}`, {
        method: "POST",
      });
    } catch {
      setUnitEnabled((prev) => ({ ...prev, [u]: !newValue }));
    }
  };

  const borderColors = [
    "#7c3aed",
    "#06b6d4",
    "#34d399",
    "#fb923c",
    "#ef4444",
    "#f97316",
    "#60a5fa",
    "#a78bfa",
  ];

  // --------------------- Render Views ----------------------

  function UnitsView() {
    return (
      <div style={{ width: "100%", padding: "20px" }}>
        <h2 className="text-2xl font-extrabold text-blue-300 mb-6">Units</h2>

        {/* Responsive grid with equal height cards */}
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: "24px",
          }}
        >
          {units.map((u, idx) => {
            const color = borderColors[idx % borderColors.length];
            return (
              <div
                key={u}
                className="transition-all duration-300 transform hover:-translate-y-2 hover:shadow-[0_8px_30px_rgba(59,130,246,0.3)]"
                style={{
                  border: `2px solid ${color}`,
                  boxShadow: `0 4px 16px ${color}22`,
                  background:
                    "linear-gradient(180deg, rgba(11,18,32,0.65), rgba(11,18,32,0.4))",
                  borderRadius: "14px",
                  padding: "16px",
                  backdropFilter: "blur(5px)",
                  color: "#e6eef8",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  minHeight: "160px",
                  transition: "all 0.3s ease",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "18px",
                      fontWeight: 700,
                      color: "#7dd3fc",
                    }}
                  >
                    {u.name}
                  </div>
                  <div style={{ fontSize: "13px", color: "#a5b4fc" }}>
                    {u.code}
                  </div>
                  <div style={{ fontSize: "14px", color: "#94a3b8" }}>
                    {presentCountForUnit(u)} present
                  </div>
                </div>

                <Button
                  onClick={() => {
                    setSelectedUnit(u);
                    setActiveTab("attendance");
                  }}
                  style={{
                    marginTop: "12px",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    backgroundColor: "#2563eb",
                    color: "#fff",
                    transition: "all 0.3s ease",
                    boxShadow: "0 0 0 rgba(59,130,246,0)",
                  }}
                  onMouseEnter={(e) =>
                  (e.currentTarget.style.boxShadow =
                    "0 0 15px rgba(59,130,246,0.6)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.boxShadow = "0 0 0 rgba(59,130,246,0)")
                  }
                >
                  View Attendance
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function LimitsView() {
    const [localLimits, setLocalLimits] = useState({});
    const [errors, setErrors] = useState({});

    useEffect(() => {
      const init = {};
      units.forEach((u) => {
        init[u.code] = {
          timeLimit: timeLimitMap[u.code] || { start: "", end: "" },
          geo: geoLimitMap[u.code] || {
            enabled: false,
            lat: "",
            lng: "",
            radius: "",
          },
        };
      });
      setLocalLimits(init);
    }, [units, timeLimitMap, geoLimitMap]);




    const handleTimeChange = (unitCode, field, value) => {
      setLocalLimits((prev) => {
        const updated = {
          ...prev,
          [unitCode]: {
            ...prev[unitCode],
            timeLimit: { ...prev[unitCode].timeLimit, [field]: value },
          },
        };

        const { start, end } = updated[unitCode].timeLimit;
        if (start && end && start >= end) {
          setErrors((e) => ({
            ...e,
            [unitCode]: "End time must be after start time",
          }));
        } else {
          setErrors((e) => {
            const copy = { ...e };
            delete copy[unitCode];
            return copy;
          });
        }

        return updated;
      });
    };

    const handleGeoChange = (unitCode, field, value) => {
      setLocalLimits((prev) => ({
        ...prev,
        [unitCode]: {
          ...prev[unitCode],
          geo: { ...prev[unitCode].geo, [field]: value },
        },
      }));
    };

    const handleUseMyLocation = (unitCode) => {
      if (!navigator.geolocation) {
        alert("Geolocation not supported in this browser.");
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          handleGeoChange(unitCode, "lat", latitude.toFixed(6));
          handleGeoChange(unitCode, "lng", longitude.toFixed(6));
        },
        (err) => alert("Failed to get location: " + err.message)
      );
    };

    const handleSave = async (unitCode) => {
      const { timeLimit, geo } = localLimits[unitCode];

      const timeLimitString =
        timeLimit.start && timeLimit.end
          ? `${timeLimit.start}-${timeLimit.end}`
          : null;

      const payload = {
        unit_code: unitCode,
        is_active: true,
        attendance_limit: null,
        time_limit: timeLimitString,
        location_lat: geo.enabled ? parseFloat(geo.lat) || null : null,
        location_lng: geo.enabled ? parseFloat(geo.lng) || null : null,
        location_radius: geo.enabled ? parseFloat(geo.radius) || null : null,
      };

      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/unit/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) throw new Error(await res.text());

        // ✅ save active state locally to morph card
        setActiveLimits((prev) => ({
          ...prev,
          [unitCode]: {
            time_limit: timeLimitString,
            location_radius: geo.enabled ? geo.radius : null,
          },
        }));
      } catch (err) {
        console.error(err);
        alert("Failed to save settings. Check console for details.");
      }
    };
    const handleCancel = async (unitCode) => {
      // 1. Instant UI update (optimistic)
      setActiveLimits((prev) => {
        const copy = { ...prev };
        delete copy[unitCode];
        return copy;
      });

      setTimeLimitMap((prev) => ({
        ...prev,
        [unitCode]: { start: "", end: "" },
      }));

      setGeoLimitMap((prev) => ({
        ...prev,
        [unitCode]: { enabled: false, lat: "", lng: "", radius: "" },
      }));

      // 🌀 2. Mark as "loading" for visual feedback (optional spinner or fade)
      setSavingMap((prev) => ({ ...prev, [unitCode]: true }));

      try {
        const payload = {
          unit_code: unitCode,
          is_active: false,
          attendance_limit: null,
          time_limit: null,
          location_lat: null,
          location_lng: null,
          location_radius: null,
        };

        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/unit/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) throw new Error(await res.text());

        // Success – remove the spinner
        setSavingMap((prev) => ({ ...prev, [unitCode]: false }));
        await loadLimits(); // refresh limits from backend

      } catch (err) {
        console.error("❌ Failed to cancel limits:", err);
        alert("Failed to cancel limits. Reverting changes...");

        //  Revert optimistic update if DB failed
        setActiveLimits((prev) => ({
          ...prev,
          [unitCode]: true,
        }));

        setSavingMap((prev) => ({ ...prev, [unitCode]: false }));
      }
    };


    return (
      <div className="flex flex-col gap-6 w-full">
        <h2 className="text-2xl font-extrabold text-blue-300">Attendance Limits</h2>

        {/* ✅ Proper grid layout */}
        <div
          className="grid gap-6 w-full"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            alignItems: "start",
            gap: "24px",
          }}
        >
          {units.map((u, idx) => {
            const color = borderColors[idx % borderColors.length];
            const data = localLimits[u.code] || {};
            const time = data.timeLimit || {};
            const geo = data.geo || {};
            const errorMsg = errors[u.code];

            return (
              <div
                key={u.code}
                className="p-5 rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                style={{
                  border: `2px solid ${color}`,
                  boxShadow: `0 6px 18px ${color}22`,
                  background:
                    "linear-gradient(180deg, rgba(15,23,42,0.7), rgba(15,23,42,0.5))",
                  minHeight: "300px", //  keeps consistent height
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div className="font-bold text-cyan-200 mb-2">
                    {u.name} <span className="text-sm text-gray-400">({u.code})</span>
                  </div>

                  {activeLimits[u.code] ? (
                    // --- When active ---
                    <div className="flex flex-col gap-3 mt-2">
                      <p className="text-sm text-gray-300 flex items-center gap-2">
                        🕒 <span>{activeLimits[u.code].time_limit}</span>
                      </p>
                      {activeLimits[u.code].location_radius && (
                        <p className="text-sm text-gray-300 flex items-center gap-2">
                          📍 <span>{activeLimits[u.code].location_radius} m radius</span>
                        </p>
                      )}
                      <LiveCountdown endTime={activeLimits[u.code].time_limit?.split("-")[1]} />

                      {/*  Transparent Cancel Button */}
                      <button
                        onClick={() => handleCancel(u.code)}
                        disabled={savingMap[u.code]}
                        className={`text-red-500 hover:text-red-700 transition ${savingMap[u.code] ? "opacity-50 cursor-not-allowed" : ""
                          }`}
                      >
                        {savingMap[u.code] ? "Removing…" : "Cancel Limits"}
                      </button>


                    </div>
                  ) : (
                    // --- When not active (original form) ---
                    <>
                      {/* Time Range */}
                      <div className="mb-3">
                        <label className="text-sm text-gray-300 block mb-1">
                          Attendance Time Window
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="time"
                            value={time.start || ""}
                            onChange={(e) => handleTimeChange(u.code, "start", e.target.value)}
                            className="w-1/2 p-2 rounded bg-slate-800 text-white"
                          />
                          <span className="text-gray-400">to</span>
                          <input
                            type="time"
                            value={time.end || ""}
                            onChange={(e) => handleTimeChange(u.code, "end", e.target.value)}
                            className="w-1/2 p-2 rounded bg-slate-800 text-white"
                          />
                        </div>
                        {errorMsg && (
                          <p className="text-red-400 text-xs mt-1">{errorMsg}</p>
                        )}
                      </div>

                      {/* Geo Options */}
                      <div className="flex items-center mb-2 gap-2">
                        <input
                          type="checkbox"
                          checked={geo.enabled}
                          onChange={(e) =>
                            handleGeoChange(u.code, "enabled", e.target.checked)
                          }
                        />
                        <span className="text-sm text-gray-300">Enable Geolocation</span>
                      </div>

                      {geo.enabled && (
                        <div className="space-y-2 mb-3">
                          <input
                            type="text"
                            placeholder="Latitude"
                            value={geo.lat || ""}
                            onChange={(e) => handleGeoChange(u.code, "lat", e.target.value)}
                            className="w-full p-2 rounded bg-slate-800 text-white"
                          />
                          <input
                            type="text"
                            placeholder="Longitude"
                            value={geo.lng || ""}
                            onChange={(e) => handleGeoChange(u.code, "lng", e.target.value)}
                            className="w-full p-2 rounded bg-slate-800 text-white"
                          />
                          <input
                            type="number"
                            placeholder="Radius (meters)"
                            value={geo.radius || ""}
                            onChange={(e) => handleGeoChange(u.code, "radius", e.target.value)}
                            className="w-full p-2 rounded bg-slate-800 text-white"
                          />
                          <Button
                            onClick={() => handleUseMyLocation(u.code)}
                            className="w-full bg-blue-600 hover:bg-blue-700"
                          >
                            Use My Location
                          </Button>
                        </div>
                      )}

                      <Button
                        onClick={() => handleSave(u.code)}
                        disabled={!!errorMsg}
                        className={`w-full mt-2 ${errorMsg
                          ? "bg-gray-600 cursor-not-allowed"
                          : "bg-green-600 hover:bg-green-700"
                          }`}
                      >
                        Save Limits
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  function LiveCountdown({ endTime }) {
    const [remaining, setRemaining] = useState("");

    useEffect(() => {
      if (!endTime) return;
      const [endH, endM] = endTime.split(":");
      const interval = setInterval(() => {
        const now = new Date();
        const end = new Date();
        end.setHours(endH, endM, 0, 0);
        const diff = end - now;
        if (diff <= 0) {
          setRemaining("⏱ Attendance window closed");
          clearInterval(interval);
        } else {
          const mins = Math.floor(diff / 60000);
          const secs = Math.floor((diff % 60000) / 1000);
          setRemaining(`${mins}m ${secs}s remaining`);
        }
      }, 1000);
      return () => clearInterval(interval);
    }, [endTime]);

    return <p className="text-green-400 text-sm">{remaining}</p>;
  }


  function StudentsView() {
    return (
      <div className="flex flex-col gap-6">
        <h2 className="text-2xl font-extrabold text-blue-300">Students</h2>
        <Card className="p-4">
          <table style={{ width: "100%", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: 8 }}>Student ID</th>
                <th style={{ textAlign: "left", padding: 8 }}>Name</th>
              </tr>
            </thead>
            <tbody>
              {searchedStudents.map((s) => (
                <tr key={s.student_id}>
                  <td style={{ padding: 8 }}>{s.student_id}</td>
                  <td style={{ padding: 8 }}>{s.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    );
  }

  function AttendanceView() {
    return (
      <div className="flex flex-col gap-6">
        <h2 className="text-2xl font-extrabold text-blue-300">Attendance</h2>
        <Card className="p-4">
          <table style={{ width: "100%", fontSize: 13 }}>
            <thead>
              <tr>
                <th>Student</th>
                <th>Unit</th>
                <th>Timestamp</th>
                <th>Tx</th>
              </tr>
            </thead>
            <tbody>
              {filteredAttendance.map((r, i) => (
                <tr key={i}>
                  <td>{r.student_id}</td>
                  <td>{r.unit}</td>
                  <td>{r.timestamp}</td>
                  <td>{r.txid ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    );
  }

  // --------------------- Layout ----------------------

  const sidebarStyle = {
    width: sidebarOpen ? 260 : 72,
    transition: "all 0.3s ease",
    backdropFilter: "blur(14px)",
    background: "rgba(17, 25, 40, 0.6)",
    borderRight: "1px solid rgba(255,255,255,0.1)",
    boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
    transform: sidebarOpen ? "translateX(0)" : "translateX(-20%)",
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
      <aside style={sidebarStyle}>
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
                src="/logo.png" alt="Logo"
                style={{
                  height: 100,
                  width: 100,
                  borderRadius: "50%",
                  marginRight: sidebarOpen ? 0 : 0,
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
                  }}
                >
                  Tutor Dashboard
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
                  <span className="text-white font-semibold text-sm">Dr Winnie Kamau</span>
                  <span className="text-gray-400 text-xs">Tutor</span>
                </div>
              )}
            </div>


            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{
                background: "transparent",
                border: "none",
                color: "#22d3ee", // neon cyan
                fontSize: "1.5rem",
                marginBottom: "10px",
                padding: "8px",
                borderRadius: "10px",
                boxShadow: "0 0 8px rgba(34,211,238,0.5)",
                cursor: "pointer",
                transition: "all 0.3s ease",
                textShadow: "0 0 6px rgba(34,211,238,0.7)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = "0 0 15px rgba(34,211,238,0.8)";
                e.currentTarget.style.textShadow =
                  "0 0 12px rgba(34,211,238,0.9), 0 0 20px rgba(34,211,238,0.7)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "0 0 8px rgba(34,211,238,0.5)";
                e.currentTarget.style.textShadow = "0 0 6px rgba(34,211,238,0.7)";
              }}
            >
              {sidebarOpen ? <FiChevronLeft /> : <FiMenu />}
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
                { id: "units", icon: <FiBook />, label: "Units" },
                { id: "limits", icon: <FiClock />, label: "Limits" },
                { id: "students", icon: <FiUsers />, label: "Students" },
                { id: "attendance", icon: <FiCalendar />, label: "Attendance" },
                { id: "records", icon: <FiDownload />, label: "Records" },
              ].map(({ id, icon, label }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`flex items-center gap-3 p-3 rounded-lg w-full text-left transition-all duration-300 ${activeTab === id ? "text-cyan-400" : "text-slate-200"
                    }`}
                  style={{
                    background: "transparent",
                    border: "none",
                    boxShadow:
                      activeTab === id
                        ? "0 0 10px rgba(34,211,238,0.8)"
                        : "0 0 0 rgba(0,0,0,0)",
                    textShadow:
                      activeTab === id
                        ? "0 0 8px rgba(34,211,238,0.8)"
                        : "0 0 4px rgba(148,163,184,0.4)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.textShadow =
                      "0 0 8px rgba(34,211,238,0.8), 0 0 15px rgba(34,211,238,0.6)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.textShadow =
                      activeTab === id
                        ? "0 0 8px rgba(34,211,238,0.8)"
                        : "0 0 4px rgba(148,163,184,0.4)";
                  }}
                >
                  {icon}
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

          {/* --- Footer section --- */}
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
        {activeTab === "units" && <UnitsView />}
        {activeTab === "limits" && <LimitsView />}
        {activeTab === "students" && <StudentsView />}
        {activeTab === "attendance" && <AttendanceView />}
        {activeTab === "records" && (
          <RecordsView selectedUnit={selectedUnit} allUnits={allUnits} />
        )}
      </main>
    </div>
  );
}
