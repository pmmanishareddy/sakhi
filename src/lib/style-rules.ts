// Shared client-side styling rules — mirrors the classification the edge functions use.
// Tolerant of the category variants that exist in real data ("Dresses", "Sarees", "Tops").

export type Role = 'top' | 'bottom' | 'one-piece' | 'ethnic-top' | 'outerwear' | 'footwear' | 'accessory' | 'other'

const CATEGORY_ROLE: Record<string, Role> = {
  't-shirt': 'top', 'top': 'top', 'tops': 'top', 'shirt': 'top', 'shirts': 'top',
  'blouse': 'top', 'blouses': 'top', 'crop top': 'top', 'sweater': 'top', 'hoodie': 'top',
  'pants': 'bottom', 'bottoms': 'bottom', 'jeans': 'bottom', 'shorts': 'bottom',
  'skirt': 'bottom', 'skirts': 'bottom', 'leggings': 'bottom', 'trousers': 'bottom',
  'dress': 'one-piece', 'dresses': 'one-piece', 'jumpsuit': 'one-piece', 'jumpsuits': 'one-piece',
  'saree': 'one-piece', 'sarees': 'one-piece',
  'kurta': 'ethnic-top', 'kurtas': 'ethnic-top', 'saree blouse': 'ethnic-top', 'saree blouses': 'ethnic-top',
  'jacket': 'outerwear', 'jackets': 'outerwear', 'blazer': 'outerwear', 'blazers': 'outerwear',
  'shoes': 'footwear', 'sandals': 'footwear', 'heels': 'footwear', 'sneakers': 'footwear',
  'jewelry': 'accessory', 'jewellery': 'accessory', 'dupatta': 'accessory', 'dupattas': 'accessory',
  'sunglasses': 'accessory', 'watch': 'accessory', 'belt': 'accessory', 'scarf': 'accessory',
  'hat': 'accessory', 'bag': 'accessory', 'bags': 'accessory',
}

export function getRole(category: string): Role {
  return CATEGORY_ROLE[category.trim().toLowerCase()] ?? 'other'
}

// "Olive Green" and "Navy Blue" count as neutral — match on words, not the exact string
const NEUTRAL_WORDS = new Set(['black', 'white', 'cream', 'beige', 'navy', 'grey', 'gray', 'brown', 'tan', 'olive', 'khaki', 'ivory', 'nude', 'charcoal', 'denim'])

export function isNeutral(color: string): boolean {
  return color.toLowerCase().split(/[\s/-]+/).some(w => NEUTRAL_WORDS.has(w))
}

const ETHNIC_KEYWORDS = /saree|sari\b|kurta|kurti|lehenga|anarkali|salwar|churidar|dupatta|choli|sharara|zari|warli|bandhani|banarasi|kanjeevaram|jhumka|kolhapuri|mojari|juttis?\b/
const WESTERN_CATEGORIES = new Set(['t-shirt', 'shirt', 'crop top', 'dress', 'dresses', 'jumpsuit', 'jumpsuits', 'jeans', 'shorts', 'hoodie', 'blazer', 'blazers', 'sweater', 'sneakers'])

export interface StyleItem {
  name: string
  category: string
  style_tags?: string[] | null
}

// W = western-only, E = ethnic-only, V = versatile (works with either)
export function styleOf(i: StyleItem): 'W' | 'E' | 'V' {
  const text = `${i.name} ${i.category} ${(i.style_tags || []).join(' ')}`.toLowerCase()
  if (ETHNIC_KEYWORDS.test(text) || i.style_tags?.includes('ethnic')) return 'E'
  if (i.style_tags?.includes('western') || WESTERN_CATEGORIES.has(i.category.trim().toLowerCase())) return 'W'
  return 'V'
}

export function isSareeBlouse(i: StyleItem): boolean {
  const text = `${i.name} ${i.category}`.toLowerCase()
  return /saree blouse|choli/.test(text) || (getRole(i.category) !== 'one-piece' && text.includes('blouse') && styleOf(i) === 'E')
}

