import os
import requests
from datetime import datetime, date
from dotenv import load_dotenv
from sqlalchemy import create_engine, Column, Integer, String, DateTime, select
from sqlalchemy.orm import declarative_base, sessionmaker
import boto3

load_dotenv()

WHISPER_URL = "https://api-inference.huggingface.co/models/openai/whisper-large-v2"
LLM_URL = "https://api-inference.huggingface.co/models/mistralai/Mixtral-8x7B-Instruct-v0.1"
HF_TOKEN = os.getenv("HF_TOKEN", "")
DATABASE_URL = os.getenv("DATABASE_URL")
RESEND_API_KEY = os.getenv("RESEND_API_KEY")
R2_ENDPOINT = os.getenv("R2_ENDPOINT")
R2_ACCESS_KEY = os.getenv("R2_ACCESS_KEY")
R2_SECRET_KEY = os.getenv("R2_SECRET_KEY")
R2_BUCKET = os.getenv("R2_BUCKET")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is not set.")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

class StandupEntry(Base):
    __tablename__ = 'standup_entries'
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    transcript = Column(String, nullable=False)
    summary = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

Base.metadata.create_all(bind=engine)

def upload_audio_to_r2(audio_bytes, filename):
    s3 = boto3.client(
        's3',
        endpoint_url=R2_ENDPOINT,
        aws_access_key_id=R2_ACCESS_KEY,
        aws_secret_access_key=R2_SECRET_KEY,
    )
    s3.put_object(Bucket=R2_BUCKET, Key=filename, Body=audio_bytes, ContentType='audio/wav')
    return f"{R2_ENDPOINT}/{R2_BUCKET}/{filename}"

def summarize_text(input_data, is_audio=False, summarize=False, audio_url=None):
    if is_audio:
        # If audio_url is provided, send the URL to Whisper if supported, else upload bytes
        resp = requests.post(
            WHISPER_URL,
            headers={"Authorization": f"Bearer {HF_TOKEN}"} if HF_TOKEN else {},
            files={"file": ("audio.wav", input_data, "audio/wav")}
        )
        return resp.json().get("text", "")
    elif summarize:
        prompt = f"""You are an assistant summarizing team member updates.\nInput: {input_data}\n\nTask:\n- Summarize into 2-3 bullet points\n- Include what's done, what's in progress, any blockers\n- Be concise and skip filler words\n\nOutput format:\n- Completed: ...\n- In Progress: ...\n- Blocked: ...\n"""
        resp = requests.post(
            LLM_URL,
            headers={"Authorization": f"Bearer {HF_TOKEN}"} if HF_TOKEN else {},
            json={"inputs": prompt, "parameters": {"max_new_tokens": 120}}
        )
        return resp.json().get("generated_text", "")
    else:
        return input_data

def log_to_db(name, transcript, summary):
    with SessionLocal() as session:
        entry = StandupEntry(name=name, transcript=transcript, summary=summary)
        session.add(entry)
        session.commit()

def fetch_today_entries():
    today = date.today()
    with SessionLocal() as session:
        results = session.query(StandupEntry).filter(StandupEntry.created_at >= datetime.combine(today, datetime.min.time())).all()
    return results

def send_email():
    entries = fetch_today_entries()
    body = "\n\n".join([f"{e.name}:\n{e.summary}" for e in entries])
    resp = requests.post(
        "https://api.resend.com/emails",
        headers={
            "Authorization": f"Bearer {RESEND_API_KEY}",
            "Content-Type": "application/json"
        },
        json={
            "from": os.getenv("FROM_EMAIL"),
            "to": [os.getenv("REPORT_EMAIL")],
            "subject": f"Daily Standup Report {date.today()}",
            "html": body.replace("\n", "<br>")
        }
    )
    return {"status": resp.status_code, "body": body} 