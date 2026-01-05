# Attendly

Attendly is a QR-based attendance tracking app with anti-fraud controls like rotating codes,
location verification, and device fingerprinting. It is built with React + Vite on the front
end and Supabase (Auth, Postgres, Realtime, Edge Functions) on the back end.

## Features
- Rotating QR codes (every 3 seconds) with short-lived tokens to reduce screenshot sharing.
- Optional location verification with a configurable radius (flags out-of-range check-ins).
- Device fingerprinting to limit duplicate check-ins per event.
- Event on/off controls for live attendance windows.
- Moderator links with limited access and privacy controls for attendee data.
- Seasons for grouping events and analytics dashboards.
- CSV export/import for attendance records.
- Theme color personalization and account deletion flow.

## Routes
- `/`: marketing landing page.
- `/auth`: sign in / sign up.
- `/dashboard`: admin overview (events + seasons).
- `/events/new`: create event.
- `/events/:id`: event management + QR display.
- `/attend/:id?token=...`: attendee check-in form.
- `/seasons/:id`: season analytics and member stats.
- `/settings`: profile, theme, and account deletion.
- `/moderate/:eventId/:token`: moderator view for attendance management.

## Tech Stack
- React 18 + TypeScript + Vite
- Tailwind CSS + shadcn/ui + Radix UI
- Supabase (Auth, Postgres, RLS, Realtime, Edge Functions)
- React Router, React Query, Zod
- FingerprintJS, QR generation (qrcode.react, qrcode), Recharts

## Project Structure
- `src/pages`: route-level UI (auth, dashboard, events, seasons, attend, moderator, settings).
- `src/components`: shared UI + event/moderation controls.
- `src/integrations/supabase`: client and generated types.
- `supabase/migrations`: database schema and RLS policies.
- `supabase/functions`: Edge Functions for moderator workflows and account deletion.
- `public`: static assets.

## Data Model (Supabase)
- `profiles`: admin profiles + theme color.
- `seasons`: groups of events.
- `events`: core event info + QR/security flags + moderation settings.
- `attendance_records`: attendee submissions + status + fingerprint + location.
- `moderation_links`: shareable tokens for moderator access.

## Getting Started

### Prerequisites
- Node.js 20+
- npm (or bun)

### Install
```bash
npm install
```

### Environment Variables
Create a `.env.local` file for local development:
```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_or_publishable_key
```

### Run
```bash
npm run dev
```

### Build and Preview
```bash
npm run build
npm run preview
```

### Lint
```bash
npm run lint
```

## Supabase Setup
This repo includes database migrations and Edge Functions for moderator workflows.

- Migrations: `supabase/migrations`
- Edge Functions: `moderator-state`, `moderator-action`, `attendance-start`, `attendance-submit`, `delete-account`
- RPC: `delete_own_account`
- Step-by-step guide: `SUPABASE_SETUP.md`

Example Supabase CLI flow (adjust to your project):
```bash
supabase link --project-ref <project-ref>
supabase db push
supabase functions deploy moderator-state moderator-action attendance-start attendance-submit delete-account
```
Notes:
- The Supabase CLI reserves `SUPABASE_*` env names; those values are injected into Edge Functions automatically.
- If your Edge Functions logs show "Backend credentials are not configured", set custom secrets:
```bash
supabase secrets set ATTENDLY_SUPABASE_URL="https://<project-ref>.supabase.co" \
  ATTENDLY_SERVICE_ROLE_KEY="<service-role-key>"
```

## Docker
The container reads Supabase config at runtime and writes `/env.js`, so the same image can be
used with different projects.

Build:
```bash
docker build -t attendly:latest .
```

Run:
```bash
docker run --rm -p 8080:80 \
  -e VITE_SUPABASE_URL=your_supabase_url \
  -e VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_or_publishable_key \
  attendly:latest
```

App will be available at `http://localhost:8080`. The Supabase publishable/anon key is
client-side; do not use a service role key here.

## Security Notes
- Rotating QR tokens are short-lived and validated by timestamp.
- Device fingerprinting is enforced at the database level (unique per event).
- Location verification marks submissions as suspicious if denied or out of range.
- Attendance form sessions expire after 2 minutes per scan.
