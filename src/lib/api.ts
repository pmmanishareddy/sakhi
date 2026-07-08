import { supabase } from './supabase'

// ── Types ──

export interface DbWardrobeItem {
  id: string
  user_id: string
  name: string
  category: string
  subcategory: string | null
  primary_color: string
  color_hex: string
  secondary_color: string | null
  pattern: string
  formality: string
  occasions: string[]
  seasons: string[]
  style_tags: string[]
  brand: string | null
  fabric: string | null
  size: string | null
  price: number | null
  image_url: string
  thumbnail_url: string | null
  status: 'active' | 'archived' | 'donated' | 'sold'
  laundry_status: 'clean' | 'in_laundry'
  times_worn: number
  last_worn_at: string | null
  ai_description: string | null
  created_at: string
  updated_at: string
}

export interface DbOutfit {
  id: string
  user_id: string
  occasion: string
  date: string
  social_circles: string[]
  event_name: string | null
  note: string | null
  image_url: string | null
  source: 'manual' | 'suggestion' | 'photo'
  created_at: string
}

export interface DbSocialCircle {
  id: string
  user_id: string
  name: string
  emoji: string
  created_at: string
}

export interface DbUserStats {
  user_id: string
  total_items: number
  total_outfits_logged: number
  money_saved: number
  streak_days: number
  longest_streak: number
  last_logged_date: string | null
  updated_at: string
}

export interface DbProfile {
  id: string
  display_name: string
  frustrations: string[]
  occasions: string[]
  style_preferences: Record<string, string>
  location: string | null
  currency: string
  created_at: string
  updated_at: string
}

export interface DbPurchaseVerdict {
  id: string
  user_id: string
  item_name: string
  item_price: number | null
  item_image_url: string | null
  item_source_url: string | null
  verdict: 'buy' | 'skip' | 'maybe'
  reasoning: string
  similar_item_ids: string[]
  estimated_cpw: number | null
  pairings_count: number
  evidence: unknown[]
  action_taken: 'bought' | 'skipped' | null
  created_at: string
}

export interface AnalysisResult {
  name: string
  category: string
  subcategory: string | null
  primary_color: string
  color_hex: string
  secondary_color: string | null
  pattern: string
  formality: string
  occasions: string[]
  seasons: string[]
  style_tags: string[]
  fabric: string | null
  brand: string | null
  description: string
}

export interface OutfitSuggestion {
  items: Array<{ id: string; role: string; name: string; image_url: string }>
  styling_note: string
  why: string
}

export interface VerdictResult {
  verdict: 'buy' | 'skip' | 'maybe'
  title: string
  reason: string
  overlap: string | null
  pairings_count: number
  estimated_cpw: number
  evidence: Array<{ label: string; text: string; metric?: string }>
}

export interface GapCard {
  icon: string
  title: string
  body: string
  tags?: string[]
  pairing?: string
}

export interface MatchResult {
  matched_items: Array<{ id: string; name: string; image_url: string; confidence: string }>
  new_items: Array<{ name: string; category: string; style?: 'western' | 'ethnic' | 'versatile'; description: string }>
}

// ── Wardrobe Items ──

