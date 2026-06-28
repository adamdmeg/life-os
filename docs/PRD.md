# Life Sprint — Product Requirements Document

## Overview

Life Sprint is a personal planning app built around a sprint-based productivity system.
Users plan their life in layers: a yearly vision broken into monthly priorities, executed
through 2-week sprints with daily tasks, and reflected on through structured retrospectives.

Target user: someone who wants intentional, structured life planning with a digital-first
workflow — mobile-accessible, always with them, and connected across layers.

---

## Core philosophy

- Planning happens in layers: Year → Month → Sprint → Task
- Every layer connects upward — tasks feed goals, goals feed the year
- Reflection is built in — mid-sprint check-ins and end-of-sprint retros are first-class features
- The system is replicable — each year, month, and sprint follows the same structure
- Structure does the remembering — dates, check-ins, and retros auto-generate so the user never has to

---

## User flows

### Onboarding flow
1. User sets yearly theme
2. User adds goals per life area (Health, Career, Finance, Personal, Fitness) — one or more per area
3. User adds milestones per goal (3–5 each)
4. App auto-generates 12 month slots and 26 sprint slots for the year
5. App auto-generates mid-sprint check-in and retro dates for every sprint
6. User is dropped into the current month to set their first monthly intention

### Sprint kickoff flow (every 2 weeks)
1. User opens current sprint
2. Writes 2–3 sprint goals
3. Reviews auto-generated key dates (mid-sprint check-in on day 7, retro on day 14)
4. Adds any additional appointments
5. Sets gym plan — two weekly grids (week 1 and week 2), each day tappable to cycle: empty → Lift → Run → Rest
6. Writes a free-text weekly workout plan (e.g. "Mon/Wed/Fri: chest + arms · Tue/Thu: run 5K")
7. Pulls subtasks from monthly goals using "Pull from monthly goals" — selects which to import
8. Adds any additional tasks manually via the Add Task modal, with optional due date
9. Marks sprint status as "Active"

### Daily flow
1. User opens app to sprint board
2. Checks tasks — tasks with due dates float to top of their column; overdue tasks highlighted in red
3. Moves cards through To Do → In Progress → Done
4. Captures new tasks via Add Task modal (includes area tag and optional due date)

### Mid-sprint check-in (day 7)
1. Prompted on day 7 of each sprint (auto-calculated from sprint start date)
2. User answers 3 questions: on track / needs to shift / dropping or adding
3. Saved to sprint record

### Sprint retro flow (day 14)
1. User opens retro for the completed sprint
2. Rates sprint 1–10
3. Fills in: went well / improve / carry forward
4. Rates energy: mind, body, motivation (1–5 each)
5. Writes one insight
6. Carry forward items auto-populate into next sprint's task list

### Monthly planning flow (start of month)
1. User opens new month
2. Writes monthly intention
3. Adds monthly goals per life area via Add Monthly Goal modal:
   - Selects area
   - Writes what specifically they're working on this month
   - Adds subtasks line by line
   - Tags subtasks as "monthly" or "yearly goal"
   - Monthly goals can reference but are separate from yearly goals
4. Adds key dates and appointments
   - Mid-sprint check-in and retro dates auto-populate for both sprints
5. Reviews the two sprint slots for the month

### Yearly review flow (end of year / start of new year)
1. User reviews all 12 months and 26 retros
2. Rates the year overall
3. Writes a year-end reflection
4. Adds goals for the new year via Add Goal modal

---

## Pages / screens

### 1. Year page
**Purpose:** North star. Open at the start of the year, reference throughout.

**Content:**
- Yearly theme (editable text, serif italic style)
- Stat cards: Goals active, Milestones done, Sprints done, Year progress %
- Goals by area — one or more goals per area, each as a card
  - Goal text (editable inline)
  - Progress bar (click to set manually, or auto-calculated from milestones)
  - Milestones checklist (checkable; updates progress bar)
  - Add milestone inline per goal
- "Add goal" button — opens modal to add a new goal to any area
- Months at a glance (12-cell grid with mini progress bar and status note per month)

**Add goal modal fields:**
- Life area (select: Health / Career / Finance / Personal / Fitness)
- Goal text
- Milestones (multi-line text, one per line)

**Actions:**
- Edit yearly theme inline
- Edit goal text inline
- Check/uncheck milestones
- Add new milestones per goal
- Add new goals via modal
- Click progress bar to set % manually
- Click month cell → navigate to that month
- "Help me set my yearly goals" → opens AI assistant with pre-filled prompt

---

