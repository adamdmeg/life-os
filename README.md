# Life OS

A personal planning app for running your life in sprints. You plan in layers —
**Year → Month → Sprint → Task** — and reflect with mid-sprint check-ins and
end-of-sprint retros. Every layer connects upward: tasks feed goals, goals feed
the year. The structure does the remembering for you — sprint dates, check-ins,
and retro dates auto-generate so you never have to set them by hand.

Built for someone who wants intentional, structured life planning with a
digital-first, mobile-friendly workflow.

## Core philosophy

- Planning happens in layers: Year → Month → Sprint → Task
- Every layer connects upward — tasks feed goals, goals feed the year
- Reflection is built in — mid-sprint check-ins and retros are first-class
- The system is replicable — every year, month, and sprint shares one structure
- Structure does the remembering — dates and check-ins auto-generate

## The five life areas

Fixed across every layer, each with a consistent color:

| Area | Color | Covers |
|---|---|---|
| Health | Teal | Sleep, nutrition, mental health, medical |
| Career | Purple | Work, skills, side projects, networking |
| Finance | Amber | Savings, budgeting, investments, debt |
| Personal | Pink | Relationships, hobbies, reading, travel |
| Fitness | Green | Gym, running, sports, body composition |

## Tech stack

- **Frontend:** React 19 + Vite (JavaScript, not TypeScript)
- **Backend:** Supabase (Postgres + Auth), row-level security on every table
- **Styling:** CSS variables design system (`src/index.css`); the app preserves
  the prototype's inline `var(--teal)` style rather than Tailwind utilities
- **Hosting (planned):** Vercel, delivered as a responsive PWA

## Architecture

### Data model

Twelve Postgres tables, all UUID-keyed, all RLS-protected so a user only sees
their own rows. The hierarchy:

```
profiles (user)
└── years
    ├── goals
    │   └── milestones
    └── months
        ├── monthly_goals
        │   └── subtasks ───────────────┐ pulled via subtask_source_id
        ├── key_dates (month-level)      │
        └── sprints                      │
            ├── sprint_goals             │
            ├── key_dates (auto + user)  │
            ├── tasks ◄──────────────────┘  (carry-forward: carried_from → tasks)
            └── retros
```

- **goals / milestones** — yearly goals per life area; checking milestones drives
  goal progress.
- **monthly_goals / subtasks** — what you're working on this month, broken into
  subtasks. Subtasks can be *pulled* into a sprint (copied, not moved); a subtask
  sourced from a yearly milestone keeps a link so its completion propagates up.
- **sprints** — two per month, numbered 1–26 across the year. Holds the gym plan
  (two weekly grids of lift/run/rest as JSONB), a free-text intention, notes, and
  the day-7 mid-sprint check-in.
- **sprint_goals** — structured goals scoped to one sprint; kanban tasks file
  under them and progress is derived from task completion (standalone — no upward
  propagation).
- **tasks** — the kanban cards (todo / in_progress / done) with optional due
  dates; due tasks sort to the top of their column, overdue shows red.
- **key_dates** — appointments; mid-sprint and retro dates are auto-inserted on
  sprint creation (`is_auto = true`) and can't be deleted.
- **retros** — one per sprint: 1–10 rating, went-well / improve / carry-forward,
  energy check, one insight. Carry-forward items become tasks in the next sprint.

Most progress numbers are computed in the app layer, not stored — goal %, sprint
completion %, "on track", days remaining, etc. See `docs/schema.md` for the full
table definitions and the computed-value table.

### App structure

- `src/App.jsx` — routing across Year / Month / Sprint / Retro, including the
  read-only **reflection** views that replace a period's editable page once it
  has ended.
- Page components: `YearPage`, `MonthPage`, `SprintPage`, `RetroPage`, plus
  `MonthReflectionPage` and `SprintReflectionPage` for ended periods.
- Modals: `AddGoalModal`, `AddMonthlyGoalModal`, `AddTaskModal`,
  `PullSubtasksModal`, `PullYearGoalsModal`.
- Shared: `AuthContext.jsx` + `supabaseClient.js` (auth), `stats.js` (computed
  values, e.g. gym consistency), `constants/areaMeta.js` (the five areas and
  their colors), `GymPlan.jsx`, `MonthGrid.jsx` / `MonthCalendar.jsx`, `Nav.jsx`.
- `src/seedUserData.js` — scaffolds a new user's year (1 year, 12 months, 26
  sprints with pre-calc'd dates, 52 auto key dates).
- `migrations/` — incremental SQL migrations (001–005) layered on the base schema.

## Getting started

### Prerequisites
- Node 18+ and npm
- A Supabase project (Postgres + Auth)

### Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a `.env` in the project root with your Supabase credentials:
   ```
   VITE_SUPABASE_URL=your-project-url
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
   (`.env` is gitignored.)
3. Apply the database schema in your Supabase project:
   - Run the base schema from `docs/schema.md`
   - Then apply the incremental migrations in `migrations/` in order (001 → 005)
   - Ensure RLS is enabled and the `handle_new_user` signup trigger is in place
4. Start the dev server:
   ```bash
   npm run dev
   ```

### Scripts
| Command | What it does |
|---|---|
| `npm run dev` | Start the Vite dev server with HMR |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |

## How to use the app

1. **Set up your year.** Pick a yearly theme and add one or more goals per life
   area, each with a few milestones. Signup auto-scaffolds your 12 months and 26
   sprints with their dates already calculated.
2. **Plan the month.** Write a monthly intention and add monthly goals by area,
   each broken into subtasks. Auto-generated check-in and retro dates appear in
   your key dates.
3. **Run the sprint (every 2 weeks).** Set your sprint intention and structured
   sprint goals, pull subtasks down from your monthly goals, lay out the gym
   plan, and work the kanban board day to day.
4. **Check in on day 7.** Answer the mid-sprint prompt: on track / needs to shift
   / dropping or adding.
5. **Retro on day 14.** Rate the sprint, capture what went well / to improve /
   to carry forward, log your energy, and write one insight. Carry-forward items
   flow into the next sprint automatically.
6. **Reflect.** Once a month or sprint ends, its editable page is replaced by a
   read-only reflection view with stats and completed work.

## Roadmap

**Shipped**
- Auth (email/password) with auto-created profile on signup
- Full schema live in Supabase (12 tables, indexes, RLS on all)
- Retro page with carry-forward into the next sprint
- Structured sprint goals filed under kanban tasks
- Month/sprint reflection views for ended periods
- Gym consistency tracking (avg workout days/week)
- Sprint Plan/Board tabs, monthly-goals peek, sprint notes

**In progress / next**
- Seed-on-signup wiring end to end
- Converting the prototype page by page (Year first), swapping in-memory arrays
  for live Supabase reads/writes

**Later (v2 ideas)**
- In-app AI "Help me plan" chat panel (Claude API)
- Reminders/notifications for kickoff, check-in, and retro
- Sprint history view, Google Calendar sync, dark mode, PDF export,
  drag-and-drop kanban

## Project docs

- `docs/PRD.md` — full product spec (flows, pages, behaviors)
- `docs/schema.md` — database schema, computed values, seed structure
- `docs/decision-log.md` — the *why* behind each decision and tradeoff
- `docs/prototype.html` — the original single-file interactive prototype
