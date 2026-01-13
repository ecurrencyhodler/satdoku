-- Enable Supabase Realtime for versus_rooms and versus_messages tables
-- REPLICA IDENTITY FULL is required for UPDATE events to include full row data (old and new)
-- Tables must be added to the supabase_realtime publication for Realtime to work

ALTER TABLE versus_rooms REPLICA IDENTITY FULL;

-- Add versus_rooms to Supabase Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE versus_rooms;

-- Add versus_messages to Supabase Realtime publication (for broadcast messages)
ALTER PUBLICATION supabase_realtime ADD TABLE versus_messages;