export async function fetchWardrobeItems(): Promise<DbWardrobeItem[]> {
  const { data, error } = await supabase
    .from('wardrobe_items')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function fetchWardrobeItem(id: string): Promise<DbWardrobeItem | null> {
  const { data, error } = await supabase
    .from('wardrobe_items')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function addWardrobeItem(
  item: Omit<DbWardrobeItem, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'times_worn' | 'last_worn_at' | 'status'>,
  imageFile: File
): Promise<DbWardrobeItem> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const ext = imageFile.name.split('.').pop() || 'webp'
  const path = `${user.id}/items/${generateId()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('wardrobe-images')
    .upload(path, imageFile, { contentType: imageFile.type })
  if (uploadError) throw uploadError

  const { data: { publicUrl } } = supabase.storage
    .from('wardrobe-images')
    .getPublicUrl(path)

  const { data, error } = await supabase
    .from('wardrobe_items')
    .insert({ ...item, user_id: user.id, image_url: publicUrl })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function addWardrobeItemFromOutfit(
  newItem: { name: string; category: string; description?: string },
  outfitImageUrl: string,
): Promise<DbWardrobeItem> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('wardrobe_items')
    .insert({
      user_id: user.id,
      name: newItem.name,
      category: newItem.category,
      subcategory: null,
      primary_color: 'Unknown',
      color_hex: '#888888',
      secondary_color: null,
      pattern: 'Solid',
      formality: 'Casual',
      occasions: ['Casual'],
      seasons: ['All'],
      style_tags: [],
      brand: null,
      fabric: null,
      size: null,
      price: null,
      image_url: outfitImageUrl,
      thumbnail_url: null,
      ai_description: newItem.description || null,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateWardrobeItem(id: string, updates: Partial<DbWardrobeItem>): Promise<void> {
  const { error } = await supabase
    .from('wardrobe_items')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function deleteWardrobeItem(id: string): Promise<void> {
  // Soft delete — keeps the row so logged outfits retain the item and its photo
  const { error } = await supabase
    .from('wardrobe_items')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function toggleLaundryStatus(id: string, status: 'clean' | 'in_laundry'): Promise<void> {
  await updateWardrobeItem(id, { laundry_status: status })
}

// ── Image Upload ──

export async function uploadImage(file: File, folder: 'items' | 'outfits'): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const ext = file.name.split('.').pop() || 'webp'
  const path = `${user.id}/${folder}/${generateId()}.${ext}`

  const { error } = await supabase.storage
    .from('wardrobe-images')
    .upload(path, file, { contentType: file.type })
  if (error) throw error

  const { data: { publicUrl } } = supabase.storage
    .from('wardrobe-images')
    .getPublicUrl(path)

  return publicUrl
}

// ── AI Edge Functions ──

async function callEdgeFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  const { data: { session } } = await supabase.auth.getSession()

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)

  let res: Response
  try {
    res = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || anonKey}`,
        'apikey': anonKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.')
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }

  const json = await res.json()
  if (!res.ok || json.success === false) {
    throw new Error(json.error || `${name} failed (${res.status})`)
  }
  return json as T
}

export async function analyzeItemPhoto(imageBase64: string, contentType: string): Promise<AnalysisResult> {
  const res = await callEdgeFunction<{ analysis: AnalysisResult }>('analyze-item', {
    image_base64: imageBase64,
    image_content_type: contentType,
  })
  return res.analysis
}

export async function suggestOutfit(occasion: string, pinnedItemIds?: string[], excludeItemIds?: string[]): Promise<OutfitSuggestion> {
  const res = await callEdgeFunction<{ outfit: OutfitSuggestion }>('suggest-outfit', {
    occasion,
    pinned_item_ids: pinnedItemIds,
    exclude_item_ids: excludeItemIds,
  })
  return res.outfit
}

export async function getPurchaseVerdict(input: {
  image_base64?: string
  image_content_type?: string
  source_url?: string
  item_name?: string
  item_price?: number
}): Promise<VerdictResult> {
  const res = await callEdgeFunction<{ verdict: VerdictResult }>('purchase-verdict', input)
  return res.verdict
}

export async function getWardrobeGaps(): Promise<GapCard[]> {
  const res = await callEdgeFunction<{ gaps: GapCard[] }>('wardrobe-gaps', {})
  return res.gaps
}

export async function matchOutfitPhoto(imageBase64: string, contentType: string): Promise<MatchResult> {
  const res = await callEdgeFunction<{ matches: MatchResult }>('match-outfit-photo', {
    image_base64: imageBase64,
    image_content_type: contentType,
  })
  return res.matches
}

// ── Outfits ──

export async function logOutfit(input: {
  occasion: string
  itemIds: string[]
  socialCircles?: string[]
  eventName?: string
  imageUrl?: string
  source?: 'manual' | 'suggestion' | 'photo'
}): Promise<DbOutfit> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: outfit, error } = await supabase
    .from('outfits')
    .insert({
      user_id: user.id,
      occasion: input.occasion,
      social_circles: input.socialCircles ?? [],
      event_name: input.eventName ?? null,
      image_url: input.imageUrl ?? null,
      source: input.source ?? 'manual',
    })
    .select()
    .single()
  if (error) throw error

  if (input.itemIds.length > 0) {
    const { error: itemsError } = await supabase
      .from('outfit_items')
      .insert(input.itemIds.map(itemId => ({
        outfit_id: outfit.id,
        wardrobe_item_id: itemId,
      })))
    if (itemsError) throw itemsError
  }

  return outfit
}

export async function addItemsToOutfit(outfitId: string, itemIds: string[]): Promise<void> {
  const { error } = await supabase
    .from('outfit_items')
    .insert(itemIds.map(itemId => ({ outfit_id: outfitId, wardrobe_item_id: itemId })))
  if (error) throw error
}

