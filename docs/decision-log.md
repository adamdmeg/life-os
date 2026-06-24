# Decision Log

A running, plain-language record of the decisions, tradeoffs, and open questions
behind each feature in Life OS. The point is to capture *why* things are the way
they are — in my own words — so I can talk about this project clearly in
interviews or design conversations later.

**How to read this:** newest entries at the top. Each entry is a short story:
what I was deciding, what I picked, what I gave up, and anything I'm still unsure
about. Nothing here needs to be polished — it just needs to be honest and
specific.

---

## Entries

### Sprint page Plan/Board tabs
**Date:** ~2026-06-24

I split the sprint page into two tabs — Plan and Board — instead of stacking
everything in one long scroll. Plan holds the monthly-goals peek, the intention
and notes side by side, the sprint goals, and appointments + gym. Board holds the
kanban and the mid-sprint check-in. The help and retro buttons live at the page
level, outside the tabs.

**Why:** the kanban was buried below all the planning content, so I had to scroll
past everything to actually work. Tabs put the board one click away while keeping
planning conceptually "first."

**Tradeoff:** tabs hide content, so you can't see plan and board at the same time
anymore. I tried to soften that by picking the default tab based on state — a
sprint that's already started opens to Board (you're executing), one that hasn't
started yet opens to Plan (you're still setting up).

**Still unsure:** whether the default-tab logic is intuitive or just surprising.
Need to live with it.

---

### Sprint notes (migration 005)
**Date:** ~2026-06-24

Added a nullable `sprints.notes` text column behind a free-text Notes card. It
saves on blur, like the other free-text fields.

**Why:** I wanted an open scratchpad that's clearly separate from the two notes
fields that already exist — `goals` (the sprint intention) and `mid_sprint_notes`
(the day-7 check-in). Those each have a specific meaning; this one is for
anything that doesn't fit.

**Tradeoff:** three free-text fields on one entity risks confusion about what
goes where. I'm betting the labels carry enough meaning to keep them distinct.

---

### Monthly goals peek on the sprint page
**Date:** ~2026-06-24

The sprint page now shows a compact, read-only "This month's goals" card at the
top of the Plan tab — area chip, goal text, and a done/total count per goal, with
a "View month" link.

**Why:** I want the month's intent visible while planning a sprint, without
having to leave the page. The data was basically free — SprintPage already loads
the month's `monthly_goals` for the pull-subtasks modal, so I reused it.

**Tradeoff:** it's read-only and duplicates a slice of the month UI. I chose not
to make it editable here to avoid two places that edit the same thing.

---

### Gym consistency calculation
**Date:** ~2026-06-24

Added a shared `gymConsistency(sprints, asOf?)` helper in `stats.js` that reads
each sprint's `gym_plan` and derives average workout days per week. Only 'lift'
and 'run' days count; rest days and blanks are excluded; weeks = 2 per sprint.
Both the month reflection and the in-progress month page render the same
section (the average plus a lift/run/total breakdown).

**Why:** the gym plan already records the workout type per day, so consistency is
derivable with zero new schema. One helper keeps the planning view and the
reflection view consistent with each other.

**Tradeoff / the subtle part:** completed months call it with no `asOf` so every
planned week counts. The in-progress month passes `today`, so it's a *running*
average — only fully-ended weeks count, and a still-in-progress week is excluded
entirely. That's deliberate: otherwise the average would dip mid-week as
not-yet-done days sit empty and look like missed workouts.

**Still unsure:** hardcoding "2 weeks per sprint" — fine for now, but it's an
assumption baked into the math.

---

### Reflection views for ended periods
**Date:** ~2026-06-24

Once a period is over, the editable planning page is automatically replaced by a
read-only reflection. App.jsx routes ended months (month number < current month)
to MonthReflectionPage; SprintPage detects an ended sprint (today > end_date) and
renders SprintReflectionPage instead.

**Why:** finished work should *look* finished. It should surface outcomes —
stats, intention, completed goals, the retro — not invite more editing of a thing
that's already in the past.

**Tradeoff:** "ended" is decided by date math, which means there's no way to go
back and edit a past period through the normal UI. Accepting that for now as the
correct default.

---

### Month reflection detail + reserved AI summary slot
**Date:** ~2026-06-24

The month reflection now nests completed goals' (all-done) subtasks under them,
and each sprint card shows a reflection peek — rating, energy, a mid-sprint
check-in preview. I also added a `retros.ai_summary` column (migration 003) that's
currently blank.

**Why:** the reserved column is a deliberate placeholder for a future
AI-generated one-sentence sprint summary. The card already renders it
automatically once it's populated, so the feature can ship later with no UI
change.

**Still unsure:** what generates the summary and when — that's a whole feature I
haven't designed yet.

---

### Sprint goals as a structured layer (migration 002)
**Date:** ~2026-06-24

Introduced structured sprint goals (text + area) scoped to a sprint. Kanban tasks
get filed under a goal via `tasks.sprint_goal_id`. A goal's progress is *derived*
from its tasks' completion — there's no separate checklist. Goals are standalone:
they don't propagate up to monthly or yearly. The old free-text `sprints.goals`
box got relabeled "Sprint intention."

**Why:** I reused tasks as the leaf node so this new layer adds no extra
copy/recalc — progress falls out of work that's already being tracked. No
duplicate state to keep in sync.

**Tradeoff:** keeping goals standalone (no upward propagation) means the
hierarchy isn't fully connected yet — sprint goals don't roll up into monthly or
yearly progress. Simpler now, but it's a known gap.

---

### Retro page
**Date:** earlier

The retro page reflects on a single sprint (resolved with the same logic
SprintPage uses), lazily upserts the one `retros` row per sprint, and pushes
carry-forward lines into the *next* sprint as deduped tasks. It's cross-linked
from the sprint page so I land on the matching sprint.

**Why:** carry-forward as deduped tasks means unfinished intentions actually
follow me into the next sprint instead of getting lost, without creating
duplicates if I run it twice.

---

### Foundational stack choices
**Date:** project start

- **React + Vite, JavaScript not TypeScript.** Keeping it light for a personal
  app; not paying the TS overhead yet.
- **Supabase (Postgres + Auth), RLS on all tables.** Auth, DB, and row-level
  security in one place so a personal app stays private by default.
- **CSS variables instead of Tailwind (for now).** The prototype uses inline
  `var(--teal)` styling and I'm preserving that exactly rather than converting to
  utility classes — keeps the visual design identical to the prototype while the
  app comes together.
- **Signup trigger (`handle_new_user`)** auto-creates a profiles row so every
  authenticated user always has a profile.

**Still unsure:** whether/when to move to Tailwind, and the seed-on-signup logic
(year + 12 months + 26 sprints + 52 key_dates) is still unbuilt.

---

<!--
NEW ENTRIES GO ABOVE THIS LINE, just under "## Entries".
Template:

### <feature or decision name>
**Date:** YYYY-MM-DD

What I was deciding and what I chose.

**Why:** the reasoning.

**Tradeoff:** what I gave up / the cost.

**Still unsure:** any open question (delete if none).
-->
