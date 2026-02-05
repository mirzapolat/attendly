# Attendly

Attendly is a QR-based attendance platform with anti-fraud controls like rotating codes,
location verification, and browser-stored client IDs. It is built with React + Vite on the
front end and Supabase (Auth, Postgres, Realtime, Edge Functions) on the back end.

## Highlights
- Rotating QR codes with short-lived tokens to reduce screenshot sharing.
- Optional location verification with a configurable radius (flags out-of-range check-ins).
- Client IDs (stored in cookies/local storage) to limit duplicate check-ins per event.
- Live event windows (start/stop attendance).
- Moderator links with limited access and privacy controls.
- Excuse links so attendees can self-mark as excused.
- Series for grouping events and analytics dashboards.
- Name conflict resolution to keep member records clean.
- Drag-and-drop event assignment to series.
- CSV export/import for attendance records.
- Theme personalization and account deletion flow.

## Tech Stack
- Frontend: React, Vite, TypeScript, Tailwind
- Backend: Supabase (Auth, Postgres, Realtime, Edge Functions)

## Quick Start (Local Dev)
1) Install dependencies
```bash
npm install
```

2) Create `.env.local`
```bash
VITE_SUPABASE_URL="https://<project-ref>.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<publishable-key>"
```

3) Run the dev server
```bash
npm run dev
```

## Supabase Setup
1) Create a Supabase project.
2) Copy the Project URL and Publishable Key.
3) Link the project and apply migrations:
```bash
supabase login
supabase link
supabase db push
```

4) Deploy Edge Functions:
```bash
supabase functions deploy moderator-state moderator-action attendance-start attendance-submit excuse-start excuse-submit --no-verify-jwt
supabase functions deploy delete-account
```

## Auth URLs (Optional)
In Supabase -> Authentication -> URL Configuration:
- Site URL: your app URL (e.g. http://localhost:5173)
- Redirect URLs: include your app URL(s)

## Docker
Run the published image:
```bash
docker run --rm -p 8080:80 \
  -e VITE_SUPABASE_URL="https://<project-ref>.supabase.co" \
  -e VITE_SUPABASE_PUBLISHABLE_KEY="<publishable-key>" \
  mirzapolat/attendly:latest
```

Build your own image:
```bash
docker build -t attendly:latest .
docker run --rm -p 8080:80 \
  -e VITE_SUPABASE_URL="https://<project-ref>.supabase.co" \
  -e VITE_SUPABASE_PUBLISHABLE_KEY="<publishable-key>" \
  attendly:latest
```

## Key Routes
- `/`: marketing landing page.
- `/auth`: sign in / sign up.
- `/dashboard`: events list + views.
- `/events/new`: create event.
- `/events/:id`: event management + QR display.
- `/attend/:id?token=...`: attendee check-in form.
- `/excuse/:eventId/:token`: excused attendance form.
- `/series/:id`: series analytics and member stats.
- `/settings`: profile, theme, and account deletion.
- `/moderate/:eventId/:token`: moderator view for attendance management.

## Project Structure
- `src/pages`: route-level UI (auth, dashboard, events, series, attend, moderator, settings).
- `src/components`: shared UI and event/moderation controls.
- `src/integrations/supabase`: Supabase client and generated types.
- `supabase/migrations`: database schema and RLS policies.
- `supabase/functions`: Edge Functions for attendance, moderation, excused attendance, and account deletion.
- `public`: static assets.

## Data Model (Supabase)
- `profiles`: admin profiles and theme color.
- `series`: groups of events.
- `events`: core event info + QR/security flags + moderation settings.
- `attendance_records`: attendee submissions + status + client id + location.
- `moderation_links`: shareable tokens for moderator access.
- `excuse_links`: shareable tokens for excused attendance.

## Security Notes
- Rotating QR tokens are short-lived and validated against the current server token.
- Client IDs are enforced at the database level (unique per event).
- Location verification marks submissions as suspicious if denied or out of range.
- Attendance form sessions expire after 2 minutes per scan.
