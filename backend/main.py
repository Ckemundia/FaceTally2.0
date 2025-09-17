from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from db import init_db
from routes import register, match, attendance

app = FastAPI(title="FRAS Backend")

# ✅ Allow only frontend origins
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    init_db()

# Register routes
app.include_router(register.router, prefix="/api")
app.include_router(match.router, prefix="/api")
app.include_router(attendance.router, prefix="/api")
