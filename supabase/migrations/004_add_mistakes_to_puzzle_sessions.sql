-- Add mistakes column to puzzle_sessions table
ALTER TABLE puzzle_sessions 
  ADD COLUMN IF NOT EXISTS mistakes INTEGER NOT NULL DEFAULT 0;

-- Create index for filtering/aggregation
CREATE INDEX IF NOT EXISTS idx_puzzle_sessions_mistakes ON puzzle_sessions(mistakes);

-- Migrate existing mistakes data from puzzle_completions to puzzle_sessions
-- Match on session_id and started_at to ensure we update the correct session
UPDATE puzzle_sessions ps
SET mistakes = pc.mistakes
FROM puzzle_completions pc
WHERE ps.session_id = pc.session_id
  AND ps.started_at = pc.started_at
  AND ps.status = 'completed'
  AND ps.mistakes = 0;  -- Only update if mistakes haven't been set yet (safety check)

