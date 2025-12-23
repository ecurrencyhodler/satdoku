-- Supabase Migration: Chat Analytics Tables
-- Creates tables for tutor conversation and message analytics

-- 1. Tutor Conversations Table
CREATE TABLE IF NOT EXISTS tutor_conversations (
  id BIGSERIAL PRIMARY KEY,
  conversation_id TEXT UNIQUE NOT NULL,
  session_id TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  date DATE NOT NULL,
  game_version INTEGER,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tutor_conversations_conversation_id ON tutor_conversations(conversation_id);
CREATE INDEX IF NOT EXISTS idx_tutor_conversations_session_id ON tutor_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_tutor_conversations_date ON tutor_conversations(date);
CREATE INDEX IF NOT EXISTS idx_tutor_conversations_started_at ON tutor_conversations(started_at);

-- 2. Tutor Messages Table
CREATE TABLE IF NOT EXISTS tutor_messages (
  id BIGSERIAL PRIMARY KEY,
  conversation_id TEXT UNIQUE NOT NULL,
  total_messages INTEGER NOT NULL DEFAULT 0,
  user_messages INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tutor_messages_conversation_id ON tutor_messages(conversation_id);

-- Enable Row Level Security
ALTER TABLE tutor_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tutor_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow public read/write (matching existing pattern)

-- Tutor Conversations Policies
CREATE POLICY "Public can read tutor conversations" ON tutor_conversations
  FOR SELECT USING (true);

CREATE POLICY "Public can insert tutor conversations" ON tutor_conversations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public can update tutor conversations" ON tutor_conversations
  FOR UPDATE USING (true);

-- Tutor Messages Policies
CREATE POLICY "Public can read tutor messages" ON tutor_messages
  FOR SELECT USING (true);

CREATE POLICY "Public can insert tutor messages" ON tutor_messages
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public can update tutor messages" ON tutor_messages
  FOR UPDATE USING (true);






