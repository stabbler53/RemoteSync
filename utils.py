import os
import requests
from datetime import datetime, date, timedelta, time
from dotenv import load_dotenv
from sqlalchemy import create_engine, Column, Integer, String, DateTime, JSON, ForeignKey, func, Boolean
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from supabase import create_client, Client
from typing import List, Optional
import secrets
from imap_tools.mailbox import MailBox
from imap_tools.query import A
from clerk_sdk import Clerk
from models import TeamCreate, TeamSettingsUpdate

load_dotenv()

# --- Environment & Keys ---
WHISPER_URL = "https://api-inference.huggingface.co/models/openai/whisper-large-v2"
LLM_URL = "https://api-inference.huggingface.co/models/mistralai/Mixtral-8x7B-Instruct-v0.1"
HF_TOKEN = os.getenv("HF_TOKEN", "")
DATABASE_URL = os.getenv("DATABASE_URL")
RESEND_API_KEY = os.getenv("RESEND_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
IMAP_SERVER = os.getenv("IMAP_SERVER")
IMAP_USERNAME = os.getenv("IMAP_USERNAME")
IMAP_PASSWORD = os.getenv("IMAP_PASSWORD")
CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY")

if not DATABASE_URL or not SUPABASE_URL or not SUPABASE_SERVICE_KEY or not CLERK_SECRET_KEY:
    raise RuntimeError("One or more required environment variables are not set.")

# --- Database Setup (SQLAlchemy) ---
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

class Team(Base):
    __tablename__ = 'teams'
    id = Column(String, primary_key=True, default=lambda: f"team_{secrets.token_hex(16)}")
    name = Column(String, nullable=False)
    owner_id = Column(String, nullable=False) # Clerk User ID
    settings = Column(JSON, default=dict)
    report_recipients = Column(JSON, default=list)
    invite_token = Column(String, unique=True, default=lambda: secrets.token_urlsafe(16))
    created_at = Column(DateTime, default=datetime.utcnow)
    members = relationship("TeamMember", back_populates="team", cascade="all, delete-orphan")
    entries = relationship("StandupEntry", back_populates="team", cascade="all, delete-orphan")

class TeamMember(Base):
    __tablename__ = 'team_members'
    team_id = Column(String, ForeignKey('teams.id'), primary_key=True)
    user_id = Column(String, primary_key=True) # Clerk User ID
    role = Column(String, default='member')
    created_at = Column(DateTime, default=datetime.utcnow)
    team = relationship("Team", back_populates="members")

class StandupEntry(Base):
    __tablename__ = 'standup_entries'
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, nullable=False) # Clerk User ID
    team_id = Column(String, ForeignKey('teams.id'), nullable=False)
    text = Column(String)
    summary = Column(String)
    audio_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    team = relationship("Team", back_populates="entries")

# Create all tables
Base.metadata.create_all(bind=engine)

# --- Service Clients ---
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
clerk = Clerk(secret_key=CLERK_SECRET_KEY)

# --- Database Functions ---
def create_team_in_db(team_data: TeamCreate, owner_id: str) -> Team:
    with SessionLocal() as session:
        new_team = Team(
            name=team_data.name,
            owner_id=owner_id,
            settings=team_data.settings
        )
        session.add(new_team)
        session.flush() # Use flush to get the ID before commit
        
        # Add the owner as the first member
        first_member = TeamMember(user_id=owner_id, team_id=new_team.id, role='owner')
        session.add(first_member)
        
        session.commit()
        session.refresh(new_team)
        return new_team

def log_to_db(user_id: str, text: str, summary: str, audio_url: Optional[str], team_id: str) -> StandupEntry:
    with SessionLocal() as session:
        new_entry = StandupEntry(
            user_id=user_id,
            team_id=team_id,
            text=text,
            summary=summary,
            audio_url=audio_url
        )
        session.add(new_entry)
        session.commit()
        session.refresh(new_entry)
        return new_entry
        
# ... (rest of the functions like upload_audio, summarize_text, email processing, etc. remain here)
# Minor fixes will be applied to them in the next step if needed, but the structure is the focus now.

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

# --- Email Reply Processing ---
def process_email_replies():
    """Connects to an IMAP inbox, processes unread standup replies, and logs them."""
    print("Checking for email replies...")
    try:
        with MailBox(IMAP_SERVER).login(IMAP_USERNAME, IMAP_PASSWORD, 'INBOX') as mailbox:
            for msg in mailbox.fetch(A(seen=False)): # Fetch unread messages
                sender_email = msg.from_
                standup_text = msg.text or msg.html

                if not standup_text:
                    continue

                # Find the user by their email
                with SessionLocal() as session:
                    # This requires a 'users' table or a way to resolve email to user_id
                    # For now, we'll assume the email is the identifier
                    # In a real app, you'd look up the user in your Clerk/Supabase user table
                    user_id = sender_email # Placeholder
                    
                    # You might also need to determine the team, perhaps from the subject or a default team
                    team_id = "default-team-id" # Placeholder

                    print(f"Processing standup from {sender_email}...")
                    summary = summarize_text(standup_text, is_audio=False, summarize=True) or "No summary available."
                    log_to_db(user_id, standup_text, summary, None, team_id)
    except Exception as e:
        print(f"Error processing email replies: {e}")

