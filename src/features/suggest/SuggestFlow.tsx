import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Sun, Sparkles, HandHeart, Check, RefreshCw } from 'lucide-react'
import { Toast } from '../../components/Toast'
import { useWardrobe } from '../../lib/wardrobe-store'
import { useAuth } from '../../lib/auth'
import { suggestOutfit, logOutfit as logOutfitApi, getProfile, setAppFlag, type OutfitSuggestion } from '../../lib/api'
import { getWeather, type Weather } from '../../lib/weather'
import type { DbWardrobeItem } from '../../lib/api'

const OCCASIONS = [
  { icon: '💼', name: 'Office' },
  { icon: '🥂', name: 'Party' },
  { icon: '💕', name: 'Date Night' },
  { icon: '☕', name: 'Brunch' },
  { icon: '💍', name: 'Wedding' },
  { icon: '☀️', name: 'Casual' },
  { icon: '🪔', name: 'Festival' },
  { icon: '✨', name: 'Other' },
]

const GENERATING_STEPS = [
  'Scanning your wardrobe...',
  'Matching colors & patterns...',
  'Checking formality level...',
  'Building your look...',
]

export function SuggestFlow() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { items } = useWardrobe()
  const [step, setStep] = useState(0)
  const [occasion, setOccasion] = useState('')
  const [genStep, setGenStep] = useState(0)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState('')
  const [weather, setWeather] = useState<Weather | null>(null)
  const [resultItems, setResultItems] = useState<DbWardrobeItem[]>([])

  useEffect(() => {
    if (user) {
      getProfile()
        .then(p => { if (p?.location) getWeather(p.location).then(setWeather) })
        .catch(() => {})
    }
  }, [user])
  const [, setSuggestion] = useState<OutfitSuggestion | null>(null)
  const [allSeenIds, setAllSeenIds] = useState<string[]>([])

  const selectOccasion = (name: string) => {
    setOccasion(name)
  }

  const startGenerating = async (pinnedIds?: string[], excludeIds?: string[]) => {
    setStep(3)
    setGenStep(0)

    const stepTimers = GENERATING_STEPS.map((_, i) =>
      setTimeout(() => setGenStep(i), i * 700)
    )

    try {
      if (user) {
        const result = await suggestOutfit(occasion, pinnedIds, excludeIds)
        stepTimers.forEach(clearTimeout)
        if (!localStorage.getItem('sakhi_first_suggestion')) {
          localStorage.setItem('sakhi_first_suggestion', 'true')
          setAppFlag('first_suggestion')
        }
        setSuggestion(result)
        const matchedItems = result.items
          .map(ri => items.find(i => i.id === ri.id))
          .filter((i): i is DbWardrobeItem => i !== null)
        setResultItems(matchedItems)
        setAllSeenIds(prev => [...new Set([...prev, ...matchedItems.map(i => i.id)])])
        setStep(4)
        return
      }
    } catch (err) {
      console.error('Suggest outfit error:', err)
      stepTimers.forEach(clearTimeout)
      setToast(err instanceof Error ? err.message : 'Suggestion failed')
      setStep(1)
      return
    }
  }

  const togglePick = (id: string) => {
    const next = new Set(selectedItems)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelectedItems(next)
  }

  const wearOutfit = async () => {
    if (user && resultItems.length > 0) {
      try {
        await logOutfitApi({
          occasion,
          itemIds: resultItems.map(i => i.id),
          source: 'suggestion',
        })
      } catch { /* toast anyway */ }
    }
    setToast('Outfit logged!')
    setTimeout(() => navigate('/'), 1500)
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-bg">
      {/* Header */}
      {step !== 3 && (
        <div className="px-5 pt-4 pb-2 shrink-0">
          <button
            onClick={() => {
              if (step === 0) navigate(-1)
              else if (step === 2) setStep(1)
              else if (step === 4) setStep(1)
              else setStep(step - 1)
            }}
            className="flex items-center gap-1 text-sm text-text-secondary bg-transparent border-none cursor-pointer"
          >
            <ArrowLeft size={18} /> {step === 0 ? 'Home' : 'Back'}
          </button>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* Step 0: Pick Occasion */}
        {step === 0 && (
          <div className="px-7 animate-fade-up">
            <h1 className="text-[22px] font-bold tracking-tight mb-2">What's the occasion?</h1>
            <p className="text-sm text-text-tertiary mb-3 leading-relaxed">Pick one and Sakhi will do the rest</p>
            {weather && (
              <div className="flex items-center gap-1.5 mb-6">
                <Sun size={13} className="text-yellow-400" />
                <span className="text-xs text-text-tertiary">{weather.temp}° right now, {weather.hint}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5 mb-6">
              {OCCASIONS.map(o => (
                <button
                  key={o.name}
                  onClick={() => selectOccasion(o.name)}
                  className={`flex items-center gap-3 px-4 py-4 rounded-[14px] border-[1.5px] bg-card cursor-pointer transition-all text-left ${
                    occasion === o.name ? 'border-accent bg-accent-soft' : 'border-transparent'
                  }`}
                >
                  <span className="text-xl">{o.icon}</span>
                  <span className={`text-[13px] font-semibold ${occasion === o.name ? 'text-text-primary' : 'text-text-secondary'}`}>{o.name}</span>
                </button>
              ))}
            </div>

            <button
              onClick={() => setStep(1)}
              disabled={!occasion}
              className="w-full py-4 rounded-[14px] text-[15px] font-semibold bg-accent text-white border-none cursor-pointer active:scale-[0.97] transition-all disabled:opacity-35 disabled:pointer-events-none"
            >
              Next
            </button>
          </div>
        )}

        {/* Step 1: Choose styling method */}
        {step === 1 && (
          <div className="px-7 animate-fade-up">
            <h1 className="text-[22px] font-bold tracking-tight mb-2">How do you want to style?</h1>
            <p className="text-sm text-text-tertiary mb-6 leading-relaxed">For your {occasion.toLowerCase()} look</p>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => startGenerating()}
                className="flex items-center gap-4 p-5 rounded-[16px] bg-accent-soft border-none cursor-pointer active:scale-[0.97] transition-transform text-left"
              >
                <div className="w-12 h-12 rounded-[14px] bg-accent flex items-center justify-center shrink-0">
                  <Sparkles size={22} className="text-white" />
                </div>
                <div>
                  <div className="text-[15px] font-semibold text-accent">Let Sakhi decide</div>
                  <div className="text-xs text-text-tertiary mt-1 leading-relaxed">Sakhi picks a complete outfit from your wardrobe, head to toe</div>
                </div>
              </button>

              <button
                onClick={() => setStep(2)}
                className="flex items-center gap-4 p-5 rounded-[16px] bg-card border-none cursor-pointer active:scale-[0.97] transition-transform text-left"
              >
                <div className="w-12 h-12 rounded-[14px] bg-white/[0.08] flex items-center justify-center shrink-0">
                  <HandHeart size={22} className="text-text-primary" />
                </div>
                <div>
                  <div className="text-[15px] font-semibold text-text-primary">Style specific items</div>
                  <div className="text-xs text-text-tertiary mt-1 leading-relaxed">Pick pieces you want to wear and Sakhi builds the rest around them</div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Pick items */}
        {step === 2 && (
          <div className="animate-fade-up">
            <div className="px-7">
              <h1 className="text-[22px] font-bold tracking-tight mb-2">Pick items to style</h1>
              <p className="text-sm text-text-tertiary mb-4 leading-relaxed">Select what you want to wear and Sakhi builds around it</p>
            </div>

            <div className="flex items-center justify-between px-7 py-3 bg-card mb-3">
              <span className="text-[13px] text-text-secondary">{selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected</span>
              <button
                onClick={() => startGenerating(Array.from(selectedItems))}
                disabled={selectedItems.size === 0}
                className="px-4 py-2 rounded-xl text-[13px] font-semibold bg-accent text-white border-none cursor-pointer disabled:opacity-35 disabled:pointer-events-none"
              >
                Build Outfit
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

        {/* Step 3: Generating */}
        {step === 3 && (
          <div className="flex-1 flex flex-col items-center justify-center px-7 pt-24 animate-fade-up generating-ambient">
            <div className="w-24 h-24 rounded-full bg-accent-soft flex items-center justify-center mb-8 glow-orb">
              <Sparkles size={36} className="text-accent" />
            </div>
            <h2 className="text-xl font-bold mb-2">Styling your look...</h2>
            <p className="text-sm text-text-tertiary text-center mb-8">Sakhi is putting together outfits from your wardrobe</p>

            <div className="w-full flex flex-col gap-3">
              {GENERATING_STEPS.map((label, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                    i <= genStep ? 'bg-card' : 'opacity-0'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                    i < genStep ? 'bg-accent' : i === genStep ? 'bg-accent animate-pulse' : 'bg-white/[0.06]'
                  }`}>
                    {i < genStep ? <Check size={14} className="text-white" /> : <span className="w-2 h-2 rounded-full bg-white/40" />}
                  </div>
                  <span className={`text-[13px] ${i <= genStep ? 'text-text-secondary' : 'text-text-tertiary'}`}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Results */}
        {step === 4 && (
          <div className="px-7 animate-fade-up">
            <h1 className="text-[22px] font-bold tracking-tight mb-1">Your {occasion.toLowerCase()} look</h1>
            <p className="text-sm text-text-tertiary mb-5">Built from your wardrobe</p>

            <div className="bg-card rounded-[18px] p-4 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={14} className="text-accent" />
                <span className="text-[12px] font-semibold text-accent uppercase tracking-wide">Sakhi's Pick</span>
              </div>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {resultItems.map((item) => (
                  <div key={item.id} className="aspect-[3/4] rounded-xl overflow-hidden">
                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
              <button
                onClick={wearOutfit}
                className="w-full py-3.5 rounded-[14px] text-[14px] font-semibold bg-accent text-white border-none cursor-pointer active:scale-[0.97] transition-transform"
              >
                Wear This
              </button>
            </div>

            <button
              onClick={() => startGenerating(undefined, allSeenIds)}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-[14px] text-[13px] font-medium text-text-secondary bg-card border-none cursor-pointer active:scale-[0.97] transition-transform"
            >
              <RefreshCw size={15} /> Try another look
            </button>
            <div className="h-8" />
          </div>
        )}
      </div>

      <Toast message={toast} visible={!!toast} onHide={() => setToast('')} />
    </div>
  )
}
