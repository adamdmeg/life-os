# Life OS — Project Context

A personal planning app: Year → Month → Sprint → Task, with retros.
Full spec in docs/PRD.md, database schema in docs/schema.md, and a
complete working prototype in docs/prototype.html.

## Stack
- React + Vite (JavaScript, not TypeScript)
- Supabase (Postgres + Auth), RLS enabled on all tables
- CSS variables for the design system (see src/index.css) — the prototype
  uses inline `var(--teal)` style, and we're preserving that for now rather
  than converting to Tailwind utility classes yet.

## What's done
- Vite project scaffolded
- Supabase project created; full schema from docs/schema.md is live,
  with indexes and RLS policies on all 12 tables
- Signup trigger (handle_new_user) auto-creates a profiles row
- Auth wired up: supabaseClient.js, AuthContext.jsx, Login.jsx, App.jsx
- Login/signup with email+password works locally

## What's next
- Seed-on-signup logic: when a new user signs up, generate their year row,
  12 months, 26 sprints (with pre-calc'd dates), and 52 auto key_dates.
  See the "Seed data structure" section in docs/schema.md.
- Then convert the prototype page by page (Year first), replacing the
  in-memory arrays (yearGoals, monthGoals, etc.) with Supabase reads/writes.

## Conventions
- Keep the prototype's visual design exact — match colors, spacing, layout.
- AREA_META colors and the 5 life areas (Health/Career/Finance/Personal/
  Fitness) are fixed and consistent across every layer.
- Each time you add or make changes to the architecture, add a short sentence to explain the addition and the rationale behind it. 