def send_reminder_email(user_email: str):
    """Sends a daily standup reminder email."""
    # Simplified reminder that just asks the user to reply
    return requests.post(
        "https://api.resend.com/emails",
        headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
        json={
            "from": f"RemoteSync <{IMAP_USERNAME}>",
            "to": [user_email],
            "subject": "👋 Time for your daily standup!",
            "html": "<p>Hey! Just reply to this email with your update for today. We'll take care of the rest.</p>",
        }
    )

def process_daily_reminders():
    """
    Checks for email replies first, then sends reminders to users who have not
    submitted an update today.
    """
    process_email_replies()  # Check for replies first

    print("Processing daily reminders...")
    with SessionLocal() as session:
        today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Get all teams
        teams = session.query(Team).all()
        for team in teams:
            # Get users in the team who have NOT submitted today
            users_submitted_today = {
                entry.user_id for entry in session.query(StandupEntry.user_id)
                .filter(StandupEntry.team_id == team.id, StandupEntry.created_at >= today_start)
                .distinct()
            }
            
            for member in team.members:
                if member.user_id not in users_submitted_today:
                    try:
                        user_info = clerk.users.get_user(user_id=member.user_id)
                        # The user object might have multiple emails, we get the primary one
                        primary_email_id = user_info.primary_email_address_id
                        user_email_obj = next((e for e in user_info.email_addresses if e.id == primary_email_id), None)

                        if user_email_obj:
                            user_email = user_email_obj.email_address
                            print(f"Sending reminder to {user_email} for team {team.name}")
                            send_reminder_email(user_email)
                        else:
                            print(f"Could not find primary email for user {member.user_id}")
                    except Exception as e:
                        print(f"Error fetching user {member.user_id} from Clerk or sending email: {e}") 

def get_dashboard_data(user_id: str):
    """
    Fetches all necessary data for a user's dashboard.
    - List of teams the user belongs to.
    - Recent standup entries for those teams (last 7 days).
    """
    with SessionLocal() as session:
        # Find all teams the user is a member of
        team_memberships = session.query(TeamMember).filter(TeamMember.user_id == user_id).all()
        team_ids = [tm.team_id for tm in team_memberships]

        if not team_ids:
            return {"teams": [], "entries": []}

        # Get team details
        teams = session.query(Team).filter(Team.id.in_(team_ids)).all()

        # Get recent standup entries for these teams (last 7 days)
        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        entries = session.query(StandupEntry).filter(
            StandupEntry.team_id.in_(team_ids),
            StandupEntry.created_at >= seven_days_ago
        ).order_by(StandupEntry.created_at.desc()).all()

        # To enrich entries with user details, we'll fetch them from Clerk
        # This is more efficient than calling Clerk inside a loop
        user_ids_from_entries = {e.user_id for e in entries}
        users_info = {}
        if user_ids_from_entries:
            try:
                clerk_users = clerk.users.get_user_list(user_id=list(user_ids_from_entries))
                for user in clerk_users:
                    users_info[user.id] = {
                        "first_name": user.first_name,
                        "last_name": user.last_name,
                        "image_url": user.image_url,
                    }
            except Exception as e:
                print(f"Error fetching batch user data from Clerk: {e}")


        # Combine entries with user info
        enriched_entries = []
        for entry in entries:
            user_data = users_info.get(entry.user_id, {})
            enriched_entries.append({
                "id": entry.id,
                "user_id": entry.user_id,
                "team_id": entry.team_id,
                "text": entry.text,
                "summary": entry.summary,
                "audio_url": entry.audio_url,
                "created_at": entry.created_at.isoformat(),
                "user_info": user_data
            })

        return {
            "teams": [{"id": t.id, "name": t.name, "settings": t.settings} for t in teams],
            "entries": enriched_entries
        } 

