# RemoteSync Frontend (Next.js + Clerk)

This is the Next.js + Clerk frontend for RemoteSync, supporting secure authentication and daily standup submissions (text or voice).

## Features
- Clerk authentication (sign in, sign up, user context)
- Form for name, text, and audio upload
- Submits to the FastAPI backend `/submit` endpoint with Clerk JWT
- Displays the returned summary

## Migration Note
This folder will be migrated from Create React App to Next.js for best Vercel compatibility and Clerk integration.

## Usage
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Update the backend API URL in `.env.local` if needed.

## Deployment
- Deploy to Vercel for free, connect your GitHub repo. 