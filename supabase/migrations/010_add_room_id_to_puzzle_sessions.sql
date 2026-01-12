-- Supabase Migration: Add room_id to puzzle_sessions
-- Adds room_id column to distinguish solo vs versus puzzles

-- Add room_id column (nullable - NULL for solo puzzles, room_id for versus puzzles)
ALTER TABLE puzzle_sessions
ADD COLUMN IF NOT EXISTS room_id TEXT;

-- Add index on room_id for efficient queries
CREATE INDEX IF NOT EXISTS idx_puzzle_sessions_room_id ON puzzle_sessions(room_id);

-- Add index on room_id + started_at for efficient time-range queries
CREATE INDEX IF NOT EXISTS idx_puzzle_sessions_room_id_started_at ON puzzle_sessions(room_id, started_at);