export function isSaree(i: StyleItem): boolean {
  return !isSareeBlouse(i) && /saree|\bsari\b/.test(`${i.name} ${i.category}`.toLowerCase())
}

function isKurta(i: StyleItem): boolean {
  return /kurta|kurti/.test(`${i.name} ${i.category}`.toLowerCase())
}

const COMPLEMENTARY: Record<Role, Set<Role>> = {
  'top': new Set(['bottom', 'footwear', 'outerwear', 'accessory']),
  'bottom': new Set(['top', 'ethnic-top', 'footwear', 'outerwear', 'accessory']),
  'one-piece': new Set(['ethnic-top', 'footwear', 'outerwear', 'accessory']),
  'ethnic-top': new Set(['bottom', 'one-piece', 'footwear', 'accessory']),
  'outerwear': new Set(['top', 'bottom', 'one-piece', 'footwear']),
  'footwear': new Set(['top', 'bottom', 'one-piece', 'ethnic-top', 'outerwear']),
  'accessory': new Set(['top', 'bottom', 'one-piece', 'ethnic-top', 'outerwear']),
  'other': new Set(),
}

// Denim reads as neutral regardless of its color name — blue jeans go with everything
function actsNeutral(i: { name: string; category: string; primary_color: string }): boolean {
  return isNeutral(i.primary_color) || /jean|denim/.test(`${i.name} ${i.category}`.toLowerCase())
}

export interface PairCandidate extends StyleItem {
  primary_color: string
  formality: string
  occasions: string[]
}

/**
 * Would these two pieces plausibly appear in one outfit?
 * Conservative on purpose — this powers "pairs well with", where a wrong
 * positive is worse than a missed pairing.
 */
export function pairsWith(
  a: StyleItem & { primary_color: string; formality: string; occasions: string[] | Set<string> },
  b: PairCandidate
): boolean {
  const roleA = getRole(a.category)
  const roleB = getRole(b.category)
  if (!COMPLEMENTARY[roleA]?.has(roleB)) return false

  // Saree family: a saree blouse only ever pairs with a saree; a saree only
  // takes its blouse, footwear (not sneakers), and accessories
  const aBlouse = isSareeBlouse(a); const bBlouse = isSareeBlouse(b)
  const aSaree = isSaree(a); const bSaree = isSaree(b)
  if (aBlouse || bBlouse) return (aBlouse && bSaree) || (bBlouse && aSaree)
  if (aSaree || bSaree) {
    const other = aSaree ? b : a
    const otherRole = aSaree ? roleB : roleA
    if (otherRole !== 'footwear' && otherRole !== 'accessory') return false
    if (styleOf(other) === 'W' || /sneaker/.test(`${other.name} ${other.category}`.toLowerCase())) return false
  }

  // Ethnic and western don't mix — except the indo-western kurta + bottom
  const sA = styleOf(a); const sB = styleOf(b)
  if ((sA === 'E' && sB === 'W') || (sA === 'W' && sB === 'E')) {
    const kurtaWithBottom = (isKurta(a) && roleB === 'bottom') || (isKurta(b) && roleA === 'bottom')
    if (!kurtaWithBottom) return false
  }

  // Must share an occasion or a formality level
  const occA = a.occasions instanceof Set ? a.occasions : new Set(a.occasions)
  if (!b.occasions.some(o => occA.has(o)) && b.formality !== a.formality) return false

  // Color: a neutral (or denim) goes with anything; matching color families read as monochrome
  if (actsNeutral(a) || actsNeutral(b)) return true
  const wordsA = a.primary_color.toLowerCase().split(/[\s/-]+/)
  const wordsB = new Set(b.primary_color.toLowerCase().split(/[\s/-]+/))
  return wordsA.some(w => wordsB.has(w))
}
