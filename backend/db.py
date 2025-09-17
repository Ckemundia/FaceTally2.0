import os
import sqlite3
import datetime
import numpy as np
import json

DB_PATH = os.environ.get("FRAS_DB", "faceattend.db")


def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.cursor()

        # Users table
        cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            student_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            embedding TEXT NOT NULL,  -- stored as JSON string
            wallet TEXT UNIQUE        -- enforce uniqueness
        )
        """)

        # Attendance table
        cur.execute("""
        CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            unit TEXT NOT NULL,
            txid TEXT,
            FOREIGN KEY(student_id) REFERENCES users(student_id)
        )
        """)
        conn.commit()
        print("[DB] Initialized database at", DB_PATH)


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    a = a / np.linalg.norm(a)
    b = b / np.linalg.norm(b)
    return float(np.dot(a, b))


def save_user(student_id: str, name: str, embedding: np.ndarray, wallet: str | None):
    try:
        print(f"[DB] Attempting to save user {student_id} (wallet={wallet})")

        # --- Check for duplicate face ---
        users = load_users()
        for sid, db_emb in users:
            sim = cosine_similarity(embedding, db_emb)
            if sim >= 0.6:  # threshold (tune if needed)
                raise ValueError(f"Face already registered under student {sid}")

        with sqlite3.connect(DB_PATH) as conn:
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO users(student_id, name, embedding, wallet)
                VALUES (?, ?, ?, ?)
            """, (student_id, name, json.dumps(embedding.tolist()), wallet))
            conn.commit()
            print(f"[DB] ✅ User {student_id} saved successfully")

    except sqlite3.IntegrityError as e:
        if "UNIQUE constraint failed: users.wallet" in str(e):
            raise ValueError("Wallet already registered")
        elif "UNIQUE constraint failed: users.student_id" in str(e):
            raise ValueError("Student ID already exists")
        else:
            raise
    except Exception as e:
        print(f"[DB] ❌ Unexpected error while saving {student_id}: {e}")
        raise


def load_users():
    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.cursor()
        cur.execute("SELECT student_id, embedding FROM users")
        rows = cur.fetchall()

    out = []
    for sid, emb_json in rows:
        try:
            arr = np.array(json.loads(emb_json), dtype=np.float32)
            out.append((sid, arr))
        except Exception:
            continue
    return out


def get_user_name(student_id: str):
    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.cursor()
        cur.execute("SELECT name FROM users WHERE student_id=?", (student_id,))
        row = cur.fetchone()
    return row[0] if row else None


def record_attendance(student_id: str, unit: str, txid: str | None = None):
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO attendance (student_id, timestamp, unit, txid)
                VALUES (?, ?, ?, ?)
            """, (student_id, datetime.datetime.utcnow().isoformat(), unit, txid))
            conn.commit()
            print(f"[DB] ✅ Attendance recorded for {student_id} ({unit})")
    except Exception as e:
        print(f"[DB] ❌ Failed to record attendance for {student_id}: {e}")
        raise


def last_attendance_time(student_id: str):
    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT timestamp FROM attendance WHERE student_id=? ORDER BY id DESC LIMIT 1",
            (student_id,)
        )
        row = cur.fetchone()
    if not row:
        return None
    return datetime.datetime.fromisoformat(row[0])


def list_attendance(limit: int = 100):
    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT id, student_id, timestamp, unit, txid 
            FROM attendance 
            ORDER BY id DESC LIMIT ?
        """, (limit,))
        rows = cur.fetchall()
    return [
        {"id": r[0], "student_id": r[1], "timestamp": r[2], "unit": r[3], "txid": r[4]}
        for r in rows
    ]
