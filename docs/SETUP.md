# RemoteSync Setup Guide

## 1. Google Sheets Setup
- Create a Google Sheet named `RemoteSync Standup Log` with columns: Timestamp, Name, Transcript, Summary
- Create a Google Service Account in Google Cloud Console
- Share the sheet with the service account email
- Download the service account JSON as `google_creds.json`
- Place `google_creds.json` in the project root
- Get your Google Sheet ID from the URL

## 2. SendGrid Setup
- Sign up for a free SendGrid account
- Create an API key (with Mail Send permissions)
- Set your sender email (verified in SendGrid)
- Set your recipient email (can be your own for testing)

## 3. Hugging Face Setup
- Use public endpoints for Whisper and LLM (Mixtral, MythoMax, etc.)
- (Optional) Create a Hugging Face account and get a token for higher rate limits

## 4. Environment Variables
- Copy `.env.example` to `.env` and fill in your values:
  - `SENDGRID_API_KEY`, `FROM_EMAIL`, `REPORT_EMAIL`, `HF_TOKEN`, `GOOGLE_SHEET_ID`, `GOOGLE_CREDS_JSON`

## 5. Install Dependencies
```bash
pip install -r requirements.txt
```

## 6. Run the Backend
```bash
uvicorn main:app --reload
```

## 7. (Optional) Deploy
- Deploy to Replit, Hugging Face Spaces, Render, or Railway
- Set environment variables/secrets in your deployment platform

## 8. (Optional) Frontend
- Use the provided React app or Tally.so/Google Form for submissions

## 9. Test
- Submit a text or audio update
- Check Google Sheet for logs
- Trigger `/send-daily-report` endpoint to send a summary email 