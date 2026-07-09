import { useState, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Camera, Image, LayoutGrid, Check, X, Plus, Calendar, Sparkles } from 'lucide-react'
import { Toast } from '../../components/Toast'
import { useWardrobe } from '../../lib/wardrobe-store'
import { useAuth } from '../../lib/auth'
import { matchOutfitPhoto, logOutfit as logOutfitApi, fileToBase64, uploadImage, updateOutfit, fetchCircles, addWardrobeItem, addItemsToOutfit, type MatchResult, type DbSocialCircle } from '../../lib/api'

const OCCASIONS = ['Office', 'Casual', 'Party', 'Wedding', 'Date', 'Brunch', 'Festival']
const DEFAULT_CIRCLES = ['Work team', 'College friends', 'Family', 'Partner']

function CropView({ imageUrl, itemName, onDone, onCancel }: {
  imageUrl: string; itemName: string; onDone: (file: File) => void; onCancel: () => void
}) {
  const imgRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [imgBounds, setImgBounds] = useState({ x: 0, y: 0, w: 0, h: 0 })
  const [crop, setCrop] = useState({ x: 0, y: 0, size: 100 })
  const [drag, setDrag] = useState<null | {
    mode: 'move' | 'resize'; startX: number; startY: number; origX: number; origY: number; origSize: number
  }>(null)

  const pos = (e: React.TouchEvent | React.MouseEvent) =>
    'touches' in e && e.touches.length ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
    : 'clientX' in e ? { x: (e as React.MouseEvent).clientX, y: (e as React.MouseEvent).clientY }
    : { x: 0, y: 0 }

  const onImgLoad = () => {
    const img = imgRef.current!
    const c = containerRef.current!.getBoundingClientRect()
    const ia = img.naturalWidth / img.naturalHeight, ca = c.width / c.height
    const [rw, rh, rx, ry] = ia > ca
      ? [c.width, c.width / ia, 0, (c.height - c.width / ia) / 2]
      : [c.height * ia, c.height, (c.width - c.height * ia) / 2, 0]
    setImgBounds({ x: rx, y: ry, w: rw, h: rh })
    const s = Math.min(rw, rh) * 0.45
    setCrop({ x: rx + (rw - s) / 2, y: ry + (rh - s) / 2, size: s })
  }

  const startMove = (e: React.TouchEvent | React.MouseEvent) => {
    const p = pos(e)
    setDrag({ mode: 'move', startX: p.x, startY: p.y, origX: crop.x, origY: crop.y, origSize: crop.size })
  }
  const startResize = (e: React.TouchEvent | React.MouseEvent) => {
    e.stopPropagation()
    const p = pos(e)
    setDrag({ mode: 'resize', startX: p.x, startY: p.y, origX: crop.x, origY: crop.y, origSize: crop.size })
  }

  const onMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!drag) return
    const p = pos(e)
    const dx = p.x - drag.startX, dy = p.y - drag.startY
    if (drag.mode === 'move') {
      setCrop(c => ({
        ...c,
        x: Math.max(imgBounds.x, Math.min(drag.origX + dx, imgBounds.x + imgBounds.w - drag.origSize)),
        y: Math.max(imgBounds.y, Math.min(drag.origY + dy, imgBounds.y + imgBounds.h - drag.origSize)),
      }))
    } else {
      const delta = Math.max(dx, dy)
      const maxS = Math.min(imgBounds.x + imgBounds.w - drag.origX, imgBounds.y + imgBounds.h - drag.origY)
      setCrop(c => ({ ...c, size: Math.max(60, Math.min(drag.origSize + delta, maxS)) }))
    }
  }

  const doCrop = () => {
    try {
      const img = imgRef.current!
      if (!imgBounds.w || !imgBounds.h) { onDone(null as any); return }
      const scale = img.naturalWidth / imgBounds.w
      const sx = (crop.x - imgBounds.x) * scale, sy = (crop.y - imgBounds.y) * scale, ss = crop.size * scale
      const canvas = document.createElement('canvas')
      const out = Math.min(ss, 800)
      canvas.width = out; canvas.height = out
      canvas.getContext('2d')!.drawImage(img, sx, sy, ss, ss, 0, 0, out, out)

      const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
      const byteString = atob(dataUrl.split(',')[1])
      const ab = new ArrayBuffer(byteString.length)
      const ia = new Uint8Array(ab)
      for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i)
      const blob = new Blob([ab], { type: 'image/jpeg' })
      onDone(new File([blob], 'cropped.jpg', { type: 'image/jpeg' }))
    } catch (err) {
      console.error('Crop failed:', err)
      onDone(null as any)
    }
  }

  return (
    <div
      className="absolute inset-0 bg-bg flex flex-col z-50"
      style={{ touchAction: 'none' }}
      onMouseMove={onMove} onMouseUp={() => setDrag(null)}
      onTouchMove={onMove} onTouchEnd={() => setDrag(null)}
    >
      <div className="flex items-center justify-between px-5 pt-4 pb-2 shrink-0">
        <button onClick={onCancel} className="text-sm text-text-secondary bg-transparent border-none cursor-pointer">Cancel</button>
        <span className="text-sm font-semibold text-text-primary truncate mx-3">{itemName}</span>
        <button onClick={doCrop} className="text-sm font-semibold text-accent bg-transparent border-none cursor-pointer">Done</button>
      </div>
      <div className="text-center text-xs text-text-tertiary mb-2">Drag the box over the item</div>
      <div ref={containerRef} className="flex-1 relative overflow-hidden mx-2 mb-4">
        <img ref={imgRef} src={imageUrl} alt="" crossOrigin="anonymous" className="w-full h-full object-contain" onLoad={onImgLoad} draggable={false} />
        <div
          className="absolute border-2 border-white/90 rounded-lg cursor-move"
          style={{ left: crop.x, top: crop.y, width: crop.size, height: crop.size, boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)' }}
          onMouseDown={startMove} onTouchStart={startMove}
        >
          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-white rounded-tl-md" />
          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-white rounded-tr-md" />
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-white rounded-bl-md" />
          <div
            className="absolute -bottom-2.5 -right-2.5 w-7 h-7 bg-white rounded-full shadow-lg cursor-se-resize flex items-center justify-center"
            onMouseDown={startResize} onTouchStart={startResize}
          >
            <div className="w-2.5 h-2.5 border-r-2 border-b-2 border-black/40" />
          </div>
        </div>
      </div>
    </div>
  )
}

