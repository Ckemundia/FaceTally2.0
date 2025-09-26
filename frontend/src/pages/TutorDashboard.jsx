// src/pages/TutorDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  FiUsers,
  FiCheckCircle,
  FiGift,
  FiDownload,
  FiSettings,
  FiSearch,
  FiChevronRight,
} from "react-icons/fi";

import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Dialog } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Progress } from "../components/ui/progress";
import { Select } from "../components/ui/select";
import { Table } from "../components/ui/table";



export default function TutorDashboard() {
  // data
  const [attendance, setAttendance] = useState([]); // raw attendance rows
  const [students, setStudents] = useState([]); // students list
  const [stats, setStats] = useState({ rewards: 0, total: 0, present: 0 });
  const [allUnits, setAllUnits] = useState([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedUnit, setSelectedUnit] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [search, setSearch] = useState("");

  const [unitEnabled, setUnitEnabled] = useState({}); // map unit => bool
  const [timeLimitMap, setTimeLimitMap] = useState({}); // map unit => "HH:MM"

  // modals
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [unitModalValue, setUnitModalValue] = useState(""); // selected unit in modal
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadUnit, setDownloadUnit] = useState("");
  const [downloadDate, setDownloadDate] = useState("");

  // Fetch attendance & students & stats
  useEffect(() => {
    let mounted = true;

    async function fetchAll() {
  setLoading(true);
  setError(null);
  try {
    const [attRes, statRes, usersRes, statusRes, unitsRes] = await Promise.allSettled([
      fetch("/api/attendance/history"),
      fetch("/api/tutor/stats"),
      fetch("/api/users"),
      fetch("/api/tutor/units/status"), 
      fetch("/api/units"),
    ]);

    // 📘 Attendance
    if (attRes.status === "fulfilled" && attRes.value.ok) {
      const a = await attRes.value.json();
      const rows = a.records ?? a.rows ?? a;
      if (mounted) setAttendance(Array.isArray(rows) ? rows : []);
    }

    // 📊 Stats
    if (statRes.status === "fulfilled" && statRes.value.ok) {
      const s = await statRes.value.json();
      if (mounted) setStats((prev) => ({ ...prev, ...s }));
    }
    // 📘 Units
    if (unitsRes.status === "fulfilled" && unitsRes.value.ok) {
      const u = await unitsRes.value.json();
      const rows = u.units ?? u.rows ?? u;
      if (Array.isArray(rows) && mounted) {
        setAllUnits(rows.map(r => r.unit_code ?? r.code ?? r.name));
      }
    }

    // 👥 Users
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
    } else {
      // fallback from attendance
      if (mounted) {
        const map = new Map();
        (attendance || []).forEach((r) => {
          const id = r.student_id ?? r.studentId ?? r.student;
          if (!map.has(id)) map.set(id, { student_id: id, name: r.name ?? id });
        });
        setStudents(Array.from(map.values()));
      }
    }

    // 🧩 NEW: Unit status
    if (statusRes.status === "fulfilled" && statusRes.value.ok) {
      const data = await statusRes.value.json();
      if (mounted && data.enabledMap) {
        setUnitEnabled(data.enabledMap);
      }
    }

  } catch (err) {
    if (mounted) setError("Failed to load data");
  } finally {
    if (mounted) setLoading(false);
  }
}

fetchAll();
return () => (mounted = false);
// eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // derive units
  const units = useMemo(() => {
  const s = new Set(allUnits); // always include backend units
  (attendance || []).forEach((r) => r.unit && s.add(r.unit)); // plus any from attendance
  return Array.from(s).sort();
}, [attendance, allUnits]);


  // init unit enabled/timeLimit state when units change
  useEffect(() => {
    setUnitEnabled((prev) => {
      const copy = { ...prev };
      units.forEach((u) => {
        if (!(u in copy)) copy[u] = true;
      });
      return copy;
    });
    setTimeLimitMap((prev) => {
      const copy = { ...prev };
      units.forEach((u) => {
        if (!(u in copy)) copy[u] = "";
      });
      return copy;
    });
  }, [units]);

  // filtered attendance by selectedUnit & date
  const filteredAttendance = useMemo(() => {
    return (attendance || []).filter((r) => {
      const ts = r.timestamp ?? r.created_at ?? "";
      const dateOk = selectedDate ? ts.startsWith(selectedDate) : true;
      const unitOk = selectedUnit ? r.unit === selectedUnit : true;
      return dateOk && unitOk;
    });
  }, [attendance, selectedUnit, selectedDate]);

  // search students (applies to table)
  const searchedStudents = useMemo(() => {
    const q = (search || "").trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        (s.name ?? "").toLowerCase().includes(q) ||
        (s.student_id ?? "").toLowerCase().includes(q)
    );
  }, [students, search]);

  // CSV generation (client-side)
  function downloadCSV(rows, fileName = "attendance.csv") {
    if (!rows || rows.length === 0) {
      alert("No records to download");
      return;
    }
    const header = ["id", "student_id", "name", "timestamp", "unit", "txid"];
    const lines = [header.join(",")];
    rows.forEach((r) => {
      const line = [
        r.id ?? "",
        `"${(r.student_id ?? "").toString().replace(/"/g, '""')}"`,
        `"${(r.name ?? "").toString().replace(/"/g, '""')}"`,
        `"${(r.timestamp ?? "").toString().replace(/"/g, '""')}"`,
        `"${(r.unit ?? "").toString().replace(/"/g, '""')}"`,
        `"${(r.txid ?? "").toString().replace(/"/g, '""')}"`,
      ];
      lines.push(line.join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const handleDownloadModal = () => {
    const rows = attendance.filter((r) => {
      const dateOk = downloadDate ? (r.timestamp ?? "").startsWith(downloadDate) : true;
      const unitOk = downloadUnit ? r.unit === downloadUnit : true;
      return dateOk && unitOk;
    });
    if (!rows.length) {
      alert("No records for selected filters");
      return;
    }
    const fileName = `attendance_${downloadUnit || "all"}_${downloadDate || "all"}.csv`;
    downloadCSV(rows, fileName);
    setShowDownloadModal(false);
  };

  // toggle unit attendance (local state; replace with API call if desired)
  const toggleUnitEnabled = async (u) => {
  const newValue = !unitEnabled[u]; // what tutor wants
  setUnitEnabled((prev) => ({ ...prev, [u]: newValue })); // update UI first

  try {
    await fetch(`/api/tutor/units/${u}/toggle?enabled=${newValue}`, {
      method: "POST",
    });
  } catch (err) {
    console.error("Failed to update unit status", err);
    // rollback if API fails
    setUnitEnabled((prev) => ({ ...prev, [u]: !newValue }));
  }
};
const saveUnitSettings = async () => {
  if (!unitModalValue) return;

  const enabled = unitEnabled[unitModalValue];
  const timeLimit = timeLimitMap[unitModalValue];

  try {
    await fetch(`/api/tutor/units/${unitModalValue}/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slots: null,       // or pass real slots if you want
        time_limit: timeLimit,
      }),
    });

    // also ensure toggle state is saved
    await fetch(`/api/tutor/units/${unitModalValue}/toggle?enabled=${enabled}`, {
      method: "POST",
    });

    setShowUnitModal(false);
  } catch (err) {
    console.error("Failed to save unit settings", err);
    alert("Failed to save settings. Please try again.");
  }
};


  // small helpers
  const presentCountForUnit = (u) =>
    attendance.filter((r) => r.unit === u && r.txid) .length || 0;

  // UI rendering
  return (
    <div
      className="tutor-root"
      style={{
        minHeight: "100vh",
        background: "#0f1724",
        color: "#e6eef8",
        padding: 28,
        position: "relative",
        overflow: "hidden",
        fontFamily: "Inter, sans-serif",
      }}
    >
      {/* floating circles (re-uses your style.css definitions) */}
      {[...Array(6)].map((_, i) => (
        <div key={i} className={`circle circle${i + 1}`} />
      ))}

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 20, position: "relative", zIndex: 5 }}>
        <h1
          style={{
            fontFamily: "'Bungee', cursive",
            fontSize: 36,
            color: "#60a5fa",
            textShadow: "0 0 12px #60a5fa, 0 0 24px #2563eb",
            margin: 0,
            letterSpacing: 2,
          }}
        >
          TUTOR DASHBOARD
        </h1>
        <p style={{ color: "#9aa6b6", marginTop: 8 }}>Manage attendance, view students and export records</p>

        <div style={{ marginTop: 16 }}>
          <Button
            className="primary-hero"
            onClick={() => setShowDownloadModal(true)}
            style={{ padding: "10px 20px", borderRadius: 10 }}
          >
            <FiDownload style={{ marginRight: 8 }} /> Download Records
          </Button>
        </div>
      </div>

      {/* Main grid */}
      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20, position: "relative", zIndex: 5 }}>
        {/* Left column (units + settings) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card className="glass-card" style={{ padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div>
                <div style={{ fontWeight: 800, color: "#cfe8ff" }}>Units</div>
                <div style={{ color: "#9aa6b6", fontSize: 12 }}>Quick toggles</div>
              </div>
              <Button variant="ghost" onClick={() => setShowUnitModal(true)} style={{ padding: 8 }}>
                <FiSettings />
              </Button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {units.length === 0 && <div style={{ color: "#9aa6b6" }}>No units found</div>}
              {units.map((u) => (
                <div key={u} style={{
                  padding: 10,
                  borderRadius: 10,
                  background: "linear-gradient(180deg, rgba(11,18,32,0.6), rgba(11,18,32,0.4))",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  boxShadow: "0 6px 18px rgba(0,0,0,0.45)",
                }}>
                  <div>
                    <div style={{ fontWeight: 800, color: "#cfe8ff" }}>{u}</div>
                    <div style={{ color: "#9aa6b6", fontSize: 12 }}>
                      {presentCountForUnit(u)} present
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                    <Button
                      onClick={() => toggleUnitEnabled(u)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 8,
                        background: unitEnabled[u] ? "#34d399" : "#ef4444",
                        color: unitEnabled[u] ? "#04260f" : "#fff",
                        fontWeight: 700,
                      }}
                    >
                      {unitEnabled[u] ? "ENABLED" : "DISABLED"}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => { setUnitModalValue(u); setShowUnitModal(true); }}
                      style={{ padding: 6, fontSize: 14 }}
                    >
                      <FiChevronRight />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card style={{ padding: 12 }}>
            <div style={{ fontWeight: 800, color: "#60a5fa", marginBottom: 8 }}>Quick Filters</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Input placeholder="Search student or id..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            <div style={{ marginTop: 10 }}>
              <label style={{ color: "#9aa6b6", fontSize: 12 }}>Unit</label>
              <Select value={selectedUnit} onChange={(e) => setSelectedUnit(e.target.value)}>
                <option value="">All units</option>
                {units.map((u) => <option key={u} value={u}>{u}</option>)}
              </Select>
            </div>

            <div style={{ marginTop: 10 }}>
              <label style={{ color: "#9aa6b6", fontSize: 12 }}>Date</label>
              <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={{
                width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #233044", background: "#071024", color: "#e6eef8"
              }} />
            </div>
          </Card>
        </div>

        {/* Right column (table + stats) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", gap: 12 }}>
            <Card style={{ flex: 1, padding: 12 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <FiGift className="text-3xl" style={{ color: "#34d399" }} />
                <div>
                  <div style={{ color: "#9aa6b6", fontSize: 12 }}>Rewards</div>
                  <div style={{ fontWeight: 800, fontSize: 18 }}>{stats.rewards}</div>
                </div>
              </div>
            </Card>

            <Card style={{ flex: 1, padding: 12 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <FiUsers className="text-3xl" style={{ color: "#60a5fa" }} />
                <div>
                  <div style={{ color: "#9aa6b6", fontSize: 12 }}>Total Students</div>
                  <div style={{ fontWeight: 800, fontSize: 18 }}>{stats.total}</div>
                </div>
              </div>
            </Card>

            <Card style={{ flex: 1, padding: 12 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <FiCheckCircle className="text-3xl" style={{ color: "#a78bfa" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ color: "#9aa6b6", fontSize: 12 }}>Present</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ fontWeight: 800, fontSize: 18 }}>{stats.present}</div>
                    <div style={{ flex: 1 }}>
                      <Progress value={(stats.present / Math.max(stats.total, 1)) * 100} />
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Table Card */}
          <Card style={{ padding: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px" }}>
              <div style={{ fontWeight: 800, color: "#60a5fa" }}>Students Attendance ({filteredAttendance.length})</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Input placeholder="Filter by name or id..." value={search} onChange={(e) => setSearch(e.target.value)} />
                <Button onClick={() => { setSearch(""); setSelectedUnit(""); setSelectedDate(""); }} variant="ghost">Reset</Button>
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <th style={{ textAlign: "left", padding: 12, color: "#60a5fa", fontWeight: 800 }}>Student ID</th>
                    <th style={{ textAlign: "left", padding: 12, color: "#9aa6b6" }}>Name</th>
                    <th style={{ textAlign: "left", padding: 12, color: "#9aa6b6" }}>Unit</th>
                    <th style={{ textAlign: "left", padding: 12, color: "#9aa6b6" }}>Timestamp</th>
                    <th style={{ textAlign: "left", padding: 12, color: "#9aa6b6" }}>Tx</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={5} style={{ padding: 18, color: "#9aa6b6" }}>Loading...</td></tr>
                  ) : error ? (
                    <tr><td colSpan={5} style={{ padding: 18, color: "#f87171" }}>{error}</td></tr>
                  ) : filteredAttendance.length === 0 ? (
                    <tr><td colSpan={5} style={{ padding: 18, color: "#9aa6b6" }}>No attendance records found for selected filters.</td></tr>
                  ) : (
                    // render attendance rows, but compact: group by student via searchedStudents
                    searchedStudents.flatMap((s) => {
                      const rows = filteredAttendance.filter(r => r.student_id === s.student_id);
                      if (!rows.length) return [];
                      return rows.map((r, i) => (
                        <tr key={`${s.student_id}-${i}`} className="hover-row" style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                          <td style={{ padding: 10, color: "#e6eef8" }}>{s.student_id}</td>
                          <td style={{ padding: 10, color: "#e6eef8" }}>{s.name}</td>
                          <td style={{ padding: 10, color: "#9aa6b6" }}>{r.unit}</td>
                          <td style={{ padding: 10, color: "#9aa6b6" }}>{r.timestamp}</td>
                          <td style={{ padding: 10, color: r.txid ? "#34d399" : "#9aa6b6" }}>{r.txid ?? "-"}</td>
                        </tr>
                      ));
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>

      {/* Unit Settings Modal */}
      {showUnitModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
          onClick={() => setShowUnitModal(false)} // close when clicking outside
        >
          <div
            style={{
              background: "#0f1724",
              borderRadius: 12,
              padding: 20,
              minWidth: 400,
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
              animation: "fadeIn 0.3s ease",
            }}
            onClick={(e) => e.stopPropagation()} // prevent close when clicking inside
          >
            <h2 style={{ marginBottom: 12, color: "#60a5fa" }}>
              Unit Attendance Settings
            </h2>

            <div
                style={{
                  maxHeight: "400px",   // limit popup body height
                  overflowY: "auto",    // enable vertical scroll
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  paddingRight: 6,      // small gap so scrollbar doesn’t overlap content
                }}
              >
                {units.length === 0 && (
                  <div style={{ color: "#9aa6b6" }}>No units found</div>
                )}

                {units.map((u) => (
                  <div
                    key={u}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 12px",
                      borderRadius: 8,
                      background: "rgba(17, 24, 39, 0.6)",
                    }}
                  >
                    <div style={{ color: "#cfe8ff", fontWeight: 700 }}>{u}</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Button
                        onClick={() => toggleUnitEnabled(u)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 6,
                          background: unitEnabled[u] ? "#34d399" : "#ef4444",
                          color: unitEnabled[u] ? "#04260f" : "#fff",
                          fontWeight: 700,
                        }}
                      >
                        {unitEnabled[u] ? "ENABLED" : "DISABLED"}
                      </Button>

                      <Input
                        type="time"
                        value={timeLimitMap[u] ?? ""}
                        onChange={(e) =>
                          setTimeLimitMap((prev) => ({ ...prev, [u]: e.target.value }))
                        }
                        style={{ width: 120 }}
                      />
                    </div>
                  </div>
                ))}
              </div>


            <label style={{ color: "#9aa6b6", fontSize: 12, marginTop: 10 }}>
              Enable Attendance
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <Button
                onClick={() => unitModalValue && toggleUnitEnabled(unitModalValue)}
                style={{ flex: 1 }}
              >
                {unitModalValue
                  ? unitEnabled[unitModalValue]
                    ? "Disable"
                    : "Enable"
                  : "Select unit"}
              </Button>
              <Input
                type="time"
                value={timeLimitMap[unitModalValue] ?? ""}
                onChange={(e) =>
                  setTimeLimitMap((prev) => ({
                    ...prev,
                    [unitModalValue]: e.target.value,
                  }))
                }
                style={{ width: 120 }}
              />
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <Button
                onClick={() => setShowUnitModal(false)}
                variant="ghost"
                style={{ flex: 1 }}
              >
                Cancel
              </Button>
              <Button onClick={saveUnitSettings} style={{ flex: 1 }}>
                Save
              </Button>
            </div>
          </div>
        </div>
      )}


      {/* Download Modal */}
      {showDownloadModal && (
        <Dialog onClose={() => setShowDownloadModal(false)} title="Download Attendance Records">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <label style={{ color: "#9aa6b6", fontSize: 12 }}>Unit</label>
            <Select value={downloadUnit} onChange={(e) => setDownloadUnit(e.target.value)}>
              <option value="">-- All units --</option>
              {units.map(u => <option key={u} value={u}>{u}</option>)}
            </Select>

            <label style={{ color: "#9aa6b6", fontSize: 12 }}>Date</label>
            <input type="date" value={downloadDate} onChange={(e) => setDownloadDate(e.target.value)} style={{
              width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #233044", background: "#071024", color: "#e6eef8"
            }} />

            <div style={{ display: "flex", gap: 8 }}>
              <Button onClick={() => setShowDownloadModal(false)} variant="ghost" style={{ flex: 1 }}>Cancel</Button>
              <Button onClick={handleDownloadModal} style={{ flex: 1 }}>Download</Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