def invite_users_to_team(team_id: str, emails: List[str]):
    """Creates invites and sends emails via Resend."""
    # This is a simplified version. In a real app, you'd generate unique tokens
    # for each email and store them in an 'invites' table.
    with SessionLocal() as session:
        team = session.query(Team).filter(Team.id == team_id).first()
        if not team:
            raise ValueError("Team not found")

    subject = f"You're invited to join the '{team.name}' team on RemoteSync!"
    # The invite link would ideally contain a unique token for each user
    invite_link = f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/accept-invite?token={team.invite_token}"
    html_body = f"<p>You've been invited to join <strong>{team.name}</strong>!</p><p>Click here to accept: <a href='{invite_link}'>{invite_link}</a></p>"

    response = requests.post(
        "https://api.resend.com/emails",
        headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
        json={
            "from": f"RemoteSync <invites@{os.getenv('RESEND_DOMAIN', 'yourdomain.com')}>",
            "to": emails,
            "subject": subject,
            "html": html_body,
        }
    )
    if response.status_code == 200:
        return {"status": "invites sent successfully"}
    else:
        raise Exception(f"Failed to send invites: {response.text}") 

def is_team_owner(session, user_id: str, team_id: str) -> bool:
    """Checks if a user is the owner of a given team."""
    team = session.query(Team).filter_by(id=team_id, owner_id=user_id).first()
    return team is not None

def update_team_settings_in_db(team_id: str, settings_data: TeamSettingsUpdate, user_id: str) -> Team:
    """Updates a team's settings and/or report recipients if the user is the owner."""
    with SessionLocal() as session:
        team = session.query(Team).filter_by(id=team_id).first()
        if not team:
            raise ValueError("Team not found.")

        if team.owner_id != user_id:
            raise PermissionError("Only the team owner can update settings.")
            
        # Update settings if provided
        if settings_data.settings is not None:
            # Merge existing settings with new ones
            updated_settings = team.settings.copy()
            updated_settings.update(settings_data.settings)
            team.settings = updated_settings
        
        # Update report recipients if provided
        if settings_data.report_recipients is not None:
            team.report_recipients = settings_data.report_recipients
            
        session.commit()
        session.refresh(team)
        return team

def accept_invite(token: str, user_id: str) -> Team:
    """
    Validates an invite token and adds the user to the team.
    Returns the team information upon successful joining.
    """
    with SessionLocal() as session:
        # Find the team associated with the invite token
        team = session.query(Team).filter(Team.invite_token == token).first()

        if not team:
            raise ValueError("Invalid or expired invitation token.")

        # Check if the user is already a member
        existing_member = session.query(TeamMember).filter(
            TeamMember.team_id == team.id,
            TeamMember.user_id == user_id
        ).first()

        if existing_member:
            # User is already in the team, so it's a success in a way.
            return team

        # Add the new member to the team
        new_member = TeamMember(team_id=team.id, user_id=user_id, role='member')
        session.add(new_member)
        session.commit()
        session.refresh(team)

        return team 

def generate_daily_report(team_id: str) -> Optional[str]:
    """
    Generates an HTML report for a team's standup entries over the last 24 hours.
    Returns the HTML string or None if no entries are found.
    """
    with SessionLocal() as session:
        yesterday = datetime.utcnow() - timedelta(days=1)
        
        entries = session.query(StandupEntry).filter(
            StandupEntry.team_id == team_id,
            StandupEntry.created_at >= yesterday
        ).order_by(StandupEntry.created_at.asc()).all()

        if not entries:
            return None

        # Fetch user info for all participants in a single batch
        user_ids = list(set(entry.user_id for entry in entries))
        users_info = {user.id: user for user in clerk.users.get_user_list(user_id=user_ids)}

        html_content = "<h1>Daily Standup Summary</h1>"
        for entry in entries:
            user = users_info.get(entry.user_id)
            user_name = f"{user.first_name} {user.last_name}" if user else "Unknown User"
            
            html_content += f"<h3>{user_name}</h3>"
            html_content += f"<blockquote>{entry.summary.replace(chr(10), '<br>')}</blockquote>"
            if entry.audio_url:
                html_content += f"<p><a href='{entry.audio_url}'>Listen to audio update</a></p>"
            html_content += "<hr>"

        return html_content

def process_daily_reports():
    """
    Iterates through teams, generates daily reports for those who are due,
    and sends them to the configured recipients.
    """
    print("Processing daily reports...")
    with SessionLocal() as session:
        teams = session.query(Team).all()
        for team in teams:
            report_time_str = team.settings.get("summaryTime", "17:00")
            # This is a naive time check. A real app would need timezone awareness.
            report_hour = int(report_time_str.split(":")[0])
            
            # Check if it's the hour to send the report (in UTC)
            if datetime.utcnow().hour != report_hour:
                continue

            recipients = team.report_recipients
            if not recipients:
                print(f"Skipping report for team {team.name}: No recipients configured.")
                continue

            print(f"Generating report for team {team.name}...")
            report_html = generate_daily_report(team.id)

            if not report_html:
                print(f"No entries for team {team.name} in the last 24 hours. Skipping report.")
                continue

            subject = f"Daily Standup Report for {team.name} - {date.today().isoformat()}"
            
            requests.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
                json={
                    "from": f"RemoteSync Reports <reports@{os.getenv('RESEND_DOMAIN', 'yourdomain.com')}>",
                    "to": recipients,
                    "subject": subject,
                    "html": report_html,
                }
            )
            print(f"Sent report for team {team.name} to {', '.join(recipients)}")

