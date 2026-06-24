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
- Retro page (RetroPage.jsx) converted: reflects on one sprint (resolved with the
  same logic as SprintPage), lazily upserts the single `retros` row per sprint, and
  pushes carry-forward lines into the next sprint as deduped tasks. Routed in App.jsx
  and cross-linked from the Sprint page so the user lands on the matching sprint.
- Sprint goals (migration 002): structured goals (text + area) scoped to a sprint, where
  kanban tasks are filed under a goal via `tasks.sprint_goal_id`. A goal's progress is
  derived from its tasks' completion — no separate checklist, and standalone (no upward
  propagation to monthly/yearly). The free-text `sprints.goals` box is relabeled "Sprint
  intention". Rationale: reuse tasks as the leaf so the new layer adds no extra copy/recalc.
- Month reflection detail: completed goals list their (all-done) subtasks nested, and each
  sprint card shows a reflection peek (rating, energy, mid-sprint check-in preview). The
  `retros.ai_summary` column (migration 003) is a reserved, currently-blank slot for a later
  AI-generated one-sentence summary — the card renders it automatically once populated.
- Reflection views for ended periods: once a period is over, the editable planning page
  is auto-replaced by a read-only reflection. App.jsx routes ended months (month number
  < current month) to MonthReflectionPage (stats, intention, completed goals, sprint
  cards); SprintPage detects an ended sprint (today > end_date) and renders
  SprintReflectionPage (read-only mid-sprint check-in + retro). Rationale: finished work
  should look finished and surface outcomes, not invite further editing.
- Gym consistency: a shared gymConsistency(sprints, asOf?) helper in stats.js reads each
  sprint's gym_plan and derives avg workout days/week — only 'lift'/'run' days count, rest
  and blank days are excluded, weeks = 2 per sprint. MonthReflectionPage (completed months)
  calls it with no asOf to count every planned week; MonthPage (in-progress month) passes
  `today` so it's a running average — only fully-ended weeks count (a still-in-progress week
  is excluded entirely) so the average never dips mid-week as not-yet-done days sit empty.
  Both render the same
  dedicated section: the average plus a lift/run/total breakdown. Rationale: the gym plan
  already captures per-day workout type, so consistency is derivable with no new schema, and
  one helper keeps the planning and reflection views consistent.

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
