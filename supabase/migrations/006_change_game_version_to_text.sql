-- Supabase Migration: Change game_version from INTEGER to TEXT
-- This allows storing gameStartTime (ISO timestamp) instead of incremental version numbers
-- for more stable game identification across moves

-- Change tutor_conversations.game_version from INTEGER to TEXT
ALTER TABLE tutor_conversations 
  ALTER COLUMN game_version TYPE TEXT USING game_version::TEXT;

-- Change conversation_purchases.game_version from INTEGER NOT NULL to TEXT NOT NULL
ALTER TABLE conversation_purchases 
  ALTER COLUMN game_version TYPE TEXT USING game_version::TEXT;

-- Note: Existing integer values will be converted to text strings (e.g., 42 -> "42")
-- New values will be ISO timestamps (e.g., "2024-12-24T19:41:47.123Z")
-- This is backwards compatible - old data remains valid
