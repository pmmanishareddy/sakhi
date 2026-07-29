import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Filter, Plus, Droplets, Search } from 'lucide-react'
import { BottomNav } from '../../components/BottomNav'
import { Toast } from '../../components/Toast'
import { useWardrobe } from '../../lib/wardrobe-store'

// Display groups. Each item's category is mapped into exactly one group so a
// tab shows every item that belongs there — regardless of casing, stray spaces,
// or a subcategory that leaked into the category (e.g. "Silk Saree"). Tops
// (western) and ethnic Blouses are deliberately separate groups.
const GROUPS: { label: string; cats: string[] }[] = [
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

const norm = (s: string) => (s || '').trim().toLowerCase()

const CAT_TO_GROUP = new Map<string, string>()
for (const g of GROUPS) for (const c of g.cats) CAT_TO_GROUP.set(norm(c), g.label)

// Map a raw category to its group. Exact (normalized) first, then a substring
// fallback so mis-formatted or subcategory-style values still land somewhere
// sensible instead of vanishing from every tab.
function groupOf(category: string): string {
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

const TABS = [{ label: 'All', cat: 'all' }, ...GROUPS.map(g => ({ label: g.label, cat: g.label }))]

export function WardrobeScreen() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('all')
  const [toast, setToast] = useState('')
  const { items } = useWardrobe()

  const filtered = activeTab === 'all' ? items : items.filter(i => groupOf(i.category) === activeTab)
  const laundryCount = items.filter(i => i.laundry_status === 'in_laundry').length

  const getTabCount = useCallback((cat: string) => {
    if (cat === 'all') return items.length
    return items.filter(i => groupOf(i.category) === cat).length
  }, [items])

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center px-6 pt-3 pb-1">
          <h1 className="text-[22px] font-bold tracking-tight">Wardrobe</h1>
          <Filter size={20} className="text-text-secondary cursor-pointer" />
        </div>

        {/* Stats */}
        <div className="flex mx-6 mb-3.5 bg-card rounded-[14px] overflow-hidden">
          {[
            { val: items.length, label: 'Items' },
            { val: new Set(items.map(i => i.category)).size, label: 'Categories' },
            { val: laundryCount, label: 'In Laundry' },
          ].map((s, i) => (
            <div key={i} className="flex-1 text-center py-3 border-l border-white/[0.04] first:border-l-0">
              <div className="text-lg font-bold text-text-primary">{s.val}</div>
              <div className="text-[10px] text-text-tertiary mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center gap-2.5 mx-6 mb-3.5 bg-card rounded-xl px-3.5 py-2.5">
          <Search size={16} className="text-text-tertiary" />
          <span className="text-[13px] text-text-tertiary">Search your wardrobe...</span>
        </div>

        {/* Category tabs */}
        <div className="flex gap-0 px-5 mb-3.5 overflow-x-auto">
          {TABS.map(tab => {
            const count = getTabCount(tab.cat)
            if (count === 0 && tab.cat !== 'all') return null
            const active = activeTab === tab.cat
            return (
              <button
                key={tab.cat}
                onClick={() => setActiveTab(tab.cat)}
                className={`px-3 py-2 text-[13px] font-medium whitespace-nowrap cursor-pointer border-b-2 bg-transparent transition-colors ${
                  active ? 'text-text-primary border-text-primary' : 'text-text-tertiary border-transparent'
                }`}
              >
                {tab.label} <span className={`text-[10px] ml-0.5 ${active ? 'text-text-secondary opacity-100' : 'text-text-tertiary opacity-60'}`}>{count}</span>
              </button>
            )
          })}
        </div>

        {/* Empty closet: logging is the easy way in */}
        {items.length === 0 && (
          <div className="px-7 py-14 text-center animate-fade-up">
            <div className="text-3xl mb-4">🪞</div>
            <h2 className="text-[17px] font-bold tracking-tight mb-2">Your closet starts with one photo</h2>
            <p className="text-[13px] text-text-tertiary leading-relaxed mb-6">
              Log what you're wearing today and Sakhi files each piece away.
              No cataloging session needed.
            </p>
            <button
              onClick={() => navigate('/log-outfit')}
              className="w-full py-4 rounded-[14px] text-[15px] font-semibold bg-accent text-white border-none cursor-pointer active:scale-[0.97] transition-all"
            >
              Log today's outfit
            </button>
            <button
              onClick={() => navigate('/add-item')}
              className="w-full py-3.5 text-[13px] text-text-tertiary bg-transparent border-none cursor-pointer mt-1"
            >
              Or snap a single piece
            </button>
          </div>
        )}

        {/* Grid */}
        <div className="grid grid-cols-2 gap-2.5 px-5 mb-10">
          {filtered.map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(`/item/${item.id}`)}
              className="relative rounded-xl overflow-hidden cursor-pointer bg-card border-none card-press aspect-[3/4]"
            >
              <img src={item.image_url} alt={item.name} className="absolute inset-0 w-full h-full object-cover" />

              {/* Laundry badge */}
              {item.laundry_status === 'in_laundry' && (
                <span className="absolute top-1.5 left-1.5 text-[8px] font-bold uppercase tracking-wide bg-orange-500/85 text-white px-1.5 py-0.5 rounded-md z-10 flex items-center gap-1">
                  <Droplets size={10} /> Laundry
                </span>
              )}

              {/* Wear count */}
              <span className="absolute top-1.5 right-1.5 text-[9px] font-semibold bg-black/55 backdrop-blur-sm text-white/70 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                🔄 {item.times_worn}
              </span>

              {/* Label */}
              <div className="absolute bottom-0 left-0 right-0 pt-5 pb-2 px-2 bg-gradient-to-t from-black/75 to-transparent flex items-center gap-1.5">
                <span className="w-[7px] h-[7px] rounded-full shrink-0 border border-white/20" style={{ background: item.color_hex }} />
                <span className="text-[11px] font-medium text-white/90 truncate">{item.name}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* FAB */}
      <button
        onClick={() => navigate('/add-item')}
        className="absolute bottom-20 right-5 w-[52px] h-[52px] rounded-2xl bg-accent flex items-center justify-center cursor-pointer z-50 shadow-[0_4px_16px_rgba(200,139,110,0.35)] border-none active:scale-[0.92] transition-transform"
      >
        <Plus size={24} className="text-white" />
      </button>

      <BottomNav />
      <Toast message={toast} visible={!!toast} onHide={() => setToast('')} />
    </div>
  )
}
