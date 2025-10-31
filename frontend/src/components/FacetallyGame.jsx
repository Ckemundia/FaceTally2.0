import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Canvas Dimensions 
const GAME_WIDTH = 900;
const GAME_HEIGHT = 600;

const ASSET_BASE = "/assets";
const ASSET_OBJECTS = {
  logo: `${ASSET_BASE}/fallingobjects/logo.png`,
  fakelogo: `${ASSET_BASE}/fallingobjects/fakelogo.png`,
  rock1: `${ASSET_BASE}/fallingobjects/rock1.png`,
  rock2: `${ASSET_BASE}/fallingobjects/rock2.png`,
  bomb: `${ASSET_BASE}/fallingobjects/bomb.png`,
  happy1: `${ASSET_BASE}/fallingobjects/happyclock1.png`,
  happy2: `${ASSET_BASE}/fallingobjects/happyclock2.png`,
  evilclock: `${ASSET_BASE}/fallingobjects/evilclock.png`,
};
const ASSET_BASKET = `${ASSET_BASE}/basket/basket1.png`;
const ASSET_SOUNDS = {
  bg: `${ASSET_BASE}/sounds/bg.mp3`,
  catch: `${ASSET_BASE}/sounds/catch.mp3`,
  hit: `${ASSET_BASE}/sounds/hit.mp3`,
  bomb: `${ASSET_BASE}/sounds/bomb.mp3`,
  clock: `${ASSET_BASE}/sounds/clock.mp3`,
  victory: `${ASSET_BASE}/sounds/victory.mp3`,
  lose: `${ASSET_BASE}/sounds/lose.mp3`,
};

