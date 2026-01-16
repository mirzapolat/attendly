# Attendly by Mirza Polat

Attendly is a QR-based attendance tracking app with anti-fraud controls like rotating codes,
location verification, and device fingerprinting. It is built with React + Vite on the front
end and Supabase (Auth, Postgres, Realtime, Edge Functions) on the back end.

## Features
- Rotating QR codes (every 3 seconds) with short-lived tokens to reduce screenshot sharing.
- Optional location verification with a configurable radius (flags out-of-range check-ins).
- Device fingerprinting to limit duplicate check-ins per event.
- Event on/off controls for live attendance windows.
- Moderator links with limited access and privacy controls for attendee data.
- Excuse links so attendees can self-mark as excused.
- Seasons for grouping events and analytics dashboards.
- Name conflict resolution to keep member records clean.
- Drag-and-drop event assignment to seasons.
- CSV export/import for attendance records.
- Theme color personalization and account deletion flow.

## Routes
- `/`: marketing landing page.
- `/auth`: sign in / sign up.
- `/dashboard`: admin overview (events + seasons).
- `/events/new`: create event.
- `/events/:id`: event management + QR display.
- `/attend/:id?token=...`: attendee check-in form.
- `/excuse/:eventId/:token`: excused attendance form.
- `/seasons/:id`: season analytics and member stats.
- `/settings`: profile, theme, and account deletion.
- `/moderate/:eventId/:token`: moderator view for attendance management.

## Project Structure
- `src/pages`: route-level UI (auth, dashboard, events, seasons, attend, moderator, settings).
- `src/components`: shared UI + event/moderation controls.
- `src/integrations/supabase`: client and generated types.
- `supabase/migrations`: database schema and RLS policies.
- `supabase/functions`: Edge Functions for attendance, moderation, excused attendance, and account deletion.
- `public`: static assets.

## Data Model (Supabase)
- `profiles`: admin profiles + theme color.
- `seasons`: groups of events.
- `events`: core event info + QR/security flags + moderation settings.
- `attendance_records`: attendee submissions + status + fingerprint + location.
- `moderation_links`: shareable tokens for moderator access.
- `excuse_links`: shareable tokens for excused attendance.

## Security Notes
- Rotating QR tokens are short-lived and validated by timestamp.
- Device fingerprinting is enforced at the database level (unique per event).
- Location verification marks submissions as suspicious if denied or out of range.
- Attendance form sessions expire after 2 minutes per scan.

# Getting Started / Installation

This guide covers two scenarios:
1) You want to run Attendly from source (local dev or custom deploy).
2) You want to use the published Docker image with your own Supabase project.

## Prerequisites
- Supabase account
- Supabase CLI installed: https://supabase.com/docs/guides/cli
- Node 20+ (only if running from source)
- This repository

## 1) Create a Supabase project
1. Create a new project in Supabase.
2. Copy from Dashboard:
   - Project URL
   - Publishable Key

## 2) Apply migrations and deploy Edge Functions
From this repository:
```bash
supabase login
supabase link # Link your project
supabase db push
supabase functions deploy moderator-state moderator-action attendance-start attendance-submit excuse-start excuse-submit --no-verify-jwt
supabase functions deploy delete-account
```

## 3) Configure Auth URLs (optional)
In Supabase -> Authentication -> URL Configuration:
- Site URL: your app URL (e.g. http://localhost:5173)
- Redirect URLs: include your app URL(s)

## 4) Run application

### Run the Docker image (recommended for users)
```bash
docker run --rm -p 8080:80 \
  -e VITE_SUPABASE_URL="https://<project-ref>.supabase.co" \
  -e VITE_SUPABASE_PUBLISHABLE_KEY="<publishable-key>" \
  mirzapolat/attendly:latest
```

### Build your own Docker image
```bash
docker build -t attendly:latest .
docker run --rm -p 8080:80 \
  -e VITE_SUPABASE_URL="https://<project-ref>.supabase.co" \
  -e VITE_SUPABASE_PUBLISHABLE_KEY="<publishable-key>" \
  attendly:latest
```

### Run from source

Create `.env.local`:
```bash
VITE_SUPABASE_URL="https://<project-ref>.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<publishable-key>"
```
Start dev server:
```bash
npm install
npm run dev
```
