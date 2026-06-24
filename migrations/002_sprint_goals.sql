-- Adds sprint-level goals: a goal is text + life area scoped to one sprint, and kanban
-- tasks are filed under a goal via the new tasks.sprint_goal_id column. A goal's progress
-- is derived from its tasks' completion (no separate checklist). Sprint goals are
-- standalone — they do not propagate up to monthly/yearly goals.
--
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query → Run).
-- Non-destructive: adds one table + one nullable column. Existing tasks get NULL.

create table if not exists sprint_goals (
  id uuid primary key default gen_random_uuid(),
  
  sprint_id uuid references sprints(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  area text not null,                       -- Health | Career | Finance | Personal | Fitness
  sprint_goal_text text not null,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table sprint_goals enable row level security;

create policy "sprint_goals_select" on sprint_goals for select using (auth.uid() = user_id);
create policy "sprint_goals_insert" on sprint_goals for insert with check (auth.uid() = user_id);
create policy "sprint_goals_update" on sprint_goals for update using (auth.uid() = user_id);
create policy "sprint_goals_delete" on sprint_goals for delete using (auth.uid() = user_id);

create index if not exists sprint_goals_user_sprint_idx on sprint_goals(user_id, sprint_id);

-- Tasks belong to an optional sprint goal. ON DELETE SET NULL so deleting a goal leaves
-- its tasks on the board (just ungrouped).
alter table tasks
  add column if not exists sprint_goal_id uuid references sprint_goals(id) on delete set null;

create index if not exists tasks_sprint_goal_id_idx on tasks(sprint_goal_id);
