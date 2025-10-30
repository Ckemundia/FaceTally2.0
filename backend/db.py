import os
import sqlite3
import datetime
import numpy as np
import json

DB_PATH = os.environ.get("FRAS_DB", "faceattend.db")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


# ---------------- INIT ---------------- #


def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.cursor()

        # Users table
        cur.execute(
            """
        CREATE TABLE IF NOT EXISTS users (
            student_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            embedding TEXT NOT NULL,  -- stored as JSON string
            wallet TEXT UNIQUE        -- enforce uniqueness
        )
        """
        )

        # Attendance table
        cur.execute(
            """
        CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            unit TEXT NOT NULL,
            txid TEXT,
            FOREIGN KEY(student_id) REFERENCES users(student_id)
        )
        """
        )

        # Units table
        cur.execute(
            """
        CREATE TABLE IF NOT EXISTS units (
            unit_code TEXT PRIMARY KEY,
            unit_name TEXT NOT NULL
        )
        """
        )

        # Student ↔ Units (many-to-many relationship)
        cur.execute(
            """
        CREATE TABLE IF NOT EXISTS student_units (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id TEXT NOT NULL,
            unit_code TEXT NOT NULL,
            FOREIGN KEY(student_id) REFERENCES users(student_id),
            FOREIGN KEY(unit_code) REFERENCES units(unit_code)
        )
        """
        )

        # Rewards table
        cur.execute(
            """
        CREATE TABLE IF NOT EXISTS rewards (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id TEXT NOT NULL,
            date TEXT NOT NULL,
            status TEXT NOT NULL,
            FOREIGN KEY(student_id) REFERENCES users(student_id),
            UNIQUE(student_id, date)
        )
        """
        )

        # Unit settings table (NEW)
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS unit_settings (
                unit_code TEXT PRIMARY KEY,
                is_active INTEGER NOT NULL DEFAULT 1,
                attendance_limit INTEGER,
                time_limit TEXT,
                location_lat REAL,
                location_lng REAL,
                location_radius REAL,
                FOREIGN KEY(unit_code) REFERENCES units(unit_code)
            )
            """
        )

        # --- Prepopulate units ---
        default_units = [
            ("CS101", "Data Structures"),
            ("CS102", "Machine Learning"),
            ("CS103", "Communication Skills"),
            ("CS104", "Python Programming"),
            ("CS105", "Object Oriented Programming"),
            ("CS106", "Intro to Programming"),
            ("CS107", "Software Testing Tools"),
            ("CS108", "Embedded Systems"),
            ("CS109", "Project Management"),
            ("CS110", "Web Development"),
            ("CS111", "Application Programming"),
            ("CS112", "Linear Programming"),
            ("CS113", "Data Science"),
        ]

        for code, name in default_units:
            cur.execute(
                "INSERT OR IGNORE INTO units(unit_code, unit_name) VALUES (?, ?)",
                (code, name),
            )

        conn.commit()
        print("[DB] Initialized database with units at", DB_PATH)


# ---------------- HELPERS ---------------- #


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    a = a / np.linalg.norm(a)
    b = b / np.linalg.norm(b)
    return float(np.dot(a, b))


# ---------------- USERS ---------------- #


def save_user(student_id: str, name: str, embedding: list, wallet: str | None):
    """
    Save a new user. Expects embedding as a Python list (not NumPy array).
    """
    try:
        print(f"[DB] Attempting to save user {student_id} (wallet={wallet})")

        # --- Check for duplicate face ---
        users = load_users()
        emb_arr = np.array(embedding, dtype=np.float32)
        for sid, db_emb in users:
            sim = cosine_similarity(emb_arr, db_emb)
            if sim >= 0.6:  # threshold (tune if needed)
                raise ValueError(f"Face already registered under student {sid}")

        with sqlite3.connect(DB_PATH) as conn:
            cur = conn.cursor()
            cur.execute(
                """
                INSERT INTO users(student_id, name, embedding, wallet)
                VALUES (?, ?, ?, ?)
            """,
                (student_id, name, json.dumps(embedding), wallet),
            )
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


# ---------------- ATTENDANCE ---------------- #


def record_attendance(student_id: str, unit: str, txid: str | None = None):
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cur = conn.cursor()
            cur.execute(
                """
                INSERT INTO attendance (student_id, timestamp, unit, txid)
                VALUES (?, ?, ?, ?)
            """,
                (student_id, datetime.datetime.utcnow().isoformat(), unit, txid),
            )
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
            (student_id,),
        )
        row = cur.fetchone()
    if not row:
        return None
    return datetime.datetime.fromisoformat(row[0])


def list_attendance(limit: int = 100, student_id: str | None = None):
    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.cursor()
        if student_id:
            cur.execute(
                """
                SELECT id, student_id, timestamp, unit, txid 
                FROM attendance 
                WHERE student_id = ?
                ORDER BY id DESC LIMIT ?
            """,
                (student_id, limit),
            )
        else:
            cur.execute(
                """
                SELECT id, student_id, timestamp, unit, txid 
                FROM attendance 
                ORDER BY id DESC LIMIT ?
            """,
                (limit,),
            )
        rows = cur.fetchall()

    return [
        {"id": r[0], "student_id": r[1], "timestamp": r[2], "unit": r[3], "txid": r[4]}
        for r in rows
    ]


# ---------------- UNITS ---------------- #


def list_units():
    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.cursor()
        cur.execute("SELECT unit_code, unit_name FROM units ORDER BY unit_code")
        return cur.fetchall()


def assign_units(student_id: str, unit_codes: list[str]):
    """
    Assign one or more units to a student.
    Expects a list of unit_code strings (e.g., ["CS101", "CS104"]).
    """
    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.cursor()
        for code in unit_codes:
            cur.execute(
                """
                INSERT OR IGNORE INTO student_units (student_id, unit_code)
                VALUES (?, ?)
            """,
                (student_id, code),
            )
        conn.commit()


def get_student_units(student_id: str):
    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT 
                u.unit_code, 
                u.unit_name,
                COALESCE(us.is_active, 0) as is_active
            FROM student_units su
            JOIN units u ON su.unit_code = u.unit_code
            LEFT JOIN unit_settings us ON u.unit_code = us.unit_code
            WHERE su.student_id = ?
        """,
            (student_id,),
        )
        rows = cur.fetchall()

    return [
        {"unit_code": row[0], "unit_name": row[1], "is_active": bool(row[2])}
        for row in rows
    ]