### 2. Month page
**Purpose:** Monthly priorities and structure. Created fresh each month.

**Content:**
- Stat cards: Tasks done, Goals active, Sprints, Key dates
- Monthly intention (editable, italic)
- Monthly goals by area — one or more per area
  - Yearly goal reference (read-only, shown as a linked callout above the monthly goal)
  - Monthly goal text (editable — what specifically this month)
  - Subtasks checklist (tagged as "monthly" or "yearly goal")
  - Progress bar (auto-calculated from subtask completion)
  - Add subtask inline
- "Add monthly goal" button — opens modal
- Key dates & appointments
  - Mid-sprint check-in dates auto-generated (day 7 of each sprint), shown with "auto" tag
  - Retro dates auto-generated (day 14 of each sprint), shown with "auto" tag
  - User can add additional dates (date picker + event name + tag)
- Sprint overview (2 sprint cards showing status and progress)

**Add monthly goal modal fields:**
- Life area (select)
- Monthly goal text
- Subtasks (multi-line text, one per line)
- Tag (monthly / yearly goal)

**Actions:**
- Write monthly intention
- Add monthly goals via modal
- Edit monthly goal text inline
- Add/check subtasks per area
- Tag subtasks as monthly or yearly goal
- Add key dates
- Navigate to Sprint 1 or Sprint 2
- "Help me plan this month" → opens AI assistant

---

### 3. Sprint page
**Purpose:** The main working view. Open daily.

**Content:**
- Meta pills: date range, day X of 14, on-track status
- Sprint goals (free text, 2–3 goals)
- Overall progress bar (tasks done / tasks total, days remaining)
- Appointments
  - Mid-sprint check-in (day 7) auto-populated with "auto" tag
  - Sprint retro (day 14) auto-populated with "auto" tag
  - User adds additional appointments via date picker + event name
- Gym plan
  - Two weekly grids: Week 1 and Week 2 (Mon–Sun each)
  - Tap each day to cycle: empty → Lift (green) → Run (blue) → Rest (gray)
  - Free-text weekly plan field: write out the actual workout split in prose
- Task board (kanban: To Do / In Progress / Done)
  - Tasks with due dates float to top of their column, sorted by date
  - Overdue tasks show due date in red
  - Upcoming due dates show in teal
  - Area badge on each card
  - Click card to advance: To Do → In Progress → Done
  - "Pull from monthly goals" button — modal showing all monthly subtasks not yet in this sprint; user selects which to import
  - "Add task" button — modal with task name, area, optional due date
- Mid-sprint check-in (free text field, day 7)

**Actions:**
- Write sprint goals
- Add appointments
- Toggle gym days (empty / Lift / Run / Rest)
- Write weekly workout plan
- Pull subtasks from monthly goals
- Add tasks with optional due date
- Move tasks through kanban
- Fill in mid-sprint check-in
- "Help me plan this sprint" → opens AI assistant

---

### 4. Retro page
**Purpose:** Sprint reflection. Completed on day 14.

**Content:**
- Overall sprint rating (1–10 selector)
- Three reflection prompts:
  - What went well (free text)
  - What to improve (free text)
  - Carry forward (free text; carry-forward items can be pushed to next sprint as tasks)
- Energy check (Mind / Body / Motivation rated 1–5 each)
- One insight (free text)

**Actions:**
- Set rating
- Write reflections
- Push carry-forward items to next sprint
- "Guide me through my retro" → opens AI assistant

---

## Auto-generated dates

When a sprint is created (via onboarding or manually), the app auto-calculates and inserts:

| Date | Rule | Label |
|---|---|---|
| Mid-sprint check-in | start_date + 6 days | "Mid-sprint check-in" · auto tag |
| Sprint retro | end_date | "Sprint retro" · auto tag |

These appear in both the Month page key dates list and the Sprint page appointments list.
They are read-only and cannot be deleted. User-added dates appear alongside them.

---

## Task behavior

- Tasks have an optional due date
- Tasks within each kanban column are sorted: due-date tasks first (ascending by date), then undated tasks
- Overdue tasks (due date < today, status ≠ done) display due date label in red
- Upcoming tasks (due date ≥ today) display due date label in teal
- When a task is pulled from monthly goals ("Pull from monthly goals"), it is copied into the sprint — the original monthly subtask is not affected
- Tasks carried forward from retro are linked to the original via `carried_from` field

---

## Life areas

Fixed set, consistent across all layers:

