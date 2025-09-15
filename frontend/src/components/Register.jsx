import React, { useRef, useState, useEffect } from "react";
import * as faceapi from "face-api.js";

export default function Register() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [status, setStatus] = useState("Loading models...");
  const [studentId, setStudentId] = useState("");

useEffect(() => {
  (async function loadModelsAndStart() {
    const MODEL_URL = "/models";   
    try {
      setStatus("Loading face-api models...");
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      ]);
      setStatus("✅ Models loaded. Starting webcam...");
      await startVideo();
    } catch (err) {
      console.error("Model load error:", err);
      setStatus("⚠️ Failed to load models: " + err.message);
    }
  })();
}, []);


  async function startVideo() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setStatus("✅ Webcam started — ready to register");
      runDetectionLoop();
    } catch (err) {
      console.error("Webcam error:", err);
      setStatus("Webcam error: " + err.message);
    }
  }

  function runDetectionLoop() {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) return;

    setInterval(async () => {
      if (!video.videoWidth) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });
      const result = await faceapi
        .detectSingleFace(video, options)
        .withFaceLandmarks();

      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (result) {
        const resized = faceapi.resizeResults(result, {
          width: video.videoWidth,
          height: video.videoHeight,
        });
        faceapi.draw.drawDetections(canvas, resized);
        faceapi.draw.drawFaceLandmarks(canvas, resized);
      }
    }, 200);
  }

  async function captureFace() {
    try {
      const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });
      const result = await faceapi
        .detectSingleFace(videoRef.current, options)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!result) {
        setStatus("❌ No face detected — try again");
        return;
      }

      if (!studentId.trim()) {
        setStatus("⚠️ Please enter a student ID first");
        return;
      }

      const embedding = Array.from(result.descriptor);

      const res = await fetch("http://127.0.0.1:8000/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: studentId.trim(),
          name: "Test Student",
          embedding,
          wallet: null,
        }),
      });

      if (res.ok) {
        setStatus("✅ Face registered successfully!");
      } else {
        setStatus("❌ Registration failed");
      }
    } catch (err) {
      console.error("Capture error:", err);
      setStatus("⚠️ Capture error: " + (err.message || err));
    }
  }

  return (
    <div className="card">
      <h3>Register Student</h3>
      <div style={{ position: "relative", display: "inline-block" }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          width="320"
          height="240"
          muted
          style={{ borderRadius: 8, background: "#000" }}
        />
        <canvas
          ref={canvasRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
          }}
        />
      </div>
      <div style={{ marginTop: 8 }}>
        <input
          type="text"
          placeholder="Enter Student ID"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          style={{ padding: 6, marginRight: 8 }}
        />
        <button onClick={captureFace} style={{ padding: "6px 12px" }}>
          Capture & Register
        </button>
      </div>
      <div style={{ marginTop: 8 }}>
        <small>{status}</small>
      </div>
    </div>
  );
}
