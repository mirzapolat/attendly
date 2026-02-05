# Attendly

## Install (Local Dev)
1) Install dependencies
```bash
npm install
```

2) Create `.env.local`
```bash
VITE_SUPABASE_URL="https://<project-ref>.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<publishable-key>"
```

3) Set up Supabase (one-time)
```bash
supabase login
supabase link
supabase db push
```

4) Deploy Edge Functions
```bash
supabase functions deploy moderator-state moderator-action attendance-start attendance-submit excuse-start excuse-submit --no-verify-jwt
supabase functions deploy delete-account
```

5) Run the dev server
```bash
npm run dev
```

## Auth URLs (Optional)
In Supabase -> Authentication -> URL Configuration:
- Site URL: your app URL (e.g. http://localhost:5173)
- Redirect URLs: include your app URL(s)

## Deployment
Run the published image:
```bash
docker run --rm -p 8080:80 \
  -e VITE_SUPABASE_URL="https://<project-ref>.supabase.co" \
  -e VITE_SUPABASE_PUBLISHABLE_KEY="<publishable-key>" \
  mirzapolat/attendly:latest
```

Build and run your own image:
```bash
docker build -t attendly:latest .
docker run --rm -p 8080:80 \
  -e VITE_SUPABASE_URL="https://<project-ref>.supabase.co" \
  -e VITE_SUPABASE_PUBLISHABLE_KEY="<publishable-key>" \
  attendly:latest
```
