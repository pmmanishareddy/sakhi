import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Camera, Image, Sparkles, Check, ChevronDown, RotateCcw, Images, X } from 'lucide-react'
import { Toast } from '../../components/Toast'
import { useAuth } from '../../lib/auth'
import { useWardrobe } from '../../lib/wardrobe-store'
import { analyzeItemPhoto, addWardrobeItem, fileToBase64 } from '../../lib/api'
import { pairsWith } from '../../lib/style-rules'

const CATEGORY_OPTIONS = ['T-Shirt', 'Top', 'Shirt', 'Blouse', 'Saree Blouse', 'Crop Top', 'Saree', 'Dress', 'Jumpsuit', 'Pants', 'Jeans', 'Shorts', 'Skirt', 'Leggings', 'Jacket', 'Blazer', 'Sweater', 'Hoodie', 'Kurta', 'Dupatta', 'Jewelry', 'Shoes', 'Sandals', 'Heels', 'Sneakers', 'Bags', 'Sunglasses', 'Watch', 'Belt', 'Scarf', 'Hat']
const COLOR_OPTIONS = [
  { name: 'Red', hex: '#E53935' }, { name: 'Blue', hex: '#1565C0' }, { name: 'Green', hex: '#2E7D32' },
  { name: 'Black', hex: '#333' }, { name: 'White', hex: '#F5F5F5' }, { name: 'Pink', hex: '#F06292' },
  { name: 'Gold', hex: '#FFD54F' }, { name: 'Teal', hex: '#00897B' }, { name: 'Brown', hex: '#8D6E63' },
  { name: 'Purple', hex: '#9B7EC8' }, { name: 'Orange', hex: '#FF9800' }, { name: 'Lime', hex: '#CDDC39' },
]
const PATTERN_OPTIONS = ['Solid', 'Printed', 'Woven', 'Embroidered', 'Striped', 'Checked', 'Floral']
const FORMALITY_OPTIONS = ['Casual', 'Smart Casual', 'Semi-Formal', 'Formal', 'Ethnic']
const OCCASION_OPTIONS = ['Office', 'Casual', 'Wedding', 'Festival', 'Date Night', 'Party', 'Travel', 'Brunch']

const ANALYSIS_STEPS = [
  'Detecting garment type...',
  'Identifying color palette...',
  'Analyzing pattern & fabric...',
  'Matching occasions...',
  'Finding wardrobe connections...',
]

