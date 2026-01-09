-- Migration: Add set_versus_start_at RPC function
-- This function atomically sets start_at only if it's NULL, preventing race conditions

-- RPC Function: Set start_at atomically (only if NULL)
-- Returns true if start_at was set, false if it was already set
CREATE OR REPLACE FUNCTION set_versus_start_at(
  p_room_id TEXT,
  OUT p_set BOOLEAN,
  OUT p_start_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_rows_updated INTEGER;
BEGIN
  -- Atomically set start_at only if it's NULL
  -- Set it to 3 seconds in the future
  UPDATE versus_rooms
  SET
    start_at = NOW() + INTERVAL '3 seconds',
    status = 'active',
    updated_at = NOW()
  WHERE room_id = p_room_id
    AND start_at IS NULL
    AND status = 'waiting';
  
  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  
  -- If we updated a row, we successfully set start_at
  IF v_rows_updated > 0 THEN
    p_set := TRUE;
    -- Get the start_at value we just set
    SELECT start_at INTO p_start_at
    FROM versus_rooms
    WHERE room_id = p_room_id;
  ELSE
    p_set := FALSE;
    -- Get the existing start_at value (if any)
    SELECT start_at INTO p_start_at
    FROM versus_rooms
    WHERE room_id = p_room_id;
  END IF;
END;
$$;