export function LogOutfitFlow() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const { items, refresh } = useWardrobe()
  const fileRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const preselectedId = searchParams.get('itemId')
  const [step, setStep] = useState(preselectedId ? 4 : 0)
  const [selfieFile, setSelfieFile] = useState<File | null>(null)
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set(preselectedId ? [preselectedId] : []))
  const [occasion, setOccasion] = useState('')
  const [socialCircles, setSocialCircles] = useState<Set<string>>(new Set())
  const [eventName, setEventName] = useState('')
  const [toast, setToast] = useState('')
  const [matchedResults, setMatchedResults] = useState<MatchResult | null>(null)
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
  const [showAddPicker, setShowAddPicker] = useState(false)
  const [dbCircles, setDbCircles] = useState<DbSocialCircle[]>([])
  const [removedItems, setRemovedItems] = useState<Set<string>>(new Set())
  const [rejectedMatches] = useState<Array<{ name: string; category: string; description?: string }>>([])
  const [lastOutfitId, setLastOutfitId] = useState<string | null>(null)
  const [cropTarget, setCropTarget] = useState<null | { type: 'new'; croppedId: string; name: string; category: string; style?: string; description?: string }>(null)
  const [croppedIds, setCroppedIds] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (user) {
      fetchCircles().then(setDbCircles).catch(() => {})
    }
  }, [user])

  const demoMatched = [
    { id: items[0]?.id || 'sample-0', name: items[0]?.name || 'Red Halter Dress', image_url: items[0]?.image_url || '', confidence: 'high', isNew: false },
    { id: items[2]?.id || 'sample-2', name: items[2]?.name || 'Gold Dupatta', image_url: items[2]?.image_url || '', confidence: 'high', isNew: false },
    { id: items[7]?.id || 'sample-7', name: items[7]?.name || 'Black Heels', image_url: items[7]?.image_url || '', confidence: 'medium', isNew: false },
  ]

  const getMatchedDisplay = () => {
    let base = demoMatched
    if (matchedResults) {
      const matched = matchedResults.matched_items.map(m => ({
        ...m,
        // Prefer the wardrobe store's URL — it's signed; the edge function returns
        // the stored canonical URL, which no longer serves (bucket is private)
        image_url: items.find(i => i.id === m.id)?.image_url || m.image_url || '',
        isNew: false,
      }))
      const newItems = matchedResults.new_items.map((n, i) => ({
        id: `new-${i}`,
        name: n.name,
        image_url: '',
        confidence: 'high' as const,
        isNew: true,
      }))
      base = [...matched, ...newItems]
    }
    // Pieces the user added by hand when the AI missed them
    const baseIds = new Set(base.map(b => b.id))
    const added = items
      .filter(i => addedIds.has(i.id) && !baseIds.has(i.id))
      .map(i => ({ id: i.id, name: i.name, image_url: i.image_url || '', confidence: 'high' as const, isNew: false }))
    return [...base, ...added]
  }

  // Is this wardrobe item currently part of the outfit being logged?
  const inOutfit = (id: string) => {
    const matchedIds = new Set((matchedResults?.matched_items || []).map(m => m.id))
    return (matchedIds.has(id) && !removedItems.has(id)) || addedIds.has(id)
  }

  const togglePickerItem = (id: string) => {
    const matchedIds = new Set((matchedResults?.matched_items || []).map(m => m.id))
    if (matchedIds.has(id)) {
      // AI-matched piece — membership is tracked via removedItems
      setRemovedItems(s => {
        const next = new Set(s)
        next.has(id) ? next.delete(id) : next.add(id)
        return next
      })
    } else {
      setAddedIds(s => {
        const next = new Set(s)
        next.has(id) ? next.delete(id) : next.add(id)
        return next
      })
    }
  }

  const handleSelfie = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSelfieFile(file)
    setSelfiePreview(URL.createObjectURL(file))
    setStep(2)

    try {
      if (user) {
        const base64 = await fileToBase64(file)
        const result = await matchOutfitPhoto(base64, file.type)
        console.log('Match results:', JSON.stringify(result))
        setMatchedResults(result)
        setStep(3)
        return
      }
    } catch (err) {
      console.error('Match outfit failed:', err)
    }

    setTimeout(() => setStep(3), 2500)
  }

  const togglePick = (id: string) => {
    const next = new Set(selectedItems)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelectedItems(next)
  }

  useEffect(() => {
    // Fresh photo → fresh manual adjustments
    setAddedIds(new Set())
    setShowAddPicker(false)
  }, [selfieFile])

  const toggleSocial = (s: string) => {
    const next = new Set(socialCircles)
    next.has(s) ? next.delete(s) : next.add(s)
    setSocialCircles(next)
  }

  const logOutfit = async () => {
    if (saving) return
    setSaving(true)
    try {
      if (user) {
        const itemIds = step === 3
          ? getMatchedDisplay().filter(m => !m.isNew && !removedItems.has(m.id)).map(m => m.id)
          : Array.from(selectedItems)

        // Save the outfit row first (fast), let the photo upload finish in
        // the background and attach itself when done
        const outfit = await logOutfitApi({
          occasion,
          itemIds,
          socialCircles: Array.from(socialCircles),
          eventName: eventName || undefined,
          source: selfieFile ? 'photo' : 'manual',
        })
        setLastOutfitId(outfit.id)
        if (selfieFile) {
          uploadImage(selfieFile, 'outfits')
            .then(url => updateOutfit(outfit.id, { image_url: url }))
            .catch(err => console.error('Outfit photo upload failed:', err))
        }
      }
    } catch { /* toast anyway */ }
    setSaving(false)

    const hasNewItems = matchedResults && (matchedResults.new_items.length > 0 || rejectedMatches.length > 0)
    if (step === 3 && hasNewItems) {
      setToast('Outfit logged! Now crop items for your wardrobe')
      setStep(6)
      return
    }

    setToast('Outfit logged!')
    setTimeout(() => navigate('/'), 1500)
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-bg">
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleSelfie} />
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={handleSelfie} />

      {/* Header */}
      {step !== 2 && step !== 7 && (
        <div className="px-5 pt-4 pb-2 shrink-0">
          <button
            onClick={() => {
              if (step === 0) navigate(-1)
              else if (step === 4) setStep(0)
              else if (step === 5) setStep(4)
              else if (step === 3) setStep(0)
              else if (step === 6) { refresh(); navigate('/') }
              else setStep(step - 1)
            }}
            className="flex items-center gap-1 text-sm text-text-secondary bg-transparent border-none cursor-pointer"
          >
            <ArrowLeft size={18} /> {step === 0 ? 'Home' : 'Back'}
          </button>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto">

        {/* Step 0: Choose method */}
        {step === 0 && (
          <div className="px-7 animate-fade-up">
            <h1 className="text-[22px] font-bold tracking-tight mb-2">Log today's outfit</h1>
            <p className="text-sm text-text-tertiary mb-6 leading-relaxed">Ten seconds before you head out. New pieces join your closet by themselves</p>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-4 p-5 rounded-[16px] bg-accent-soft border-none cursor-pointer active:scale-[0.97] transition-transform text-left"
              >
                <div className="w-12 h-12 rounded-[14px] bg-accent flex items-center justify-center shrink-0">
                  <Camera size={22} className="text-white" />
                </div>
                <div>
                  <div className="text-[15px] font-semibold text-accent">Take a picture</div>
                  <div className="text-xs text-text-tertiary mt-1 leading-relaxed">A mirror selfie works great. Sakhi spots every piece, even new ones</div>
                </div>
              </button>

              <button
                onClick={() => galleryRef.current?.click()}
                className="flex items-center gap-4 p-5 rounded-[16px] bg-card border-none cursor-pointer active:scale-[0.97] transition-transform text-left"
              >
                <div className="w-12 h-12 rounded-[14px] bg-white/[0.08] flex items-center justify-center shrink-0">
                  <Image size={22} className="text-text-primary" />
                </div>
                <div>
                  <div className="text-[15px] font-semibold text-text-primary">Choose from gallery</div>
                  <div className="text-xs text-text-tertiary mt-1 leading-relaxed">Pick an existing outfit photo</div>
                </div>
              </button>

              <button
                onClick={() => setStep(4)}
                className="flex items-center gap-4 p-5 rounded-[16px] bg-card border-none cursor-pointer active:scale-[0.97] transition-transform text-left"
              >
                <div className="w-12 h-12 rounded-[14px] bg-white/[0.08] flex items-center justify-center shrink-0">
                  <LayoutGrid size={22} className="text-text-primary" />
                </div>
                <div>
                  <div className="text-[15px] font-semibold text-text-primary">Pick from wardrobe</div>
                  <div className="text-xs text-text-tertiary mt-1 leading-relaxed">Manually select the items you wore today</div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Analyzing selfie */}
        {step === 2 && (
          <div className="flex-1 flex flex-col items-center justify-center px-7 pt-24 animate-fade-up">
            <div className="w-24 h-24 rounded-full bg-accent-soft flex items-center justify-center mb-8 animate-pulse">
              <Camera size={36} className="text-accent" />
            </div>
            <h2 className="text-xl font-bold mb-2">Matching your wardrobe...</h2>
            <p className="text-sm text-text-tertiary text-center">Sakhi is identifying items from your photo</p>
          </div>
        )}

        {/* Step 3: Selfie results + context */}
        {step === 3 && (
          <div className="animate-fade-up pb-8">
            <div className="px-7">
              <h1 className="text-[22px] font-bold tracking-tight mb-4">Log your look</h1>
            </div>

            {/* Selfie */}
            {selfiePreview && (
              <div className="mx-7 rounded-[18px] overflow-hidden aspect-[3/4] max-h-[220px] mb-5">
                <img src={selfiePreview} alt="" className="w-full h-full object-cover" />
              </div>
            )}

            {/* Matched items */}
            <div className="px-7 mb-2">
              <span className="text-[12px] font-semibold text-text-tertiary uppercase tracking-wide">We think you're wearing</span>
            </div>
            <div className="flex gap-3 px-7 overflow-x-auto pb-3 mb-4">
              {getMatchedDisplay().filter(m => !removedItems.has(m.id)).map((m, i) => (
                <div key={i} className="flex flex-col items-center shrink-0 relative">
                  <div className="w-[60px] h-[60px] rounded-xl overflow-hidden relative">
                    {m.image_url ? (
                      <img src={m.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-card flex items-center justify-center">
                        <Sparkles size={16} className="text-text-tertiary" />
                      </div>
                    )}
                    {m.isNew && (
                      <div className="absolute top-0 left-0 bg-accent text-white text-[8px] font-bold px-1.5 py-0.5 rounded-br-lg">New</div>
                    )}
                    <button
                      onClick={() => {
                        if (addedIds.has(m.id)) {
                          setAddedIds(s => { const next = new Set(s); next.delete(m.id); return next })
                        } else {
                          setRemovedItems(s => new Set(s).add(m.id))
                        }
                      }}
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-card border border-white/10 flex items-center justify-center cursor-pointer"
                    >
                      <X size={10} className="text-text-tertiary" />
                    </button>
                  </div>
                  <span className="text-[10px] text-text-tertiary mt-1.5 w-[60px] text-center truncate">{m.name}</span>
                </div>
              ))}
              <button onClick={() => setShowAddPicker(true)} className="flex flex-col items-center shrink-0 bg-transparent border-none cursor-pointer p-0">
                <div className="w-[60px] h-[60px] rounded-xl bg-card flex items-center justify-center border border-dashed border-white/10">
                  <Plus size={20} className="text-text-tertiary" />
                </div>
                <span className="text-[10px] text-text-tertiary mt-1.5">Add item</span>
              </button>
            </div>

            {/* Context fields */}
            <ContextFields
              occasion={occasion}
              setOccasion={setOccasion}
              socialCircles={socialCircles}
              toggleSocial={toggleSocial}
              eventName={eventName}
              setEventName={setEventName}
              circleNames={dbCircles.length > 0 ? dbCircles.map(c => c.name) : DEFAULT_CIRCLES}
            />

            <div className="px-7 mt-6">
              <button
                onClick={logOutfit}
                disabled={!occasion}
                className="w-full py-4 rounded-[14px] text-[15px] font-semibold bg-accent text-white border-none cursor-pointer active:scale-[0.97] transition-all disabled:opacity-35 disabled:pointer-events-none"
              >
                Log Outfit
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Manual pick */}
        {step === 4 && (
          <div className="animate-fade-up">
            <div className="px-7">
              <h1 className="text-[22px] font-bold tracking-tight mb-2">Pick what you wore</h1>
              <p className="text-sm text-text-tertiary mb-4">Select items from your wardrobe</p>
            </div>

            <div className="flex items-center justify-between px-7 py-3 bg-card mb-3">
              <span className="text-[13px] text-text-secondary">{selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected</span>
              <button
                onClick={() => setStep(5)}
                disabled={selectedItems.size === 0}
                className="px-4 py-2 rounded-xl text-[13px] font-semibold bg-accent text-white border-none cursor-pointer disabled:opacity-35 disabled:pointer-events-none"
              >
                Next
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 px-5">
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => togglePick(item.id)}
                  className="relative aspect-[3/4] rounded-xl overflow-hidden cursor-pointer bg-card border-none active:scale-[0.96] transition-transform"
                >
                  <img src={item.image_url} alt={item.name} className="absolute inset-0 w-full h-full object-cover" />
                  {selectedItems.has(item.id) && (
                    <>
                      <div className="absolute inset-0 bg-accent/30" />
                      <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-accent flex items-center justify-center">
                        <Check size={14} className="text-white" />
                      </div>
                    </>
                  )}
                </button>
              ))}
            </div>
            <div className="h-8" />
          </div>
        )}

        {/* Step 5: Review + context */}
        {step === 5 && (
          <div className="animate-fade-up pb-8">
            <div className="px-7">
              <h1 className="text-[22px] font-bold tracking-tight mb-2">Add details</h1>
              <p className="text-sm text-text-tertiary mb-5">Almost done, just tag your outfit</p>
            </div>

            {/* Selected items */}
            <div className="px-7 mb-2">
              <span className="text-[12px] font-semibold text-text-tertiary uppercase tracking-wide">Items you're wearing</span>
            </div>
            <div className="flex gap-3 px-7 overflow-x-auto pb-3 mb-4">
              {Array.from(selectedItems).map(id => {
                const item = items.find(i => i.id === id)
                if (!item) return null
                return (
                  <div key={id} className="flex flex-col items-center shrink-0">
                    <div className="w-[60px] h-[60px] rounded-xl overflow-hidden">
                      <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                    </div>
                    <span className="text-[10px] text-text-tertiary mt-1.5 w-[60px] text-center truncate">{item.name}</span>
                  </div>
                )
              })}
              <div className="flex flex-col items-center shrink-0">
                <div className="w-[60px] h-[60px] rounded-xl bg-card flex items-center justify-center border border-dashed border-white/10 cursor-pointer" onClick={() => setStep(4)}>
                  <Plus size={20} className="text-text-tertiary" />
                </div>
                <span className="text-[10px] text-text-tertiary mt-1.5">Add item</span>
              </div>
            </div>

            <ContextFields
              occasion={occasion}
              setOccasion={setOccasion}
              socialCircles={socialCircles}
              toggleSocial={toggleSocial}
              eventName={eventName}
              setEventName={setEventName}
              circleNames={dbCircles.length > 0 ? dbCircles.map(c => c.name) : DEFAULT_CIRCLES}
            />

            <div className="px-7 mt-6">
              <button
                onClick={logOutfit}
                disabled={!occasion}
                className="w-full py-4 rounded-[14px] text-[15px] font-semibold bg-accent text-white border-none cursor-pointer active:scale-[0.97] transition-all disabled:opacity-35 disabled:pointer-events-none"
              >
                Log Outfit
              </button>
            </div>
          </div>
        )}

        {/* Step 6: Crop new items from outfit photo */}
        {step === 6 && (matchedResults || rejectedMatches.length > 0) && (
          <div className="animate-fade-up px-7 pb-8">
            <h1 className="text-[22px] font-bold tracking-tight mb-2">Add items to wardrobe</h1>
            <p className="text-sm text-text-tertiary mb-5">Crop each new item from your photo</p>

            <div className="flex flex-col gap-2.5">
              {matchedResults?.matched_items.filter(m => !removedItems.has(m.id)).map((item) => (
                <div key={item.id} className="flex items-center gap-3 p-3 bg-card rounded-[14px]">
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-semibold text-text-primary">{item.name}</div>
                    <div className="text-[11px] text-green-400">Already in wardrobe</div>
                  </div>
                  <Check size={16} className="text-green-400 shrink-0" />
                </div>
              ))}
              {matchedResults?.new_items.map((item, i) => (
                <div key={`new-${i}`} className="flex items-center gap-3 p-3 bg-card rounded-[14px]">
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-semibold text-text-primary">{item.name}</div>
                    <div className="text-[11px] text-accent">New item</div>
                  </div>
                  {croppedIds.has(`new-${i}`) ? (
                    <span className="text-[12px] text-green-400 font-semibold flex items-center gap-1">
                      <Check size={14} /> Added
                    </span>
                  ) : removedItems.has(`new-${i}`) ? (
                    <span className="text-[12px] text-text-tertiary">Skipped</span>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setRemovedItems(s => new Set(s).add(`new-${i}`))}
                        className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/[0.04] border-none cursor-pointer"
                      >
                        <X size={14} className="text-text-tertiary" />
                      </button>
                      <button
                        onClick={() => { setCropTarget({ type: 'new', croppedId: `new-${i}`, name: item.name, category: item.category, style: item.style, description: item.description }); setStep(7) }}
                        className="px-3.5 py-2 rounded-xl text-[12px] font-semibold bg-accent text-white border-none cursor-pointer"
                      >
                        Crop & Add
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {rejectedMatches.map((item, i) => {
                const rjId = `rejected-${i}`
                return (
                  <div key={rjId} className="flex items-center gap-3 p-3 bg-card rounded-[14px]">
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-semibold text-text-primary">{item.name}</div>
                      <div className="text-[11px] text-amber-400">Wrong match? Add as new</div>
                    </div>
                    {croppedIds.has(rjId) ? (
                      <span className="text-[12px] text-green-400 font-semibold flex items-center gap-1">
                        <Check size={14} /> Added
                      </span>
                    ) : removedItems.has(rjId) ? (
                      <span className="text-[12px] text-text-tertiary">Skipped</span>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setRemovedItems(s => new Set(s).add(rjId))}
                          className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/[0.04] border-none cursor-pointer"
                        >
                          <X size={14} className="text-text-tertiary" />
                        </button>
                        <button
                          onClick={() => { setCropTarget({ type: 'new', croppedId: rjId, name: item.name, category: item.category, description: item.description }); setStep(7) }}
                          className="px-3.5 py-2 rounded-xl text-[12px] font-semibold bg-accent text-white border-none cursor-pointer"
                        >
                          Crop & Add
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <button
              onClick={() => { refresh(); navigate('/') }}
              className="w-full mt-6 py-3.5 rounded-[14px] text-[14px] font-semibold bg-card text-text-primary border-none cursor-pointer active:scale-[0.97] transition-transform"
            >
              {croppedIds.size > 0 ? 'Done' : 'Skip'}
            </button>
          </div>
        )}
      </div>

      {/* Step 7: Crop tool */}
      {step === 7 && selfiePreview && cropTarget && (
        <CropView
          imageUrl={selfiePreview}
          itemName={cropTarget.name}
          onDone={async (file) => {
            if (!file) {
              setToast('Could not crop image. Try again.')
              setStep(6)
              return
            }
            setSaving(true)
            try {
              const created = await addWardrobeItem({
                name: cropTarget.name,
                category: cropTarget.category,
                subcategory: null,
                primary_color: 'Unknown',
                color_hex: '#888888',
                secondary_color: null,
                pattern: 'Solid',
                formality: 'Casual',
                occasions: ['Casual'],
                seasons: ['All'],
                style_tags: cropTarget.style ? [cropTarget.style] : [],
                brand: null,
                fabric: null,
                size: null,
                price: null,
                image_url: '',
                thumbnail_url: null,
                ai_description: cropTarget.description || null,
                laundry_status: 'clean',
              }, file)
              if (lastOutfitId && created.id) {
                await addItemsToOutfit(lastOutfitId, [created.id]).catch(() => {})
              }
              setCroppedIds(s => new Set(s).add(cropTarget.croppedId))
              setToast(`${cropTarget.name} added!`)
            } catch (err: any) {
              const msg = err?.message || err?.error_description || JSON.stringify(err)
              console.error('Failed to add item:', msg, err)
              setToast(msg.length > 60 ? 'Failed to save. Try again.' : msg)
            }
            setSaving(false)
            setStep(6)
          }}
          onCancel={() => setStep(6)}
        />
      )}

      {/* Add-from-wardrobe picker — for pieces the AI missed or matched wrong */}
      {showAddPicker && (
        <div className="fixed inset-0 z-50 bg-bg flex flex-col">
          <div className="flex items-center justify-between px-6 pt-5 pb-3 shrink-0">
            <div>
              <h2 className="text-[18px] font-bold tracking-tight">Add from wardrobe</h2>
              <p className="text-[12px] text-text-tertiary mt-0.5">Tap anything Sakhi missed</p>
            </div>
            <button
              onClick={() => setShowAddPicker(false)}
              className="px-4 py-2 rounded-xl text-[13px] font-semibold bg-accent text-white border-none cursor-pointer"
            >
              Done
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="grid grid-cols-3 gap-2.5 px-5 pb-10">
              {items.map(item => (
                <button
                  key={item.id}
                  onClick={() => togglePickerItem(item.id)}
                  className="relative aspect-[3/4] rounded-xl overflow-hidden cursor-pointer bg-card border-none active:scale-[0.96] transition-transform"
                >
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center px-1 text-[10px] text-text-tertiary text-center">{item.name}</span>
                  )}
                  {inOutfit(item.id) && (
                    <>
                      <div className="absolute inset-0 bg-accent/30" />
                      <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-accent flex items-center justify-center">
                        <Check size={12} className="text-white" />
                      </div>
                    </>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {saving && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-card rounded-2xl px-8 py-6 flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
            <span className="text-sm text-text-secondary">Saving...</span>
          </div>
        </div>
      )}

      <Toast message={toast} visible={!!toast} onHide={() => setToast('')} />
    </div>
  )
}

function ContextFields({ occasion, setOccasion, socialCircles, toggleSocial, eventName, setEventName, circleNames }: {
  occasion: string
  setOccasion: (v: string) => void
  socialCircles: Set<string>
  toggleSocial: (s: string) => void
  eventName: string
  setEventName: (v: string) => void
  circleNames: string[]
}) {
  return (
    <>
      {/* Occasion */}
      <div className="px-7 mb-2">
        <span className="text-[12px] font-semibold text-text-tertiary uppercase tracking-wide">Occasion <span className="text-danger">*</span></span>
      </div>
      <div className="flex flex-wrap gap-2 px-7 mb-5">
        {OCCASIONS.map(o => (
          <button
            key={o}
            onClick={() => setOccasion(o)}
            className={`px-3.5 py-2 rounded-xl text-[12px] font-medium border-none cursor-pointer transition-colors ${
              occasion === o ? 'bg-accent text-white' : 'bg-card text-text-secondary'
            }`}
          >
            {o}
          </button>
        ))}
      </div>

      {/* Social circle */}
      <div className="px-7 mb-2">
        <span className="text-[12px] font-semibold text-text-tertiary uppercase tracking-wide">Social circle <span className="text-text-tertiary font-normal text-[10px]">optional</span></span>
      </div>
      <div className="flex flex-wrap gap-2 px-7 mb-5">
        {circleNames.map(s => (
          <button
            key={s}
            onClick={() => toggleSocial(s)}
            className={`px-3.5 py-2 rounded-xl text-[12px] font-medium border-none cursor-pointer transition-colors ${
              socialCircles.has(s) ? 'bg-accent text-white' : 'bg-card text-text-secondary'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Event name */}
      <div className="px-7 mb-2">
        <span className="text-[12px] font-semibold text-text-tertiary uppercase tracking-wide">Event name <span className="text-text-tertiary font-normal text-[10px]">optional</span></span>
      </div>
      <div className="px-7">
        <div className="flex items-center gap-3 bg-card rounded-[14px] px-4 py-3.5">
          <Calendar size={16} className="text-text-tertiary shrink-0" />
          <input
            className="flex-1 bg-transparent text-[13px] text-text-primary outline-none border-none"
            placeholder="e.g. Diwali dinner, Sara's birthday..."
            value={eventName}
            onChange={e => setEventName(e.target.value)}
          />
        </div>
      </div>
    </>
  )
}
