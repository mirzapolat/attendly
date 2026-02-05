# Security Best Practices Review

## Executive Summary
- Stack reviewed: Vite + React (TypeScript) frontend, Supabase JS client, Supabase Edge Functions (Deno/TypeScript), Postgres with RLS migrations, Nginx static hosting config.
- Highest risk: rotating QR attendance tokens are **not validated against the event’s current token**, allowing forged tokens to pass the “freshness” check.
- General posture: solid use of Supabase RLS and server-side inserts via Edge Functions, but public functions + wildcard CORS + service-role key usage should be tightened with stricter validation and defense-in-depth controls.

## Critical Findings

### 1) APP-AUTH-001 — Rotating QR tokens are not validated against the event’s current token
- Severity: Critical
- Location: `supabase/functions/attendance-start/index.ts:81-104`, `supabase/functions/attendance-start/index.ts:207-223`
- Evidence:
  ```ts
  .select(["current_qr_token", "qr_token_expires_at", ...])
  // ...
  if (event.rotating_qr_enabled) {
    if (!providedToken || !isTokenWithinGrace(providedToken, now, rotationSeconds * 1000)) {
      return respond({ authorized: false, reason: "expired" });
    }
  }
  ```
- Impact: An attacker can craft a token with a valid timestamp suffix and bypass rotating-QR validation, enabling unauthorized check-ins and access to event metadata.
- Fix (preferred): Compare `providedToken` to `event.current_qr_token` and enforce expiry using `event.qr_token_expires_at`. If a grace period is needed, persist a `previous_qr_token` with its own expiry.
- Mitigation (defense-in-depth): Store hashed tokens, compare with a timing-safe function, and rotate tokens with short TTLs.
- False positive notes: None. The token is fetched but never compared to the provided token.

## Medium Findings

### 2) APP-EDGE-001 — Public Edge Functions run with `verify_jwt = false` and wildcard CORS
- Severity: Medium
- Location: `supabase/functions/attendance-start/config.toml:1`, `supabase/functions/attendance-submit/config.toml:1`, `supabase/functions/moderator-action/config.toml:1`, `supabase/functions/moderator-state/config.toml:1`, `supabase/functions/attendance-start/index.ts:4-7`
- Evidence:
  ```toml
  verify_jwt = false
  ```
  ```ts
  const corsHeaders = { "Access-Control-Allow-Origin": "*", ... };
  ```
- Impact: Any origin can call these service-role-backed functions; security relies entirely on URL tokens. If tokens leak, an attacker can invoke privileged actions from any site.
- Fix (preferred): Restrict CORS to trusted origins and set `Vary: Origin`. For non-public actions, enable `verify_jwt` and require authenticated JWTs.
- Mitigation (defense-in-depth): Add rate limits per IP/token and consider signed, short-lived tokens (HMAC) for anonymous flows.
- False positive notes: If you intentionally want fully public access, document that assumption and ensure tokens are high-entropy and short-lived.

### 3) APP-SESSION-001 — Attendance submission trusts `sessionId` alone (no binding to token/fingerprint)
- Severity: Medium
- Location: `supabase/functions/attendance-submit/index.ts:65-109`, `supabase/functions/attendance-start/index.ts:225-233`
- Evidence:
  ```ts
  .from("attendance_sessions").select("id, event_id, expires_at, used_at").eq("id", sessionId)
  ```
  ```ts
  .insert({ event_id: event.id, token: providedToken ?? "static", expires_at: expiresAt })
  ```
- Impact: If a `sessionId` is leaked (XSS, logs, analytics), it can be replayed without proving possession of the original token or fingerprint.
- Fix (preferred): Bind the session to the token and/or fingerprint at creation, then verify on submit (e.g., store `token_hash` and `fingerprint_hash` in `attendance_sessions` and require them on submit).
- Mitigation (defense-in-depth): Reduce session TTL and log/alert on mismatched submissions.
- False positive notes: If you rely solely on session entropy and short TTL, risk is reduced but still present if session IDs leak.

## Low Findings

### 4) APP-INFO-001 — Raw database error messages are returned to clients
- Severity: Low
- Location: `supabase/functions/attendance-submit/index.ts:236-246`, `supabase/functions/excuse-submit/index.ts:148-153`
- Evidence:
  ```ts
  return new Response(JSON.stringify({ success: false, reason: insertError.message }), ...)
  ```
- Impact: Leaks internal error details that can aid enumeration or debugging by attackers.
- Fix (preferred): Return generic error codes/messages to clients, log detailed errors server-side.
- Mitigation (defense-in-depth): Add structured error logging with correlation IDs.
- False positive notes: If errors are already scrubbed upstream, impact is reduced.

### 5) APP-PRIV-001 — PII stored in a non-HttpOnly cookie
- Severity: Low
- Location: `src/pages/Attend.tsx:43-94`
- Evidence:
  ```ts
  const REMEMBER_COOKIE = 'attendly:remember-attendee';
  document.cookie = `${REMEMBER_COOKIE}=${encoded}; Max-Age=...; ${buildCookieAttributes()}`;
  ```
- Impact: Names/emails are readable by any JS running on the page (XSS risk). It also persists for 30 days.
- Fix (preferred): Store only non-sensitive values (e.g., name) or use session-only storage; make “remember me” opt-in and allow easy purge.
- Mitigation (defense-in-depth): Shorten retention and add a clear UI control to clear data.
- False positive notes: If this is strictly convenience data and XSS protections are strong, risk is lower.

### 6) APP-HEADERS-001 — Security headers not defined in Nginx/Vercel configs
- Severity: Low
- Location: `nginx.conf:1-22`, `vercel.json:1-10`
- Evidence:
  ```nginx
  # No CSP/Referrer-Policy/X-Content-Type-Options/X-Frame-Options headers
  ```
- Impact: Weaker browser-level defenses against XSS, clickjacking, and MIME sniffing.
- Fix (preferred): Add CSP, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and a `frame-ancestors` or `X-Frame-Options` policy at the edge.
- Mitigation (defense-in-depth): If headers are set by CDN/hosting, document them and verify at runtime.
- False positive notes: These headers might be configured outside the repo; verify in production responses.

## Notes / Good Practices Observed
- RLS migrations show intentional hardening (e.g., removal of public access to moderation links and QR tokens).
- Tokens are generated with `crypto.randomUUID()` in several flows, which is appropriate for public links.

## Next Steps (Optional)
1. Fix APP-AUTH-001 immediately; it is exploitable without privileged access.
2. Decide which Edge Functions are truly public, then tighten CORS and JWT requirements accordingly.
3. Add a short security header baseline in Nginx/Vercel and verify headers in production.
