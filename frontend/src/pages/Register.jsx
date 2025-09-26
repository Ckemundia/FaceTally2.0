import React, { useRef, useState, useEffect } from "react";
import * as faceapi from "face-api.js";
import { useNavigate } from "react-router-dom";
import WalletInput from "../components/WalletInput";

export default function Register() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [status, setStatus] = useState("Loading models...");
  const [studentId, setStudentId] = useState("");
  const [studentName, setStudentName] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [units, setUnits] = useState([]);             
  const [selectedUnits, setSelectedUnits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [popupType, setPopupType] = useState("info"); 

  const navigate = useNavigate();

  // Fetch units from backend
  useEffect(() => {
    fetch("/api/units")
      .then((res) => res.json())
      .then((data) => {
        setUnits(data.units || []);
      })
      .catch((err) => console.error("Failed to load units:", err));
  }, []);

  // Load models
  useEffect(() => {
    (async function loadModelsAndStart() {
      const MODEL_URL = "/models";
      try {
        setStatus("⏳ Loading face-api models...");
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        ]);
        setStatus("✅ Models loaded. Starting webcam...");
        setTimeout(() => startCamera(), 300);
      } catch (err) {
        console.error("Model load error:", err);
        setStatus("⚠️ Failed to load models: " + err.message);
      }
    })();
  }, []);

  function startCamera() {
    if (!videoRef.current) return;
    navigator.mediaDevices
      .getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 } } })
      .then((stream) => {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setStatus("📷 Webcam ready. Click Register when ready.");
      })
      .catch((err) => {
        console.error("Camera error:", err);
        setStatus("⚠️ Camera access denied");
      });
  }

  async function captureFace() {
    try {
      setLoading(true);
      setStatus("🔍 Detecting face... please hold still");

      if (!studentId.trim()) {
        setPopupType("error");
        setStatus("⚠️ Please enter a student ID first");
        setShowPopup(true);
        setLoading(false);
        return;
      }

      if (!studentName.trim()) {
        setPopupType("error");
        setStatus("⚠️ Please enter student name first");
        setShowPopup(true);
        setLoading(false);
        return;
      }

      if (selectedUnits.length === 0) {
        setPopupType("error");
        setStatus("⚠️ Please select and confirm at least one unit first");
        setShowPopup(true);
        setLoading(false);
        return;
      }

      if (!walletAddress) {
        setPopupType("error");
        setStatus("⚠️ Please confirm your HBAR wallet address first");
        setShowPopup(true);
        setLoading(false);
        return;
      }

      const options = new faceapi.TinyFaceDetectorOptions({
        inputSize: 224,
        scoreThreshold: 0.5,
      });

      const result = await faceapi
        .detectSingleFace(videoRef.current, options)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!result) {
        setPopupType("error");
        setStatus("❌ No face detected — try again");
        setShowPopup(true);
        setLoading(false);
        return;
      }

      let embedding = Array.from(result.descriptor).map((v) => Number(v));

      if (embedding.length !== 128) {
        setPopupType("error");
        setStatus(`❌ Invalid embedding length: ${embedding.length} (must be 128)`);
        setShowPopup(true);
        setLoading(false);
        return;
      }

      // Draw detections
      const displaySize = {
        width: videoRef.current.videoWidth,
        height: videoRef.current.videoHeight,
      };
      faceapi.matchDimensions(canvasRef.current, displaySize);
      const resized = faceapi.resizeResults(result, displaySize);
      const ctx = canvasRef.current.getContext("2d");
      ctx.clearRect(0, 0, displaySize.width, displaySize.height);
      faceapi.draw.drawDetections(canvasRef.current, resized);
      faceapi.draw.drawFaceLandmarks(canvasRef.current, resized);

      const payload = {
        student_id: studentId.trim(),
        name: studentName.trim(),
        units: selectedUnits.map(u => u.unit_code),   
        embedding,
        wallet: walletAddress,
        network: "testnet",
      };


      console.log("Payload to backend:", payload);

      setStatus("📡 Sending data to backend...");
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && data.ok) {
        setPopupType("success");
        setStatus("✅ Registered successfully!");
        setShowPopup(true);
        setTimeout(() => navigate("/dashboard"), 1500);
      } else {
        setPopupType("error");
        setStatus("❌ Registration failed: " + (data.detail || "unknown error"));
        setShowPopup(true);
      }
    } catch (err) {
      setPopupType("error");
      console.error("Capture error:", err);
      setStatus("⚠️ Capture error: " + (err.message || err));
      setShowPopup(true);
    } finally {
      setLoading(false);
    }
  }

 return (
  <div style={{ position: "relative", minHeight: "100vh", overflow: "hidden" }}>
    {/* Floating Circles Background */}
    <div className="circle circle1"></div>
    <div className="circle circle2"></div>
    <div className="circle circle3"></div>
    <div className="circle circle4"></div>
    <div className="circle circle5"></div>
    <div className="circle circle6"></div>

    {/* Page Wrapper */}
    <div className="card" style={{ margin: "100px auto", padding: "30px", maxWidth: "1100px", display: "flex", gap: "30px", zIndex: 5, position: "relative" }}>
      
      {/* Left: Camera Feed */}
      <div style={{ position: "relative", flex: 1 }}>
        <h2 style={{ marginBottom: "10px", color: "#60a5fa" }}>📷 Live Camera</h2>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: "100%",
            height: "auto",
            borderRadius: "10px",
            border: "2px solid #2563eb",
            boxShadow: "0 0 15px rgba(37, 99, 235, 0.6)"
          }}
        />
        <canvas
          ref={canvasRef}
          style={{ position: "absolute", top: 0, left: 0 }}
        />
      </div>

      {/* Right: Form Section */}
      <div style={{ flex: 1 }}>
        <h2 style={{ color: "#34d399", marginBottom: "15px" }}>📝 Register Student</h2>
        
        {/* Wallet */}
        <WalletInput walletAddress={walletAddress} setWalletAddress={setWalletAddress} />

        {/* Student ID */}
        <input
          type="text"
          placeholder="Enter Student ID"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          className="input-field"
        />

        {/* Student Name */}
        <input
          type="text"
          placeholder="Enter Student Name"
          value={studentName}
          onChange={(e) => setStudentName(e.target.value)}
          className="input-field"
        />

        {/* Units Checklist */}
        <div style={{ marginTop: "15px" }}>
          <h4 style={{ marginBottom: "8px", color: "#fbbf24" }}>📚 Select Units</h4>
          <div style={{
            maxHeight: "160px",
            overflowY: "auto",
            border: "1px solid #374151",
            padding: "10px",
            borderRadius: "8px",
            background: "#0f172a",
            boxShadow: "inset 0 0 10px rgba(0,0,0,0.6)"
          }}>
            {units.map((unit) => (
              <label key={unit.unit_code} style={{ display: "block", marginBottom: "6px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={selectedUnits.some(u => u.unit_code === unit.unit_code)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedUnits([...selectedUnits, unit]);
                    } else {
                      setSelectedUnits(selectedUnits.filter(u => u.unit_code !== unit.unit_code));
                    }
                  }}
                />{" "}
                {unit.unit_code} - {unit.unit_name}
              </label>
            ))}
          </div>
        </div>

        {/* Submit */}
        <button
          onClick={captureFace}
          disabled={loading}
          style={{
            width: "100%",
            padding: "12px",
            marginTop: "20px",
            borderRadius: "8px",
            fontSize: "1rem",
            background: loading ? "#6b7280" : "linear-gradient(90deg, #2563eb, #34d399)",
            color: "white",
            border: "none",
            cursor: loading ? "not-allowed" : "pointer",
            boxShadow: "0 4px 15px rgba(0,0,0,0.4)",
            transition: "0.3s"
          }}
        >
          {loading ? "⏳ Registering..." : "✅ Register Now"}
        </button>
      </div>
    </div>

    {/* Popup Modal */}
    {showPopup && (
      <div className="modal-overlay" onClick={() => setShowPopup(false)}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <h3 style={{ marginBottom: "10px" }}>
            {popupType === "success" ? "✅ Success" : popupType === "error" ? "❌ Error" : "ℹ️ Info"}
          </h3>
          <p>{status}</p>
          <button onClick={() => setShowPopup(false)} style={{ marginTop: "15px", background: "#2563eb" }}>
            Close
          </button>
        </div>
      </div>
    )}
  </div>
);
}