export async function updateOutfit(outfitId: string, updates: { occasion?: string; event_name?: string | null }): Promise<void> {
  const { error } = await supabase.from('outfits').update(updates).eq('id', outfitId)
  if (error) throw error
}

export async function removeItemFromOutfit(outfitId: string, itemId: string): Promise<void> {
  const { error } = await supabase.from('outfit_items').delete().eq('outfit_id', outfitId).eq('wardrobe_item_id', itemId)
  if (error) throw error
}

export async function deleteOutfit(outfitId: string): Promise<void> {
  await supabase.from('outfit_items').delete().eq('outfit_id', outfitId)
  const { error } = await supabase.from('outfits').delete().eq('id', outfitId)
  if (error) throw error
}

export interface OutfitItemSnapshot {
  name: string
  category: string
  primary_color: string
  color_hex: string
  image_url: string
}

export type OutfitWithItems = DbOutfit & {
  outfit_items: Array<{ wardrobe_item_id: string; wardrobe_items: OutfitItemSnapshot | null }>
}

export async function fetchOutfitHistory(): Promise<OutfitWithItems[]> {
  // Joins item details so outfits keep rendering items that were later archived
  const { data, error } = await supabase
    .from('outfits')
    .select('*, outfit_items(wardrobe_item_id, wardrobe_items(name, category, primary_color, color_hex, image_url))')
    .order('date', { ascending: false })
    .limit(30)
  if (error) throw error
  return (data ?? []) as unknown as OutfitWithItems[]
}

// ── Social Circles ──

export async function fetchCircles(): Promise<DbSocialCircle[]> {
  const { data, error } = await supabase
    .from('social_circles')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createCircle(name: string, emoji: string): Promise<DbSocialCircle> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('social_circles')
    .insert({ user_id: user.id, name, emoji })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCircle(id: string, updates: { name?: string; emoji?: string }): Promise<void> {
  const { error } = await supabase
    .from('social_circles')
    .update(updates)
    .eq('id', id)
  if (error) throw error
}

export async function deleteCircle(id: string): Promise<void> {
  const { error } = await supabase
    .from('social_circles')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ── User Stats ──

export async function fetchUserStats(): Promise<DbUserStats | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('user_stats')
    .select('*')
    .eq('user_id', user.id)
    .single()
  if (error) throw error
  return data
}

// ── Purchase Verdicts ──

export async function savePurchaseVerdict(input: {
  itemName: string
  itemPrice?: number
  itemImageUrl?: string
  itemSourceUrl?: string
  verdict: 'buy' | 'skip' | 'maybe'
  reasoning: string
  similarItemIds?: string[]
  estimatedCpw?: number
  pairingsCount?: number
  evidence?: unknown[]
  actionTaken: 'bought' | 'skipped'
}): Promise<DbPurchaseVerdict> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('purchase_verdicts')
    .insert({
      user_id: user.id,
      item_name: input.itemName,
      item_price: input.itemPrice ?? null,
      item_image_url: input.itemImageUrl ?? null,
      item_source_url: input.itemSourceUrl ?? null,
      verdict: input.verdict,
      reasoning: input.reasoning,
      similar_item_ids: input.similarItemIds ?? [],
      estimated_cpw: input.estimatedCpw ?? null,
      pairings_count: input.pairingsCount ?? 0,
      evidence: input.evidence ?? [],
      action_taken: input.actionTaken,
    })
    .select()
    .single()
  if (error) throw error

  if (input.actionTaken === 'skipped' && input.itemPrice) {
    const stats = await fetchUserStats()
    if (stats) {
      await supabase
        .from('user_stats')
        .update({
          money_saved: stats.money_saved + input.itemPrice,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
    }
  }

  return data
}

export async function fetchVerdictHistory(): Promise<DbPurchaseVerdict[]> {
  const { data, error } = await supabase
    .from('purchase_verdicts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw error
  return data ?? []
}

// ── Profile ──

export async function updateProfile(updates: {
  display_name?: string
  frustrations?: string[]
  occasions?: string[]
  style_preferences?: Record<string, unknown>
  location?: string
  currency?: string
}): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', user.id)
  if (error) throw error
}

export async function deleteAccount(): Promise<void> {
  await callEdgeFunction('delete-account', {})
  await supabase.auth.signOut()
}

export async function getProfile(): Promise<DbProfile | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()
  if (error) throw error
  return data
}

// ── Helpers ──

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
