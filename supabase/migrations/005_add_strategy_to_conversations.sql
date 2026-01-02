-- Add strategy column to tutor_conversations table
ALTER TABLE tutor_conversations 
ADD COLUMN IF NOT EXISTS strategy TEXT;

-- Add index for strategy queries
CREATE INDEX IF NOT EXISTS idx_tutor_conversations_strategy ON tutor_conversations(strategy);




