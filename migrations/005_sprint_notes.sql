-- Free-text scratch notes for a sprint, shown under the sprint intention block on the
-- planning page. Distinct from `goals` (the sprint intention) and `mid_sprint_notes`
-- (the day-7 check-in) — this is an open notepad for planning thoughts.
--
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query → Run).
-- Non-destructive: adds one nullable column. Existing rows get NULL.

alter table sprints add column if not exists notes text;
