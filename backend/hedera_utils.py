from dotenv import load_dotenv
import os
from hedera import (
    Client,
    AccountId,
    PrivateKey,
    TokenCreateTransaction,
    TokenType,
    TokenSupplyType,
    TransferTransaction,
    TokenId,
    TokenInfoQuery,
    TopicCreateTransaction,
    TopicMessageSubmitTransaction,
)
import requests
import json
from hedera import TopicId

load_dotenv()

# Load operator credentials
OPERATOR_ID = AccountId.fromString(os.getenv("HEDERA_ACCOUNT_ID"))
OPERATOR_KEY = PrivateKey.fromString(os.getenv("HEDERA_PRIVATE_KEY"))

client = Client.forTestnet()
client.setOperator(OPERATOR_ID, OPERATOR_KEY)

# --- POP Token section ---
TOKEN_FILE = "pop_token.json"

def load_pop_token():
    if os.path.exists(TOKEN_FILE):
        with open(TOKEN_FILE, "r") as f:
            data = json.load(f)
            return data.get("POP_TOKEN_ID")
    return None

def save_pop_token(token_id):
    with open(TOKEN_FILE, "w") as f:
        json.dump({"POP_TOKEN_ID": token_id}, f)

POP_TOKEN_ID = load_pop_token()

def create_pop_token():
    global POP_TOKEN_ID
    if POP_TOKEN_ID:
        try:
            _ = TokenInfoQuery().setTokenId(TokenId.fromString(POP_TOKEN_ID)).execute(client)
            return POP_TOKEN_ID
        except:
            pass

    tx = (
        TokenCreateTransaction()
        .setTokenName("Proof Of Presence")
        .setTokenSymbol("POP")
        .setTokenType(TokenType.FUNGIBLE_COMMON)
        .setDecimals(0)
        .setInitialSupply(100_000_000)
        .setTreasuryAccountId(OPERATOR_ID)
        .setSupplyType(TokenSupplyType.FINITE)
        .setMaxSupply(100_000_000)
        .freezeWith(client)
        .sign(OPERATOR_KEY)
    )

    resp = tx.execute(client)
    receipt = resp.getReceipt(client)
    token_id = receipt.tokenId.toString()

    POP_TOKEN_ID = token_id
    save_pop_token(token_id)

    print("POP token created! Token ID:", token_id)
    return token_id

def reward_student(student_wallet: str, amount: int = 1):
    global POP_TOKEN_ID
    try:
        if not POP_TOKEN_ID:
            raise ValueError("POP token does not exist. Run create_pop_token() first.")

        token_id = TokenId.fromString(POP_TOKEN_ID)
        tx = (
            TransferTransaction()
            .addTokenTransfer(token_id, OPERATOR_ID, -amount)
            .addTokenTransfer(token_id, AccountId.fromString(student_wallet), amount)
            .freezeWith(client)
            .sign(OPERATOR_KEY)
        )
        resp = tx.execute(client)
        return {"status": "success", "tx_id": str(resp.transactionId)}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# --- HCS Section ---
TOPIC_FILE = "hcs_topic.json"

def load_topic_id():
    if os.path.exists(TOPIC_FILE):
        with open(TOPIC_FILE, "r") as f:
            data = json.load(f)
            topic_id = data.get("TOPIC_ID")
            if isinstance(topic_id, str) and topic_id.count(".") == 2:
                return topic_id
    return None

def save_topic_id(topic_id):
    with open(TOPIC_FILE, "w") as f:
        json.dump({"TOPIC_ID": str(topic_id)}, f)


TOPIC_ID = load_topic_id()

def create_topic():
    global TOPIC_ID
    if TOPIC_ID:
        return TOPIC_ID

    tx = TopicCreateTransaction().freezeWith(client).sign(OPERATOR_KEY)
    resp = tx.execute(client)
    receipt = resp.getReceipt(client)

    # ✅ Properly stringify the topic
    topic_id = receipt.topicId.toString()

    TOPIC_ID = topic_id
    save_topic_id(topic_id)

    print("✅ HCS topic created:", topic_id)
    return topic_id


def publish_message(message: dict):
    global TOPIC_ID
    if not TOPIC_ID:
        create_topic()

    msg_json = json.dumps(message)
    tx = (
        TopicMessageSubmitTransaction()
        .setTopicId(TopicId.fromString(TOPIC_ID))  
        .setMessage(msg_json)
        .freezeWith(client)
        .sign(OPERATOR_KEY)
    )
    resp = tx.execute(client)
    return {"status": "success", "tx_id": str(resp.transactionId)}


import base64

def get_messages(limit=20):
    if not TOPIC_ID:
        return {"error": "No topic created yet"}
    
    url = f"https://testnet.mirrornode.hedera.com/api/v1/topics/{TOPIC_ID}/messages?limit={limit}&order=desc"
    resp = requests.get(url)
    if resp.status_code != 200:
        return {"error": resp.text}

    messages = []
    for m in resp.json().get("messages", []):
        try:
            decoded = base64.b64decode(m["message"]).decode("utf-8")
            messages.append({
                "consensusTimestamp": m["consensus_timestamp"],
                "message": json.loads(decoded) if decoded.startswith("{") else decoded
            })
        except Exception as e:
            messages.append({
                "consensusTimestamp": m["consensus_timestamp"],
                "raw": m["message"],
                "error": str(e)
            })

    return {"topic_id": TOPIC_ID, "messages": messages}
