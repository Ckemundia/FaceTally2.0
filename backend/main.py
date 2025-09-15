from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import sqlite3
import numpy as np
import datetime
import os

DB_PATH = os.environ.get("FRAS_DB", "fras.db")
MATCH_THRESHOLD = float(os.environ.get("FRAS_THRESHOLD", 0.45))
DUPLICATE_COOLDOWN_SECONDS = int(os.environ.get("FRAS_COOLDOWN", 60))

app = FastAPI(title="FRAS Backend")

# allow CORS for dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # dev only; restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class RegisterIn(BaseModel):
    student_id: str
    name: str
    embedding: list[float]
    wallet: str | None = None

class EmbeddingIn(BaseModel):
    embedding: list[float]

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
    CREATE TABLE IF NOT EXISTS users (
        student_id TEXT PRIMARY KEY,
        name TEXT,
        embedding BLOB,
        wallet TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )""")
    cur.execute("""
    CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id TEXT,
        name TEXT,
        date TEXT,
        time TEXT,
        unit TEXT,
        hedera_txid TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )""")
    conn.commit()
    conn.close()

def save_user_embedding(student_id: str, name: str, embedding: np.ndarray, wallet: str | None):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("INSERT OR REPLACE INTO users(student_id, name, embedding, wallet) VALUES (?, ?, ?, ?)",
                (student_id, name, embedding.tobytes(), wallet))
    conn.commit()
    conn.close()

def load_user_embeddings():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT student_id, embedding FROM users")
    rows = cur.fetchall()
    conn.close()
    out = []
    for sid, blob in rows:
        if blob is None:
            continue
        arr = np.frombuffer(blob, dtype=np.float32)
        out.append((sid, arr))
    return out

def record_attendance(student_id: str, name: str, unit: str = "UnitPlaceholder"):
    now = datetime.datetime.utcnow()
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("INSERT INTO attendance (student_id, name, date, time, unit) VALUES (?, ?, ?, ?, ?)",
                (student_id, name, now.strftime("%Y-%m-%d"), now.strftime("%H:%M:%S"), unit))
    conn.commit()
    conn.close()

def last_attendance_time(student_id: str):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT created_at FROM attendance WHERE student_id=? ORDER BY id DESC LIMIT 1", (student_id,))
    row = cur.fetchone()
    conn.close()
    if not row:
        return None
    return datetime.datetime.fromisoformat(row[0])

@app.on_event("startup")
def startup_event():
    init_db()

@app.post("/api/register")
def register(payload: RegisterIn):
    emb = np.array(payload.embedding, dtype=np.float32)
    save_user_embedding(payload.student_id, payload.name, emb, payload.wallet)
    return {"ok": True}

@app.post("/api/match")
def match(payload: EmbeddingIn):
    emb = np.array(payload.embedding, dtype=np.float32)
    users = load_user_embeddings()
    best_id = None
    best_dist = float("inf")
    for sid, known in users:
        if known.shape != emb.shape:
            continue
        d = float(np.linalg.norm(known - emb))
        if d < best_dist:
            best_dist = d
            best_id = sid

    if best_id is None:
        return {"matched": False, "dist": None}

    if best_dist < MATCH_THRESHOLD:
        # duplicate protection
        last_time = last_attendance_time(best_id)
        if last_time:
            diff = (datetime.datetime.utcnow() - last_time).total_seconds()
            if diff < DUPLICATE_COOLDOWN_SECONDS:
                return {"matched": True, "student_id": best_id, "dist": best_dist, "skipped_recent": True}
        # record attendance
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        cur.execute("SELECT name FROM users WHERE student_id=?", (best_id,))
        row = cur.fetchone()
        name = row[0] if row else None
        conn.close()
        record_attendance(best_id, name or "", unit="UnitPlaceholder")
        return {"matched": True, "student_id": best_id, "dist": best_dist, "skipped_recent": False}

    return {"matched": False, "dist": best_dist}

@app.get("/api/attendance")
def attendance_list(limit: int = 100):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT id, student_id, name, date, time, created_at FROM attendance ORDER BY id DESC LIMIT ?", (limit,))
    rows = cur.fetchall()
    conn.close()
    data = [{"id": r[0], "student_id": r[1], "name": r[2], "date": r[3], "time": r[4], "created_at": r[5]} for r in rows]
    return {"rows": data}
