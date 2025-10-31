import React, { useState } from "react";

export default function WalletInput({ walletAddress, setWalletAddress }) {
  const [input, setInput] = useState(walletAddress || "");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  // ✅ Validate basic format: 0.0.xxxx
  const validateFormat = (addr) => /^[0-9]+\.[0-9]+\.[0-9]+$/.test(addr.trim());

  // ✅ Confirm and verify wallet
  const handleConfirm = async () => {
    const trimmed = input.trim();

    if (!validateFormat(trimmed)) {
      setStatus("❌ Invalid format. Must be like 0.0.xxxx");
      return;
    }

    setLoading(true);
    setStatus("⏳ Verifying wallet on Hedera...");

    try {
      const res = await fetch(`/api/validate_wallet?wallet=${trimmed}`);
      const data = await res.json();

      if (data.valid) {
        setWalletAddress(trimmed);
        setStatus("✅ Wallet verified and confirmed!");
      } else {
        setStatus("❌ Wallet not found on Hedera network");
      }
    } catch (err) {
      console.error("Wallet validation error:", err);
      setStatus("⚠️ Error verifying wallet. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginBottom: 12 }}>
      <input
        type="text"
        placeholder="Enter your HBAR wallet (e.g. 0.0.6069811)"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        style={{
          padding: 6,
          width: 300,
          marginRight: 8,
          borderRadius: 6,
          border: "1px solid #2563eb",
        }}
      />
      <button
        onClick={handleConfirm}
        disabled={loading}
        style={{
          padding: "6px 12px",
          background: loading ? "#94a3b8" : "#2563eb",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "Verifying..." : "Confirm"}
      </button>
      <div style={{ marginTop: 4 }}>
        <small>{status}</small>
      </div>
    </div>
  );
}
