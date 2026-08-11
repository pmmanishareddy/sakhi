-- Category-wise wardrobe sharing.
--
-- A share is a capability: whoever holds the token can view the listed
-- categories. There is no viewer-side management UI by design — every link
-- expires on its own, so a forgotten link stops working instead of living
-- forever. The owner can also kill one early from the share sheet.

CREATE TABLE wardrobe_shares (
  -- gen_random_bytes(12) is 96 bits of entropy; translate() makes the base64
  -- URL-safe (Postgres 17 has no base64url encoder).
  token TEXT PRIMARY KEY DEFAULT translate(encode(gen_random_bytes(12), 'base64'), '+/=', 'xyz'),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- Display-group labels from src/lib/categories.ts (e.g. {Sarees,Blouses}).
  -- Empty means the whole wardrobe.
  groups TEXT[] NOT NULL DEFAULT '{}',
  title TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_shares_user ON wardrobe_shares(user_id, created_at DESC);

ALTER TABLE wardrobe_shares ENABLE ROW LEVEL SECURITY;

-- Owner-only. The public read path never goes through PostgREST: it runs in the
-- get-shared-wardrobe edge function on the service-role key, which bypasses RLS
-- and hand-filters the columns a viewer is allowed to see.
CREATE POLICY "Users CRUD own shares" ON wardrobe_shares FOR ALL USING (auth.uid() = user_id);

-- New tables are not auto-exposed to the Data API roles on current Supabase.
GRANT SELECT, INSERT, UPDATE ON wardrobe_shares TO authenticated;

-- Called only by get-shared-wardrobe on the service-role key. Atomic so
-- concurrent viewers don't clobber each other's increment.
CREATE OR REPLACE FUNCTION increment_share_views(share_token TEXT)
RETURNS void AS $$
  UPDATE public.wardrobe_shares SET view_count = view_count + 1 WHERE token = share_token;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;
