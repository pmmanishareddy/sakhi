-- Back-dated outfit logging: logging an outfit for an earlier day must not
-- rewind an item's last_worn_at. The original trigger set last_worn_at to the
-- new outfit's date unconditionally, so logging yesterday's look after today's
-- would move "last worn" backwards. Guard it with GREATEST (which skips NULLs,
-- so a first-ever wear still sets the date). times_worn still increments for
-- every wear regardless of date.
CREATE OR REPLACE FUNCTION increment_wear_counts()
RETURNS TRIGGER AS $$
DECLARE
  worn DATE;
BEGIN
  SELECT date INTO worn FROM public.outfits WHERE id = NEW.outfit_id;
  UPDATE public.wardrobe_items
  SET times_worn = times_worn + 1,
      last_worn_at = GREATEST(last_worn_at, worn::timestamptz),
      updated_at = now()
  WHERE id = NEW.wardrobe_item_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
