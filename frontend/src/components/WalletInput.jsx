import React, { useState } from "react";

export default function WalletInput({ walletAddress, setWalletAddress }) {
  const [input, setInput] = useState(walletAddress);
  const [status, setStatus] = useState("");

  // Simple Hedera address validation: 0.0.xxxx
  const validateAddress = (addr) => {
    const regex = /^[0-9]+\.[0-9]+\.[0-9]+$/;
    return regex.test(addr.trim());
  };

  const handleConfirm = () => {
    if (!validateAddress(input)) {
      setStatus("❌ Invalid HBAR address (format: 0.0.xxxx)");
      return;
    }
    setWalletAddress(input.trim());
    setStatus("✅ Wallet address confirmed");
  };

  return (
    <div style={{ marginBottom: 12 }}>
      <input
        type="text"
        placeholder="Enter your HBAR wallet address (0.0.xxxx)"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        style={{ padding: 6, width: 300, marginRight: 8 }}
      />
      <button onClick={handleConfirm} style={{ padding: "6px 12px" }}>
        Confirm
      </button>
      <div style={{ marginTop: 4 }}>
        <small>{status}</small>
      </div>
    </div>
  );
}
