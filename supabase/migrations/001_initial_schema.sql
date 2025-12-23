-- Supabase Migration: Initial Schema
-- Creates all tables for puzzle completions, sessions, purchases, answer leak detection, and leaderboard

-- 1. Puzzle Completions Table
CREATE TABLE IF NOT EXISTS puzzle_completions (
  id BIGSERIAL PRIMARY KEY,
  completion_id TEXT UNIQUE NOT NULL,
  session_id TEXT NOT NULL,
  score INTEGER NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('beginner', 'intermediate', 'expert')),
  mistakes INTEGER NOT NULL DEFAULT 0,
  moves INTEGER NOT NULL DEFAULT 0,
  duration INTEGER NOT NULL, -- seconds
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL,
  eligible_for_leaderboard BOOLEAN NOT NULL DEFAULT false,
  submitted_to_leaderboard BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_puzzle_completions_session_id ON puzzle_completions(session_id);
CREATE INDEX IF NOT EXISTS idx_puzzle_completions_completion_id ON puzzle_completions(completion_id);
CREATE INDEX IF NOT EXISTS idx_puzzle_completions_completed_at ON puzzle_completions(completed_at);

-- 2. Puzzle Sessions Table
CREATE TABLE IF NOT EXISTS puzzle_sessions (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('beginner', 'intermediate', 'expert')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned'))
);

CREATE INDEX IF NOT EXISTS idx_puzzle_sessions_session_id ON puzzle_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_puzzle_sessions_started_at ON puzzle_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_puzzle_sessions_status ON puzzle_sessions(status);

-- 3. Life Purchases Table
CREATE TABLE IF NOT EXISTS life_purchases (
  id BIGSERIAL PRIMARY KEY,
  checkout_id TEXT UNIQUE NOT NULL,
  session_id TEXT NOT NULL,
  cost_sats INTEGER NOT NULL,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_life_purchases_checkout_id ON life_purchases(checkout_id);
CREATE INDEX IF NOT EXISTS idx_life_purchases_session_id ON life_purchases(session_id);
CREATE INDEX IF NOT EXISTS idx_life_purchases_purchase_date ON life_purchases(purchase_date);

-- 4. Conversation Purchases Table
CREATE TABLE IF NOT EXISTS conversation_purchases (
  id BIGSERIAL PRIMARY KEY,
  checkout_id TEXT UNIQUE NOT NULL,
  session_id TEXT NOT NULL,
  game_version INTEGER NOT NULL,
  cost_sats INTEGER NOT NULL,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_conversation_purchases_checkout_id ON conversation_purchases(checkout_id);
CREATE INDEX IF NOT EXISTS idx_conversation_purchases_session_id ON conversation_purchases(session_id);
CREATE INDEX IF NOT EXISTS idx_conversation_purchases_purchase_date ON conversation_purchases(purchase_date);

-- 5. Answer Leak Triggers Table
CREATE TABLE IF NOT EXISTS answer_leak_triggers (
  id BIGSERIAL PRIMARY KEY,
  trigger_date DATE UNIQUE NOT NULL,
  trigger_count INTEGER NOT NULL DEFAULT 1,
  detected_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_answer_leak_triggers_trigger_date ON answer_leak_triggers(trigger_date);

-- 6. Leaderboard Entries Table
CREATE TABLE IF NOT EXISTS leaderboard_entries (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  username TEXT,
  score INTEGER NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL,
  rank INTEGER, -- Rank at time of persistence (Redis is source of truth for current rank)
  redis_score NUMERIC, -- The exact Redis sorted set score for reconstruction if needed
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_session_id ON leaderboard_entries(session_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_score ON leaderboard_entries(score DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_completed_at ON leaderboard_entries(completed_at DESC);

-- Enable Row Level Security
ALTER TABLE puzzle_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE puzzle_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE life_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE answer_leak_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow public read, authenticated/anon write

-- Puzzle Completions Policies
CREATE POLICY "Public can read completions" ON puzzle_completions
  FOR SELECT USING (true);

CREATE POLICY "Public can insert completions" ON puzzle_completions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public can update completions" ON puzzle_completions
  FOR UPDATE USING (true);

-- Puzzle Sessions Policies
CREATE POLICY "Public can read puzzle sessions" ON puzzle_sessions
  FOR SELECT USING (true);

CREATE POLICY "Public can insert puzzle sessions" ON puzzle_sessions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public can update puzzle sessions" ON puzzle_sessions
  FOR UPDATE USING (true);

-- Life Purchases Policies
CREATE POLICY "Public can read life purchases" ON life_purchases
  FOR SELECT USING (true);

CREATE POLICY "Public can insert life purchases" ON life_purchases
  FOR INSERT WITH CHECK (true);

-- Conversation Purchases Policies
CREATE POLICY "Public can read conversation purchases" ON conversation_purchases
  FOR SELECT USING (true);

CREATE POLICY "Public can insert conversation purchases" ON conversation_purchases
  FOR INSERT WITH CHECK (true);

-- Answer Leak Triggers Policies
CREATE POLICY "Public can read answer leak triggers" ON answer_leak_triggers
  FOR SELECT USING (true);

CREATE POLICY "Public can insert answer leak triggers" ON answer_leak_triggers
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public can update answer leak triggers" ON answer_leak_triggers
  FOR UPDATE USING (true);

-- Leaderboard Entries Policies
CREATE POLICY "Public can read leaderboard entries" ON leaderboard_entries
  FOR SELECT USING (true);

CREATE POLICY "Public can insert leaderboard entries" ON leaderboard_entries
  FOR INSERT WITH CHECK (true);



