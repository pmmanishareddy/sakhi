// Display groups shared by every screen that shows the wardrobe in sections.
// Each item's category maps into exactly one group so a section shows every
// item that belongs there, regardless of casing, stray spaces, or a
// subcategory that leaked into the category (e.g. "Silk Saree"). Tops
// (western) and ethnic Blouses are deliberately separate groups.
export const GROUPS: { label: string; cats: string[] }[] = [
  { label: 'Sarees', cats: ['Saree'] },
  { label: 'Blouses', cats: ['Saree Blouse'] },
  { label: 'Tops', cats: ['Top', 'T-Shirt', 'Shirt', 'Blouse', 'Crop Top'] },
  { label: 'Dresses', cats: ['Dress', 'Jumpsuit'] },
  { label: 'Bottoms', cats: ['Pants', 'Jeans', 'Shorts', 'Skirt', 'Leggings'] },
  { label: 'Ethnic', cats: ['Kurta', 'Dupatta'] },
  { label: 'Outerwear', cats: ['Jacket', 'Blazer', 'Sweater', 'Hoodie'] },
  { label: 'Footwear', cats: ['Shoes', 'Sandals', 'Heels', 'Sneakers'] },
  { label: 'Bags', cats: ['Bags'] },
  { label: 'Accessories', cats: ['Jewelry', 'Sunglasses', 'Watch', 'Belt', 'Scarf', 'Hat'] },
]

export const GROUP_LABELS = GROUPS.map(g => g.label)

const norm = (s: string) => (s || '').trim().toLowerCase()

const CAT_TO_GROUP = new Map<string, string>()
for (const g of GROUPS) for (const c of g.cats) CAT_TO_GROUP.set(norm(c), g.label)

// Map a raw category to its group. Exact (normalized) first, then a substring
// fallback so mis-formatted or subcategory-style values still land somewhere
// sensible instead of vanishing from every section.
export function groupOf(category: string): string {
  const n = norm(category)
  const direct = CAT_TO_GROUP.get(n)
  if (direct) return direct
  if (n.includes('saree blouse') || (n.includes('blouse') && n.includes('saree'))) return 'Blouses'
  if (n.includes('saree')) return 'Sarees'
  if (n.includes('dress') || n.includes('gown') || n.includes('jumpsuit')) return 'Dresses'
  if (n.includes('kurt') || n.includes('dupatta') || n.includes('lehenga') || n.includes('anarkali') || n.includes('salwar')) return 'Ethnic'
  if (n.includes('blouse') || n.includes('shirt') || n.includes('top')) return 'Tops'
  if (n.includes('jean') || n.includes('pant') || n.includes('trouser') || n.includes('skirt') || n.includes('short') || n.includes('legging')) return 'Bottoms'
  if (n.includes('jacket') || n.includes('blazer') || n.includes('sweater') || n.includes('hoodie') || n.includes('coat')) return 'Outerwear'
  if (n.includes('shoe') || n.includes('sandal') || n.includes('heel') || n.includes('sneaker') || n.includes('boot') || n.includes('flat')) return 'Footwear'
  if (n.includes('bag') || n.includes('clutch') || n.includes('purse')) return 'Bags'
  return 'Accessories'
}

// When an outfit has no photo of its own, its cover comes from the pieces worn.
// outfit_items comes back in insertion order, so without this the cover was
// whichever item happened to be stored first — a bag or a pair of shoes is a
// poor stand-in for a look. Order by how much a piece defines the outfit.
const COVER_ORDER = ['Dresses', 'Sarees', 'Ethnic', 'Tops', 'Blouses', 'Bottoms', 'Outerwear', 'Footwear', 'Bags', 'Accessories']
const COVER_RANK = new Map(COVER_ORDER.map((label, i) => [label, i]))

export function byCoverPriority<T extends { category: string }>(items: T[]): T[] {
  const rank = (c: string) => COVER_RANK.get(groupOf(c)) ?? COVER_ORDER.length
  return [...items].sort((a, b) => rank(a.category) - rank(b.category))
}

// Free-text match used by the wardrobe search and the item pickers. Every word
// typed must appear somewhere in the item's text, so "green silk" and
// "silk green" both find the emerald silk saree.
type Searchable = {
  name: string
  category: string
  primary_color: string
  brand?: string | null
  fabric?: string | null
}

export const searchTerms = (query: string): string[] =>
  query.trim().toLowerCase().split(/\s+/).filter(Boolean)

export function matchesQuery(item: Searchable, terms: string[]): boolean {
  if (terms.length === 0) return true
  const text = `${item.name} ${item.category} ${item.primary_color} ${item.brand || ''} ${item.fabric || ''}`.toLowerCase()
  return terms.every(t => text.includes(t))
}

// Group items into display sections, preserving GROUPS order and dropping
// sections that came back empty (e.g. everything filtered out by a search).
export function sectionize<T extends { category: string }>(items: T[]): { label: string; items: T[] }[] {
  const byGroup = new Map<string, T[]>()
  for (const item of items) {
    const label = groupOf(item.category)
    const bucket = byGroup.get(label)
    if (bucket) bucket.push(item)
    else byGroup.set(label, [item])
  }
  return GROUP_LABELS
    .map(label => ({ label, items: byGroup.get(label) || [] }))
    .filter(section => section.items.length > 0)
}
