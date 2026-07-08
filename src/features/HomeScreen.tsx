import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wand2, Camera, PenLine, Sun, Check, ChevronRight, Sparkles, X } from 'lucide-react'
import { BottomNav } from '../components/BottomNav'
import { useWardrobe } from '../lib/wardrobe-store'
import { useAuth } from '../lib/auth'
import { fetchOutfitHistory, type OutfitWithItems } from '../lib/api'

export function HomeScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { items } = useWardrobe()
  const [outfits, setOutfits] = useState<OutfitWithItems[]>([])

  useEffect(() => {
    if (user) {
      fetchOutfitHistory().then(setOutfits).catch(() => {})
    }
  }, [user])

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-6 pt-6 text-[28px] font-light tracking-[10px] uppercase text-text-primary">Sakhi</div>
        <div className="flex items-center gap-1.5 px-6 pt-2">
          <Sun size={13} className="text-yellow-400" />
          <span className="text-xs text-text-tertiary">34°C, Dubai — Light fabrics today</span>
        </div>

        {/* CTAs */}
        <div className="flex gap-2 px-6 pt-4">
          {[
            { icon: <Wand2 size={19} />, label: 'Suggest Outfit', accent: true, onClick: () => navigate('/suggest') },
            { icon: <Camera size={19} />, label: 'Add Item', accent: false, onClick: () => navigate('/add-item') },
            { icon: <PenLine size={19} />, label: 'Log Outfit', accent: false, onClick: () => navigate('/log-outfit') },
          ].map((cta, i) => (
            <button
              key={i}
              onClick={cta.onClick}
              className={`flex-1 flex flex-col items-center gap-2 py-4 px-2 rounded-2xl cursor-pointer border-none active:scale-[0.97] transition-transform ${
                cta.accent ? 'bg-accent-soft' : 'bg-card'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                cta.accent ? 'bg-accent text-white' : 'bg-white/[0.08] text-text-primary'
              }`}>
                {cta.icon}
              </div>
              <span className={`text-[11px] font-semibold ${cta.accent ? 'text-accent' : 'text-text-secondary'}`}>{cta.label}</span>
            </button>
          ))}
        </div>

        <GettingStarted itemCount={items.length} outfitCount={outfits.length} />

        {/* Logged Outfits */}
        <div className="px-6 pt-6 pb-3.5 text-sm font-semibold text-text-secondary">Your Looks</div>
        {outfits.length === 0 ? (
          <div className="mx-5 py-10 text-center">
            <div className="text-text-tertiary text-sm mb-3">No outfits logged yet</div>
            <button onClick={() => navigate('/log-outfit')} className="text-accent text-sm font-semibold bg-transparent border-none cursor-pointer">
              Log your first outfit
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 px-5">
            {outfits.map((outfit) => {
              // Joined snapshot keeps covers working even if the item was archived
              const coverImage = outfit.image_url ||
                outfit.outfit_items.map(oi => items.find(i => i.id === oi.wardrobe_item_id)?.image_url || oi.wardrobe_items?.image_url).find(Boolean)
              return (
                <div key={outfit.id} onClick={() => navigate(`/outfit/${outfit.id}`)} className="rounded-xl overflow-hidden cursor-pointer active:scale-[0.97] transition-transform">
                  {coverImage ? (
                    <div className="relative aspect-[3/4] overflow-hidden rounded-xl">
                      <img src={coverImage} alt="" className="w-full h-full object-cover" />
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2.5 pb-2 pt-6">
                        <div className="text-[12px] font-semibold text-white">{outfit.occasion}</div>
                        <div className="text-[10px] text-white/60">{new Date(outfit.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="relative aspect-[3/4] bg-white/[0.04] flex items-center justify-center rounded-xl">
                      <PenLine size={24} className="text-text-tertiary" />
                      <div className="absolute bottom-0 left-0 right-0 px-2.5 pb-2 pt-6">
                        <div className="text-[12px] font-semibold text-text-secondary">{outfit.occasion}</div>
                        <div className="text-[10px] text-text-tertiary">{new Date(outfit.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
        <div className="h-24" />
      </div>

      <BottomNav />
    </div>
  )
}

// First-run journey: three real actions, tracked against live data.
// Disappears for good once completed (or dismissed from the done state).
function GettingStarted({ itemCount, outfitCount }: { itemCount: number; outfitCount: number }) {
  const navigate = useNavigate()
  const [dismissed, setDismissed] = useState(() => !!localStorage.getItem('sakhi_journey_done'))
  const suggested = !!localStorage.getItem('sakhi_first_suggestion')

  if (dismissed) return null

  const steps = [
    {
      done: itemCount >= 5,
      icon: <Camera size={17} />,
      title: itemCount >= 5 ? 'Wardrobe started' : 'Add your first 5 pieces',
      sub: itemCount >= 5 ? `${itemCount} pieces catalogued` : `${itemCount}/5 — snap them or batch-upload`,
      to: '/add-item',
    },
    {
      done: suggested,
      icon: <Wand2 size={17} />,
      title: 'Get your first outfit',
      sub: suggested ? 'Sakhi styled you' : 'Styled from what you own',
      to: '/suggest',
    },
    {
      done: outfitCount > 0,
      icon: <PenLine size={17} />,
      title: 'Log what you wore',
      sub: outfitCount > 0 ? 'Wear history growing' : 'Teaches Sakhi your real taste',
      to: '/log-outfit',
    },
  ]
  const doneCount = steps.filter(s => s.done).length
  const allDone = doneCount === steps.length

  const finish = () => {
    localStorage.setItem('sakhi_journey_done', 'true')
    setDismissed(true)
  }

  if (allDone) {
    return (
      <div className="mx-5 mt-6 p-4 rounded-[16px] bg-accent-soft flex items-center gap-3.5 animate-fade-up">
        <div className="w-10 h-10 rounded-[12px] bg-accent flex items-center justify-center shrink-0">
          <Sparkles size={18} className="text-white" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-text-primary">You're all set</div>
          <div className="text-xs text-text-tertiary mt-0.5">Sakhi gets sharper with every piece and every log.</div>
        </div>
        <button onClick={finish} className="p-1.5 bg-transparent border-none cursor-pointer text-text-tertiary">
          <X size={16} />
        </button>
      </div>
    )
  }

  return (
    <div className="mx-5 mt-6 p-4 rounded-[16px] bg-card border border-border">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-text-primary">Get the best out of Sakhi</span>
        <div className="flex items-center gap-2.5">
          <span className="text-[11px] font-semibold text-accent">{doneCount}/{steps.length}</span>
          <button onClick={finish} className="p-0.5 bg-transparent border-none cursor-pointer text-text-tertiary flex">
            <X size={14} />
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        {steps.map((s, i) => (
          <button
            key={i}
            onClick={() => !s.done && navigate(s.to)}
            className={`flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-[12px] bg-transparent border-none text-left transition-colors ${
              s.done ? 'opacity-50' : 'cursor-pointer active:bg-white/[0.04]'
            }`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              s.done ? 'bg-accent text-white' : 'bg-white/[0.08] text-text-secondary'
            }`}>
              {s.done ? <Check size={15} /> : s.icon}
            </div>
            <div className="flex-1">
              <div className={`text-[13px] font-semibold ${s.done ? 'text-text-tertiary line-through' : 'text-text-primary'}`}>{s.title}</div>
              <div className="text-[11px] text-text-tertiary mt-0.5">{s.sub}</div>
            </div>
            {!s.done && <ChevronRight size={16} className="text-text-tertiary" />}
          </button>
        ))}
      </div>
    </div>
  )
}
