-- Supabase Migration: Update Difficulty Constraints
-- Updates difficulty constraints to match code values (beginner, medium, hard)
-- instead of (beginner, intermediate, expert)

-- Update puzzle_completions table constraint
ALTER TABLE puzzle_completions 
  DROP CONSTRAINT IF EXISTS puzzle_completions_difficulty_check;

ALTER TABLE puzzle_completions 
  ADD CONSTRAINT puzzle_completions_difficulty_check 
  CHECK (difficulty IN ('beginner', 'medium', 'hard'));

-- Update puzzle_sessions table constraint
ALTER TABLE puzzle_sessions 
  DROP CONSTRAINT IF EXISTS puzzle_sessions_difficulty_check;

ALTER TABLE puzzle_sessions 
  ADD CONSTRAINT puzzle_sessions_difficulty_check 
  CHECK (difficulty IN ('beginner', 'medium', 'hard'));

