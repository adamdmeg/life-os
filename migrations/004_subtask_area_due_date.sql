-- Lets a monthly subtask carry its own life area and due date (independent of its parent
-- monthly goal). When such a subtask is pulled into a sprint, the sprint task inherits the
-- subtask's area (falling back to the goal's area) and due date.
--
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query → Run).
-- Non-destructive: adds two nullable columns. Existing rows get NULL (= inherit goal area,
-- no due date).

alter table subtasks add column if not exists area text;       -- Health | Career | Finance | Personal | Fitness | null (= inherit goal's area)
alter table subtasks add column if not exists due_date date;