export default function FacetallyCatchGame() {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [timeLeft, setTimeLeft] = useState(60);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => parseInt(localStorage.getItem("facetally_best") || "0"));
  const [message, setMessage] = useState("");
  const [gameOver, setGameOver] = useState(false);
  const [showStart, setShowStart] = useState(true);
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);


  const stateRef = useRef({
    objects: [],
    basketX: 0,
    basketW: 120,
    basketH: 64,
    spawnInterval: 900,
    difficultyTimer: 0,
    speedMultiplier: 1,
    width: 900,
    height: 520,
    keys: { left: false, right: false },
    mouseX: null,
  });

  const imagesRef = useRef({});
  const soundsRef = useRef({});

  useEffect(() => {
    try {
      const seen = localStorage.getItem("facetally_instructions_seen");
      if (!seen) {
        setShowInstructions(true);

      }
    } catch (err) {
      console.warn("LocalStorage unavailable:", err);
      setShowInstructions(true);
    }
  }, []);

  //LOAD IMAGES + SOUNDS (safe version with loading overlay)
  useEffect(() => {
    const imgs = {};
    const toLoad = { ...ASSET_OBJECTS, basket: ASSET_BASKET };
    let loadedCount = 0;
    const total = Object.keys(toLoad).length;

    Object.entries(toLoad).forEach(([k, src]) => {
      const img = new Image();
      img.onload = () => {
        loadedCount++;
        imgs[k] = img;
        if (loadedCount === total) {
          console.log("✅ All images loaded");
          imagesRef.current = imgs;
          setAssetsLoaded(true);
        }
      };
      img.onerror = (e) => {
        console.warn(`⚠️ Failed to load image: ${src}`, e);
        loadedCount++;
        imgs[k] = null;
        if (loadedCount === total) {
          imagesRef.current = imgs;
          setAssetsLoaded(true);
        }
      };
      img.src = src;
    });

    soundsRef.current.bg = new Audio(ASSET_SOUNDS.bg);
    soundsRef.current.bg.loop = true;
    soundsRef.current.bg.volume = 0.2;
    ["catch", "hit", "bomb", "clock", "victory", "lose"].forEach(k => {
      soundsRef.current[k] = new Audio(ASSET_SOUNDS[k]);
    });
  }, []);

  // Resize Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const resize = () => {
      const w = GAME_WIDTH;
      const h = GAME_HEIGHT;
      stateRef.current.width = w;
      stateRef.current.height = h;
      canvas.width = w * devicePixelRatio;
      canvas.height = h * devicePixelRatio;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext("2d");
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      stateRef.current.basketX = w / 2 - stateRef.current.basketW / 2;
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // 🎮 Handle keyboard and mouse movement (with spacebar pause)
  useEffect(() => {
    const s = stateRef.current;

    const handleKeyDown = (e) => {
      if (e.key === "ArrowLeft" || e.key === "a") s.keys.left = true;
      if (e.key === "ArrowRight" || e.key === "d") s.keys.right = true;

      //  Spacebar toggles pause
      if (e.code === "Space") {
        e.preventDefault(); // stop page scroll
        setPaused((p) => !p);
      }
    };

    const handleKeyUp = (e) => {
      if (e.key === "ArrowLeft" || e.key === "a") s.keys.left = false;
      if (e.key === "ArrowRight" || e.key === "d") s.keys.right = false;
    };

    const handleMouseMove = (e) => {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      s.mouseX = x;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  const tryPlay = (key) => {
    if (!soundOn) return;
    const a = soundsRef.current[key];
    if (a) {
      a.currentTime = 0;
      a.play().catch(() => { });
    }
  };
  //  Control background music
  const controlBGMusic = (play) => {
    const bg = soundsRef.current.bg;
    if (!bg) return;

    if (play && soundOn) {
      bg.loop = true;
      bg.volume = 0.4;
      bg.currentTime = 0;
      bg.play().catch(() => { });
    } else {
      bg.pause();
      bg.currentTime = 0;
    }
  };

  const spawnObject = () => {
    const { width } = stateRef.current;
    const elapsed = 60 - timeLeft; // seconds passed
    const progress = Math.min(1, elapsed / 60); // clamp 0–1

    // 💣 Bomb chance: starts 15%, ends 80%
    const bombChance = 0.15 + progress * 0.65;

    // 🎲 Choose object type
    const roll = Math.random();
    let type = "logo";
    if (roll < bombChance) type = "bomb";
    else if (roll < 0.55) type = "logo";
    else if (roll < 0.7) type = "fakelogo";
    else if (roll < 0.85) type = "rock1";
    else if (roll < 0.9) type = "rock2";
    else if (roll < 0.95) type = "happy1";
    else type = "happy2";

    const sizeMap = {
      logo: 100, fakelogo: 110, rock1: 90, rock2: 138,
      bomb: 89, happy1: 80, happy2: 70, evilclock: 100,
    };

    const w = sizeMap[type];
    const x = Math.random() * (width - w - 20) + 10;

    // ⚡ Speed ramps up more aggressively
    const baseSpeed = 2 + progress * 5; // start at 2× → end at 7×
    const speed = (baseSpeed + Math.random() * 1.8) * stateRef.current.speedMultiplier;

    stateRef.current.objects.push({ id: Math.random(), type, x, y: -w, w, h: w, speed });

    // 💥 Add more simultaneous bombs (especially later)
    const extraBombs = progress < 0.3 ? 0 : progress < 0.7 ? 1 : 2;
    for (let i = 0; i < extraBombs; i++) {
      const bx = Math.random() * (width - 80) + 10;
      stateRef.current.objects.push({
        id: Math.random(),
        type: "bomb",
        x: bx,
        y: -90 * (i + 1),
        w: 90,
        h: 90,
        speed: 3 + Math.random() * 4,
      });
    }

    // Final 15s = bomb storm
    if (timeLeft <= 15) {
      for (let i = 0; i < 3; i++) {
        const bx = Math.random() * (width - 90) + 10;
        stateRef.current.objects.push({
          id: Math.random(),
          type: "bomb",
          x: bx,
          y: -100 * i,
          w: 90,
          h: 90,
          speed: 3 + Math.random() * 5,
        });
      }
    }

    // 🕒 Faster spawn rate — minimum 150 ms
    const baseInterval = 1200; // start slower
    const minInterval = 150;   // much faster
    const currentInterval = Math.max(baseInterval - elapsed * 25, minInterval);

    clearTimeout(stateRef.current.spawnTimeout);
    stateRef.current.spawnTimeout = setTimeout(spawnObject, currentInterval);
  };

  const handleCatch = (o) => {
    if (gameOver) return;
    switch (o.type) {
      case "logo":
        setScore(s => {
          const next = s + 10;
          if (next > best) {
            setBest(next);
            localStorage.setItem("facetally_best", next.toString());
          }
          return next;
        });
        tryPlay("catch");
        setMessage("+10!");
        break;
      case "fakelogo":
        setScore(s => Math.max(0, s - 5));
        tryPlay("hit");
        setMessage("Trap! -5");
        break;
      case "rock1":
        setTimeLeft(t => Math.max(0, t - 3));
        tryPlay("hit");
        break;
      case "rock2":
        setTimeLeft(t => Math.max(0, t - 6));
        tryPlay("hit");
        break;
      case "bomb":
        tryPlay("lose");
        controlBGMusic(false);
        setMessage("💣 Boom! Game Over");
        setTimeout(() => {
          setGameOver(true);
          setRunning(false);
        }, 300);
        break;
      case "happy1":
        setTimeLeft(t => Math.min(60, t + 5)); //never exceed 60
        tryPlay("catch");
        setMessage("+5s (max 60)");
        break;
      case "happy2":
        setTimeLeft(t => Math.min(60, t + 10)); //never exceed 60
        tryPlay("catch");
        setMessage("+10s (max 60)");
        break;

      case "evilclock":
        stateRef.current.speedMultiplier *= 1.8;
        tryPlay("hit");
        setTimeout(() => {
          stateRef.current.speedMultiplier = Math.max(1, stateRef.current.speedMultiplier / 1.8);
        }, 5000);
        break;
      default:
        break;
    }
  };

  const collide = (a, bx, by, bw, bh) => !(a.x + a.w < bx || a.x > bx + bw || a.y + a.h < by || a.y > by + bh);

  // Main loop with pre-check for loaded assets
  useEffect(() => {
    if (!running) return;
    const ctx = canvasRef.current.getContext("2d");

    const timer = setInterval(() => {
      if (!paused && running && !gameOver) {
        setTimeLeft(t => {
          if (t <= 1) {
            setRunning(false);
            controlBGMusic(false);
            setTimeout(() => {
              setGameOver(true);
              setMessage("🏆 You Survived!");
              tryPlay("victory");
              triggerConfetti();
            }, 200);
            return 0;
          }
          return t - 1;
        });
      }
    }, 1000);

    const loop = (ts) => {
      if (!assetsLoaded) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      if (paused || !running || gameOver) {
        rafRef.current = requestAnimationFrame(loop);
        drawFrame(ctx);
        return;
      }

      const s = stateRef.current;
      for (const o of s.objects) o.y += o.speed * 1.4;
      if (Math.random() < 0.02) spawnObject();

      const basketY = s.height - 12 - s.basketH;
      for (let i = s.objects.length - 1; i >= 0; i--) {
        const o = s.objects[i];
        if (o.y > s.height) s.objects.splice(i, 1);
        else if (collide(o, s.basketX, basketY, s.basketW, s.basketH)) {
          handleCatch(o);
          s.objects.splice(i, 1);
        }
      }
      const moveSpeed = 14;
      if (s.keys.left) s.basketX -= moveSpeed;
      if (s.keys.right) s.basketX += moveSpeed;
      if (s.mouseActive && s.mouseX !== null) {
        s.basketX += (s.mouseX - (s.basketX + s.basketW / 2)) * 0.15;
      }
      s.basketX = Math.max(0, Math.min(s.width - s.basketW, s.basketX));

      drawFrame(ctx);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      clearInterval(timer);
    };
  }, [running, paused, gameOver, assetsLoaded]);

  const drawFrame = (ctx) => {
    const s = stateRef.current;
    ctx.clearRect(0, 0, s.width, s.height);
    const g = ctx.createLinearGradient(0, 0, 0, s.height);
    g.addColorStop(0, "rgba(11, 21, 48, 0.3)");
    g.addColorStop(1, "rgba(8, 16, 33, 0.3)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s.width, s.height);

    for (const o of s.objects) {
      const img = imagesRef.current[o.type];
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, o.x, o.y, o.w, o.h);
      } else {
        ctx.fillStyle = "#fff";
        ctx.fillRect(o.x, o.y, o.w, o.h);
      }
    }

    const basket = imagesRef.current.basket;
    const bx = s.basketX;
    const by = s.height - 12 - s.basketH;
    if (basket && basket.complete && basket.naturalWidth > 0) {
      ctx.drawImage(basket, bx, by, s.basketW, s.basketH);
    }
  };

  const startGame = () => {
    setShowStart(false);
    setGameOver(false);
    setRunning(true);
    setScore(0);
    setTimeLeft(60);

    stateRef.current.objects = [];
    stateRef.current.speedMultiplier = 1;

    clearTimeout(stateRef.current.spawnTimeout);
    spawnObject(); //Start spawning objects immediately

    tryPlay("clock");
    controlBGMusic(true);
  };

  const restart = () => {
    setGameOver(false);
    setRunning(true);
    setScore(0);
    setTimeLeft(60);
    stateRef.current.objects = [];
    controlBGMusic(true);
  };

  const triggerConfetti = () => {
    const canvas = document.createElement("canvas");
    canvas.style.position = "absolute";
    canvas.style.inset = 0;
    canvas.style.zIndex = 999;
    canvas.style.pointerEvents = "none";
    document.body.appendChild(canvas);

    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const confettis = Array.from({ length: 150 }).map(() => ({
      x: Math.random() * canvas.width,
      y: Math.random() * -canvas.height,
      r: Math.random() * 6 + 2,
      c: `hsl(${Math.random() * 360}, 100%, 60%)`,
      s: Math.random() * 3 + 2,
    }));

    let animation;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      confettis.forEach(cf => {
        cf.y += cf.s;
        if (cf.y > canvas.height) cf.y = 0;
        ctx.beginPath();
        ctx.arc(cf.x, cf.y, cf.r, 0, Math.PI * 2);
        ctx.fillStyle = cf.c;
        ctx.fill();
      });
      animation = requestAnimationFrame(draw);
    };

    draw();
    setTimeout(() => {
      cancelAnimationFrame(animation);
      canvas.remove();
    }, 5000);
  };

  const glassPanel = {
    background: "rgba(255, 255, 255, 0.1)",
    backdropFilter: "blur(20px) saturate(180%)",
    WebkitBackdropFilter: "blur(20px) saturate(180%)", // Safari support
    border: "1px solid rgba(255, 255, 255, 0.2)",
    borderRadius: 16,
    boxShadow:
      "0 8px 32px rgba(0,0,0,0.3), inset 0 0 25px rgba(255,255,255,0.05)",
    padding: 16,
    transition: "all 0.3s ease",
    color: "#e5e7eb",
    zIndex: 1,
  };

  const iconBtnStyle = {
    width: 48,
    height: 48,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.15)",
    border: "1px solid rgba(255,255,255,0.3)",
    color: "#fff",
    fontSize: 22,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backdropFilter: "blur(6px)",
    transition: "transform 0.2s ease, box-shadow 0.3s ease",
  };

  const iconBtnHover = {
    transform: "scale(1.1)",
    boxShadow: "0 0 15px rgba(255,255,255,0.4)",
  };

  const btnStyle = {
    padding: "10px 22px",
    borderRadius: 12,
    background: "linear-gradient(90deg,#60a5fa,#7c3aed)",
    border: "none",
    color: "#fff",
    fontWeight: "bold",
    cursor: "pointer",
    transition: "all 0.3s ease",
    boxShadow: "0 0 10px rgba(96,165,250,0.4)",
  };

  const btnHover = {
    transform: "scale(1.05)",
    boxShadow: "0 0 25px rgba(124,58,237,0.6)",
  };

  const overlayStyle = {
    position: "absolute",
    inset: 0,
    background: "rgba(0, 0, 0, 0.3)",
    backdropFilter: "blur(10px) brightness(1.1)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
    borderRadius: 20,
  };

  const overlayInner = {
    textAlign: "center",
    color: "#e0eaff",
    animation: "fadeIn 0.8s ease forwards",
  };

  // UI + Overlays
  return (
    <div style={{ position: "relative", minHeight: "100vh", overflow: "hidden" }}>
      {/* ✨ Floating Background Circles (move to background layer) */}
      <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
        <div className="circle circle1" />
        <div className="circle circle2" />
        <div className="circle circle3" />
        <div className="circle circle4" />
        <div className="circle circle5" />
        <div className="circle circle6" />
      </div>

      {/* Main Layout */}
      <div
        style={{
          position: "relative",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          padding: 24,
          gap: 24,
          zIndex: 1,
        }}
      >
        {/* LEFT PANEL */}
        <div style={{ ...glassPanel, width: 240 }}>
          <h3 style={{ color: "#fff", marginBottom: 8 }}>⏱ Time Left</h3>
          <div style={{ fontSize: 32, marginBottom: 12 }}>{Math.max(0, timeLeft)}s</div>
          <div>Score: <b>{score}</b></div>
          <div>Best: {best}</div>

          {/* Divider line for visual separation */}
          <div
            style={{
              height: 1,
              background: "rgba(255,255,255,0.15)",
              margin: "16px 0",
            }}
          />

          {/*  Coming Soon Section */}
          <div style={{ fontSize: 14, lineHeight: 1.6, color: "#d1d5db" }}>
            <p style={{ marginBottom: 6 }}>
              💰 <strong>POP$ Token Rewards</strong> — coming soon when we go live!
            </p>
            <p style={{ marginBottom: 6 }}>
              🔒 Game will unlock after a <strong>7-day perfect attendance streak</strong>.
            </p>
            <p style={{ opacity: 0.8 }}>
              For now, enjoy the demo version — more updates coming soon!
            </p>
          </div>
          <div
            style={{
              fontSize: 12,
              opacity: 0.6,
              marginTop: 20,
              textAlign: "center",
            }}
          >
            © {new Date().getFullYear()} Facetally
          </div>
        </div>


        {/* 🎮 CENTER CANVAS AREA */}
        <div
          style={{
            flex: 1,
            position: "relative",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 2,
          }}
        >
          {/* Glassy Canvas Container */}
          <div
            style={{
              ...glassPanel,
              width: `${GAME_WIDTH}px`,
              height: `${GAME_HEIGHT}px`,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              borderRadius: 20,
              boxShadow: "0 0 35px rgba(0,0,0,0.4)",
              position: "relative",
              overflow: "hidden",
              backdropFilter: "blur(12px)",
              background: "rgba(255, 255, 255, 0.03)",
            }}
          >
            <canvas
              ref={canvasRef}
              style={{
                borderRadius: 20,
                background: "transparent",
                width: "100%",
                height: "100%",
              }}
            />
            {/* 🧾 Instructions Popup */}
            <AnimatePresence>
              {showInstructions && (
                <motion.div
                  key="instructions"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(0,0,0,0.75)",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    zIndex: 9999,
                    backdropFilter: "blur(6px)",
                  }}
                >
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    style={{
                      background: "#1e293b",
                      color: "#e2e8f0",
                      padding: "28px",
                      borderRadius: "12px",
                      width: "90%",
                      maxWidth: "420px",
                      boxShadow: "0 0 25px rgba(34,211,238,0.4)",
                      textAlign: "center",
                    }}
                  >
                    <h2 style={{ color: "#38bdf8", marginBottom: "12px" }}>
                      🕹️ How to Play FaceTally Catch
                    </h2>
                    <p style={{ marginBottom: "20px", lineHeight: "1.5" }}>
                      Catch real <b>FaceTally logos</b> to score points.<br />
                      Avoid bombs and rocks — they end your run!<br />
                      Catch happy clocks for bonus time.<br />
                      ⏱Survive 60 seconds to win!<br />
                      *Use arrow keys to move left and right<br />
                      *Press spacebar to pause the game
                      All the best champ!!🦾
                    </p>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setShowInstructions(false)}
                      style={{
                        background: "#38bdf8",
                        color: "#0f172a",
                        border: "none",
                        padding: "10px 18px",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontWeight: 600,
                      }}
                    >
                      Got it!
                    </motion.button>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>


            {/* Loading Overlay */}
            {!assetsLoaded && (
              <div style={overlayStyle}>
                <div style={overlayInner}>
                  <h2>Loading assets...</h2>
                  <p>Please wait ⏳</p>
                </div>
              </div>
            )}

            {/* Start Overlay */}
            {assetsLoaded && showStart && (
              <div style={overlayStyle}>
                <div style={overlayInner}>
                  <h1 style={{ fontSize: 42, marginBottom: 12 }}>Facetally Catch!</h1>
                  <p>Catch real logos, dodge bombs & rocks.</p>
                  <button
                    style={btnStyle}
                    onMouseEnter={e => Object.assign(e.target.style, btnHover)}
                    onMouseLeave={e => Object.assign(e.target.style, btnStyle)}
                    onClick={startGame}
                  >
                    Start Game
                  </button>
                </div>
              </div>
            )}

            {/* Game Over / Victory Overlay */}
            {gameOver && (
              <div style={overlayStyle}>
                <div style={overlayInner}>
                  <h2 style={{ fontSize: 36 }}>
                    {message.includes("Survived") ? "🎉 Victory!" : "💣 Game Over"}
                  </h2>
                  <p>{message}</p>
                  <p>Score: <b>{score}</b></p>
                  <button
                    style={btnStyle}
                    onMouseEnter={e => Object.assign(e.target.style, btnHover)}
                    onMouseLeave={e => Object.assign(e.target.style, btnStyle)}
                    onClick={restart}
                  >
                    {message.includes("Survived") ? "Play Again" : "Try Again"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL (leaderboard placeholder + controls) */}
        <div style={{ ...glassPanel, width: 240, position: "relative", minHeight: 200 }}>
          <div
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              display: "flex",
              gap: 10,
              zIndex: 10,
            }}
          >
            <button
              onClick={() => setPaused(p => !p)}
              title={paused ? "Resume" : "Pause"}
              style={iconBtnStyle}
              onMouseEnter={e => Object.assign(e.target.style, iconBtnHover)}
              onMouseLeave={e => Object.assign(e.target.style, iconBtnStyle)}
            >
              {paused ? "▶️" : "⏸️"}
            </button>

            <button
              onClick={() => setSoundOn(s => !s)}
              title={soundOn ? "Mute" : "Unmute"}
              style={iconBtnStyle}
              onMouseEnter={e => Object.assign(e.target.style, iconBtnHover)}
              onMouseLeave={e => Object.assign(e.target.style, iconBtnStyle)}
            >
              {soundOn ? "🔊" : "🔇"}
            </button>
            <button
              onClick={() => setShowInstructions(true)}
              title="Show Instructions"
              style={iconBtnStyle}
              onMouseEnter={e => Object.assign(e.target.style, iconBtnHover)}
              onMouseLeave={e => Object.assign(e.target.style, iconBtnStyle)}
            >
              ❔
            </button>
          </div>

          {/* Future leaderboard placeholder */}
          <div style={{ marginTop: 60, textAlign: "center", opacity: 0.6 }}>
            <p>🏆 Leaderboard Coming Soon</p>
          </div>
        </div>
      </div>
    </div>
  );
}
