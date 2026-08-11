-- Manual ordering for trip entries, so a list can be arranged by the day each
-- piece is meant for rather than by when it happened to be added.

ALTER TABLE trip_entries ADD COLUMN IF NOT EXISTS position INTEGER;

-- Backfill existing lists in their current (created_at) order so nothing jumps
-- around the first time a list is opened after this ships.
UPDATE trip_entries e
SET position = ranked.rn
FROM (
  SELECT id, row_number() OVER (PARTITION BY trip_id ORDER BY created_at) - 1 AS rn
  FROM trip_entries
) ranked
WHERE e.id = ranked.id AND e.position IS NULL;

-- Reorder in one round trip instead of one UPDATE per tile.
-- SECURITY INVOKER (the default) on purpose: row-level security already limits
-- the update to the caller's own entries, so no ownership check is needed here
-- and none can be forgotten.
CREATE OR REPLACE FUNCTION reorder_trip_entries(p_ids UUID[])
RETURNS void AS $$
  UPDATE public.trip_entries e
  SET position = ord.rn - 1
  FROM unnest(p_ids) WITH ORDINALITY AS ord(id, rn)
  WHERE e.id = ord.id;
$$ LANGUAGE sql;

GRANT EXECUTE ON FUNCTION reorder_trip_entries(UUID[]) TO authenticated;