def generate_weekly_report(team_id: str) -> Optional[str]:
    """
    Generates an HTML report for a team's standup entries over the last 7 days.
    """
    with SessionLocal() as session:
        one_week_ago = datetime.utcnow() - timedelta(days=7)
        entries = session.query(StandupEntry).filter(
            StandupEntry.team_id == team_id,
            StandupEntry.created_at >= one_week_ago
        ).order_by(StandupEntry.created_at.asc()).all()

        if not entries:
            return None

        user_ids = list(set(entry.user_id for entry in entries))
        users_info = {user.id: user for user in clerk.users.get_user_list(user_id=user_ids)}

        html_content = "<h1>Weekly Standup Summary</h1><p>A summary of all updates from the past week.</p><hr>"
        
        # Group entries by day
        entries_by_day = {}
        for entry in entries:
            day = entry.created_at.strftime('%Y-%m-%d %A')
            if day not in entries_by_day:
                entries_by_day[day] = []
            entries_by_day[day].append(entry)

        for day, day_entries in sorted(entries_by_day.items()):
            html_content += f"<h2>{day}</h2>"
            for entry in day_entries:
                user = users_info.get(entry.user_id)
                user_name = f"{user.first_name} {user.last_name}" if user else "Unknown User"
                html_content += f"<h3>{user_name}</h3><blockquote>{entry.summary.replace(chr(10), '<br>')}</blockquote>"
            html_content += "<hr>"

        return html_content

def process_weekly_reports():
    """
    Iterates through teams and sends weekly reports if they are due.
    """
    print("Processing weekly reports...")
    with SessionLocal() as session:
        today_name = datetime.utcnow().strftime('%A') # e.g., "Friday"
        teams = session.query(Team).all()
        for team in teams:
            weekly_report_day = team.settings.get("weeklyReportDay", "Friday")
            report_time_str = team.settings.get("summaryTime", "17:00")
            report_hour = int(report_time_str.split(":")[0])

            # Check if it's the right day and hour to send the report
            if today_name != weekly_report_day or datetime.utcnow().hour != report_hour:
                continue

            recipients = team.report_recipients
            if not recipients:
                continue

            print(f"Generating weekly report for team {team.name}...")
            report_html = generate_weekly_report(team.id)

            if not report_html:
                continue

            subject = f"Weekly Standup Report for {team.name} - Week of {date.today().isoformat()}"
            requests.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
                json={
                    "from": f"RemoteSync Reports <reports@{os.getenv('RESEND_DOMAIN', 'yourdomain.com')}>",
                    "to": recipients, "subject": subject, "html": report_html
                }
            )
            print(f"Sent weekly report for team {team.name} to {', '.join(recipients)}")

def run_scheduled_jobs():
    process_daily_reminders()
    process_daily_reports()
    process_weekly_reports()

def remove_member_from_team(team_id: str, member_id_to_remove: str, requester_id: str):
    """Removes a member from a team, checking for owner permissions."""
    with SessionLocal() as session:
        team = session.query(Team).filter_by(id=team_id).first()
        if not team:
            raise ValueError("Team not found.")
        
        # Check if the requester is the owner
        if team.owner_id != requester_id:
            raise PermissionError("Only the team owner can remove members.")
            
        # The owner cannot remove themselves
        if member_id_to_remove == team.owner_id:
            raise ValueError("The team owner cannot be removed.")
            
        member_to_remove = session.query(TeamMember).filter_by(
            team_id=team_id, 
            user_id=member_id_to_remove
        ).first()
        
        if not member_to_remove:
            raise ValueError("Member not found in this team.")
            
        session.delete(member_to_remove)
        session.commit()
        return {"status": "success", "message": "Member removed."} 

def get_team_members(team_id: str):
    """Fetches all members of a team and enriches them with Clerk user data."""
    with SessionLocal() as session:
        members = session.query(TeamMember).filter_by(team_id=team_id).all()
        if not members:
            return []
            
        member_user_ids = [m.user_id for m in members]
        
        try:
            clerk_users = clerk.users.get_user_list(user_id=member_user_ids)
            users_info = {user.id: user for user in clerk_users}
        except Exception as e:
            print(f"Error fetching batch user data from Clerk: {e}")
            users_info = {}

        enriched_members = []
        for member in members:
            user_data = users_info.get(member.user_id)
            if user_data:
                enriched_members.append({
                    "id": user_data.id,
                    "first_name": user_data.first_name,
                    "last_name": user_data.last_name,
                    "image_url": user_data.image_url,
                    "role": member.role
                })
        
        return enriched_members 