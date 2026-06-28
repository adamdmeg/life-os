# Life Sprint — Data Schema

All tables use UUID primary keys and created_at / updated_at timestamps.
Written for Postgres (Supabase). Adapt as needed for other databases.

---

## Tables

### users
Standard auth table (managed by Supabase Auth).
Extended with a profiles table for app-specific fields.

```sql
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  areas jsonb default '["Health","Career","Finance","Personal","Fitness"]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

---

### years

```sql
create table years (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  year int not null,                        -- e.g. 2026
  theme text,                               -- yearly theme / intention
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, year)
);
```

---

### goals

Multiple goals per area per year are supported. The area field is not unique per year,
allowing a user to add more than one goal to the same life area.

```sql
create table goals (
  id uuid primary key default gen_random_uuid(),
  year_id uuid references years(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  area text not null,                       -- Health | Career | Finance | Personal | Fitness
  goal_text text not null,
  progress int default 0,                   -- 0–100, manually set OR auto-calculated from milestones
  status text default 'in_progress',        -- not_started | in_progress | complete
  sort_order int default 0,                 -- display order within an area
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

---

### milestones

Year-level checkpoints. Belong to a goal. Checking a milestone recalculates goal progress.

```sql
create table milestones (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid references goals(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  text text not null,
  done boolean default false,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

---

### months

```sql
create table months (
  id uuid primary key default gen_random_uuid(),
  year_id uuid references years(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  month_number int not null,                -- 1–12
  month_name text not null,                 -- January, February, etc.
  intention text,
  status text default 'not_started',        -- not_started | active | complete
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(year_id, month_number)
);
```

---

### monthly_goals

Multiple monthly goals per area per month are supported (same as yearly goals).
Each monthly goal optionally references a yearly goal for display purposes.

```sql
create table monthly_goals (
  id uuid primary key default gen_random_uuid(),
  month_id uuid references months(id) on delete cascade,
  goal_id uuid references goals(id) on delete set null,  -- optional link to yearly goal
  user_id uuid references profiles(id) on delete cascade,
  area text not null,                       -- Health | Career | Finance | Personal | Fitness
  monthly_goal_text text not null,          -- what specifically this month
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

---

### subtasks

Month-level subtasks. Belong to a monthly_goal.
Tagged to distinguish between month-specific work and tasks tied to yearly goals.
Subtasks can be pulled into sprint tasks — pulling copies the subtask, it does not move it.
A subtask pulled from a yearly goal's milestone keeps a `milestone_source_id` link so its
completion can propagate up to the milestone (and recalculate the yearly goal's progress).

```sql
create table subtasks (
  id uuid primary key default gen_random_uuid(),
  monthly_goal_id uuid references monthly_goals(id) on delete cascade,
  milestone_source_id uuid references milestones(id) on delete set null,  -- if pulled from a yearly milestone
  user_id uuid references profiles(id) on delete cascade,
  text text not null,
  done boolean default false,
  tag text default 'monthly',               -- monthly | yearly_goal
  area text,                                -- (migration 004) reserved; subtasks currently always follow their goal's area (column unused by the app)
  due_date date,                            -- (migration 004) optional; carried to the sprint task when pulled
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

Completion propagation (application layer): when a subtask with `milestone_source_id` is
marked done/undone — either via its sprint task (`tasks.subtask_source_id`) or directly on the
month page — the linked milestone's `done` is updated and the parent goal's `progress` is
recalculated. Subtasks without a `milestone_source_id` (typed manually at the month level) and
sprint tasks without a `subtask_source_id` (typed at the sprint level) do not propagate upward.

---

### key_dates

Appointments and important dates. Belong to a month and optionally a sprint.
Auto-generated dates (mid-sprint check-in, retro) are flagged with is_auto = true
and cannot be deleted by the user.

```sql
create table key_dates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  month_id uuid references months(id) on delete cascade,
  sprint_id uuid references sprints(id) on delete set null,
  date date not null,
  event_name text not null,
  tag text,                                 -- Holiday | Sprint | Health | Career | auto | etc.
  is_auto boolean default false,            -- true = system-generated, not user-deletable
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

Auto-generated key dates are inserted when a sprint is created:
- Mid-sprint check-in: `start_date + 6 days`, event_name = 'Mid-sprint check-in', is_auto = true
- Sprint retro: `end_date`, event_name = 'Sprint retro', is_auto = true

---

### sprints

Two per month. Sprint number is 1–26 across the year.
Gym plan stores two weeks of daily workout type per sprint.

```sql
create table sprints (
  id uuid primary key default gen_random_uuid(),
  month_id uuid references months(id) on delete cascade,
  year_id uuid references years(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  sprint_number int not null,               -- 1–26 across the year
  sprint_number_in_month int not null,      -- 1 or 2
  name text,                                -- e.g. "Sprint 1 · Jul 1–14"
  start_date date not null,
  end_date date not null,                   -- always start_date + 13 days
  mid_sprint_date date not null,            -- always start_date + 6 days (auto-calculated)
  goals text,                               -- free text: 2–3 sprint goals (the "sprint intention")
  notes text,                               -- free text scratchpad for sprint planning (migration 005)
  gym_plan jsonb,                           -- see gym_plan schema below
  gym_plan_notes text,                      -- free text weekly workout description
  mid_sprint_notes text,                    -- day 7 check-in notes
  status text default 'not_started',        -- not_started | kickoff_done | active | mid_check_done | complete
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(year_id, sprint_number)
);
```

`gym_plan` JSONB schema — two weeks, seven days each, four possible values per day:

```json
{
  "week1": {
    "mon": "lift",
    "tue": "rest",
    "wed": "lift",
    "thu": "run",
    "fri": "lift",
    "sat": "rest",
    "sun": "rest"
  },
  "week2": {
    "mon": "lift",
    "tue": "run",
    "wed": "lift",
    "thu": "rest",
    "fri": "rest",
    "sat": "rest",
    "sun": "rest"
  }
}
```

Valid day values: `"lift"` | `"run"` | `"rest"` | `""` (empty = no plan set)

UI rendering:
- `"lift"` → green (#1D9E75), label "L"
- `"run"` → blue (#E6F1FB bg, #185FA5 border), label "R"
- `"rest"` → gray (muted bg)
- `""` → empty/unpainted box

Tapping a day cycles: `""` → `"lift"` → `"run"` → `"rest"` → `""`

---

### tasks

Every task belongs to a sprint. Optionally linked to a yearly goal.
Tasks may also be sourced from monthly subtasks via the "Pull from monthly goals" feature —
when pulled, a copy is created in tasks with `subtask_source_id` referencing the original subtask.

Due dates are optional. The application sorts tasks within each kanban column:
tasks with due dates appear first (ascending), undated tasks follow.

```sql
create table tasks (
  id uuid primary key default gen_random_uuid(),
  sprint_id uuid references sprints(id) on delete cascade,
  goal_id uuid references goals(id) on delete set null,         -- optional link to yearly goal
  subtask_source_id uuid references subtasks(id) on delete set null,  -- if pulled from monthly goal
  sprint_goal_id uuid references sprint_goals(id) on delete set null, -- optional: which sprint goal this task is filed under
  user_id uuid references profiles(id) on delete cascade,
  text text not null,
  area text,                                -- Health | Career | Finance | Personal | Fitness | null
  status text default 'todo',               -- todo | in_progress | done
  priority text default 'medium',           -- high | medium | low
  due_date date,                            -- optional; tasks with due dates sort to top of column
  notes text,
  carried_from uuid references tasks(id) on delete set null,    -- if carried forward from retro
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

---

### sprint_goals

Structured goals scoped to one sprint (added in migration 002). A sprint goal is text + a
life area; kanban tasks are filed under it via `tasks.sprint_goal_id`. The goal's progress
is derived from its tasks' completion (% done) — there is no separate checklist. Sprint
goals are standalone: they do not propagate completion up to monthly or yearly goals. The
sprint's free-text `sprints.goals` field remains as the overall sprint intention.

```sql
create table sprint_goals (
  id uuid primary key default gen_random_uuid(),
  sprint_id uuid references sprints(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  area text not null,                       -- Health | Career | Finance | Personal | Fitness
  sprint_goal_text text not null,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

Due date display rules (application layer):
- `due_date < today AND status != 'done'` → overdue, show due date label in red (#E24B4A)
- `due_date >= today AND status != 'done'` → upcoming, show due date label in teal (#1D9E75)
- `status = 'done'` → no due date label shown regardless

---

### retros

One per sprint.

```sql
create table retros (
  id uuid primary key default gen_random_uuid(),
  sprint_id uuid references sprints(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  rating int check (rating >= 1 and rating <= 10),
  went_well text,
  improve text,
  carry_forward text,                       -- free text; carry-forward items also create task rows
  energy_mind int check (energy_mind >= 1 and energy_mind <= 5),
  energy_body int check (energy_body >= 1 and energy_body <= 5),
  energy_motivation int check (energy_motivation >= 1 and energy_motivation <= 5),
  one_insight text,
  ai_summary text,                          -- (migration 003) reserved for a later AI-generated one-sentence summary of the free-text boxes; currently blank
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(sprint_id)
);
```

---

## Computed values (handle in application layer)

| Value | How to calculate |
|---|---|
| Goal progress % | (milestones.done = true count / milestones total count) × 100; falls back to manual `progress` field if no milestones exist |
| Sprint completion % | (tasks.status = 'done' count / total tasks in sprint) × 100 |
| Month progress % | average subtask completion % across all monthly goals in the month |
| Days left in sprint | sprints.end_date − current_date |
| Mid-sprint date | sprints.start_date + 6 days (stored on sprint row, also inserted as key_date) |
| Retro date | sprints.end_date (stored as key_date with is_auto = true) |
| Sprint "on track" | completion % ≥ (days elapsed / 14) × 100 |
| Energy average | (energy_mind + energy_body + energy_motivation) / 3 |
| Year progress % | (current month number / 12) × 100 |
| Task sort position | due_date IS NOT NULL first (ASC), then due_date IS NULL; within due-date group, sort by due_date ASC |

---

## Key relationships

```
users (profiles)
└── years
    ├── goals
    │   └── milestones
    └── months
        ├── monthly_goals
        │   └── subtasks ──────────────────────┐
        ├── key_dates (month-level)             │ pulled via subtask_source_id
        └── sprints                             │
            ├── key_dates (auto + user-added)   │
            ├── tasks ◄──────────────────────────┘
            │   └── (carried_from → tasks)
            └── retros
```

---

## On sprint creation (trigger / application logic)

When a sprint row is inserted, automatically:

1. Calculate and store `mid_sprint_date` = `start_date + 6`
2. Insert two `key_dates` rows for this sprint:
   ```sql
   -- Mid-sprint check-in
   insert into key_dates (user_id, month_id, sprint_id, date, event_name, tag, is_auto)
   values ($user_id, $month_id, $sprint_id, $start_date + 6, 'Mid-sprint check-in', 'auto', true);

   -- Sprint retro
   insert into key_dates (user_id, month_id, sprint_id, date, event_name, tag, is_auto)
   values ($user_id, $month_id, $sprint_id, $end_date, 'Sprint retro', 'auto', true);
   ```

These dates are read-only from the user's perspective. The `is_auto` flag prevents deletion in the UI and via RLS policy if desired.

---

## Pull from monthly goals (application logic)

When the user selects subtasks to pull into a sprint:

```sql
insert into tasks (sprint_id, user_id, text, area, status, subtask_source_id)
select
  $sprint_id,
  $user_id,
  s.text,
  mg.area,
  'todo',
  s.id
from subtasks s
join monthly_goals mg on mg.id = s.monthly_goal_id
where s.id = any($selected_subtask_ids);
```

The original subtask row is unchanged. The new task row has `subtask_source_id` set so the
source can be traced. Future queries can use this to avoid showing already-pulled subtasks
in the pull modal (filter: `subtasks.id not in (select subtask_source_id from tasks where sprint_id = $sprint_id)`).

---

## Indexes (recommended)

```sql
create index on goals(user_id, year_id);
create index on goals(user_id, area);
create index on milestones(goal_id);
create index on months(user_id, year_id);
create index on monthly_goals(month_id, area);
create index on monthly_goals(goal_id);
create index on subtasks(monthly_goal_id);
create index on sprints(user_id, month_id);
create index on sprints(user_id, start_date, end_date);
create index on tasks(user_id, sprint_id);
create index on tasks(user_id, status);
create index on tasks(sprint_id, due_date);           -- for due-date sort
create index on tasks(subtask_source_id);             -- for pull deduplication
create index on key_dates(user_id, month_id);
create index on key_dates(sprint_id, is_auto);
create index on retros(user_id, sprint_id);
```

---

## Row-level security (Supabase RLS)

Enable RLS on all tables. Standard policy: users can only read/write their own rows.

```sql
-- Example for tasks (repeat pattern for all tables)
alter table tasks enable row level security;

create policy "Users can manage their own tasks"
  on tasks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Auto key_dates: prevent deletion of is_auto rows
create policy "Users cannot delete auto key dates"
  on key_dates for delete
  using (auth.uid() = user_id and is_auto = false);
```

---

## Seed data structure (for onboarding)

When a new user completes onboarding, auto-generate:

1. One `years` row for the current year
2. Zero `goals` rows — user adds goals via the Add Goal modal during onboarding
3. Twelve `months` rows (Jan–Dec)
4. Twenty-six `sprints` rows with pre-calculated dates:
   - Sprint 1: Jan 1–14, Sprint 2: Jan 15–28, Sprint 3: Feb 1–14, etc.
   - `mid_sprint_date` calculated for each
5. Fifty-two `key_dates` rows (2 auto dates × 26 sprints) — mid-sprint and retro for every sprint
6. Zero `monthly_goals` — user adds via Add Monthly Goal modal at the start of each month

This scaffolds the full year structure on signup. Users fill in content as they go.
