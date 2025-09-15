import React, { useRef, useEffect, useState } from "react";
import * as faceapi from "face-api.js";
import { Hands } from "@mediapipe/hands";
import { Camera } from "@mediapipe/camera_utils";

export default function WebcamFace() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [status, setStatus] = useState("loading models...");
  const lastCheckRef = useRef(0);
  const checkIntervalSeconds = 5;
  const handStateRef = useRef(false);
  const handsRef = useRef(null);
  const cameraRef = useRef(null);

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
      startCamera();   // ✅ use startCamera here
    } catch (err) {
      console.error("Model load error:", err);
      setStatus("⚠️ Failed to load models: " + err.message);
    }
  })();
}, []);


  function initHands() {
    const hands = new Hands({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });
    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.5,
    });
    hands.onResults(onHandsResults);
    handsRef.current = hands;
  }

  function startCamera() {
    if (!videoRef.current) return;
    cameraRef.current = new Camera(videoRef.current, {
      onFrame: async () => {
        await handsRef.current.send({ image: videoRef.current });
        drawFrame();
      },
      width: 640,
      height: 480,
    });
    cameraRef.current.start();
    setStatus("✅ webcam started");
  }

  function onHandsResults(results) {
    let raised = false;
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      for (const landmarks of results.multiHandLandmarks) {
        const wrist = landmarks[0];
        const tip = landmarks[12];
        if (tip.y < wrist.y) {
          raised = true;
          break;
        }
      }
    }
    handStateRef.current = raised;
  }

  async function drawFrame() {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!videoRef.current || !videoRef.current.videoWidth) return;

    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

    if (handStateRef.current) {
      const now = Date.now() / 1000;
      if (now - lastCheckRef.current > checkIntervalSeconds) {
        lastCheckRef.current = now;
        setStatus("✋ hand raised → checking face...");
        await doFaceCheck();
      } else {
        setStatus("✋ hand raised (cooldown)");
      }
    } else {
      setStatus("no hand raised");
    }
  }

  async function doFaceCheck() {
    try {
      const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });
      const result = await faceapi
        .detectSingleFace(videoRef.current, options)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!result) {
        setStatus("❌ no face found");
        return;
      }
      setStatus("✅ face found — sending embedding...");

      const embedding = Array.from(result.descriptor);
      const res = await fetch("http://127.0.0.1:8000/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embedding }),
      });
      const json = await res.json();
      if (json.matched) {
        setStatus(`✅ Matched: ${json.student_id} (dist ${json.dist.toFixed(3)})`);
      } else {
        setStatus(`❌ No match (best dist ${json.dist?.toFixed(3) ?? "N/A"})`);
      }
    } catch (err) {
      console.error("Face check error:", err);
      setStatus("⚠️ face check error: " + (err.message || err));
    }
  }

  return (
    <div className="card">
      <h3>Live Camera</h3>
      <div style={{ position: "relative" }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{ width: 640, height: 480, background: "#000" }}
        />
        <canvas
          ref={canvasRef}
          style={{ position: "absolute", left: 0, top: 0 }}
        />
      </div>
      <div style={{ marginTop: 8 }}>
        <small>{status}</small>
      </div>
      <div style={{ marginTop: 8 }}>
        <small>Raise your hand to trigger a face check.</small>
      </div>
    </div>
  );
}
