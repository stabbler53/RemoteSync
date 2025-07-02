# RemoteSync

RemoteSync is a 100% free, open-source, web-based SaaS tool for daily standup automation. It enables teams to submit daily updates via text or voice, transcribes voice to text, summarizes updates using open-source LLMs, logs all entries, and sends daily reports via email or Slack—all using only free and unlimited-tier tools.

## Features
- Accepts daily standup updates (voice or text)
- Transcribes voice to text using open-source Whisper (Hugging Face Spaces)
- Summarizes updates with free, open-source LLMs (Mixtral, MythoMax, Hermes, etc.)
- Logs all entries to Google Sheets (or Supabase)
- Sends daily summary reports via SendGrid (free tier) or Slack webhook
- Modular pipeline: works with browser, forms, WhatsApp/Telegram bots
- 100% free, MIT-licensed, and easy to self-host (Replit, Hugging Face Spaces, Render, etc.)

## Tech Stack
- Frontend: React + Tailwind (optional, for browser voice upload)
- Backend: FastAPI (Python)
- Voice Transcription: Whisper (Hugging Face Space)
- Summarization: Open-source LLM (Hugging Face Space)
- Storage: Google Sheets (pygsheets) or Supabase
- Email: SendGrid (free tier)

## Quick Start

1. **Clone the repo**
2. **Set up Google Sheets** and service account (see `docs/GOOGLE_SHEETS_SETUP.md`)
3. **Set up SendGrid** (see `docs/SENDGRID_SETUP.md`)
4. **Add environment variables** (see `.env.example`)
5. **Deploy backend** (Replit, Hugging Face Spaces, Render, etc.)
6. **(Optional) Deploy frontend** or use Tally.so/Google Form
7. **Share the form or app link** with your team
8. **Test with text and audio submissions**
9. **Trigger daily report** (manually or via cron/Zapier)

## Documentation
- [Setup Guide](docs/SETUP.md)
- [How to Plug in Different Models](docs/MODEL_PLUGINS.md)
- [API Reference](docs/API.md)

## License
MIT 