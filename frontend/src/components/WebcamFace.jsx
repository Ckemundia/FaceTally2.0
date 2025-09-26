import React, { useRef, useEffect, useState } from "react";
import * as faceapi from "face-api.js";
import { Hands } from "@mediapipe/hands";
import { Camera } from "@mediapipe/camera_utils";

export default function WebcamFace({ selectedUnit, onAttendanceMarked }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [status, setStatus] = useState("Loading models...");
  const [loading, setLoading] = useState(false);
  const lastCheckRef = useRef(0);
  const checkIntervalSeconds = 5;
  const handStateRef = useRef(false);
  const handsRef = useRef(null);
  const cameraRef = useRef(null);

  // 🚀 Load models & start camera
  useEffect(() => {
    (async function init() {
      const MODEL_URL = "/models";
      try {
        setStatus("⏳ Loading face-api models...");
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        ]);

        setStatus("✅ Models loaded. Initializing hand tracking...");
        initHands();
        startCamera();
      } catch (err) {
        console.error("Model load error:", err);
        setStatus("⚠️ Failed to load models: " + err.message);
      }
    })();

    return () => {
      if (cameraRef.current) cameraRef.current.stop();
    };
  }, []);

  // 🖐️ Initialize hand tracking
  function initHands() {
    const hands = new Hands({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${file}`,
    });

    hands.setOptions({
      selfieMode: true,
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7,
    });

    hands.onResults(onHandsResults);
    handsRef.current = hands;
  }

  // 📸 Start camera
  function startCamera() {
    if (!videoRef.current) return;
    cameraRef.current = new Camera(videoRef.current, {
      onFrame: async () => {
        if (handsRef.current)
          await handsRef.current.send({ image: videoRef.current });
        drawFrame();
      },
      width: 640,
      height: 480,
    });
    cameraRef.current.start();
    setStatus("✅ Webcam started — raise your hand to check face");
  }

  // 🖐️ Hand detection
  function onHandsResults(results) {
    let raised = false;
    if (results.multiHandLandmarks?.length > 0) {
      for (const landmarks of results.multiHandLandmarks) {
        const wrist = landmarks[0];
        const tip = landmarks[12]; // middle finger tip
        if (tip.y < wrist.y - 0.1) {
          raised = true;
          break;
        }
      }
    }
    handStateRef.current = raised;
  }

  // 🎥 Draw + trigger check
  async function drawFrame() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const video = videoRef.current;
    if (!video || !video.videoWidth || !ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    if (handStateRef.current) {
      const now = Date.now() / 1000;
      if (now - lastCheckRef.current > checkIntervalSeconds) {
        lastCheckRef.current = now;
        setStatus("✋ Hand raised → checking face...");
        setTimeout(() => doFaceCheck(), 400);
      } else {
        setStatus("✋ Hand raised (cooldown)");
      }
    } else {
      setStatus("No hand raised");
    }
  }

  // 🧠 Detect + match
  async function doFaceCheck() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) {
      setStatus("📸 Waiting for camera...");
      return;
    }

    try {
      setLoading(true);
      const options = new faceapi.TinyFaceDetectorOptions({
        inputSize: 224,
        scoreThreshold: 0.5,
      });

      const result = await faceapi
        .detectSingleFace(video, options)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!result) {
        setStatus("❌ No face detected — please look straight at camera");
        return;
      }

      // Draw face box
      const dims = { width: video.videoWidth, height: video.videoHeight };
      const resized = faceapi.resizeResults(result, dims);
      faceapi.matchDimensions(canvasRef.current, dims);
      faceapi.draw.drawDetections(canvasRef.current, resized);
      faceapi.draw.drawFaceLandmarks(canvasRef.current, resized);

      // Send embedding to backend
      const embedding = Array.from(result.descriptor);
      setStatus("📡 Matching face...");

      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embedding }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.detail || "Match failed");

      if (data.matched) {
        setStatus(`✅ Match found: ${data.student_id}`);
        await sendAttendance(data.student_id);
      } else {
        setStatus("❌ No match found");
      }
    } catch (err) {
      console.error("Face check error:", err);
      setStatus("⚠️ Face check error: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  // 🗂️ Attendance submission
  async function sendAttendance(student_id) {
    if (!selectedUnit) {
      setStatus("⚠️ Please select a unit first!");
      return;
    }
    try {
      setStatus("📡 Marking attendance...");
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id,
          unit: selectedUnit,
          txid: null,
        }),
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        setStatus(`🎉 Attendance recorded for ${student_id}`);
        if (onAttendanceMarked)
          onAttendanceMarked({ student_id, unit: selectedUnit });
      } else {
        setStatus("⚠️ " + (data.detail || "Attendance failed"));
      }
    } catch (err) {
      console.error("Attendance error:", err);
      setStatus("⚠️ Attendance request failed");
    }
  }

  return (
    <div className="card webcam-card" style={{ position: "relative" }}>
      <h2 className="section-title" style={{ color: "#60a5fa" }}>
        📷 Face Attendance
      </h2>

      <div className="camera-box" style={{ position: "relative" }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="camera-feed"
          style={{
            width: "100%",
            borderRadius: "10px",
            border: "2px solid #2563eb",
          }}
        />
        <canvas
          ref={canvasRef}
          className="camera-overlay"
          style={{ position: "absolute", top: 0, left: 0 }}
        />
      </div>

      <p
        style={{
          marginTop: "10px",
          fontSize: "0.9rem",
          color: status.startsWith("✅") || status.startsWith("🎉")
            ? "#4ade80"
            : status.startsWith("⚠️") || status.startsWith("❌")
            ? "#f87171"
            : "#cbd5e1",
        }}
      >
        {loading ? "⏳ Processing..." : status}
      </p>

      <small style={{ color: "#fbbf24" }}>
        ✋ Raise your hand to trigger face detection
      </small>
    </div>
  );
}
