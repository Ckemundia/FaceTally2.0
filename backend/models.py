from pydantic import BaseModel
from typing import Optional, List


class RegisterIn(BaseModel):
    student_id: str
    name: str
    embedding: List[float]
    wallet: Optional[str] = None
    network: Optional[str] = None
    units: Optional[List[str]] = []  # ✅ new field for selected units


class RegisterOut(BaseModel):
    ok: bool
    student_id: str


class EmbeddingIn(BaseModel):
    embedding: List[float]


class AttendanceRow(BaseModel):
    id: int
    student_id: str
    timestamp: str
    unit: str
    txid: Optional[str] = None


class AttendanceList(BaseModel):
    rows: List[AttendanceRow]
