-- Storage bucket for wardrobe images
INSERT INTO storage.buckets (id, name, public) VALUES ('wardrobe-images', 'wardrobe-images', true);

CREATE POLICY "Users can upload own images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'wardrobe-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Anyone can view wardrobe images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'wardrobe-images');

CREATE POLICY "Users can delete own images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'wardrobe-images' AND (storage.foldername(name))[1] = auth.uid()::text);
