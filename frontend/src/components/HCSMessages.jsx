import React, { useEffect, useState } from "react";

export default function HCSMessages() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchMessages = async () => {
    try {
      const res = await fetch("/api/hcs/messages?limit=10");
      if (!res.ok) throw new Error("Failed to fetch HCS messages");
      const data = await res.json();
      setMessages(data.messages || []);
    } catch (err) {
      console.error("❌ HCS fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <p style={{ color: "#fff" }}>Loading...</p>;
  if (messages.length === 0) return <p style={{ color: "#fff" }}>No HCS messages yet.</p>;

  return (
    <ul style={{ listStyle: "none", padding: 0 }}>
      {messages.map((m, idx) => (
        <li
          key={idx}
          style={{
            padding: "8px 0",
            color: "#e6eef8",
            borderBottom: "1px solid #374151",
            fontSize: "0.85rem",
          }}
        >
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
            {JSON.stringify(m, null, 2)}
          </pre>
        </li>
      ))}
    </ul>
  );
}
