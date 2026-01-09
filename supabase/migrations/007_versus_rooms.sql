-- Supabase Migration: Versus Rooms Tables and RPC Functions
-- Creates tables for versus mode game state and messaging, replacing Redis/WebSocket

-- 1. Versus Rooms Table (metadata and player state)
CREATE TABLE IF NOT EXISTS versus_rooms (
  room_id TEXT PRIMARY KEY,
  version INTEGER NOT NULL DEFAULT 0,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('beginner', 'medium', 'hard')),
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'finished')),
  room_state JSONB NOT NULL,
  start_at TIMESTAMPTZ,
  winner TEXT CHECK (winner IN ('player1', 'player2')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_versus_rooms_expires_at ON versus_rooms(expires_at);
CREATE INDEX IF NOT EXISTS idx_versus_rooms_status ON versus_rooms(status);
CREATE INDEX IF NOT EXISTS idx_versus_rooms_created_at ON versus_rooms(created_at);

-- 2. Versus Room Boards Table (authoritative board state)
CREATE TABLE IF NOT EXISTS versus_room_boards (
  room_id TEXT PRIMARY KEY REFERENCES versus_rooms(room_id) ON DELETE CASCADE,
  current_board JSONB NOT NULL,
  current_puzzle JSONB NOT NULL,
  current_solution JSONB NOT NULL,
  completed_rows JSONB NOT NULL DEFAULT '[]'::jsonb,
  completed_columns JSONB NOT NULL DEFAULT '[]'::jsonb,
  completed_boxes JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Versus Messages Table (for server-side broadcasts)
CREATE TABLE IF NOT EXISTS versus_messages (
  id BIGSERIAL PRIMARY KEY,
  room_id TEXT NOT NULL,
  message JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_versus_messages_room_id ON versus_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_versus_messages_created_at ON versus_messages(created_at);

-- Enable Row Level Security
ALTER TABLE versus_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE versus_room_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE versus_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for versus_rooms
CREATE POLICY "Public can read rooms" ON versus_rooms
  FOR SELECT USING (true);

CREATE POLICY "Public can create rooms" ON versus_rooms
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public can update rooms" ON versus_rooms
  FOR UPDATE USING (true);

-- RLS Policies for versus_room_boards
CREATE POLICY "Public can read boards" ON versus_room_boards
  FOR SELECT USING (true);

-- RLS Policies for versus_messages
CREATE POLICY "Public can read messages" ON versus_messages
  FOR SELECT USING (true);

CREATE POLICY "Public can insert messages" ON versus_messages
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public can delete messages" ON versus_messages
  FOR DELETE USING (true);

-- RPC Function: Create Versus Room (atomic room + board creation)
CREATE OR REPLACE FUNCTION create_versus_room(
  p_room_id TEXT,
  p_difficulty TEXT,
  p_room_state JSONB,
  p_board_data JSONB
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Insert room metadata
  INSERT INTO versus_rooms (
    room_id,
    version,
    difficulty,
    status,
    room_state,
    start_at,
    winner,
    expires_at
  ) VALUES (
    p_room_id,
    0, -- Initial version
    p_difficulty,
    'waiting', -- Initial status
    p_room_state,
    NULL, -- start_at set when both players ready
    NULL, -- winner set when game finishes
    NOW() + INTERVAL '12 hours' -- Expires in 12 hours
  );

  -- Insert board data
  INSERT INTO versus_room_boards (
    room_id,
    current_board,
    current_puzzle,
    current_solution,
    completed_rows,
    completed_columns,
    completed_boxes
  ) VALUES (
    p_room_id,
    p_board_data->'current_board',
    p_board_data->'current_puzzle',
    p_board_data->'current_solution',
    COALESCE(p_board_data->'completed_rows', '[]'::jsonb),
    COALESCE(p_board_data->'completed_columns', '[]'::jsonb),
    COALESCE(p_board_data->'completed_boxes', '[]'::jsonb)
  );
END;
$$;

-- RPC Function: Apply Versus Move (atomic board + metadata update with version check)
CREATE OR REPLACE FUNCTION apply_versus_move(
  p_room_id TEXT,
  p_expected_version INTEGER,
  p_board_data JSONB,
  p_room_state_updates JSONB,
  OUT p_new_version INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_version INTEGER;
  v_start_at TIMESTAMPTZ;
  v_status TEXT;
BEGIN
  -- Get current version and start_at
  SELECT version, start_at, status
  INTO v_current_version, v_start_at, v_status
  FROM versus_rooms
  WHERE room_id = p_room_id;

  -- Check if room exists
  IF v_current_version IS NULL THEN
    RAISE EXCEPTION 'ROOM_NOT_FOUND: Room % does not exist', p_room_id;
  END IF;

  -- Check version conflict
  IF v_current_version != p_expected_version THEN
    RAISE EXCEPTION 'VERSION_CONFLICT: Expected version %, but current version is %', p_expected_version, v_current_version;
  END IF;

  -- Validate game has started (for move operations)
  IF v_start_at IS NULL OR NOW() < v_start_at THEN
    RAISE EXCEPTION 'GAME_NOT_STARTED: Game has not started yet. start_at: %, now: %', v_start_at, NOW();
  END IF;

  -- Update board data (only update fields that are present in p_board_data)
  UPDATE versus_room_boards
  SET
    current_board = COALESCE(p_board_data->'current_board', current_board),
    completed_rows = COALESCE(p_board_data->'completed_rows', completed_rows),
    completed_columns = COALESCE(p_board_data->'completed_columns', completed_columns),
    completed_boxes = COALESCE(p_board_data->'completed_boxes', completed_boxes),
    updated_at = NOW()
  WHERE room_id = p_room_id;

  -- Update room metadata (increment version, update room_state and top-level fields)
  -- p_room_state_updates contains the full room_state object, not nested
  UPDATE versus_rooms
  SET
    version = version + 1,
    room_state = COALESCE(p_room_state_updates, room_state),
    status = COALESCE((p_room_state_updates->>'status')::text, status),
    winner = COALESCE((p_room_state_updates->>'winner')::text, winner),
    start_at = COALESCE((p_room_state_updates->>'start_at')::timestamptz, start_at),
    expires_at = COALESCE((p_room_state_updates->>'expires_at')::timestamptz, expires_at),
    updated_at = NOW()
  WHERE room_id = p_room_id
    AND version = p_expected_version;

  -- Get new version
  SELECT version INTO p_new_version
  FROM versus_rooms
  WHERE room_id = p_room_id;

  -- If no rows updated, version conflict occurred
  IF p_new_version IS NULL OR p_new_version = p_expected_version THEN
    RAISE EXCEPTION 'VERSION_CONFLICT: Update failed, version may have changed';
  END IF;
END;
$$;