def get_units():
    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.cursor()
        cur.execute("SELECT unit_code, unit_name FROM units")
        rows = cur.fetchall()
    return [{"unit_code": r[0], "unit_name": r[1]} for r in rows]


# ---------------- REWARDS ---------------- #


def log_reward_claim(student_id: str, date: str, status: str = "claimed"):
    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT OR IGNORE INTO rewards(student_id, date, status)
            VALUES (?, ?, ?)
        """,
            (student_id, date, status),
        )
        conn.commit()


def list_rewards(student_id: str, limit: int = 50):
    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, student_id, date, status
            FROM rewards
            WHERE student_id = ?
            ORDER BY date DESC LIMIT ?
        """,
            (student_id, limit),
        )
        rows = cur.fetchall()
    return [
        {"id": r[0], "student_id": r[1], "date": r[2], "status": r[3]} for r in rows
    ]


def set_unit_status(
    unit_code: str,
    active: bool,
    attendance_limit: int | None = None,
    time_limit: str | None = None,
    location_lat: float | None = None,
    location_lng: float | None = None,
    location_radius: float | None = None,
):
    """
    Update or insert settings for a unit, including optional time and location restrictions.
    """
    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO unit_settings (
                unit_code, 
                is_active, 
                attendance_limit, 
                time_limit, 
                location_lat, 
                location_lng, 
                location_radius
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(unit_code) DO UPDATE SET
                is_active = excluded.is_active,
                attendance_limit = excluded.attendance_limit,
                time_limit = excluded.time_limit,
                location_lat = excluded.location_lat,
                location_lng = excluded.location_lng,
                location_radius = excluded.location_radius
            """,
            (
                unit_code,
                int(active),
                attendance_limit,
                time_limit,
                location_lat,
                location_lng,
                location_radius,
            ),
        )
        conn.commit()


def get_unit_status(unit_code: str):
    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT 
                is_active, 
                attendance_limit, 
                time_limit, 
                location_lat, 
                location_lng, 
                location_radius
            FROM unit_settings 
            WHERE unit_code = ?
            """,
            (unit_code,),
        )
        row = cur.fetchone()

    if not row:
        return {
            "is_active": False,
            "attendance_limit": None,
            "time_limit": None,
            "location_lat": None,
            "location_lng": None,
            "location_radius": None,
        }

    return {
        "is_active": bool(row[0]),
        "attendance_limit": row[1],
        "time_limit": row[2],
        "location_lat": row[3],
        "location_lng": row[4],
        "location_radius": row[5],
    }


