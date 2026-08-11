import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Calendar, Users, Tag, Trash2, Pencil, X, Plus, Minus } from 'lucide-react'
import { Toast } from '../../components/Toast'
import { useWardrobe } from '../../lib/wardrobe-store'
import { fetchOutfitHistory, deleteOutfit, updateOutfit, addItemsToOutfit, removeItemFromOutfit, type OutfitWithItems, type OutfitItemSnapshot } from '../../lib/api'
import { byCoverPriority } from '../../lib/categories'

type DisplayItem = OutfitItemSnapshot & { id: string }

const OCCASIONS = ['Office', 'Casual', 'Party', 'Wedding', 'Date Night', 'Festival', 'Travel', 'Brunch']

export function OutfitDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { items, refresh } = useWardrobe()
  const [outfit, setOutfit] = useState<OutfitWithItems | null>(null)
  const [showDelete, setShowDelete] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editOccasion, setEditOccasion] = useState('')
  const [editItemIds, setEditItemIds] = useState<Set<string>>(new Set())
  const [showAddItems, setShowAddItems] = useState(false)
  const [toast, setToast] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchOutfitHistory().then(all => {
      const found = all.find(o => o.id === id)
      if (found) setOutfit(found)
    }).catch(() => {})
  }, [id])

  if (!outfit) {
    return (
      <div className="flex items-center justify-center h-full bg-bg">
        <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    )
  }

  const outfitItemIds = new Set(outfit.outfit_items.map(oi => oi.wardrobe_item_id))
  // Prefer the live wardrobe item; fall back to the joined snapshot for archived items
  const resolveItem = (itemId: string): DisplayItem | undefined => {
    const live = items.find(i => i.id === itemId)
    if (live) return live
    const snapshot = outfit.outfit_items.find(oi => oi.wardrobe_item_id === itemId)?.wardrobe_items
    return snapshot ? { id: itemId, ...snapshot } : undefined
  }
  const outfitItems = outfit.outfit_items
    .map(oi => resolveItem(oi.wardrobe_item_id))
    .filter(Boolean)

  const startEditing = () => {
    setEditOccasion(outfit.occasion)
    setEditItemIds(new Set(outfit.outfit_items.map(oi => oi.wardrobe_item_id)))
    setEditing(true)
  }

  const cancelEditing = () => {
    setEditing(false)
    setShowAddItems(false)
  }

  const toggleEditItem = (itemId: string) => {
    const next = new Set(editItemIds)
    if (next.has(itemId)) {
      if (next.size <= 1) return
      next.delete(itemId)
    } else {
      next.add(itemId)
    }
    setEditItemIds(next)
  }

  const saveEdits = async () => {
    if (!outfit) return
    setSaving(true)
    try {
      if (editOccasion !== outfit.occasion) {
        await updateOutfit(outfit.id, { occasion: editOccasion })
      }

      const originalIds = new Set(outfit.outfit_items.map(oi => oi.wardrobe_item_id))
      const toAdd = [...editItemIds].filter(id => !originalIds.has(id))
      const toRemove = [...originalIds].filter(id => !editItemIds.has(id))

      for (const itemId of toRemove) {
        await removeItemFromOutfit(outfit.id, itemId)
      }
      if (toAdd.length > 0) {
        await addItemsToOutfit(outfit.id, toAdd)
      }

      setOutfit({
        ...outfit,
        occasion: editOccasion,
        outfit_items: [...editItemIds].map(id =>
          outfit.outfit_items.find(oi => oi.wardrobe_item_id === id) ?? { wardrobe_item_id: id, wardrobe_items: null }
        ),
      })
      setEditing(false)
      setShowAddItems(false)
      setToast('Outfit updated')

      // Adding or removing an item fires the wear-count trigger server-side, so
      // times_worn / last_worn_at have changed. The wardrobe store only loads
      // once, so without this the grid and item detail keep showing the old
      // count until a full app reload.
      if (toAdd.length > 0 || toRemove.length > 0) refresh().catch(() => {})
    } catch {
      setToast('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const hasChanges = editing && (
    editOccasion !== outfit.occasion ||
    editItemIds.size !== outfitItemIds.size ||
    [...editItemIds].some(id => !outfitItemIds.has(id))
  )

  const displayItems = editing
    ? [...editItemIds].map(resolveItem).filter(Boolean)
    : outfitItems

  // The hero collage stands in for a missing outfit photo, so lead with the
  // pieces that define the look rather than whichever item was stored first
  const heroItems = byCoverPriority(displayItems.filter((i): i is DisplayItem => !!i))

  const addableItems = items.filter(i => !editItemIds.has(i.id))

  return (
    <div className="flex flex-col h-full min-h-0 bg-bg">
      {/* Hero */}
      <div className="relative h-[50vh] shrink-0">
        {outfit.image_url ? (
          <img src={outfit.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : heroItems.length > 0 ? (
          <div className={`absolute inset-0 grid ${heroItems.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} gap-0.5`}>
            {heroItems.slice(0, 4).map(item => (
              <div key={item.id} className="overflow-hidden">
                <img src={item.image_url} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        ) : (
          <div className="absolute inset-0 bg-card flex items-center justify-center">
            <span className="text-text-tertiary text-lg">No photo</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-transparent to-bg/60" />

        <button
          onClick={() => editing ? cancelEditing() : navigate(-1)}
          className="absolute top-4 left-4 w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center border-none cursor-pointer z-10"
        >
          {editing ? <X size={18} className="text-white" /> : <ArrowLeft size={18} className="text-white" />}
        </button>

        <div className="absolute top-4 right-4 flex gap-2 z-10">
          {!editing && (
            <>
              <button
                onClick={startEditing}
                className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center border-none cursor-pointer"
              >
                <Pencil size={15} className="text-white" />
              </button>
              <button
                onClick={() => setShowDelete(true)}
                className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center border-none cursor-pointer"
              >
                <Trash2 size={15} className="text-red-400" />
              </button>
            </>
          )}
        </div>

        <div className="absolute bottom-4 left-5 right-5">
          {editing ? (
            <div className="flex flex-wrap gap-1.5">
              {OCCASIONS.map(o => (
                <button
                  key={o}
                  onClick={() => setEditOccasion(o)}
                  className={`px-3 py-1.5 rounded-full text-[12px] font-semibold border-none cursor-pointer transition-all ${
                    editOccasion === o
                      ? 'bg-accent text-white'
                      : 'bg-black/40 backdrop-blur-sm text-white/70'
                  }`}
                >
                  {o}
                </button>
              ))}
            </div>
          ) : (
            <>
              <h1 className="text-[24px] font-bold tracking-tight text-white">{outfit.occasion}</h1>
              <div className="flex flex-wrap gap-3 mt-1.5 text-[12px] text-white/70">
                <span className="flex items-center gap-1">
                  <Calendar size={13} />
                  {new Date(outfit.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
                {outfit.event_name && (
                  <span className="flex items-center gap-1">
                    <Tag size={13} /> {outfit.event_name}
                  </span>
                )}
                {outfit.social_circles?.length > 0 && (
                  <span className="flex items-center gap-1">
                    <Users size={13} /> {outfit.social_circles.join(', ')}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="flex items-center justify-between px-6 pt-4 pb-3">
          <span className="text-[14px] font-semibold text-text-secondary">
            {editing ? 'Edit items' : 'Items worn'} ({displayItems.length})
          </span>
          {editing && (
            <button
              onClick={() => setShowAddItems(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] font-semibold bg-accent-soft text-accent border-none cursor-pointer"
            >
              <Plus size={13} /> Add
            </button>
          )}
        </div>

        <div className="flex flex-col gap-2 px-5 pb-4">
          {displayItems.map(item => (
            <div
              key={item!.id}
              className="flex items-center gap-3 p-2.5 bg-card rounded-[14px] text-left"
            >
              <div
                onClick={() => !editing && navigate(`/item/${item!.id}`)}
                className={`flex items-center gap-3 flex-1 min-w-0 ${!editing ? 'cursor-pointer' : ''}`}
              >
                <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0">
                  <img src={item!.image_url} alt={item!.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-text-primary truncate">{item!.name}</div>
                  <div className="text-[11px] text-text-tertiary mt-0.5">{item!.category} · {item!.primary_color}</div>
                </div>
              </div>
              {editing && (
                <button
                  onClick={() => toggleEditItem(item!.id)}
                  className="w-8 h-8 rounded-full bg-red-500/15 flex items-center justify-center border-none cursor-pointer shrink-0"
                >
                  <Minus size={14} className="text-red-400" />
                </button>
              )}
              {!editing && (
                <span className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/10" style={{ background: item!.color_hex }} />
              )}
            </div>
          ))}
          {displayItems.length === 0 && (
            <div className="py-6 text-center text-sm text-text-tertiary">
              No wardrobe items linked to this outfit
            </div>
          )}
        </div>

        {/* Save bar */}
        {editing && (
          <div className="px-5 pb-8">
            <button
              onClick={saveEdits}
              disabled={!hasChanges || saving}
              className="w-full py-3.5 rounded-[14px] text-[14px] font-semibold bg-accent text-white border-none cursor-pointer active:scale-[0.97] transition-transform disabled:opacity-35 disabled:pointer-events-none"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>

      {/* Add items sheet */}
      {showAddItems && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex flex-col justify-end">
          <div className="bg-bg rounded-t-2xl max-h-[70vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <span className="text-[15px] font-semibold text-text-primary">Add items</span>
              <button
                onClick={() => setShowAddItems(false)}
                className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center border-none cursor-pointer"
              >
                <X size={16} className="text-text-secondary" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3">
              {addableItems.length === 0 ? (
                <div className="py-8 text-center text-sm text-text-tertiary">All items already in this outfit</div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {addableItems.map(item => (
                    <button
                      key={item.id}
                      onClick={() => { toggleEditItem(item.id); setShowAddItems(false) }}
                      className="relative aspect-[3/4] rounded-xl overflow-hidden cursor-pointer bg-card border-none active:scale-[0.96] transition-transform"
                    >
                      <img src={item.image_url} alt={item.name} className="absolute inset-0 w-full h-full object-cover" />
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 pb-1.5 pt-4">
                        <div className="text-[10px] font-medium text-white truncate">{item.name}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {showDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-8">
          <div className="bg-card rounded-2xl p-6 w-full max-w-[300px] text-center">
            <div className="text-[15px] font-semibold text-text-primary mb-2">Delete this outfit?</div>
            <div className="text-[13px] text-text-tertiary mb-5">This can't be undone.</div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDelete(false)}
                className="flex-1 py-3 rounded-xl text-[13px] font-semibold bg-white/[0.06] text-text-secondary border-none cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    await deleteOutfit(outfit.id)
                    navigate('/')
                  } catch { setShowDelete(false) }
                }}
                className="flex-1 py-3 rounded-xl text-[13px] font-semibold bg-red-500/15 text-red-400 border-none cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast message={toast} visible={!!toast} onHide={() => setToast('')} />
    </div>
  )
}
