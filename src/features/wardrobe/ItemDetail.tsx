import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Droplets, Pencil, Trash2, Check, ChevronDown, X, PenLine } from 'lucide-react'
import { Toast } from '../../components/Toast'
import { useWardrobe } from '../../lib/wardrobe-store'
import { toggleLaundryStatus, deleteWardrobeItem, updateWardrobeItem } from '../../lib/api'
import { useAuth } from '../../lib/auth'

const CATEGORY_OPTIONS = ['T-Shirt', 'Top', 'Shirt', 'Blouse', 'Saree Blouse', 'Crop Top', 'Saree', 'Dress', 'Jumpsuit', 'Pants', 'Jeans', 'Shorts', 'Skirt', 'Leggings', 'Jacket', 'Blazer', 'Sweater', 'Hoodie', 'Kurta', 'Dupatta', 'Jewelry', 'Shoes', 'Sandals', 'Heels', 'Sneakers', 'Bags', 'Sunglasses', 'Watch', 'Belt', 'Scarf', 'Hat']
const COLOR_OPTIONS = [
  { name: 'Red', hex: '#E53935' }, { name: 'Blue', hex: '#1565C0' }, { name: 'Green', hex: '#2E7D32' },
  { name: 'Black', hex: '#333' }, { name: 'White', hex: '#F5F5F5' }, { name: 'Pink', hex: '#F06292' },
  { name: 'Gold', hex: '#FFD54F' }, { name: 'Teal', hex: '#00897B' }, { name: 'Brown', hex: '#8D6E63' },
  { name: 'Purple', hex: '#9B7EC8' }, { name: 'Orange', hex: '#FF9800' }, { name: 'Lime', hex: '#CDDC39' },
  { name: 'Maroon', hex: '#880E4F' }, { name: 'Navy', hex: '#1A237E' }, { name: 'Mint', hex: '#A5D6A7' },
]
const PATTERN_OPTIONS = ['Solid', 'Printed', 'Woven', 'Embroidered', 'Striped', 'Checked', 'Floral', 'Lace', 'Abstract']
const FORMALITY_OPTIONS = ['Casual', 'Smart Casual', 'Semi-Formal', 'Formal', 'Ethnic']
const OCCASION_OPTIONS = ['Office', 'Casual', 'Weddings', 'Festivals', 'Date Night', 'Parties', 'Travel', 'Brunch']

