# CLAUDE.md — Attendly

## Project Overview

Attendly is a full-stack event attendance tracking application. Users create workspaces, organize events into series/seasons, and track attendance via QR codes (static or rotating). It includes moderation workflows, excuse submissions, and location-based verification.

## Tech Stack

- **Frontend:** React 18.3 + TypeScript 5.8 (SPA)
- **Build:** Vite 5.4 with SWC plugin
- **Styling:** Tailwind CSS 3.4 + shadcn/ui (Radix UI primitives)
- **State:** React Context (auth, workspace, theme) + TanStack React Query (server state)
- **Forms:** react-hook-form + zod validation
- **Backend:** Supabase (PostgreSQL + Edge Functions in Deno)
- **Deployment:** Docker/Nginx or Vercel
- **Package Manager:** npm (bun.lockb also present)

## Quick Commands

```bash
npm run dev          # Start dev server on port 8080
npm run build        # Production build → dist/
npm run build:dev    # Development mode build
npm run lint         # ESLint checks
npm run preview      # Preview production build locally
```

## Project Structure

```
src/
├── components/          # React components
│   ├── ui/              # shadcn/ui primitives (Button, Card, Dialog, etc.)
│   └── *.tsx            # Feature components (EventCard, LocationPicker, QRCodeExport, etc.)
├── pages/               # Route components (18 pages)
├── hooks/               # Custom React hooks (useAuth, useWorkspace, useThemeColor, useConfirm, usePageTitle)
├── integrations/
│   └── supabase/        # Supabase client init + auto-generated DB types
├── utils/               # Error handling, privacy utils, Supabase function helpers
├── lib/                 # Utility functions (cn(), runtime env loader)
├── constants/           # localStorage key constants
├── App.tsx              # Root component with provider hierarchy + routing
├── main.tsx             # React entry point
└── index.css            # Global styles + Tailwind directives

supabase/
├── functions/           # Deno Edge Functions (7 functions)
│   ├── attendance-start/    # Initiate attendance session (validates QR token)
│   ├── attendance-submit/   # Submit attendance record (location verification)
│   ├── moderator-state/     # Get moderation data
│   ├── moderator-action/    # Approve/reject attendance
│   ├── excuse-start/        # Initiate excuse flow
│   ├── excuse-submit/       # Submit excuse request
│   └── delete-account/      # Account deletion with cascade
└── migrations/          # 41 SQL migration files
```

## Architecture

### Provider Hierarchy (App.tsx)

```
QueryClientProvider → AuthProvider → WorkspaceProvider → ThemeColorProvider → ConfirmDialogProvider → TooltipProvider → BrowserRouter
```

### Routing (React Router v6)

| Path | Page | Description |
|------|------|-------------|
| `/` | Index | Landing page |
| `/features` | Features | Feature showcase |
| `/auth` | Auth | Sign up / sign in |
| `/workspaces` | Workspaces | Workspace management |
| `/dashboard` | Dashboard | Main dashboard |
| `/series` | Seasons | Series/season listing |
| `/series/:id` | SeasonDetail | Season details |
| `/series/:id/sanitize` | SeasonSanitize | Season data cleanup |
| `/members` | Members | Workspace members |
| `/workspace-settings` | WorkspaceSettings | Workspace config |
| `/events/new` | NewEvent | Create event |
| `/events/:id` | EventDetail | Event management |
| `/attend/:id` | Attend | Public attendance page |
| `/excuse/:eventId/:token` | Excuse | Excuse submission |
| `/moderate/:eventId/:token` | ModeratorView | Moderation interface |
| `/settings` | Settings | User settings |
| `/privacy` | Privacy | Privacy policy |
| `/impressum` | Impressum | Legal page |

### Database Tables (Supabase/PostgreSQL)

Core tables: `profiles`, `workspaces`, `workspace_members`, `workspace_invites`, `series`, `events`, `attendance_records`, `attendance_sessions`, `moderation_links`, `excuse_links`, `workspace_notifications`, `dismiss_sanitize_suggestions`.

- All tables use UUIDs as primary keys
- Row-Level Security (RLS) enabled on all tables
- Attendance status enum: `present`, `absent`, `excused`, `suspicious`

### Edge Functions

All Edge Functions use CORS with wildcard origin and `verify_jwt: false` (public endpoints). They use the Supabase service role key for admin operations. Responses follow a consistent error categorization pattern (`session_invalid`, `session_expired`, `already_submitted`, etc.).

## Key Conventions

### Imports

Use the `@/` path alias for all imports from `src/`:
```typescript
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
```

### Component Patterns

- **Functional components only** — no class components
- **shadcn/ui** for all base UI components (`src/components/ui/`). Add new components via `npx shadcn-ui@latest add <component>`
- **Tailwind utility classes** for styling — no CSS modules or styled-components
- **`cn()` helper** (clsx + tailwind-merge) for conditional class names
- **Theming** via CSS custom properties in HSL format (`--primary`, `--background`, etc.)
- **Dark mode** supported via class-based toggling

### State Management

- **Auth state:** `useAuth()` hook — provides user, session, signUp, signIn, signOut
- **Workspace state:** `useWorkspace()` hook — active workspace selection, membership data, persisted to localStorage
- **Theme state:** `useThemeColor()` hook — brand color customization with HSL conversion
- **Server data:** TanStack React Query for fetching and caching
- **Form state:** react-hook-form with zod schemas

### TypeScript

- Path alias: `@/*` maps to `./src/*`
- Non-strict mode: `noImplicitAny: false`, `strictNullChecks: false`, `noUnusedLocals: false`
- Auto-generated Supabase types in `src/integrations/supabase/types.ts` — do not edit manually
- Target: ES2020, Module: ESNext

### ESLint

- TypeScript ESLint + React hooks + React Refresh plugins
- `@typescript-eslint/no-unused-vars` is disabled
- Run `npm run lint` to check

### Environment Variables

Required variables (prefix `VITE_` for client-side access):
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` — Supabase anon/public key

Runtime env injection for Docker: `window.__ENV` loaded from `/env.js` (generated by `docker-entrypoint.d/99-runtime-env.sh`). The `getRuntimeEnv()` function in `src/lib/runtimeEnv.ts` checks `window.__ENV` first, then falls back to `import.meta.env`.

## Testing

No test framework is currently configured. There are no test files in the project. If adding tests, Vitest is the recommended choice for Vite projects.

## Deployment

### Docker

Multi-stage build: `node:20-alpine` (build) → `nginx:alpine` (serve). Runtime environment variables are injected via shell script at container startup. Nginx serves the SPA with fallback routing to `index.html`.

### Vercel

Configured via `vercel.json`: build command `npm run build`, output directory `dist`, with SPA rewrites.

## Supabase Development

```bash
npx supabase link             # Link to remote project
npx supabase db push          # Push migrations
npx supabase functions deploy  # Deploy Edge Functions
```

Edge Functions are written in Deno TypeScript under `supabase/functions/`. Each function has its own directory with an `index.ts` entry point.

## Common Patterns

- **localStorage keys** are centralized in `src/constants/storageKeys.ts` with a common prefix
- **Error handling** for Edge Functions uses `parseSupabaseFunctionError()` from `src/utils/supabaseFunctions.ts`
- **Confirmation dialogs** use the `useConfirm()` hook which returns a promise-based API
- **Toast notifications** via Sonner (`sonner`) and Radix Toast (`@/components/ui/toaster`)
- **QR codes** are generated using `qrcode` (canvas) and `qrcode.react` (React component), supporting both static and rotating token modes
- **Maps** use Leaflet via `react-leaflet` for location picking and attendance verification
