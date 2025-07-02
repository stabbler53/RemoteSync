import os
from fastapi import FastAPI, UploadFile, Form, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from utils import (
    summarize_text, log_to_db, send_email, upload_audio_to_supabase,
    create_team_in_db, invite_users_to_team, TeamCreate, TeamInvite,
    process_daily_reminders
)
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
import requests
from typing import Optional

load_dotenv()

CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY")

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

scheduler = AsyncIOScheduler()

@app.on_event("startup")
async def start_scheduler():
    # Schedule the reminder job to run every hour
    scheduler.add_job(
        process_daily_reminders,
        trigger=IntervalTrigger(hours=1),
        id="daily_reminder_job",
        replace_existing=True,
    )
    scheduler.start()

@app.on_event("shutdown")
async def shutdown_scheduler():
    scheduler.shutdown()

def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization.split(" ", 1)[1]
    resp = requests.post(
        "https://api.clerk.dev/v1/tokens/verify",
        headers={"Authorization": f"Bearer {CLERK_SECRET_KEY}", "Content-Type": "application/json"},
        json={"token": token}
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Clerk token")
    return resp.json()

@app.post("/teams", status_code=201)
def create_team(team_data: TeamCreate, user: dict = Depends(get_current_user)):
    user_id = user.get("sub") # Clerk user ID
    if not user_id:
        raise HTTPException(status_code=403, detail="User ID not found in token")
    new_team = create_team_in_db(team_data, user_id)
    return new_team

@app.post("/teams/{team_id}/invites")
def invite_to_team(team_id: str, invite_data: TeamInvite, user: dict = Depends(get_current_user)):
    # Optional: Add logic to ensure only team admins can invite
    return invite_users_to_team(team_id, invite_data)

@app.post("/submit")
async def submit_update(
    name: str = Form(...),
    text: str = Form(""),
    audio: Optional[UploadFile] = None,
    user=Depends(get_current_user)
):
    transcript = text
    audio_url = None
    if audio:
        audio_bytes = await audio.read()
        filename = f"{name}_{int(os.times().elapsed)}.wav"
        audio_url = upload_audio_to_supabase(audio_bytes, filename)
        transcript = summarize_text(audio_bytes, is_audio=True, audio_url=audio_url)
    else:
        transcript = summarize_text(text, is_audio=False)
    summary = summarize_text(transcript, is_audio=False, summarize=True)
    log_to_db(name, transcript, summary)
    return {"transcript": transcript, "summary": summary, "audio_url": audio_url}

@app.post("/send-daily-report")
def send_daily_report():
    return send_email()

@app.post("/webhooks/email-inbound")
async def email_inbound_webhook(payload: dict):
    # Logic to parse the email from Resend and create a standup entry
    # This will be implemented next
    print("Received inbound email:", payload)
    return {"status": "received"} 