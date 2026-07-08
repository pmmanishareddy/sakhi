-- Sakhi wardrobe intelligence app — initial schema

-- Profiles (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  frustrations TEXT[] DEFAULT '{}',
  occasions TEXT[] DEFAULT '{}',
  style_preferences JSONB DEFAULT '{}',
  location TEXT,
  currency TEXT DEFAULT 'INR',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Wardrobe items
CREATE TABLE wardrobe_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT,
  primary_color TEXT NOT NULL,
  color_hex TEXT NOT NULL,
  secondary_color TEXT,
  pattern TEXT NOT NULL,
  formality TEXT NOT NULL,
  occasions TEXT[] DEFAULT '{}',
  seasons TEXT[] DEFAULT '{}',
  style_tags TEXT[] DEFAULT '{}',
  brand TEXT,
  fabric TEXT,
  size TEXT,
  price NUMERIC(10,2),
  image_url TEXT NOT NULL,
  thumbnail_url TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'donated', 'sold')),
  laundry_status TEXT DEFAULT 'clean' CHECK (laundry_status IN ('clean', 'in_laundry')),
  times_worn INTEGER DEFAULT 0,
  last_worn_at TIMESTAMPTZ,
  ai_description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_wardrobe_items_user ON wardrobe_items(user_id);
CREATE INDEX idx_wardrobe_items_category ON wardrobe_items(user_id, category);

-- Outfits
CREATE TABLE outfits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  occasion TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  social_circles TEXT[] DEFAULT '{}',
  event_name TEXT,
  note TEXT,
  image_url TEXT,
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'suggestion', 'photo')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_outfits_user ON outfits(user_id);
CREATE INDEX idx_outfits_date ON outfits(user_id, date DESC);

-- Outfit items (junction)
CREATE TABLE outfit_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outfit_id UUID NOT NULL REFERENCES outfits(id) ON DELETE CASCADE,
  wardrobe_item_id UUID NOT NULL REFERENCES wardrobe_items(id) ON DELETE CASCADE,
  UNIQUE(outfit_id, wardrobe_item_id)
);

CREATE INDEX idx_outfit_items_outfit ON outfit_items(outfit_id);
CREATE INDEX idx_outfit_items_item ON outfit_items(wardrobe_item_id);

-- Social circles (for repeat avoidance tracking)
CREATE TABLE social_circles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  emoji TEXT DEFAULT '👥',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_circles_user ON social_circles(user_id);

-- Outfit-circle junction (which circles saw this outfit)
CREATE TABLE outfit_circles (
  outfit_id UUID NOT NULL REFERENCES outfits(id) ON DELETE CASCADE,
  circle_id UUID NOT NULL REFERENCES social_circles(id) ON DELETE CASCADE,
  PRIMARY KEY (outfit_id, circle_id)
);

-- User stats (gamification)
CREATE TABLE user_stats (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  total_items INTEGER DEFAULT 0,
  total_outfits_logged INTEGER DEFAULT 0,
  money_saved NUMERIC(10,2) DEFAULT 0,
  streak_days INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_logged_date DATE,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Purchase verdicts
CREATE TABLE purchase_verdicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  item_price NUMERIC(10,2),
  item_image_url TEXT,
  item_source_url TEXT,
  verdict TEXT NOT NULL CHECK (verdict IN ('buy', 'skip', 'maybe')),
  reasoning TEXT NOT NULL,
  similar_item_ids UUID[] DEFAULT '{}',
  estimated_cpw NUMERIC(10,2),
  pairings_count INTEGER DEFAULT 0,
  evidence JSONB DEFAULT '[]',
  action_taken TEXT CHECK (action_taken IN ('bought', 'skipped', NULL)),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_verdicts_user ON purchase_verdicts(user_id, created_at DESC);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  INSERT INTO public.user_stats (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Auto-increment wear counts when outfit is logged
CREATE OR REPLACE FUNCTION increment_wear_counts()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.wardrobe_items
  SET times_worn = times_worn + 1,
      last_worn_at = (SELECT date FROM public.outfits WHERE id = NEW.outfit_id),
      updated_at = now()
  WHERE id = NEW.wardrobe_item_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_outfit_item_inserted
  AFTER INSERT ON outfit_items
  FOR EACH ROW EXECUTE FUNCTION increment_wear_counts();

CREATE OR REPLACE FUNCTION decrement_wear_counts()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.wardrobe_items
  SET times_worn = GREATEST(times_worn - 1, 0),
      updated_at = now()
  WHERE id = OLD.wardrobe_item_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_outfit_item_deleted
  AFTER DELETE ON outfit_items
  FOR EACH ROW EXECUTE FUNCTION decrement_wear_counts();

-- Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

ALTER TABLE wardrobe_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users CRUD own items" ON wardrobe_items FOR ALL USING (auth.uid() = user_id);

ALTER TABLE outfits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users CRUD own outfits" ON outfits FOR ALL USING (auth.uid() = user_id);

ALTER TABLE outfit_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users CRUD own outfit items" ON outfit_items FOR ALL
  USING (EXISTS (SELECT 1 FROM outfits WHERE outfits.id = outfit_items.outfit_id AND outfits.user_id = auth.uid()));

ALTER TABLE purchase_verdicts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users CRUD own verdicts" ON purchase_verdicts FOR ALL USING (auth.uid() = user_id);

ALTER TABLE social_circles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users CRUD own circles" ON social_circles FOR ALL USING (auth.uid() = user_id);

ALTER TABLE outfit_circles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users CRUD own outfit circles" ON outfit_circles FOR ALL
  USING (EXISTS (SELECT 1 FROM outfits WHERE outfits.id = outfit_circles.outfit_id AND outfits.user_id = auth.uid()));

ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own stats" ON user_stats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own stats" ON user_stats FOR UPDATE USING (auth.uid() = user_id);
