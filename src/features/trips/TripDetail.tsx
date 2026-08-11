import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, X, Check, Trash2, Loader2, Shirt, Camera, StickyNote } from 'lucide-react'
import {
  DndContext, closestCenter, TouchSensor, MouseSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Toast } from '../../components/Toast'
import { PickerFilters } from '../../components/PickerFilters'
import { useWardrobe } from '../../lib/wardrobe-store'
import { groupOf, matchesQuery, searchTerms, byCoverPriority } from '../../lib/categories'
import {
  fetchTrips, fetchOutfitHistory, addTripEntries, updateTripEntryNote,
  removeTripEntry, renameTrip, deleteTrip, reorderTripEntries,
  type Trip, type TripEntry, type OutfitWithItems,
} from '../../lib/api'

type Picker = null | 'item' | 'outfit'

export function TripDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { items } = useWardrobe()

  const [trip, setTrip] = useState<Trip | null>(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [picker, setPicker] = useState<Picker>(null)
  const [openEntry, setOpenEntry] = useState<TripEntry | null>(null)
  const [renaming, setRenaming] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const load = useCallback(async () => {
    try {
      const trips = await fetchTrips()
      setTrip(trips.find(t => t.id === id) ?? null)
    } catch {
      setToast('Could not load this list')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const handleAdd = async (target: { itemIds?: string[]; outfitIds?: string[] }) => {
    setPicker(null)
    try {
      // Land at the end so an addition never disturbs a hand-arranged order
      await addTripEntries(id!, target, trip?.entries.length ?? 0)
      await load()
    } catch {
      setToast('Could not add that. Try again.')
    }
  }

  // Touch and mouse are split deliberately. PointerSensor would have covered
  // both, but it also fires for touch, so a 6px finger movement would start a
  // drag and the grid could never be scrolled. TouchSensor's hold delay keeps
  // scrolling as the default gesture and a deliberate hold as the exception.
  const sensors = useSensors(
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    // Belt and braces for the same iOS problem: if a hold did manage to start a
    // selection, drop it here so the next drag starts from a clean slate
    window.getSelection()?.removeAllRanges()

    if (!over || active.id === over.id || !trip) return

    const from = trip.entries.findIndex(e => e.id === active.id)
    const to = trip.entries.findIndex(e => e.id === over.id)
    if (from < 0 || to < 0) return

    const reordered = arrayMove(trip.entries, from, to)
    const previous = trip.entries
    setTrip({ ...trip, entries: reordered })
    try {
      await reorderTripEntries(reordered.map(e => e.id))
    } catch {
      setToast('Could not save that order')
      setTrip(t => t && { ...t, entries: previous })
    }
  }

  const handleSaveNote = async (entryId: string, note: string) => {
    setOpenEntry(null)
    // Optimistic: the sheet closes immediately and the caption updates with it
    setTrip(t => t && { ...t, entries: t.entries.map(e => e.id === entryId ? { ...e, note: note.trim() || null } : e) })
    try {
      await updateTripEntryNote(entryId, note)
    } catch {
      setToast('Could not save that note')
      load()
    }
  }

  const handleRemove = async (entryId: string) => {
    setOpenEntry(null)
    setTrip(t => t && { ...t, entries: t.entries.filter(e => e.id !== entryId) })
    try {
      await removeTripEntry(entryId)
    } catch {
      setToast('Could not remove that')
      load()
    }
  }

  const handleRename = async () => {
    const next = titleDraft.trim()
    setRenaming(false)
    if (!next || !trip || next === trip.title) return
    setTrip({ ...trip, title: next })
    try {
      await renameTrip(trip.id, next)
    } catch {
      setToast('Could not rename that')
      load()
    }
  }

  const handleDeleteTrip = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return }
    try {
      await deleteTrip(id!)
      navigate('/trips')
    } catch {
      setToast('Could not delete that list')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={20} className="text-text-tertiary animate-spin" />
      </div>
    )
  }

  if (!trip) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-9 text-center">
        <p className="text-[14px] text-text-secondary mb-1">This list is gone</p>
        <button onClick={() => navigate('/trips')} className="text-[13px] text-accent bg-transparent border-none cursor-pointer mt-2">
          Back to planning
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header stays tight: every row it costs is a row of clothes you lose */}
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-2.5 shrink-0">
        <button
          onClick={() => navigate('/trips')}
          aria-label="Back"
          className="w-9 h-9 rounded-full bg-card flex items-center justify-center border-none cursor-pointer shrink-0"
        >
          <ArrowLeft size={18} className="text-text-secondary" />
        </button>

        {renaming ? (
          <input
            autoFocus
            value={titleDraft}
            onChange={e => setTitleDraft(e.target.value)}
            onBlur={handleRename}
            onKeyDown={e => e.key === 'Enter' && handleRename()}
            maxLength={40}
            aria-label="List name"
            className="flex-1 min-w-0 bg-transparent border-none outline-none text-[19px] font-bold tracking-tight text-text-primary"
          />
        ) : (
          <button
            onClick={() => { setTitleDraft(trip.title); setRenaming(true) }}
            className="flex-1 min-w-0 text-left bg-transparent border-none cursor-pointer p-0"
          >
            <div className="text-[19px] font-bold tracking-tight truncate">{trip.title}</div>
          </button>
        )}

        <button
          onClick={handleDeleteTrip}
          aria-label="Delete list"
          className={`shrink-0 h-9 rounded-full flex items-center justify-center border-none cursor-pointer ${
            confirmDelete ? 'px-3 bg-red-500/15 text-red-400 text-[12px] font-semibold' : 'w-9 bg-card'
          }`}
        >
          {confirmDelete ? 'Delete?' : <Trash2 size={16} className="text-text-tertiary" />}
        </button>
      </div>

      {/* The grid. Three across, no gradient overlay, note as a caption that
          collapses when there isn't one — density is the whole point here. */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4" onScroll={() => setConfirmDelete(false)}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={trip.entries.map(e => e.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-3 gap-1.5 items-start">
              {trip.entries.map(entry => (
                <SortableTile key={entry.id} entry={entry} onOpen={() => setOpenEntry(entry)} />
              ))}

              {/* Add lives in the grid so it costs no vertical space of its own.
                  Outside SortableContext: it is not a thing you can reorder. */}
              <button
                onClick={() => setPicker('item')}
                aria-label="Add to list"
                className="aspect-[4/5] rounded-lg border border-dashed border-white/12 bg-card/40 flex items-center justify-center cursor-pointer active:scale-[0.96] transition-transform"
              >
                <Plus size={20} className="text-text-tertiary" />
              </button>
            </div>
          </SortableContext>
        </DndContext>

        {trip.entries.length > 1 && (
          <p className="text-[11px] text-text-tertiary text-center mt-3">
            Hold a piece to move it
          </p>
        )}

        {trip.entries.length === 0 && (
          <p className="text-[12.5px] text-text-tertiary text-center leading-relaxed mt-6 px-6">
            Add pieces and looks you're considering, then note where each one is going.
          </p>
        )}
        <div className="h-8" />
      </div>

      {picker === 'item' && (
        <ItemPicker
          items={items}
          onCancel={() => setPicker(null)}
          onSwitch={() => setPicker('outfit')}
          onDone={itemIds => handleAdd({ itemIds })}
        />
      )}

      {picker === 'outfit' && (
        <OutfitPicker
          onCancel={() => setPicker(null)}
          onSwitch={() => setPicker('item')}
          onDone={outfitIds => handleAdd({ outfitIds })}
        />
      )}

      {openEntry && (
        <EntrySheet
          entry={openEntry}
          onClose={() => setOpenEntry(null)}
          onSave={handleSaveNote}
          onRemove={handleRemove}
        />
      )}

      <Toast message={toast} visible={!!toast} onHide={() => setToast('')} />
    </div>
  )
}

