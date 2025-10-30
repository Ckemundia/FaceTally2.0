import React, { useRef, useEffect, useState } from "react";
import * as faceapi from "face-api.js";

export default function WebcamFace({ selectedUnit, onAttendanceMarked, disabled, pauseDetection }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [status, setStatus] = useState("Loading models...");
  const [recognizedStudent, setRecognizedStudent] = useState(null);
  const processingRef = useRef(false);
  const attendanceRef = useRef(false);

  useEffect(() => {
    let stream;
    let animationFrame;

    async function loadModelsAndStart() {
      const MODEL_URL = "/models";
      try {
        setStatus("⏳ Loading face-api models...");
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        ]);
        setStatus("✅ Models loaded. Starting webcam...");

        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 } },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        detectLoop();
      } catch (err) {
        console.error("Model load error:", err);
        setStatus("⚠️ Failed to load models: " + err.message);
      }
    }

    async function detectLoop() {
      if (!videoRef.current) return;

      // 🛑 Stop detection loop completely when paused
      if (pauseDetection) {
        cancelAnimationFrame(animationFrame);
        return;
      }

      if (videoRef.current.readyState !== 4) {
        animationFrame = requestAnimationFrame(detectLoop);
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

      if (result) {
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

        const embedding = Array.from(result.descriptor).map((v) => Number(v));

        // 🔹 Only check if we haven't recognized a student yet
        if (embedding.length === 128 && !processingRef.current && !recognizedStudent) {
          processingRef.current = true; // lock processing
          setStatus("📡 Checking face against database...");
          await doFaceCheck(embedding);
        }

      }

      animationFrame = requestAnimationFrame(detectLoop);
    }

    async function doFaceCheck(embedding) {
      // Helper to get current location
      async function getCurrentLocation() {
        return new Promise((resolve, reject) => {
          if (!navigator.geolocation) {
            reject("Geolocation not supported by this browser");
          } else {
            navigator.geolocation.getCurrentPosition(
              (pos) => resolve({
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
              }),
              (err) => reject(err.message || "Location access denied")
            );
          }
        });
      }

      try {
        const res = await fetch("/api/match", {
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
          setRecognizedStudent(student);
          setStatus(`✅ Match found: ${student.name} (${student.student_id})`);

          if (attendanceRef.current) {
            console.log("⚠️ Attendance already marked, skipping duplicate.");
            return;
          }
          attendanceRef.current = true;

          // 🧠 Stop detection + webcam right after successful match
          if (videoRef.current?.srcObject) {
            videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
          }
          cancelAnimationFrame(animationFrame);

          // 🟢 If a unit is selected, mark attendance immediately
          if (selectedUnit) {
            try {
              setStatus("📍 Getting location...");
              const { lat, lng } = await getCurrentLocation();

              setStatus("📝 Marking attendance...");
              const res2 = await fetch("/api/attendance", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  student_id: student.student_id,
                  unit: selectedUnit,
                  lat,
                  lng,
                }),
              });

              const data2 = await res2.json();
              console.log("[DEBUG] Attendance API response:", data2);

              if (data2.ok) {
                setStatus(`✅ Attendance recorded for ${selectedUnit}`);

                // 🛑 Stop webcam detection right away
                if (videoRef.current?.srcObject) {
                  videoRef.current.srcObject.getTracks().forEach(track => track.stop());
                }
                cancelAnimationFrame(animationFrame);

                // 🎁 Automatically send reward
                const rewardRes = await fetch("/api/reward/give", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    student_wallet: student.wallet,
                    amount: 1,
                  }),
                });

                const rewardData = await rewardRes.json();
                console.log("[DEBUG] Reward API response:", rewardData);

                //  Notify Dashboard to show popup modal
                if (onAttendanceMarked) {
                  onAttendanceMarked({
                    student,
                    attendanceRecorded: true,
                    rewardInfo: rewardData,
                  });
                }
              } else {
                setStatus(`⚠️ ${data2.detail || "Attendance failed"}`);
              }
            } catch (err) {
              console.error("❌ Attendance marking failed:", err);
              setStatus("⚠️ Attendance request failed");
            }

          }

        } else if (data.matched && !data.student) {
          setStatus("⚠️ Match found, but student details missing");
          console.warn("Student details missing! Debug info:", data.debug);
        } else {
          setStatus("❌ No match found");
        }
      } catch (err) {
        console.error("❌ Match request failed:", err);
        setStatus("⚠️ Match error: " + (err.message || err));
      }
      finally {

        processingRef.current = false;
      }
    }


    loadModelsAndStart();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      cancelAnimationFrame(animationFrame);
    };
  }, [selectedUnit, disabled, onAttendanceMarked, pauseDetection]);

  // ✅ Resume detection automatically when unpaused
  useEffect(() => {
    if (!pauseDetection && videoRef.current && videoRef.current.srcObject) {
      requestAnimationFrame(() => detectLoop());
    }
  }, [pauseDetection]);


  return (
    <div style={{ position: "relative" }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ width: "100%", borderRadius: "10px", border: "2px solid #2563eb" }}
      />
      <canvas ref={canvasRef} style={{ position: "absolute", top: 0, left: 0 }} />
      <p style={{ color: "#fff", marginTop: "8px" }}>{status}</p>
    </div>
  );
}
