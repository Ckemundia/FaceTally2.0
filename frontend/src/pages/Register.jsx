import React, { useRef, useState, useEffect } from "react";
import * as faceapi from "face-api.js";
import { useNavigate } from "react-router-dom";
import WalletInput from "../components/WalletInput";

export default function Register() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [status, setStatus] = useState("Loading models...");
  const [studentId, setStudentId] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  // Load models and start webcam
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

        // Delay start to ensure <video> ref exists
        setTimeout(() => {
          startCamera();
        }, 300);
      } catch (err) {
        console.error("Model load error:", err);
        setStatus("⚠️ Failed to load models: " + err.message);
      }
    })();
  }, []);

  function startCamera() {
    if (!videoRef.current) {
      console.error("Video ref not ready yet");
      return;
    }
    navigator.mediaDevices
      .getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
      })
      .then((stream) => {
        videoRef.current.srcObject = stream;
        videoRef.current.play(); // ✅ ensure playback starts
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

      // Check student ID
      if (!studentId.trim()) {
        setStatus("⚠️ Please enter a student ID first");
        setLoading(false);
        return;
      }

      // Check wallet
      if (!walletAddress) {
        setStatus("⚠️ Please confirm your HBAR wallet address first");
        setLoading(false);
        return;
      }

      const options = new faceapi.TinyFaceDetectorOptions({
        inputSize: 224,
        scoreThreshold: 0.5,
      });

      // Detect face
      const result = await faceapi
        .detectSingleFace(videoRef.current, options)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!result) {
        setStatus("❌ No face detected — try again");
        setLoading(false);
        return;
      }

      // Convert descriptor to normal array of floats
      let embedding = Array.from(result.descriptor).map((v) => Number(v));

      // Ensure valid length
      if (embedding.length !== 128) {
        setStatus(
          `❌ Invalid embedding length: ${embedding.length} (must be 128)`
        );
        console.error("Embedding:", embedding);
        setLoading(false);
        return;
      }

      // Draw detection box + landmarks
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

      // Prepare payload
      const payload = {
        student_id: studentId.trim(),
        name: "Test Student", // replace with actual name if you have an input
        embedding,
      };
      if (walletAddress) payload.wallet = walletAddress;
      payload.network = "testnet";

      console.log("Payload to backend:", payload);

      setStatus("📡 Sending data to backend...");

      const res = await fetch("http://127.0.0.1:8000/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && data.ok) {
        setStatus("✅ Registered successfully!");
        setTimeout(() => navigate("/dashboard"), 1500);
      } else {
        setStatus("❌ Registration failed: " + (data.detail || "unknown error"));
        console.error("Backend error:", data);
      }
    } catch (err) {
      console.error("Capture error:", err);
      setStatus("⚠️ Capture error: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h3>Register Student</h3>

      {/* Wallet Input Component */}
      <WalletInput
        walletAddress={walletAddress}
        setWalletAddress={setWalletAddress}
      />

      {/* Video feed + canvas */}
      <div style={{ position: "relative", display: "inline-block" }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{ width: 640, height: 480, background: "#000" }}
        />
        <canvas
          ref={canvasRef}
          style={{ position: "absolute", top: 0, left: 0 }}
        />
      </div>

      {/* Student ID Input */}
      <div style={{ marginTop: 8 }}>
        <input
          type="text"
          id="studentId"
          name="studentId"
          placeholder="Enter Student ID"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          style={{ padding: 6, marginRight: 8 }}
        />
      </div>

      {/* Register Button */}
      <div style={{ marginTop: 12 }}>
        <button
          onClick={captureFace}
          disabled={loading}
          style={{
            padding: "8px 16px",
            background: loading ? "#888" : "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Registering..." : "Register Now"}
        </button>
      </div>

      {/* Status */}
      <div style={{ marginTop: 8 }}>
        <small>{status}</small>
      </div>
    </div>
  );
}