// ── One tile: tap to open, hold to move ──

function SortableTile({ entry, onOpen }: { entry: TripEntry; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: entry.id })

  return (
    <button
      ref={setNodeRef}
      onClick={onOpen}
      {...attributes}
      {...listeners}
      onContextMenu={e => e.preventDefault()}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        // Lifted tile rides above its neighbours while it moves
        zIndex: isDragging ? 10 : undefined,
        // Let the grid scroll normally; the sensor's hold delay claims the
        // gesture only once a drag has actually begun
        touchAction: 'manipulation',
      }}
      // .holdable carries the iOS long-press guards (see index.css)
      className={`holdable relative bg-transparent border-none p-0 cursor-pointer text-left transition-transform ${
        isDragging ? 'opacity-90 scale-[1.06]' : 'active:scale-[0.96]'
      }`}
    >
      <div className={`relative aspect-[4/5] rounded-lg overflow-hidden bg-card ${
        isDragging ? 'ring-2 ring-accent shadow-[0_10px_30px_rgba(0,0,0,0.55)]' : ''
      }`}>
        {entry.cover_url
          ? <img src={entry.cover_url} alt={entry.label} draggable={false} className="absolute inset-0 w-full h-full object-cover" />
          : <div className="absolute inset-0 flex items-center justify-center"><Shirt size={18} className="text-text-tertiary" /></div>}
        {entry.outfit_id && (
          <span className="absolute top-1 left-1 text-[8px] font-bold uppercase tracking-wide bg-black/60 text-white/80 px-1.5 py-0.5 rounded">
            Look
          </span>
        )}
      </div>
      {entry.note && (
        <div className="text-[10px] text-text-secondary leading-tight mt-1 truncate">{entry.note}</div>
      )}
    </button>
  )
}