export function ItemDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { items, refresh } = useWardrobe()
  const { user } = useAuth()
  const item = items.find(i => i.id === id)
  const [laundry, setLaundry] = useState(item?.laundry_status === 'in_laundry')
  const [toast, setToast] = useState('')
  const [showDelete, setShowDelete] = useState(false)
  const [editing, setEditing] = useState(false)

  if (!item) return null

  const handleToggleLaundry = async () => {
    const newStatus = laundry ? 'clean' : 'in_laundry'
    setLaundry(!laundry)
    setToast(laundry ? 'Marked as clean' : 'Marked as in laundry')
    if (user) {
      try {
        await toggleLaundryStatus(item.id, newStatus as 'clean' | 'in_laundry')
        refresh()
      } catch { /* optimistic update already applied */ }
    }
  }

  const handleDelete = async () => {
    setShowDelete(false)
    setToast('Item deleted')
    if (user) {
      try {
        await deleteWardrobeItem(item.id)
        refresh()
      } catch { /* navigate anyway */ }
    }
    setTimeout(() => navigate('/wardrobe'), 1500)
  }

  const cpw = item.price && item.times_worn > 0
    ? `₹${Math.round(item.price / item.times_worn)}`
    : item.price ? `₹${item.price}` : 'Not added'

  const lastWorn = item.last_worn_at
    ? new Date(item.last_worn_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : 'Not added'

  if (editing) {
    return (
      <EditItemView
        item={item}
        user={user}
        refresh={refresh}
        onClose={() => setEditing(false)}
        onSaved={(msg) => { setEditing(false); setToast(msg) }}
      />
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0 overflow-y-auto bg-bg">
      {/* Back */}
      <button onClick={() => navigate('/wardrobe')} className="flex items-center gap-1 px-5 py-3 text-sm text-text-secondary bg-transparent border-none cursor-pointer">
        <ArrowLeft size={18} /> Wardrobe
      </button>

      {/* Hero photo */}
      <div className="mx-5 rounded-[18px] aspect-[3/4] max-h-[340px] overflow-hidden relative">
        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
        {laundry && (
          <div className="absolute top-3 left-3 text-[11px] font-semibold bg-orange-500/90 text-white px-3 py-1.5 rounded-lg flex items-center gap-1">
            <Droplets size={14} /> In Laundry
          </div>
        )}
      </div>

      {/* Info */}
      <div className="px-6 pt-4">
        <h1 className="text-xl font-bold tracking-tight mb-2">{item.name}</h1>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {[
            { label: item.category },
            { label: item.primary_color, dot: item.color_hex },
            { label: item.pattern },
            { label: item.formality },
          ].map((tag, i) => (
            <span key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-card text-xs text-text-secondary">
              {tag.dot && <span className="w-2.5 h-2.5 rounded-full border border-white/15" style={{ background: tag.dot }} />}
              {tag.label}
            </span>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="flex mx-6 mt-3 mb-4 bg-card rounded-[14px] overflow-hidden">
        {[
          { val: String(item.times_worn), label: 'Times Worn' },
          { val: lastWorn, label: 'Last Worn' },
          { val: cpw, label: 'Cost/Wear' },
        ].map((s, i) => (
          <div key={i} className="flex-1 flex flex-col items-center justify-center py-3.5 border-l border-white/[0.06] first:border-l-0">
            <span className="text-[10px] text-text-tertiary uppercase tracking-wide block">{s.label}</span>
            <span className="text-[17px] font-bold text-white block mt-1">{s.val}</span>
          </div>
        ))}
      </div>

      {/* Actions */}
      {/* Log as outfit */}
      <div className="px-5 mb-2">
        <button
          onClick={() => navigate(`/log-outfit?itemId=${item.id}`)}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-[14px] text-[13px] font-semibold bg-accent text-white border-none cursor-pointer active:scale-[0.97] transition-transform"
        >
          <PenLine size={16} /> Log as Outfit
        </button>
      </div>

      <div className="flex gap-2 px-5">
        <button
          onClick={handleToggleLaundry}
          className="flex-1 flex items-center justify-center gap-1.5 py-3.5 rounded-[14px] text-[13px] font-semibold border-none cursor-pointer active:scale-[0.97] transition-transform bg-orange-500/10 text-orange-400"
        >
          {laundry ? <Check size={16} /> : <Droplets size={16} />}
          {laundry ? 'Mark Clean' : 'Laundry'}
        </button>
        <button
          onClick={() => setEditing(true)}
          className="flex-1 flex items-center justify-center gap-1.5 py-3.5 rounded-[14px] text-[13px] font-semibold bg-card text-text-primary border-none cursor-pointer active:scale-[0.97] transition-transform"
        >
          <Pencil size={16} /> Edit
        </button>
        <button
          onClick={() => setShowDelete(true)}
          className="flex-[0.5] flex items-center justify-center py-3.5 rounded-[14px] text-[13px] font-semibold bg-danger/[0.08] text-danger border-none cursor-pointer active:scale-[0.97] transition-transform"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Extra details */}
      <div className="px-6 pt-4 pb-8">
        {[
          { label: 'Brand', val: item.brand || 'Not added' },
          { label: 'Size', val: item.size || 'Not added' },
          { label: 'Fabric', val: item.fabric || 'Not added' },
          { label: 'Purchase Price', val: item.price ? `₹${item.price}` : 'Not added' },
          { label: 'Added', val: new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) },
        ].map((row, i) => (
          <div key={i} className="flex justify-between items-center py-3 border-b border-white/[0.04] last:border-b-0">
            <span className="text-[13px] text-text-tertiary">{row.label}</span>
            <span className="text-[13px] font-medium text-text-secondary">{row.val}</span>
          </div>
        ))}
      </div>

      {/* Delete modal */}
      {showDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] px-8" onClick={() => setShowDelete(false)}>
          <div className="bg-card rounded-2xl p-6 w-full max-w-[300px] text-center" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center mx-auto mb-3">
              <Trash2 size={22} className="text-danger" />
            </div>
            <h3 className="text-base font-bold mb-1.5">Delete this item?</h3>
            <p className="text-[13px] text-text-tertiary mb-5 leading-relaxed">This will remove it from your wardrobe and all outfit logs.</p>
            <div className="flex gap-2.5">
              <button onClick={() => setShowDelete(false)} className="flex-1 py-3 rounded-xl text-sm font-semibold bg-white/[0.06] text-text-secondary border-none cursor-pointer">Cancel</button>
              <button
                onClick={handleDelete}
                className="flex-1 py-3 rounded-xl text-sm font-semibold bg-danger text-white border-none cursor-pointer"
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

// ── Edit View ──

import type { DbWardrobeItem } from '../../lib/api'
import type { User } from '@supabase/supabase-js'

function EditItemView({ item, user, refresh, onClose, onSaved }: {
  item: DbWardrobeItem
  user: User | null
  refresh: () => Promise<void>
  onClose: () => void
  onSaved: (msg: string) => void
}) {
  const [name, setName] = useState(item.name)
  const [category, setCategory] = useState(item.category)
  const [color, setColor] = useState(item.primary_color)
  const [colorHex, setColorHex] = useState(item.color_hex)
  const [pattern, setPattern] = useState(item.pattern)
  const [formality, setFormality] = useState(item.formality)
  const [occasions, setOccasions] = useState<Set<string>>(new Set(item.occasions))
  const [brand, setBrand] = useState(item.brand || '')
  const [fabric, setFabric] = useState(item.fabric || '')
  const [size, setSize] = useState(item.size || '')
  const [price, setPrice] = useState(item.price ? String(item.price) : '')
  const [editingField, setEditingField] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const toggleOccasion = (o: string) => {
    const next = new Set(occasions)
    next.has(o) ? next.delete(o) : next.add(o)
    setOccasions(next)
  }

  const hasChanges =
    name !== item.name ||
    category !== item.category ||
    color !== item.primary_color ||
    colorHex !== item.color_hex ||
    pattern !== item.pattern ||
    formality !== item.formality ||
    brand !== (item.brand || '') ||
    fabric !== (item.fabric || '') ||
    size !== (item.size || '') ||
    price !== (item.price ? String(item.price) : '') ||
    !setsEqual(occasions, new Set(item.occasions))

  const handleSave = async () => {
    if (saving) return
    setSaving(true)

    if (user) {
      try {
        await updateWardrobeItem(item.id, {
          name,
          category,
          primary_color: color,
          color_hex: colorHex,
          pattern,
          formality,
          occasions: Array.from(occasions),
          brand: brand || null,
          fabric: fabric || null,
          size: size || null,
          price: price ? parseFloat(price) : null,
        })
        await refresh()
      } catch {
        setSaving(false)
        return
      }
    }

    onSaved('Item updated')
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-bg">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2 shrink-0">
        <button onClick={onClose} className="flex items-center gap-1 text-sm text-text-secondary bg-transparent border-none cursor-pointer">
          <X size={18} /> Cancel
        </button>
        <span className="text-[15px] font-semibold text-text-primary">Edit Item</span>
        <button
          onClick={handleSave}
          disabled={!hasChanges || !name.trim() || !category || saving}
          className="text-sm font-semibold text-accent bg-transparent border-none cursor-pointer disabled:opacity-35 disabled:pointer-events-none"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-7 pb-8 animate-fade-up">
          {/* Photo + Name */}
          <div className="flex gap-4 mb-5 mt-2">
            <div className="w-24 h-32 rounded-[14px] overflow-hidden shrink-0">
              <img src={item.image_url} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <label className="text-[11px] text-text-tertiary mb-1.5 block">Item Name</label>
              <input
                className="w-full bg-card border border-border rounded-xl px-3.5 py-3 text-[15px] font-semibold text-text-primary outline-none focus:border-accent transition-colors"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
          </div>

          {/* Category */}
          <TagField
            label="Category"
            value={category}
            isEditing={editingField === 'category'}
            onTap={() => setEditingField(editingField === 'category' ? null : 'category')}
          >
            <div className="flex flex-wrap gap-2 pt-2">
              {CATEGORY_OPTIONS.map(c => (
                <button
                  key={c}
                  onClick={() => { setCategory(c); setEditingField(null) }}
                  className={`px-3 py-2 rounded-xl text-xs font-medium border-none cursor-pointer transition-colors ${
                    category === c ? 'bg-accent text-white' : 'bg-white/[0.06] text-text-secondary'
                  }`}
                >{c}</button>
              ))}
            </div>
          </TagField>

          {/* Color */}
          <TagField
            label="Color"
            value={color}
            colorDot={colorHex}
            isEditing={editingField === 'color'}
            onTap={() => setEditingField(editingField === 'color' ? null : 'color')}
          >
            <div className="flex flex-wrap gap-2 pt-2">
              {COLOR_OPTIONS.map(c => (
                <button
                  key={c.name}
                  onClick={() => { setColor(c.name); setColorHex(c.hex); setEditingField(null) }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border-none cursor-pointer transition-colors ${
                    color === c.name ? 'bg-accent text-white' : 'bg-white/[0.06] text-text-secondary'
                  }`}
                >
                  <span className="w-3 h-3 rounded-full border border-white/20" style={{ background: c.hex }} />
                  {c.name}
                </button>
              ))}
            </div>
          </TagField>

          {/* Pattern */}
          <TagField
            label="Pattern"
            value={pattern}
            isEditing={editingField === 'pattern'}
            onTap={() => setEditingField(editingField === 'pattern' ? null : 'pattern')}
          >
            <div className="flex flex-wrap gap-2 pt-2">
              {PATTERN_OPTIONS.map(p => (
                <button
                  key={p}
                  onClick={() => { setPattern(p); setEditingField(null) }}
                  className={`px-3 py-2 rounded-xl text-xs font-medium border-none cursor-pointer transition-colors ${
                    pattern === p ? 'bg-accent text-white' : 'bg-white/[0.06] text-text-secondary'
                  }`}
                >{p}</button>
              ))}
            </div>
          </TagField>

          {/* Formality */}
          <TagField
            label="Formality"
            value={formality}
            isEditing={editingField === 'formality'}
            onTap={() => setEditingField(editingField === 'formality' ? null : 'formality')}
          >
            <div className="flex flex-wrap gap-2 pt-2">
              {FORMALITY_OPTIONS.map(f => (
                <button
                  key={f}
                  onClick={() => { setFormality(f); setEditingField(null) }}
                  className={`px-3 py-2 rounded-xl text-xs font-medium border-none cursor-pointer transition-colors ${
                    formality === f ? 'bg-accent text-white' : 'bg-white/[0.06] text-text-secondary'
                  }`}
                >{f}</button>
              ))}
            </div>
          </TagField>

          {/* Occasions */}
          <TagField
            label="Occasions"
            value={occasions.size > 0 ? Array.from(occasions).join(', ') : 'None selected'}
            isEditing={editingField === 'occasions'}
            onTap={() => setEditingField(editingField === 'occasions' ? null : 'occasions')}
          >
            <div className="flex flex-wrap gap-2 pt-2">
              {OCCASION_OPTIONS.map(o => (
                <button
                  key={o}
                  onClick={() => toggleOccasion(o)}
                  className={`px-3 py-2 rounded-xl text-xs font-medium border-none cursor-pointer transition-colors ${
                    occasions.has(o) ? 'bg-accent text-white' : 'bg-white/[0.06] text-text-secondary'
                  }`}
                >{o}</button>
              ))}
            </div>
          </TagField>

          {/* Text fields */}
          <div className="flex flex-col gap-2.5 mt-1">
            <TextRow label="Brand" value={brand} onChange={setBrand} placeholder="e.g. Zara, Handloom" />
            <TextRow label="Fabric" value={fabric} onChange={setFabric} placeholder="e.g. Silk, Cotton, Linen" />
            <TextRow label="Size" value={size} onChange={setSize} placeholder="e.g. S, M, L, 38" />
            <TextRow label="Price (₹)" value={price} onChange={setPrice} placeholder="e.g. 299" inputMode="decimal" />
          </div>

          {/* Save button (bottom) */}
          <button
            onClick={handleSave}
            disabled={!hasChanges || !name.trim() || !category || saving}
            className="w-full mt-6 py-4 rounded-[14px] text-[15px] font-semibold bg-accent text-white border-none cursor-pointer active:scale-[0.97] transition-all disabled:opacity-35 disabled:pointer-events-none flex items-center justify-center gap-2"
          >
            <Check size={18} /> {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Shared components ──

function TagField({ label, value, colorDot, isEditing, onTap, children }: {
  label: string
  value: string
  colorDot?: string
  isEditing: boolean
  onTap: () => void
  children: React.ReactNode
}) {
  return (
    <div className={`mb-2.5 rounded-[14px] transition-colors ${isEditing ? 'bg-card p-4' : ''}`}>
      <button
        onClick={onTap}
        className="w-full flex justify-between items-center bg-card rounded-[14px] px-4 py-3.5 border-none cursor-pointer text-left"
        style={isEditing ? { background: 'transparent', padding: '0 0 4px 0' } : {}}
      >
        <span className="text-[13px] text-text-tertiary">{label}</span>
        <span className="flex items-center gap-2">
          {colorDot && <span className="w-3 h-3 rounded-full border border-white/15" style={{ background: colorDot }} />}
          <span className="text-[13px] font-medium text-text-primary truncate max-w-[160px]">{value}</span>
          <ChevronDown size={14} className={`text-text-tertiary transition-transform ${isEditing ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {isEditing && children}
    </div>
  )
}

function TextRow({ label, value, onChange, placeholder, inputMode }: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  inputMode?: 'text' | 'decimal'
}) {
  return (
    <div className="flex items-center gap-3 bg-card rounded-[14px] px-4 py-3">
      <span className="text-[13px] text-text-tertiary w-20 shrink-0">{label}</span>
      <input
        className="flex-1 bg-transparent text-[13px] font-medium text-text-primary outline-none border-none text-right"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode || 'text'}
      />
    </div>
  )
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false
  for (const v of a) if (!b.has(v)) return false
  return true
}