export function AddItemScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { items, refresh } = useWardrobe()
  const fileRef = useRef<HTMLInputElement>(null)
  const pendingAnalysis = useRef<ReturnType<typeof analyzeItemPhoto> | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [step, setStep] = useState(0)
  const [analysisStep, setAnalysisStep] = useState(0)
  const [toast, setToast] = useState('')
  const [saving, setSaving] = useState(false)

  const [itemName, setItemName] = useState('')
  const [category, setCategory] = useState('')
  const [color, setColor] = useState('')
  const [colorHex, setColorHex] = useState('')
  const [pattern, setPattern] = useState('')
  const [formality, setFormality] = useState('')
  const [occasions, setOccasions] = useState<Set<string>>(new Set())
  const [fabric, setFabric] = useState('')
  const [brand, setBrand] = useState('')
  const [aiDescription, setAiDescription] = useState('')
  const [seasons, setSeasons] = useState<string[]>([])
  const [styleTags, setStyleTags] = useState<string[]>([])
  const [editingField, setEditingField] = useState<string | null>(null)

  const galleryRef = useRef<HTMLInputElement>(null)
  const prefillApplied = useRef(false)

  useEffect(() => {
    const state = location.state as { prefillPhoto?: File; prefillName?: string } | null
    if (state?.prefillPhoto && !prefillApplied.current) {
      prefillApplied.current = true
      setImageFile(state.prefillPhoto)
      setPreview(URL.createObjectURL(state.prefillPhoto))
      if (state.prefillName) setItemName(state.prefillName)
      setStep(1)
    }
  }, [location.state])

  // Batch upload state
  const batchRef = useRef<HTMLInputElement>(null)
  const [batchFiles, setBatchFiles] = useState<File[]>([])
  const [batchPreviews, setBatchPreviews] = useState<string[]>([])
  const [, setBatchIndex] = useState(0)
  const [batchResults, setBatchResults] = useState<Array<{ name: string; status: 'pending' | 'analyzing' | 'done' | 'error' }>>([])
  const [batchMode, setBatchMode] = useState(false)

  const handleBatchSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    setBatchFiles(files)
    setBatchPreviews(files.map(f => URL.createObjectURL(f)))
    setBatchResults(files.map(f => ({ name: f.name, status: 'pending' })))
    setBatchIndex(0)
    setBatchMode(true)
    setStep(10)
  }

  const removeBatchItem = (idx: number) => {
    setBatchFiles(f => f.filter((_, i) => i !== idx))
    setBatchPreviews(p => p.filter((_, i) => i !== idx))
    setBatchResults(r => r.filter((_, i) => i !== idx))
  }

  const startBatchUpload = async () => {
    setStep(11)
    for (let i = 0; i < batchFiles.length; i++) {
      setBatchIndex(i)
      setBatchResults(prev => prev.map((r, j) => j === i ? { ...r, status: 'analyzing' } : r))
      try {
        if (user) {
          const base64 = await fileToBase64(batchFiles[i])
          const analysis = await analyzeItemPhoto(base64, batchFiles[i].type)
          await addWardrobeItem({
            name: analysis.name,
            category: analysis.category,
            subcategory: analysis.subcategory || null,
            primary_color: analysis.primary_color,
            color_hex: analysis.color_hex,
            secondary_color: analysis.secondary_color || null,
            pattern: analysis.pattern,
            formality: analysis.formality,
            occasions: analysis.occasions || [],
            seasons: analysis.seasons || [],
            style_tags: analysis.style_tags || [],
            brand: analysis.brand || null,
            fabric: analysis.fabric || null,
            size: null,
            price: null,
            image_url: '',
            thumbnail_url: null,
            laundry_status: 'clean',
            ai_description: analysis.description || null,
          }, batchFiles[i])
          setBatchResults(prev => prev.map((r, j) => j === i ? { name: analysis.name, status: 'done' } : r))
        }
      } catch (err) {
        console.error(`Batch item ${i} failed:`, err)
        setBatchResults(prev => prev.map((r, j) => j === i ? { ...r, status: 'error' } : r))
      }
    }
    await refresh()
    setStep(12)
  }

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setPreview(URL.createObjectURL(file))
    // Start the AI analysis right away, while the user is still looking at
    // the preview. By the time they tap Analyze it's often already done.
    if (user) {
      const p = fileToBase64(file).then(b64 => analyzeItemPhoto(b64, file.type))
      p.catch(() => {})
      pendingAnalysis.current = p
    }
    setStep(1)
  }

  const handleCamera = () => {
    fileRef.current?.click()
  }

  const handleGallery = () => {
    galleryRef.current?.click()
  }

  const startAnalysis = async () => {
    setStep(2)
    setAnalysisStep(0)

    const stepTimer = ANALYSIS_STEPS.map((_, i) =>
      setTimeout(() => setAnalysisStep(i), i * 600)
    )

    try {
      if (user && imageFile) {
        const analysis = pendingAnalysis.current
          ? await pendingAnalysis.current
          : await fileToBase64(imageFile).then(b64 => analyzeItemPhoto(b64, imageFile.type))
        pendingAnalysis.current = null

        stepTimer.forEach(clearTimeout)
        setItemName(analysis.name)
        setCategory(analysis.category)
        setColor(analysis.primary_color)
        setColorHex(analysis.color_hex)
        setPattern(analysis.pattern)
        setFormality(analysis.formality)
        setOccasions(new Set(analysis.occasions))
        setFabric(analysis.fabric || '')
        setBrand(analysis.brand || '')
        setAiDescription(analysis.description || '')
        setSeasons(analysis.seasons || [])
        setStyleTags(analysis.style_tags || [])
        setStep(3)
        return
      }
    } catch (err) {
      stepTimer.forEach(clearTimeout)
      const msg = err instanceof Error ? err.message : 'Analysis failed'
      console.error('Analyze item error:', err)
      setToast(msg)
      setStep(1)
      return
    }

    // No user — show demo fallback
    setTimeout(() => {
      setItemName('Red Halter Dress')
      setCategory('Dress')
      setColor('Red')
      setColorHex('#E53935')
      setPattern('Solid')
      setFormality('Semi-Formal')
      setOccasions(new Set(['Date Night', 'Parties']))
      setStep(3)
    }, 3200)
  }

  const toggleOccasion = (o: string) => {
    const next = new Set(occasions)
    next.has(o) ? next.delete(o) : next.add(o)
    setOccasions(next)
  }

  const addToWardrobe = async () => {
    if (saving) return
    setSaving(true)

    try {
      if (user && imageFile) {
        await addWardrobeItem({
          name: itemName,
          category,
          subcategory: null,
          primary_color: color,
          color_hex: colorHex,
          secondary_color: null,
          pattern,
          formality,
          occasions: Array.from(occasions),
          seasons,
          style_tags: styleTags,
          brand: brand || null,
          fabric: fabric || null,
          size: null,
          price: null,
          image_url: '',
          thumbnail_url: null,
          laundry_status: 'clean',
          ai_description: aiDescription || null,
        }, imageFile)
        await refresh()
      }
    } catch (err) {
      console.error('Failed to add item:', err)
      setSaving(false)
      setToast(err instanceof Error ? err.message : 'Failed to add item')
      return
    }

    setToast(`${itemName || 'Item'} added to wardrobe!`)
    setTimeout(() => navigate('/wardrobe'), 1800)
  }

  const resetAll = () => {
    setPreview(null)
    setImageFile(null)
    setStep(0)
    setItemName('')
    setCategory('')
    setColor('')
    setColorHex('')
    setPattern('')
    setFormality('')
    setOccasions(new Set())
    setFabric('')
    setBrand('')
    setAiDescription('')
    setSeasons([])
    setStyleTags([])
    setEditingField(null)
    setSaving(false)
    setBatchMode(false)
    setBatchFiles([])
    setBatchPreviews([])
    setBatchResults([])
    setBatchIndex(0)
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-bg">
      <input ref={batchRef} type="file" accept="image/*" multiple className="hidden" onChange={handleBatchSelect} />
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />

      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2 shrink-0">
        <button onClick={() => step === 0 ? navigate(-1) : step === 12 ? navigate('/wardrobe') : resetAll()} className="flex items-center gap-1 text-sm text-text-secondary bg-transparent border-none cursor-pointer">
          <ArrowLeft size={18} /> {step === 0 ? 'Back' : step === 12 ? 'Wardrobe' : 'Start over'}
        </button>
        {step > 0 && step < 3 && (
          <span className="text-[11px] text-text-tertiary">Step {step} of 3</span>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* Step 0: Choose method */}
        {step === 0 && (
          <div className="px-7 animate-fade-up">
            <h1 className="text-[22px] font-bold tracking-tight mb-2">Add to wardrobe</h1>
            <p className="text-sm text-text-tertiary mb-8 leading-relaxed">Snap it or pick from your gallery. Sakhi handles the rest.</p>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleCamera}
                className="flex items-center gap-4 p-4 rounded-[16px] bg-accent-soft border-none cursor-pointer active:scale-[0.97] transition-transform text-left"
              >
                <div className="w-12 h-12 rounded-[14px] bg-accent flex items-center justify-center shrink-0">
                  <Camera size={22} className="text-white" />
                </div>
                <div>
                  <div className="text-[15px] font-semibold text-accent">Take a photo</div>
                  <div className="text-xs text-text-tertiary mt-1">Snap your item on any background</div>
                </div>
              </button>

              <button
                onClick={handleGallery}
                className="flex items-center gap-4 p-4 rounded-[16px] bg-card border-none cursor-pointer active:scale-[0.97] transition-transform text-left"
              >
                <div className="w-12 h-12 rounded-[14px] bg-white/[0.08] flex items-center justify-center shrink-0">
                  <Image size={22} className="text-text-primary" />
                </div>
                <div>
                  <div className="text-[15px] font-semibold text-text-primary">Choose from gallery</div>
                  <div className="text-xs text-text-tertiary mt-1">Pick an existing photo</div>
                </div>
              </button>

              <button
                onClick={() => batchRef.current?.click()}
                className="flex items-center gap-4 p-4 rounded-[16px] bg-card border-none cursor-pointer active:scale-[0.97] transition-transform text-left"
              >
                <div className="w-12 h-12 rounded-[14px] bg-white/[0.08] flex items-center justify-center shrink-0">
                  <Images size={22} className="text-text-primary" />
                </div>
                <div>
                  <div className="text-[15px] font-semibold text-text-primary">Batch upload</div>
                  <div className="text-xs text-text-tertiary mt-1">Select multiple photos at once</div>
                </div>
              </button>

            </div>
          </div>
        )}

        {/* Step 1: Photo preview */}
        {step === 1 && preview && (
          <div className="px-7 animate-fade-up">
            <h1 className="text-[22px] font-bold tracking-tight mb-2">Looking good?</h1>
            <p className="text-sm text-text-tertiary mb-5 leading-relaxed">Make sure the item is clearly visible.</p>

            <div className="rounded-[18px] overflow-hidden aspect-[3/4] max-h-[340px] mb-6 relative">
              <img src={preview} alt="Item preview" className="w-full h-full object-cover" />
              <button
                onClick={resetAll}
                className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-black/60 backdrop-blur-sm text-white text-xs font-medium border-none cursor-pointer"
              >
                <RotateCcw size={14} /> Retake
              </button>
            </div>

            <button
              onClick={startAnalysis}
              className="w-full py-4 rounded-[14px] text-[15px] font-semibold bg-accent text-white border-none cursor-pointer active:scale-[0.97] transition-transform flex items-center justify-center gap-2"
            >
              <Sparkles size={18} /> Analyze with Sakhi
            </button>
          </div>
        )}

        {/* Step 2: Analyzing */}
        {step === 2 && (
          <div className="flex-1 flex flex-col items-center justify-center px-7 pt-16 animate-fade-up">
            <div className="w-24 h-24 rounded-full bg-accent-soft flex items-center justify-center mb-8 animate-pulse">
              <Sparkles size={36} className="text-accent" />
            </div>

            <h2 className="text-xl font-bold mb-8">Analyzing your item...</h2>

            <div className="w-full flex flex-col gap-3">
              {ANALYSIS_STEPS.map((label, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                    i <= analysisStep ? 'bg-card' : 'opacity-0'
                  }`}
                  style={{ transitionDelay: `${i * 100}ms` }}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                    i < analysisStep ? 'bg-accent' : i === analysisStep ? 'bg-accent animate-pulse' : 'bg-white/[0.06]'
                  }`}>
                    {i < analysisStep ? (
                      <Check size={14} className="text-white" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-white/40" />
                    )}
                  </div>
                  <span className={`text-[13px] ${i <= analysisStep ? 'text-text-secondary' : 'text-text-tertiary'}`}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Confirm & Edit Tags */}
        {step === 3 && (
          <div className="px-7 pb-8 animate-fade-up">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center">
                <Check size={18} className="text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight">Sakhi identified your item</h1>
                <p className="text-[11px] text-text-tertiary">Tap any field to edit</p>
              </div>
            </div>

            {/* Photo + Name */}
            <div className="flex gap-4 mb-5">
              {preview && (
                <div className="w-24 h-32 rounded-[14px] overflow-hidden shrink-0">
                  <img src={preview} alt="" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <label className="text-[11px] text-text-tertiary mb-1.5 block">Item Name</label>
                <input
                  className="w-full bg-card border border-border rounded-xl px-3.5 py-3 text-[15px] font-semibold text-text-primary outline-none focus:border-accent transition-colors"
                  value={itemName}
                  onChange={e => setItemName(e.target.value)}
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
              value={Array.from(occasions).join(', ') || 'None selected'}
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

            {/* Wardrobe matches */}
            {items.length > 0 && category && (() => {
              const newItem = { name: itemName, category, primary_color: color, formality, occasions, style_tags: styleTags }
              const matching = items.filter(i => pairsWith(newItem, i))

              if (matching.length === 0) return null
              const names = matching.slice(0, 2).map(i => i.name).join(', ')
              return (
                <div className="mt-5 p-4 bg-accent-soft rounded-[16px]">
                  <div className="text-[13px] font-semibold text-accent mb-1">Pairs well with</div>
                  <div className="text-[12px] text-text-secondary leading-relaxed">
                    Goes great with {names}{matching.length > 2 ? ` and ${matching.length - 2} more` : ''} in your wardrobe.
                  </div>
                </div>
              )
            })()}

            <button
              onClick={addToWardrobe}
              disabled={!itemName.trim() || !category || saving}
              className="w-full mt-6 py-4 rounded-[14px] text-[15px] font-semibold bg-accent text-white border-none cursor-pointer active:scale-[0.97] transition-all disabled:opacity-35 disabled:pointer-events-none flex items-center justify-center gap-2"
            >
              <Check size={18} /> {saving ? 'Adding...' : 'Add to Wardrobe'}
            </button>

            <button
              onClick={resetAll}
              className="w-full py-3.5 text-[13px] text-text-tertiary bg-transparent border-none cursor-pointer mt-1"
            >
              Try a different photo
            </button>
          </div>
        )}

        {/* Step 10: Batch preview — review selected photos */}
        {step === 10 && batchMode && (
          <div className="px-6 animate-fade-up">
            <h1 className="text-[22px] font-bold tracking-tight mb-1">Batch upload</h1>
            <p className="text-sm text-text-tertiary mb-5">{batchFiles.length} item{batchFiles.length !== 1 ? 's' : ''} selected. Remove any you don't want.</p>

            <div className="grid grid-cols-3 gap-2 mb-6">
              {batchPreviews.map((src, i) => (
                <div key={i} className="relative aspect-square rounded-xl overflow-hidden">
                  <img src={src} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeBatchItem(i)}
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center border-none cursor-pointer"
                  >
                    <X size={13} className="text-white" />
                  </button>
                </div>
              ))}
            </div>

            {batchFiles.length > 0 && (
              <button
                onClick={startBatchUpload}
                className="w-full py-4 rounded-[14px] text-[15px] font-semibold bg-accent text-white border-none cursor-pointer active:scale-[0.97] transition-all flex items-center justify-center gap-2"
              >
                <Sparkles size={18} /> Analyze & Add All
              </button>
            )}
            <button
              onClick={resetAll}
              className="w-full py-3.5 text-[13px] text-text-tertiary bg-transparent border-none cursor-pointer mt-1"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Step 11: Batch processing */}
        {step === 11 && batchMode && (
          <div className="px-6 animate-fade-up">
            <h1 className="text-[22px] font-bold tracking-tight mb-1">Adding items...</h1>
            <p className="text-sm text-text-tertiary mb-5">
              {batchResults.filter(r => r.status === 'done').length} of {batchResults.length} done
            </p>

            <div className="flex flex-col gap-2.5">
              {batchResults.map((r, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-card rounded-[14px]">
                  <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0">
                    <img src={batchPreviews[i]} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-text-primary truncate">
                      {r.status === 'done' ? r.name : r.status === 'analyzing' ? 'Analyzing...' : r.status === 'error' ? 'Failed' : 'Waiting...'}
                    </div>
                    <div className="text-[11px] text-text-tertiary mt-0.5">
                      {r.status === 'done' ? 'Added' : r.status === 'analyzing' ? 'AI detecting item...' : r.status === 'error' ? 'Could not analyze' : 'In queue'}
                    </div>
                  </div>
                  <div className="shrink-0">
                    {r.status === 'done' && <Check size={16} className="text-green-400" />}
                    {r.status === 'analyzing' && <div className="w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />}
                    {r.status === 'error' && <X size={16} className="text-red-400" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 12: Batch complete */}
        {step === 12 && batchMode && (
          <div className="px-6 animate-fade-up text-center pt-8">
            <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-4">
              <Check size={28} className="text-green-400" />
            </div>
            <h1 className="text-[22px] font-bold tracking-tight mb-2">All done!</h1>
            <p className="text-sm text-text-tertiary mb-8">
              {batchResults.filter(r => r.status === 'done').length} item{batchResults.filter(r => r.status === 'done').length !== 1 ? 's' : ''} added to your wardrobe
              {batchResults.some(r => r.status === 'error') && `, ${batchResults.filter(r => r.status === 'error').length} failed`}
            </p>
            <button
              onClick={() => navigate('/wardrobe')}
              className="w-full py-4 rounded-[14px] text-[15px] font-semibold bg-accent text-white border-none cursor-pointer active:scale-[0.97] transition-all"
            >
              View Wardrobe
            </button>
            <button
              onClick={resetAll}
              className="w-full py-3.5 text-[13px] text-text-tertiary bg-transparent border-none cursor-pointer mt-1"
            >
              Add more items
            </button>
          </div>
        )}
      </div>

      <Toast message={toast} visible={!!toast} onHide={() => setToast('')} />
    </div>
  )
}

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
          <span className="text-[13px] font-medium text-text-primary">{value}</span>
          <ChevronDown size={14} className={`text-text-tertiary transition-transform ${isEditing ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {isEditing && children}
    </div>
  )
}
