# FaceTally — AI-Powered Attendance & Token Rewards System  
### 🏁 Track: Distributed Ledger Technology (DLT) for Operations  

---

## 🌍 Overview  

**FaceTally** is an AI-powered attendance and engagement verification system for educational institutions.  
It combines **face recognition**, **geolocation**, and **Hedera** to ensure real, verified class attendance — rewarding students with **FaceTally POP Tokens** (Proof of presence) issued via the **Hedera Token Service (HTS)**.  

FaceTally gamifies attendance: students who maintain perfect records unlock the **FaceTally Game**, where they earn additional POP tokens in a fun, decentralized experience.  

This project demonstrates how **DLT** can enhance accountability, transparency, and reward fairness in operational workflows like academic attendance tracking.  

---

## 💠 Hedera Integration Summary  

FaceTally integrates three Hedera services — **HTS**, **HCS**, and the **Mirror Node API** — to create a secure, transparent, and cost-efficient attendance ecosystem. Together, they ensure tokenized incentives are verifiable and tamper-proof.

---

### 🪙 Hedera Token Service (HTS)  

We use **HTS** to create and manage the **FaceTally POP Token (`0.0.6879369`)**.  
Each verified attendance event mints and transfers one POP token to the student’s wallet.  

**Transaction Types:**  
- `TokenCreateTransaction` → Initializes the POP Token supply  
- `TokenMintTransaction` → Issues new POPs for verified attendance  
- `TransferTransaction` → Sends tokens to student wallets  

**Economic Justification:**  
Hedera’s predictable low fees ($0.0001 per transaction) and near-instant finality make token minting sustainable for large-scale education systems in Africa. Institutions can adopt blockchain incentives without incurring high operational costs.

---

### 🧾 Hedera Consensus Service (HCS)  

Used for **immutable attendance logging**.  
Every attendance record is stored on-chain with:
- Student ID  
- Session ID  
- Geo-hash  
- Timestamp  
- Face match confidence  

**Transaction Types:**  
- `TopicCreateTransaction` → Creates the attendance log topic  
- `TopicMessageSubmitTransaction` → Submits verified attendance data  

**Economic Justification:**  
HCS provides an immutable audit trail at a fraction of the cost of traditional databases, ensuring trust and transparency in attendance verification for schools and universities.

---

### 🔍 Hedera Mirror Node API  

The **Mirror Node API** is used for **wallet validation** and **on-chain data verification** before token distribution.  

**Example Integration (FastAPI):**
    
    from fastapi import APIRouter, Query
    from hedera import AccountId
    import requests

    router = APIRouter()
    
    @router.get("/validate_wallet")
    def validate_wallet(wallet: str = Query(...)):
        try:
            AccountId.fromString(wallet)
            resp = requests.get(f"https://testnet.mirrornode.hedera.com/api/v1/accounts/{wallet}", timeout=5)
            if resp.status_code == 200 and "account" in resp.json():
                return {"valid": True}
            return {"valid": False}
           except Exception as e:
            return {"valid": False, "error": str(e)}


⚙️ Deployment & Setup Instructions

🧩 Estimated Setup Time: ~8 minutes total
(Backend: 4 min | Frontend: 3 min | Env setup: 1 min)

1️⃣ Clone the Repository
git clone https://github.com/<your-username>/facetally.git
cd facetally
2️⃣ Environment Setup

Create a .env file inside the backend directory using this template:
HEDERA_ACCOUNT_ID=0.0.xxxxxx
HEDERA_PRIVATE_KEY=302e0201...
TOKEN_ID=0.0.6879369
MIRROR_NODE_URL=https://testnet.mirrornode.hedera.com/api/v1

⚠️ Never commit your .env file.
3️⃣ Install Dependencies
Backend (FastAPI)
cd backend
pip install -r requirements.txt
uvicorn main: app 

Frontend (Vite + React)
cd frontend
npm install
npm run dev

🧠Running Environment
Component	Command	Local URL
Frontend (Vite)	npm run dev	http://localhost:5173
Backend (FastAPI + Uvicorn)	uvicorn main:app --reload	http://127.0.0.1:8000
  Requirements:
    Node.js 18+
    Python 3.10+
    Browser: Chrome / Edge (latest)

### 🧱 Architecture Diagram

    
         [Face Detection + Attendance Capture]
                           │
                           ▼
    ┌────────────────────────────────────────────┐
    │ React Frontend (Vite)                      │
    │ - Face Recognition (face-api.js)           │
    │ - Token Game Interface                     │
    └─────────────────┬──────────────────────────┘
                      │   (REST API via Axios)
                      ▼
    ┌────────────────────────────────────────────┐
    │ FastAPI Backend                            │
    │ - Auth / Attendance Processing             │
    │ - Wallet Validation                        │
    │ - Hedera SDK Integration                   │
    └─────────────────┬──────────────────────────┘
                      │   (HCS Logs / HTS Minting)
                      ▼
    ┌────────────────────────────────────────────┐
    │ Hedera Network (Testnet)                   │
    │ - HTS: POP Token Rewards (0.0.6879369)     │
    │ - HCS: Attendance Logs                     │
    │ - Mirror Node: Data Verification           │
    └────────────────────────────────────────────┘

🧩 Deployed Hedera IDs
    Service            	Description    	    Testnet ID

    Token	FaceTally     POP Token            	0.0.6879369
    Topic	Attendance    Log Topic	            0.0.6922157
    Operator Account	  Backend Wallet	    0.0.6853808

🔒 Security & Secrets
  No private keys or credentials are committed.
  Environment variables are stored securely in .env.
  .env is included in .gitignore.
  Judges receive test credentials privately via DoraHacks submission notes.

🧠 Code Quality & Auditability
  Frontend: ESLint (React)
  Backend: Black (Python)
  Modular folder structure with clear logic separation:

🎮 Screenshots / Demo (Coming Soon)
Feature                          	Description
🎥 Face Recognition	               Real-time detection via webcam using face-api.js
🧾 Attendance                      Logging	Securely recorded to Hedera via HCS
🪙 Token Rewards                    POP tokens issued automatically for verified attendance
🎯 FaceTallyCatch	                 Token-based mini-game for consistent students


🚀 Future Improvements

NFT-based attendance certificates using HTS/NFTs

DAO-style governance for educational institutions

Integration with Hedera Guardian for verifiable credentials

Support for multi-campus and corporate training systems

📜 **License**
This project is licensed under the [MIT License](./LICENSE).
