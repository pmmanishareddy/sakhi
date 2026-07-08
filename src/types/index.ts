export interface WardrobeItem {
  id: string
  user_id: string
  name: string
  category: string
  subcategory?: string
  primary_color: string
  color_hex: string
  secondary_color?: string
  pattern: string
  formality: string
  occasions: string[]
  seasons: string[]
  style_tags: string[]
  brand?: string
  fabric?: string
  size?: string
  price?: number
  image_url: string
  thumbnail_url?: string
  status: 'active' | 'archived' | 'donated' | 'sold'
  laundry_status: 'clean' | 'in_laundry'
  times_worn: number
  last_worn_at?: string
  ai_description?: string
  created_at: string
  updated_at: string
}

export interface Outfit {
  id: string
  user_id: string
  occasion: string
  date: string
  social_circles: string[]
  event_name?: string
  note?: string
  image_url?: string
  source: 'manual' | 'suggestion' | 'photo'
  items: OutfitItem[]
  created_at: string
}

export interface OutfitItem {
  id: string
  outfit_id: string
  wardrobe_item_id: string
  wardrobe_item?: WardrobeItem
}

export interface SocialCircle {
  id: string
  user_id: string
  name: string
  emoji: string
  created_at: string
}

export interface UserStats {
  user_id: string
  total_items: number
  total_outfits_logged: number
  money_saved: number
  streak_days: number
  longest_streak: number
  last_logged_date: string | null
  updated_at: string
}

export interface Profile {
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

export type Screen = 'splash' | 'onboarding' | 'home' | 'wardrobe' | 'sakhi' | 'add-item' | 'item-detail'

export type Category = 'Tops' | 'Bottoms' | 'Dresses' | 'Sarees' | 'Outerwear' | 'Jewelry' | 'Shoes' | 'Bags' | 'Accessories'

export const CATEGORIES: Category[] = ['Tops', 'Bottoms', 'Dresses', 'Sarees', 'Outerwear', 'Jewelry', 'Shoes', 'Bags', 'Accessories']

export const OCCASIONS = ['Office', 'Casual', 'Party', 'Wedding', 'Date Night', 'Festival', 'Travel'] as const

export const PATTERNS = ['Solid', 'Printed', 'Striped', 'Checked', 'Floral', 'Embroidered', 'Woven', 'Abstract'] as const

export const FORMALITY_LEVELS = ['Casual', 'Smart Casual', 'Semi-Formal', 'Formal', 'Black Tie'] as const

export const SEASONS = ['Summer', 'Winter', 'Spring', 'Fall', 'All'] as const