// ── Entry sheet: the big photo and the note ──

function EntrySheet({ entry, onClose, onSave, onRemove }: {
  entry: TripEntry
  onClose: () => void
  onSave: (entryId: string, note: string) => void
  onRemove: (entryId: string) => void
}) {
  const [note, setNote] = useState(entry.note ?? '')
  const [confirmRemove, setConfirmRemove] = useState(false)

  return (
    <div className="fixed inset-0 z-[100] flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/55" />
      <div
        className="relative w-full bg-bg rounded-t-[24px] px-6 pt-5 animate-fade-up max-h-[92%] overflow-y-auto"
        style={{ paddingBottom: 'calc(1.75rem + env(safe-area-inset-bottom))' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Bigger than the grid tile it came from — tapping a piece should let
            you actually look at it, not shrink it */}
        <div className="relative w-full h-[30vh] rounded-2xl overflow-hidden bg-card mb-3.5">
          {entry.cover_url && <img src={entry.cover_url} alt="" className="w-full h-full object-cover" />}
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-black/55 backdrop-blur-sm flex items-center justify-center border-none cursor-pointer"
          >
            <X size={15} className="text-white" />
          </button>
        </div>

        <div className="text-[15px] font-bold text-text-primary leading-snug">{entry.label}</div>
        <div className="text-[11.5px] text-text-tertiary mt-0.5 mb-4">
          {entry.outfit_id ? 'A look you logged' : entry.wardrobe_items?.category}
        </div>

        <div className="flex items-center gap-1.5 mb-2">
          <StickyNote size={13} className="text-text-tertiary" />
          <span className="text-[12px] text-text-tertiary">Your note</span>
        </div>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          maxLength={120}
          rows={2}
          placeholder="Wear for Tuesday brunch"
          aria-label="Note"
          className="w-full bg-card rounded-xl px-3.5 py-3 border border-white/[0.06] outline-none text-[13px] text-text-primary placeholder:text-text-tertiary resize-none leading-relaxed"
        />

        <button
          onClick={() => onSave(entry.id, note)}
          className="w-full mt-3 py-3.5 rounded-[14px] text-[14px] font-semibold bg-accent text-white border-none cursor-pointer active:scale-[0.97] transition-all flex items-center justify-center gap-2"
        >
          <Check size={15} /> Save note
        </button>

        <button
          onClick={() => confirmRemove ? onRemove(entry.id) : setConfirmRemove(true)}
          className={`w-full py-3 text-[12px] bg-transparent border-none cursor-pointer ${
            confirmRemove ? 'text-red-400 font-semibold' : 'text-text-tertiary'
          }`}
        >
          {confirmRemove ? 'Tap again to remove' : 'Remove from list'}
        </button>
      </div>
    </div>
  )
}

// ── Pickers ──

function PickerShell({ title, otherLabel, count, onCancel, onSwitch, onDone, children }: {
  title: string
  otherLabel: string
  count: number
  onCancel: () => void
  onSwitch: () => void
  onDone: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-[100] bg-bg flex flex-col">
      <div className="flex items-center justify-between px-5 pt-4 pb-3 shrink-0">
        <button onClick={onCancel} aria-label="Cancel" className="w-9 h-9 rounded-full bg-card flex items-center justify-center border-none cursor-pointer">
          <X size={17} className="text-text-secondary" />
        </button>
        <span className="text-[15px] font-bold">{title}</span>
        <button onClick={onSwitch} className="text-[12px] font-semibold text-accent bg-transparent border-none cursor-pointer">
          {otherLabel}
        </button>
      </div>

      {children}

      <div className="px-5 pt-2 shrink-0" style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}>
        <button
          onClick={onDone}
          disabled={count === 0}
          className="w-full py-3.5 rounded-[14px] text-[14px] font-semibold bg-accent text-white border-none cursor-pointer disabled:opacity-35 disabled:pointer-events-none"
        >
          {count === 0 ? 'Pick something' : `Add ${count}`}
        </button>
      </div>
    </div>
  )
}

