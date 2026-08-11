-- Trip planning: a named list of outfits and items, each with a note.
--
-- Named generically on purpose. The UI calls these trips, but the same shape
-- covers a wedding week or a festival, so broadening later is a copy change
-- rather than a migration.

CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_trips_user ON trips(user_id, created_at DESC);

CREATE TABLE trip_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  -- Exactly one of these is set. Two nullable FKs plus the check below beats a
  -- type column: a malformed row is impossible rather than merely discouraged.
  wardrobe_item_id UUID REFERENCES wardrobe_items(id) ON DELETE CASCADE,
  outfit_id UUID REFERENCES outfits(id) ON DELETE CASCADE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT one_target CHECK (num_nonnulls(wardrobe_item_id, outfit_id) = 1)
);

-- Duplicates are allowed on purpose: adding a dress on its own and again as
-- part of an outfit is a real thing to want while planning.
CREATE INDEX idx_trip_entries_trip ON trip_entries(trip_id, created_at);

ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users CRUD own trips" ON trips FOR ALL USING (auth.uid() = user_id);

ALTER TABLE trip_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users CRUD own trip entries" ON trip_entries FOR ALL
  USING (EXISTS (SELECT 1 FROM trips WHERE trips.id = trip_entries.trip_id AND trips.user_id = auth.uid()));

-- New tables are not auto-exposed to the Data API roles on current Supabase.
GRANT SELECT, INSERT, UPDATE, DELETE ON trips TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON trip_entries TO authenticated;
