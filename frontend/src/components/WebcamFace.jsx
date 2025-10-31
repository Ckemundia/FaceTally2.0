import React, { useRef, useEffect, useState } from "react";
import * as faceapi from "face-api.js";

export default function WebcamFace({ onFaceMatched, pauseDetection }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [status, setStatus] = useState("Loading models...");
  const streamRef = useRef(null);
  const animationRef = useRef(null);
  const processingRef = useRef(false);
  const modelsLoadedRef = useRef(false);

  useEffect(() => {
    async function loadModelsAndStart() {
      const MODEL_URL = "/models";

      try {
        // ✅ Only load models once
        if (!modelsLoadedRef.current) {
          setStatus("⏳ Loading face-api models...");
          await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          ]);
          modelsLoadedRef.current = true;
        }

        setStatus("🎥 Starting webcam...");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, frameRate: 15 },
        });

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        detectLoop();
      } catch (err) {
        console.error("Model load error:", err);
        setStatus("⚠️ Failed to initialize: " + err.message);
      }
    }

    async function detectLoop() {
      if (!videoRef.current || pauseDetection) {
        animationRef.current = requestAnimationFrame(detectLoop);
        return;
      }

      if (videoRef.current.readyState !== 4) {
        animationRef.current = requestAnimationFrame(detectLoop);
        return;
      }

      const options = new faceapi.TinyFaceDetectorOptions({
        inputSize: 160, // 🔹 smaller = faster (good for demos)
        scoreThreshold: 0.5,
      });

      const result = await faceapi
        .detectSingleFace(videoRef.current, options)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (result && !processingRef.current) {
        processingRef.current = true;
        const embedding = Array.from(result.descriptor).map((v) => Number(v));

        if (embedding.length === 128) {
          setStatus("📡 Checking face in database...");
          await doFaceCheck(embedding);
        }

        processingRef.current = false;
      }

      animationRef.current = requestAnimationFrame(detectLoop);
    }

    async function doFaceCheck(embedding) {
      try {
        const res = await fetch(`/api/match`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ embedding }),
        });

        const data = await res.json();
        console.log("[DEBUG] Match API response:", data);

        if (data.matched && data.student) {
          const student = {
            student_id: data.student.student_id,
            name: data.student.name,
            wallet: data.student.wallet,
          };

          setStatus(`✅ Match found: ${student.name}`);
          stopWebcam();

          // Notify parent one time
          if (onFaceMatched) onFaceMatched(student);
        } else {
          setStatus("❌ No match found, try again.");
        }
      } catch (err) {
        console.error("❌ Match request failed:", err);
        setStatus("⚠️ Match error: " + (err.message || err));
      }
    }

    function stopWebcam() {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      cancelAnimationFrame(animationRef.current);
    }

    loadModelsAndStart();
    return stopWebcam;
  }, [pauseDetection, onFaceMatched]);

  return (
    <div style={{ position: "relative" }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        width={320}
        height={240}
        style={{
          width: "100%",
          borderRadius: "10px",
          border: "2px solid #38bdf8",
        }}
      />
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", top: 0, left: 0 }}
      />
      <p style={{ color: "#e2e8f0", marginTop: "8px" }}>{status}</p>
    </div>
  );
}
