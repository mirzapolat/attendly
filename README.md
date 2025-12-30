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
Create a `.env.local` file:
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
- Edge Functions: `moderator-state`, `moderator-action`, `delete-account`
- RPC: `delete_own_account`

Example Supabase CLI flow (adjust to your project):
```bash
supabase link --project-ref <project-ref>
supabase db push
supabase functions deploy moderator-state moderator-action delete-account
supabase secrets set SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
```

## Docker
`docker-compose.yml` builds the Vite app into an Nginx image.
Update the Supabase build args to your own project keys.

```bash
docker compose up --build
```

App will be available at `http://localhost:8080`.

## Security Notes
- Rotating QR tokens are short-lived and validated by timestamp.
- Device fingerprinting is enforced at the database level (unique per event).
- Location verification marks submissions as suspicious if denied or out of range.
- Attendance form sessions expire after 2 minutes per scan.

## License
No license file is included. Add one if you intend to distribute this project.
