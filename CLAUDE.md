# Life OS — Project Context

A personal planning app: Year → Month → Sprint → Task, with retros.
Full spec in docs/PRD.md, database schema in docs/schema.md, and a
complete working prototype in docs/prototype.html.

## Decision log — keep this current (IMPORTANT)
There is a running decision log at `docs/decision-log.md`. It captures, in
plain conversational first-person language, the decisions, tradeoffs, and open
questions behind every feature. Its purpose is to be a good source of truth for
when the user talks about this project in interviews.

Whenever the user makes a decision, hesitates, asks a question, weighs a
tradeoff, or changes their mind about a feature — during ANY conversation, not
just when explicitly told — you must:
1. **Add an entry** to `docs/decision-log.md`. New entries go at the top of the
   "## Entries" section, newest first, using the template at the bottom of that
   file (name, date, what was decided, **Why:**, **Tradeoff:**, **Still
   unsure:**). Keep it concise and conversational — write it in the user's
   voice, the way they'd explain it out loud.
2. **Prompt the user with a short follow-up question** when their reasoning is
   thin or a tradeoff/uncertainty is unstated — e.g. "what made you pick X over
   Y?", "what are you giving up here?", "anything still bugging you about this?"
   The goal is to draw out the *why* so the log is genuinely useful later.
3. Use today's actual date (see currentDate) on new entries.

Don't wait to be asked to update it — treat it as a standing instruction. If a
decision updates or reverses an earlier one, add a new entry that references the
change rather than silently editing the old entry.

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
- Retro page (RetroPage.jsx): reflects on one sprint (resolved with the same logic as
  SprintPage), lazily upserts the single `retros` row per sprint, and pushes carry-forward
  lines into the next sprint as deduped tasks. Routed in App.jsx and cross-linked from the
  Sprint page.
- Sprint goals (migration 002): structured goals (text + area) scoped to a sprint; kanban
  tasks are filed under a goal via `tasks.sprint_goal_id`. A goal's progress is derived from
  its tasks' completion (no separate checklist); standalone (no upward propagation to
  monthly/yearly). The free-text `sprints.goals` box is relabeled "Sprint intention".
- Month reflection detail: completed goals list their (all-done) subtasks nested; each sprint
  card shows a reflection peek (rating, energy, mid-sprint check-in preview). The
  `retros.ai_summary` column (migration 003) is a reserved, currently-blank slot for a later
  AI-generated one-sentence summary — the card renders it automatically once populated.
- Reflection views for ended periods: once a period is over, the editable planning page is
  auto-replaced by a read-only reflection. App.jsx routes ended months (month number <
  current month) to MonthReflectionPage (stats, intention, completed goals, sprint cards);
  SprintPage detects an ended sprint (today > end_date) and renders SprintReflectionPage
  (read-only mid-sprint check-in + retro).
- Gym consistency: a shared gymConsistency(sprints, asOf?) helper in stats.js reads each
  sprint's gym_plan and derives avg workout days/week — only 'lift'/'run' days count, rest
  and blank days are excluded, weeks = 2 per sprint. MonthReflectionPage (completed months)
  calls it with no asOf (counts every planned week); MonthPage (in-progress month) passes
  `today` for a running average (only fully-ended weeks count, in-progress week excluded).
  Both render a dedicated section: the average plus a lift/run/total breakdown.
- Monthly goals peek on the sprint page: SprintPage renders a compact read-only card ("This
  month's goals") at the top of the planning page, above the Sprint intention — area chip,
  goal text, and a done/total count derived from each goal's subtasks, with a "View month"
  link. (Reuses the month's monthly_goals already loaded for the pull-subtasks modal.)
- Sprint notes (migration 005): a nullable `sprints.notes` text column backs a free-text
  Notes card, distinct from `goals` (the intention) and `mid_sprint_notes` (the day-7
  check-in). Saved on blur, same as the other free-text fields.
- Sprint page Plan/Board tabs: SprintPage splits its content into two tabs. Plan = monthly
  goals peek, Intention + Notes (side by side), Sprint goals, Appointments + Gym; Board = the
  kanban + mid-sprint check-in. Help/retro buttons stay at the page level, outside the tabs.
  Default tab on load: a started sprint opens to Board, a not-yet-started one opens to Plan.

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
- Each time you add or change architecture, record the factual "what exists" in the
  "What's done" section above (no rationale there — keep it a strict record), and put the
  *why* / tradeoffs / open questions in `docs/decision-log.md` per the decision-log
  instructions near the top of this file.