def list_students_with_attendance(unit_code: str, date: str):
    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT u.student_id, u.name, 
                   CASE WHEN a.id IS NOT NULL THEN 1 ELSE 0 END as present
            FROM users u
            JOIN student_units su ON u.student_id = su.student_id
            LEFT JOIN attendance a 
               ON a.student_id = u.student_id 
               AND a.unit = su.unit_code
               AND date(a.timestamp) = ?
            WHERE su.unit_code = ?
        """,
            (date, unit_code),
        )
        rows = cur.fetchall()
    return [{"student_id": r[0], "name": r[1], "present": bool(r[2])} for r in rows]


def export_attendance(unit_code: str, date: str):
    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT a.student_id, u.name, a.timestamp, a.unit
            FROM attendance a
            JOIN users u ON a.student_id = u.student_id
            WHERE a.unit = ? AND date(a.timestamp) = ?
            ORDER BY a.timestamp
        """,
            (unit_code, date),
        )
        rows = cur.fetchall()
    return [
        {"student_id": r[0], "name": r[1], "timestamp": r[2], "unit": r[3]}
        for r in rows
    ]


def get_student_by_id(student_id: str):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT student_id, name, wallet
        FROM users
        WHERE student_id = ?
    """,
        (student_id,),
    )
    row = cursor.fetchone()
    conn.close()

    if row is None:
        print(f"[DEBUG] get_student_by_id: No student found for {student_id}")
    return dict(row) if row else None


def get_student_wallet(student_id: str):
    """
    Return the wallet address for a given student_id.
    """
    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.cursor()
        cur.execute("SELECT wallet FROM users WHERE student_id = ?", (student_id,))
        row = cur.fetchone()
    return row[0] if row else None


def update_attendance_txid(student_id: str, unit: str, txid: str):
    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.cursor()
        # find latest attendance id
        cur.execute(
            "SELECT id FROM attendance WHERE student_id = ? AND unit = ? ORDER BY id DESC LIMIT 1",
            (student_id, unit),
        )
        row = cur.fetchone()
        if row:
            cur.execute("UPDATE attendance SET txid = ? WHERE id = ?", (txid, row[0]))
            conn.commit()
            print(f"[DB] ✅ Updated attendance txid for {student_id} ({unit}) → {txid}")
        else:
            print(f"[DB] ⚠️ No attendance record found for {student_id} ({unit})")


def get_all_unit_statuses():
    """
    Returns all rows from the unit_settings table.
    """
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row  # allows dict-like access
        cur = conn.cursor()
        cur.execute(
            """
            SELECT 
                unit_code,
                is_active,
                attendance_limit,
                time_limit,
                location_lat,
                location_lng,
                location_radius
            FROM unit_settings
        """
        )
        rows = [dict(row) for row in cur.fetchall()]
    return rows
