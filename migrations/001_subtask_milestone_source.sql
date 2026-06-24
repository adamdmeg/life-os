-- Adds a link from a monthly subtask back to the yearly milestone it was pulled from,
-- so completing the subtask (in the sprint or on the month page) can propagate up to the
-- milestone and recalculate the yearly goal's progress.
--
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query → Run).
-- Non-destructive: adds one nullable column + an index. Existing rows get NULL.

alter table subtasks
  add column if not exists milestone_source_id uuid references milestones(id) on delete set null;

create index if not exists subtasks_milestone_source_id_idx on subtasks(milestone_source_id);
