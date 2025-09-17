from pydantic import BaseModel
from typing import Optional, List

class RegisterIn(BaseModel):
    student_id: str
    name: str
    embedding: list[float]
    wallet: Optional[str] = None
    network: Optional[str] = None 

class RegisterOut(BaseModel):
    ok: bool
    student_id: str

class EmbeddingIn(BaseModel):
    embedding: list[float]

class AttendanceRow(BaseModel):
    id: int
    student_id: str
    timestamp: str
    unit: str
    txid: Optional[str] = None

class AttendanceList(BaseModel):
    rows: List[AttendanceRow]
