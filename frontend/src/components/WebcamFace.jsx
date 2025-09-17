import React, { useRef, useEffect, useState } from "react";
import * as faceapi from "face-api.js";
import { Hands } from "@mediapipe/hands";
import { Camera } from "@mediapipe/camera_utils";

export default function WebcamFace() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [status, setStatus] = useState("Loading models...");
  const lastCheckRef = useRef(0);
  const checkIntervalSeconds = 5;
  const handStateRef = useRef(false);
  const handsRef = useRef(null);
  const cameraRef = useRef(null);

  // Load models and start
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
      if (cameraRef.current) {
        cameraRef.current.stop();
      }
    };
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
        if (handsRef.current) {
          await handsRef.current.send({ image: videoRef.current });
        }
        drawFrame();
      },
      width: 640,
      height: 480,
    });
    cameraRef.current.start();
    setStatus("✅ Webcam started — raise hand to check face");
  }

  function onHandsResults(results) {
    let raised = false;
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      for (const landmarks of results.multiHandLandmarks) {
        const wrist = landmarks[0];
        const tip = landmarks[12]; // middle finger tip
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
    const ctx = canvas?.getContext("2d");
    const video = videoRef.current;

    if (!video || !video.videoWidth || !ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    if (handStateRef.current) {
      const now = Date.now() / 1000;
      if (now - lastCheckRef.current > checkIntervalSeconds) {
        lastCheckRef.current = now;
        setStatus("✋ Hand raised → checking face...");
        await doFaceCheck(ctx);
      } else {
        setStatus("✋ Hand raised (cooldown)");
      }
    } else {
      setStatus("No hand raised");
    }
  }

  async function doFaceCheck(ctx) {
    try {
      const options = new faceapi.TinyFaceDetectorOptions({
        inputSize: 224,
        scoreThreshold: 0.5,
      });

      const result = await faceapi
        .detectSingleFace(videoRef.current, options)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!result) {
        setStatus("❌ No face found");
        return;
      }

      // Draw rectangle + landmarks
      const dims = {
        width: videoRef.current.videoWidth,
        height: videoRef.current.videoHeight,
      };
      const resized = faceapi.resizeResults(result, dims);

      faceapi.draw.drawDetections(canvasRef.current, resized);
      faceapi.draw.drawFaceLandmarks(canvasRef.current, resized);

      // Prepare embedding
      const embedding = Array.from(result.descriptor);

      setStatus("📡 Sending embedding to backend...");

      const res = await fetch("http://127.0.0.1:8000/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embedding }),
      });

      const json = await res.json();

      if (json.matched) {
        setStatus(
          `✅ Attendance marked: ${json.student_id} (dist ${json.distance.toFixed(
            3
          )})`
        );
      } else {
        setStatus(
          `❌ No match (closest dist ${json.distance?.toFixed(3) ?? "N/A"})`
        );
      }
    } catch (err) {
      console.error("Face check error:", err);
      setStatus("⚠️ Face check error: " + (err.message || err));
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
