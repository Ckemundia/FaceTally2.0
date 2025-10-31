import React, { useState, useEffect } from "react";

function RecordsView({ selectedUnit, allUnits }) {
    const [unit, setUnit] = useState(selectedUnit || "");
    const [dates, setDates] = useState([]);
    const [selectedDateLocal, setSelectedDateLocal] = useState(null);
    const [records, setRecords] = useState([]);
    const [loadingDates, setLoadingDates] = useState(false);
    const [loadingRecords, setLoadingRecords] = useState(false);

    // load dates when unit changes (or on mount if selectedUnit set)
    useEffect(() => {
        const u = selectedUnit || unit;
        if (!u) {
            setDates([]);
            return;
        }
        setLoadingDates(true);
        fetch(`/api/attendance/dates?unit=${encodeURIComponent(u)}`)
            .then((res) => res.json())
            .then((data) => setDates(data.dates || []))
            .catch((err) => {
                console.error("Failed to load dates", err);
                setDates([]);
            })
            .finally(() => setLoadingDates(false));
    }, [selectedUnit, unit]);

    // fetch records for a specific date
    const fetchRecordsFor = (date) => {
        const u = selectedUnit || unit;
        if (!u || !date) return;
        setSelectedDateLocal(date);
        setLoadingRecords(true);
        fetch(`/api/attendance/by_date?unit=${encodeURIComponent(u)}&date=${encodeURIComponent(date)}`)
            .then((res) => res.json())
            .then((data) => setRecords(data.records || []))
            .catch((err) => {
                console.error("Failed to load records", err);
                setRecords([]);
            })
            .finally(() => setLoadingRecords(false));
    };

    // convenience: download csv (opens the export endpoint)
    const downloadCSV = (date) => {
        const u = selectedUnit || unit;
        if (!u || !date) return;
        const url = `/api/attendance/export_csv?unit=${encodeURIComponent(u)}&date=${encodeURIComponent(date)}`;
        window.open(url, "_blank");
    };

    return (
        <div className="flex flex-col gap-6">
            <h2 className="text-2xl font-extrabold text-blue-300">Records</h2>

            <div className="flex gap-4 items-center">
                <select
                    value={selectedUnit || unit}
                    onChange={(e) => {
                        setUnit(e.target.value);
                        // optionally clear selected date/records
                        setSelectedDateLocal(null);
                        setRecords([]);
                    }}
                    className="bg-slate-800 text-white p-2 rounded"
                >
                    <option value="">Select unit</option>
                    {allUnits.map((u) => (
                        <option key={u.code} value={u.code}>
                            {u.code} — {u.name}
                        </option>
                    ))}
                </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Dates list */}
                <div className="bg-slate-900 p-4 rounded">
                    <h3 className="font-semibold mb-3">Available Dates</h3>
                    {loadingDates ? (
                        <p>Loading dates…</p>
                    ) : dates.length === 0 ? (
                        <p className="text-sm text-gray-400">No dates found.</p>
                    ) : (
                        <ul className="space-y-2">
                            {dates.map((d) => (
                                <li key={d} className="flex justify-between items-center">
                                    <button
                                        onClick={() => fetchRecordsFor(d)}
                                        className={`w-full text-left px-3 py-2 rounded-lg transition-all duration-300 ${selectedDateLocal === d
                                            ? "text-cyan-300"
                                            : "text-slate-200 hover:text-cyan-300"
                                            }`}
                                        style={{
                                            background:
                                                selectedDateLocal === d
                                                    ? "linear-gradient(180deg, rgba(34,211,238,0.25), rgba(34,211,238,0.1))"
                                                    : "rgba(30,41,59,0.3)",
                                            border: "1px solid rgba(255,255,255,0.1)",
                                            backdropFilter: "blur(12px)",
                                            boxShadow:
                                                selectedDateLocal === d
                                                    ? "0 0 15px rgba(34,211,238,0.4)"
                                                    : "0 0 6px rgba(0,0,0,0.3)",
                                        }}
                                    >
                                        {d}
                                    </button>

                                    <button
                                        onClick={() => downloadCSV(d)}
                                        title="Download CSV"
                                        className="ml-2 px-2 py-1 rounded-lg text-white text-sm transition-all duration-300"
                                        style={{
                                            background:
                                                "linear-gradient(180deg, rgba(16,185,129,0.3), rgba(16,185,129,0.15))",
                                            border: "1px solid rgba(16,185,129,0.4)",
                                            backdropFilter: "blur(10px)",
                                            boxShadow: "0 0 10px rgba(16,185,129,0.3)",
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.boxShadow = "0 0 16px rgba(16,185,129,0.6)";
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.boxShadow = "0 0 10px rgba(16,185,129,0.3)";
                                        }}
                                    >
                                        CSV
                                    </button>

                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Records preview */}
                <div className="md:col-span-2 bg-slate-900 p-4 rounded">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="font-semibold">Preview {selectedDateLocal ? `— ${selectedDateLocal}` : ""}</h3>
                        {selectedDateLocal && (
                            <button
                                onClick={() => downloadCSV(selectedDateLocal)}
                                className="px-3 py-1 rounded-lg text-white transition-all duration-300"
                                style={{
                                    background:
                                        "linear-gradient(180deg, rgba(37,99,235,0.3), rgba(37,99,235,0.15))",
                                    border: "1px solid rgba(37,99,235,0.4)",
                                    backdropFilter: "blur(12px)",
                                    boxShadow: "0 0 12px rgba(37,99,235,0.3)",
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.boxShadow = "0 0 18px rgba(37,99,235,0.6)";
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.boxShadow = "0 0 12px rgba(37,99,235,0.3)";
                                }}
                            >
                                Download CSV
                            </button>

                        )}
                    </div>

                    {loadingRecords ? (
                        <p>Loading records…</p>
                    ) : !selectedDateLocal ? (
                        <p className="text-sm text-gray-400">Select a date to preview records.</p>
                    ) : records.length === 0 ? (
                        <p>No records for this date.</p>
                    ) : (
                        <div className="overflow-auto max-h-96">
                            <table className="w-full text-sm">
                                <thead className="text-left text-gray-300">
                                    <tr>
                                        <th className="p-2">Student ID</th>
                                        <th className="p-2">Name</th>
                                        <th className="p-2">Time</th>
                                        <th className="p-2">Tx</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {records.map((r, i) => (
                                        <tr key={i} className="border-t border-slate-800">
                                            <td className="p-2">{r.student_id}</td>
                                            <td className="p-2">{r.name}</td>
                                            <td className="p-2">{new Date(r.timestamp).toLocaleTimeString()}</td>
                                            <td className="p-2">{r.txid || "—"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
export default RecordsView;