function ItemPicker({ items, onCancel, onSwitch, onDone }: {
  items: ReturnType<typeof useWardrobe>['items']
  onCancel: () => void
  onSwitch: () => void
  onDone: (ids: string[]) => void
}) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [picked, setPicked] = useState<Set<string>>(new Set())

  const categories = useMemo(
    () => [...new Set(items.map(i => groupOf(i.category)))],
    [items]
  )
  const terms = searchTerms(query)
  const shown = items.filter(i =>
    (!category || groupOf(i.category) === category) && matchesQuery(i, terms)
  )

  const toggle = (id: string) => setPicked(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  return (
    <PickerShell
      title="Add a piece"
      otherLabel="Add a look"
      count={picked.size}
      onCancel={onCancel}
      onSwitch={onSwitch}
      onDone={() => onDone([...picked])}
    >
      <PickerFilters query={query} setQuery={setQuery} category={category} setCategory={setCategory} categories={categories} />
      <div className="flex-1 min-h-0 overflow-y-auto">
        {shown.length === 0 ? (
          <p className="px-7 py-10 text-center text-[13px] text-text-tertiary">Nothing matches that.</p>
        ) : (
          <div className="grid grid-cols-3 gap-1.5 px-4">
            {shown.map(item => (
              <button
                key={item.id}
                onClick={() => toggle(item.id)}
                className="relative aspect-[4/5] rounded-lg overflow-hidden bg-card border-none cursor-pointer active:scale-[0.96] transition-transform"
              >
                <img src={item.image_url} alt={item.name} className="absolute inset-0 w-full h-full object-cover" />
                {picked.has(item.id) && (
                  <>
                    <div className="absolute inset-0 bg-accent/30" />
                    <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-accent flex items-center justify-center">
                      <Check size={12} className="text-white" />
                    </div>
                  </>
                )}
              </button>
            ))}
          </div>
        )}
        <div className="h-4" />
      </div>
    </PickerShell>
  )
}

function OutfitPicker({ onCancel, onSwitch, onDone }: {
  onCancel: () => void
  onSwitch: () => void
  onDone: (ids: string[]) => void
}) {
  const { items } = useWardrobe()
  const [outfits, setOutfits] = useState<OutfitWithItems[]>([])
  const [loading, setLoading] = useState(true)
  const [picked, setPicked] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchOutfitHistory()
      .then(setOutfits)
      .catch(() => setOutfits([]))
      .finally(() => setLoading(false))
  }, [])

  const toggle = (id: string) => setPicked(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  // Same fallback as the home screen: a look with no photo shows its pieces
  const coverOf = (o: OutfitWithItems): string | undefined => {
    if (o.image_url) return o.image_url
    const cells = o.outfit_items.flatMap(oi => {
      const live = items.find(i => i.id === oi.wardrobe_item_id)
      const image_url = live?.image_url || oi.wardrobe_items?.image_url
      const category = live?.category || oi.wardrobe_items?.category
      return image_url ? [{ image_url, category: category || '' }] : []
    })
    return byCoverPriority(cells)[0]?.image_url
  }

  return (
    <PickerShell
      title="Add a look"
      otherLabel="Add a piece"
      count={picked.size}
      onCancel={onCancel}
      onSwitch={onSwitch}
      onDone={() => onDone([...picked])}
    >
      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 size={18} className="text-text-tertiary animate-spin" /></div>
        ) : outfits.length === 0 ? (
          <div className="px-8 py-12 text-center">
            <Camera size={22} className="text-text-tertiary mx-auto mb-3" />
            <p className="text-[13px] text-text-tertiary leading-relaxed">
              You haven't logged any outfits yet. Log one and it'll show up here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5 px-4">
            {outfits.map(o => {
              const cover = coverOf(o)
              return (
                <button
                  key={o.id}
                  onClick={() => toggle(o.id)}
                  className="relative aspect-[4/5] rounded-lg overflow-hidden bg-card border-none cursor-pointer active:scale-[0.96] transition-transform"
                >
                  {cover
                    ? <img src={cover} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    : <div className="absolute inset-0 flex items-center justify-center"><Shirt size={16} className="text-text-tertiary" /></div>}
                  <div className="absolute bottom-0 left-0 right-0 pt-4 pb-1 px-1.5 bg-gradient-to-t from-black/75 to-transparent">
                    <div className="text-[9px] font-semibold text-white/90 truncate">{o.occasion}</div>
                  </div>
                  {picked.has(o.id) && (
                    <>
                      <div className="absolute inset-0 bg-accent/30" />
                      <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-accent flex items-center justify-center">
                        <Check size={12} className="text-white" />
                      </div>
                    </>
                  )}
                </button>
              )
            })}
          </div>
        )}
        <div className="h-4" />
      </div>
    </PickerShell>
  )
}
