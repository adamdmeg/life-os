-- Placeholder for an AI-generated one-sentence summary of the retro's free-text boxes
-- (went_well / improve / carry_forward / one_insight). Currently unpopulated; a later AI
-- job fills it and the month reflection's sprint cards render it automatically.
--
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query → Run).
-- Non-destructive: adds one nullable column. Existing rows get NULL.

alter table retros add column if not exists ai_summary text;