| Area | Color | Use |
|---|---|---|
| Health | Teal #1D9E75 | Sleep, nutrition, mental health, medical |
| Career | Purple #534AB7 | Work, skills, side projects, networking |
| Finance | Amber #BA7517 | Savings, budgeting, investments, debt |
| Personal | Pink #D4537E | Relationships, hobbies, reading, travel |
| Fitness | Green #639922 | Gym, running, sports, body composition |

---

## Gym plan

Each sprint has two weekly gym grids (Week 1 and Week 2), one row per week, 7 columns (Mon–Sun).

Each day cycles through four states:
- Empty (no plan)
- Lift — green (#1D9E75 teal)
- Run — blue (#E6F1FB background, #185FA5 border)
- Rest — gray (muted background)

A free-text weekly plan field sits below the grids for writing the actual workout split in prose (e.g. "Mon/Wed/Fri: chest + arms · Tue/Thu: run 5K · Sat: legs").

---

## AI integration ("Help me" buttons)

Each page has a "Help me" button that opens an AI conversation pre-seeded with a contextual prompt.
In a real app, this opens an in-app AI chat panel rather than a new browser tab.

Pre-filled prompts:

**Year:** "Help me define my [year] yearly theme and set one meaningful goal for each of my 5 life areas: Health, Career, Finance, Personal, and Fitness."

**Month:** "Help me plan my [month] [year] month. Walk me through setting my monthly intention, goals for each life area broken down into subtasks, and key dates."

**Sprint:** "Help me plan my next 2-week sprint from [start_date] to [end_date]. Walk me through setting goals, tasks by life area, appointments, and gym targets."

**Retro:** "Guide me through my sprint retrospective for sprint [N]. Ask me reflective questions about what went well, what to improve, and what to carry forward into the next sprint."

---

## Technical requirements

### Must have (MVP)
- [ ] Auth (email/password or Google OAuth)
- [ ] Year page with goals and milestone tracking
- [ ] Add Goal modal (area, goal text, milestones)
- [ ] Month page with monthly goals and subtasks per area
- [ ] Add Monthly Goal modal (area, monthly goal text, subtasks, tag)
- [ ] Sprint page with kanban task board and gym tracker
- [ ] Add Task modal with optional due date
- [ ] Due-date task sorting (due tasks to top, overdue highlighted)
- [ ] Pull from monthly goals — modal to import subtasks into sprint tasks
- [ ] Auto-generated mid-sprint and retro dates on sprint creation
- [ ] Gym plan: two weekly grids per sprint (Lift / Run / Rest / empty), free-text plan field
- [ ] Retro page with all reflection fields
- [ ] Data persists across sessions (database-backed)
- [ ] Mobile responsive
- [ ] Navigation between all 4 views
- [ ] Year/month/sprint are linked (sprint belongs to month, month belongs to year)
- [ ] Carry-forward from retro to next sprint

### Nice to have (v2)
- [ ] In-app AI chat panel (instead of opening Claude in a new tab)
- [ ] Push notifications for sprint kickoff, mid-sprint check-in, retro reminders
- [ ] Sprint log / history view across all past sprints
- [ ] Google Calendar sync for appointments
- [ ] Dark mode
- [ ] Year-over-year comparison view
- [ ] Export sprint/retro to PDF for journaling
- [ ] Drag-and-drop kanban
- [ ] Recurring tasks
- [ ] Task priority (high / medium / low) with visual indicator

### Out of scope (v1)
- Team features / sharing
- Public profiles
- Integrations beyond Google Calendar
- Native mobile app (web-first, responsive)

---

## Design principles

- Clean, minimal — white surfaces, subtle borders, no gradients
- Life areas consistently color-coded across all layers (year, month, sprint, tasks)
- Typography: sans-serif for UI, serif italic for intentions/themes
- Progress is always visible — bars, counts, and percentages surface momentum
- Auto-generated dates use a distinct "auto" visual tag so users know what the system created
- Due date urgency is communicated through color: teal for upcoming, red for overdue
- Gym plan states have distinct, meaningful colors: green = lift, blue = run, gray = rest
- Every view has a clear primary action
- The app should feel calm, not urgent

---

## Stack recommendation (for a real build)

**Frontend:** React + Tailwind CSS
**Backend:** Supabase (Postgres + Auth + Realtime)
**AI:** Anthropic Claude API (claude-sonnet-4-6) for the help prompts
**Hosting:** Vercel
**Mobile:** Progressive Web App (PWA) — no separate native app needed for v1

---

## Prototype

See `prototype.html` — a fully interactive single-file HTML prototype covering all 4 views.
No backend. All state is in-memory. Use this to validate UX before building.
