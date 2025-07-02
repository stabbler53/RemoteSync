import os
import requests
from datetime import datetime, date
from dotenv import load_dotenv
from sqlalchemy import create_engine, Column, Integer, String, DateTime, JSON, select, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from supabase import create_client, Client
from pydantic import BaseModel, EmailStr
from typing import List, Optional
import secrets

load_dotenv()

WHISPER_URL = "https://api-inference.huggingface.co/models/openai/whisper-large-v2"
LLM_URL = "https://api-inference.huggingface.co/models/mistralai/Mixtral-8x7B-Instruct-v0.1"
HF_TOKEN = os.getenv("HF_TOKEN", "")
DATABASE_URL = os.getenv("DATABASE_URL")
RESEND_API_KEY = os.getenv("RESEND_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is not set.")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# --- Pydantic Models for API requests ---
class TeamCreate(BaseModel):
    name: str
    settings: Optional[dict] = {}

class TeamInvite(BaseModel):
    emails: List[EmailStr]

# --- SQLAlchemy Models ---
class Team(Base):
    __tablename__ = 'teams'
    id = Column(String, primary_key=True, default=lambda: str(secrets.token_hex(16)))
    name = Column(String, nullable=False)
    settings = Column(JSON)
    created_by = Column(String) # Clerk User ID
    created_at = Column(DateTime, default=datetime.utcnow)
    members = relationship("TeamMember", back_populates="team")

class TeamMember(Base):
    __tablename__ = 'team_members'
    team_id = Column(String, ForeignKey('teams.id'), primary_key=True)
    user_id = Column(String, primary_key=True) # Clerk User ID
    role = Column(String, default='member')
    team = relationship("Team", back_populates="members")

class Invite(Base):
    __tablename__ = 'invites'
    id = Column(String, primary_key=True, default=lambda: str(secrets.token_hex(16)))
    team_id = Column(String, ForeignKey('teams.id'))
    email = Column(String)
    token = Column(String, unique=True, default=lambda: secrets.token_urlsafe(32))
    status = Column(String, default='pending')
    created_at = Column(DateTime, default=datetime.utcnow)

class StandupEntry(Base):
    __tablename__ = 'standup_entries'
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    transcript = Column(String, nullable=False)
    summary = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

Base.metadata.create_all(bind=engine)

def create_team_in_db(team_data: TeamCreate, user_id: str):
    with SessionLocal() as session:
        new_team = Team(name=team_data.name, settings=team_data.settings, created_by=user_id)
        session.add(new_team)
        session.flush() # To get the new_team.id
        
        first_member = TeamMember(team_id=new_team.id, user_id=user_id, role='admin')
        session.add(first_member)
        session.commit()
        session.refresh(new_team)
        return new_team

def invite_users_to_team(team_id: str, invite_data: TeamInvite):
    # Logic to create invites and send emails via Resend
    # ...
    return {"status": "invites sent"}

def upload_audio_to_supabase(audio_bytes, filename):
    # Upload to the 'audio' bucket (create it in Supabase dashboard if not exists)
    res = supabase.storage().from_('audio').upload(filename, audio_bytes)
    if res.get('error'):
        raise Exception(res['error']['message'])
    public_url = f"{SUPABASE_URL}/storage/v1/object/public/audio/{filename}"
    return public_url

def summarize_text(input_data, is_audio=False, summarize=False, audio_url=None):
    if is_audio:
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

# --- Reminder and Invite Service Functions ---
def send_reminder_email(user_email: str, user_id: str, team_id: str):
    """Sends a daily standup reminder email that the user can reply to."""
    # This unique address allows us to parse the reply and identify the user/team
    reply_to_address = f"update-{user_id}-{team_id}@inbound.yourdomain.com" # Replace with your Resend inbound domain

    return requests.post(
        "https://api.resend.com/emails",
        headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
        json={
            "from": f"RemoteSync <reminders@{os.getenv('RESEND_DOMAIN')}>",
            "to": [user_email],
            "subject": "👋 Time for your daily standup!",
            "html": f"<p>Hey! Just reply to this email with your update for today.</p>",
            "reply_to": reply_to_address,
        }
    )

def process_daily_reminders():
    """
    Checks all teams and sends reminders to members who haven't submitted.
    This function should be run periodically by the scheduler.
    """
    print("Processing daily reminders...")
    with SessionLocal() as session:
        teams = session.query(Team).all()
        today = date.today()

        for team in teams:
            # Basic time check (can be improved with timezone awareness)
            # This logic assumes the server runs in UTC.
            reminder_time_str = team.settings.get("summaryTime", "17:00")
            reminder_hour = int(reminder_time_str.split(":")[0])
            
            # Simple check: if it's the reminder hour (in UTC), proceed.
            if datetime.utcnow().hour != reminder_hour:
                continue

            # Get members and their submissions for today
            members = session.query(TeamMember).filter(TeamMember.team_id == team.id).all()
            submissions_today = session.query(StandupEntry).filter(
                StandupEntry.created_at >= datetime.combine(today, datetime.min.time()),
                StandupEntry.name.in_([m.user_id for m in members]) # Assuming name is user_id
            ).all()
            submitted_user_ids = {s.name for s in submissions_today}

            for member in members:
                if member.user_id not in submitted_user_ids:
                    # This is a placeholder for fetching user's email from Clerk/your DB
                    user_email = "user@example.com" # Replace with actual email lookup
                    print(f"Sending reminder to {user_email} for team {team.name}")
                    # send_reminder_email(user_email, member.user_id, team.id) 