# Supabase Setup (Step-by-step)

This guide covers two scenarios:
1) You want to run Attendly from source (local dev or custom deploy).
2) You want to use the published Docker image with your own Supabase project.

## Prerequisites
- Supabase account
- Supabase CLI installed: https://supabase.com/docs/guides/cli
- Node 20+ (only if running from source)

## 1) Create a Supabase project
1. Create a new project in Supabase.
2. Go to Project Settings -> API.
3. Copy:
   - Project URL
   - anon (publishable) key
   - service role key (for Edge Functions only)

## 2) Apply migrations and deploy Edge Functions
From this repository:
```bash
supabase login
supabase link --project-ref <project-ref>
supabase db push
supabase functions deploy moderator-state moderator-action attendance-start attendance-submit delete-account
supabase secrets set SUPABASE_URL="https://<project-ref>.supabase.co" \
  SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
```

## 3) Configure Auth URLs
In Supabase -> Authentication -> URL Configuration:
- Site URL: your app URL (e.g. http://localhost:5173)
- Redirect URLs: include your app URL(s)

## 4) Run from source (optional)
Create `.env.local`:
```bash
VITE_SUPABASE_URL="https://<project-ref>.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<anon-or-publishable-key>"
```
Start dev server:
```bash
npm install
npm run dev
```

## 5) Run the Docker image (recommended for users)
If you publish the image to Docker Hub, your users can run it with their own keys:
```bash
docker run --rm -p 8080:80 \
  -e VITE_SUPABASE_URL="https://<project-ref>.supabase.co" \
  -e VITE_SUPABASE_PUBLISHABLE_KEY="<anon-or-publishable-key>" \
  <dockerhub-user>/attendly:latest
```

Notes:
- The publishable/anon key is safe to expose in the client.
- Never put the service role key in the client. It is only for Edge Functions secrets.
