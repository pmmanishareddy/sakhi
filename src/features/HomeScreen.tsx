import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wand2, Camera, PenLine, Sun, Check, ChevronRight, Sparkles, X } from 'lucide-react'
import { BottomNav } from '../components/BottomNav'
import { useWardrobe } from '../lib/wardrobe-store'
import { useAuth } from '../lib/auth'
import { fetchOutfitHistory, getProfile, setAppFlag, type OutfitWithItems } from '../lib/api'
import { getWeather, type Weather } from '../lib/weather'

// Local calendar date; outfit.date from the DB may be the UTC day, so
// "logged today" accepts either to avoid a midnight-window false negative
function localDate(d = new Date()): string {
  return d.toLocaleDateString('en-CA')
}

export function HomeScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { items } = useWardrobe()
  const [outfits, setOutfits] = useState<OutfitWithItems[]>([])
  const [weather, setWeather] = useState<Weather | null>(null)
  const [appFlags, setAppFlags] = useState<Record<string, boolean> | null>(null)
  const name = localStorage.getItem('sakhi_name') || ''

  useEffect(() => {
    if (user) {
      fetchOutfitHistory().then(setOutfits).catch(() => {})
      getProfile()
        .then(p => {
          setAppFlags(p?.app_flags || {})
          if (p?.location) getWeather(p.location).then(setWeather)
        })
        .catch(() => {})
    }
  }, [user])

  const today = localDate()
  const utcToday = new Date().toISOString().split('T')[0]
  const loggedToday = outfits.some(o => o.date === today || o.date === utcToday)

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const weekAgo = localDate(new Date(Date.now() - 7 * 24 * 3600 * 1000))
  const thisWeek = outfits.filter(o => o.date >= weekAgo)
  const earlier = outfits.filter(o => o.date < weekAgo)

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-6 pt-6 text-[28px] font-light tracking-[10px] uppercase text-text-primary">Sakhi</div>
        <div className="flex items-center gap-1.5 px-6 pt-2">
          {weather && <Sun size={13} className="text-yellow-400" />}
          <span className="text-xs text-text-tertiary">
            {greeting}{name ? `, ${name}` : ''}{weather ? ` · ${weather.temp}°, ${weather.hint}` : ''}
          </span>
        </div>

        {/* The day's state decides the hero: log first, then styling */}
        {!loggedToday ? (
          <button
            onClick={() => navigate('/log-outfit')}
            className="mx-6 mt-4 w-[calc(100%-48px)] flex items-center gap-4 p-5 rounded-2xl bg-accent-soft border-none cursor-pointer active:scale-[0.98] transition-transform text-left"
          >
            <div className="w-12 h-12 rounded-[14px] bg-accent flex items-center justify-center shrink-0">
              <Camera size={22} className="text-white" />
            </div>
            <div>
              <div className="text-[16px] font-bold text-text-primary">What are you wearing today?</div>
              <div className="text-xs text-text-tertiary mt-1">One mirror photo, any time today</div>
            </div>
          </button>
        ) : (
          <button
            onClick={() => navigate('/log-outfit')}
            className="mx-6 mt-4 w-[calc(100%-48px)] flex items-center gap-4 p-5 rounded-2xl bg-accent-soft border-none cursor-pointer active:scale-[0.98] transition-transform text-left"
          >
            <div className="w-12 h-12 rounded-[14px] bg-accent flex items-center justify-center shrink-0">
              <PenLine size={22} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-success mb-0.5">
                <Check size={12} /> Today's outfit logged
              </div>
              <div className="text-[16px] font-bold text-text-primary">Log another outfit</div>
            </div>
          </button>
        )}

        {/* Secondary actions — same two, logged or not; Suggest Outfit doesn't move around */}
        <div className="flex gap-2 px-6 pt-2.5">
          {[
            { icon: <Wand2 size={17} />, label: 'Style me', onClick: () => navigate('/suggest') },
            { icon: <Camera size={17} />, label: 'Snap a piece', onClick: () => navigate('/add-item') },
          ].map((cta, i) => (
            <button
              key={i}
              onClick={cta.onClick}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl cursor-pointer border-none active:scale-[0.97] transition-transform bg-card text-text-secondary"
            >
              {cta.icon}
              <span className="text-[12px] font-semibold">{cta.label}</span>
            </button>
          ))}
        </div>

        <GettingStarted itemCount={items.length} outfitCount={outfits.length} flags={appFlags} />

        {/* Logged Outfits, framed as the week's rhythm */}
        <div className="px-6 pt-6 pb-3.5 text-sm font-semibold text-text-secondary">This week</div>
        <div className="grid grid-cols-2 gap-2.5 px-5">
          {!loggedToday && (
            <button
              onClick={() => navigate('/log-outfit')}
              className="relative aspect-[3/4] rounded-xl border border-dashed border-accent/40 bg-accent-soft/40 flex flex-col items-center justify-center gap-2 cursor-pointer active:scale-[0.97] transition-transform"
            >
              <Camera size={22} className="text-accent" />
              <span className="text-[12px] font-semibold text-accent">Today</span>
              <span className="text-[10px] text-text-tertiary px-4 text-center leading-snug">Your slot is waiting</span>
            </button>
          )}
          {thisWeek.map(outfit => (
            <OutfitCell key={outfit.id} outfit={outfit} items={items} onOpen={() => navigate(`/outfit/${outfit.id}`)} />
          ))}
        </div>
        {loggedToday && thisWeek.length === 0 && null}

        {earlier.length > 0 && (
          <>
            <div className="px-6 pt-6 pb-3.5 text-sm font-semibold text-text-secondary">Earlier</div>
            <div className="grid grid-cols-2 gap-2.5 px-5">
              {earlier.map(outfit => (
                <OutfitCell key={outfit.id} outfit={outfit} items={items} onOpen={() => navigate(`/outfit/${outfit.id}`)} />
              ))}
            </div>
          </>
        )}
        <div className="h-24" />
      </div>

      <BottomNav />
    </div>
  )
}

function OutfitCell({ outfit, items, onOpen }: {
  outfit: OutfitWithItems
  items: ReturnType<typeof useWardrobe>['items']
  onOpen: () => void
}) {
  // Joined snapshot keeps covers working even if the item was archived
  const coverImage = outfit.image_url ||
    outfit.outfit_items.map(oi => items.find(i => i.id === oi.wardrobe_item_id)?.image_url || oi.wardrobe_items?.image_url).find(Boolean)
  const dateLabel = new Date(outfit.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return (
    <div onClick={onOpen} className="rounded-xl overflow-hidden cursor-pointer active:scale-[0.97] transition-transform">
      {coverImage ? (
        <div className="relative aspect-[3/4] overflow-hidden rounded-xl">
          <img src={coverImage} alt="" className="w-full h-full object-cover" />
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2.5 pb-2 pt-6">
            <div className="text-[12px] font-semibold text-white">{outfit.occasion}</div>
            <div className="text-[10px] text-white/60">{dateLabel}</div>
          </div>
        </div>
      ) : (
        <div className="relative aspect-[3/4] bg-white/[0.04] flex items-center justify-center rounded-xl">
          <PenLine size={24} className="text-text-tertiary" />
          <div className="absolute bottom-0 left-0 right-0 px-2.5 pb-2 pt-6">
            <div className="text-[12px] font-semibold text-text-secondary">{outfit.occasion}</div>
            <div className="text-[10px] text-text-tertiary">{dateLabel}</div>
          </div>
        </div>
      )}
    </div>
  )
}

// First-run journey: three real actions, tracked against live data.
// Disappears for good once completed or dismissed. The flag lives on the
// profile (localStorage is just a fast cache — it's wiped on reinstall).
function GettingStarted({ itemCount, outfitCount, flags }: { itemCount: number; outfitCount: number; flags: Record<string, boolean> | null }) {
  const navigate = useNavigate()
  const [dismissed, setDismissed] = useState(() => !!localStorage.getItem('sakhi_journey_done'))
  const suggested = !!localStorage.getItem('sakhi_first_suggestion') || !!flags?.first_suggestion

  useEffect(() => {
    if (flags?.journey_done) {
      localStorage.setItem('sakhi_journey_done', 'true')
      setDismissed(true)
    }
  }, [flags])

  if (dismissed || flags === null) return null

  const steps = [
    {
      done: outfitCount > 0,
      icon: <PenLine size={17} />,
      title: outfitCount > 0 ? 'First outfit logged' : "Log today's outfit",
      sub: outfitCount > 0 ? 'Your closet has begun' : 'One mirror photo. Sakhi spots each piece',
      to: '/log-outfit',
    },
    {
      done: itemCount >= 5,
      icon: <Camera size={17} />,
      title: itemCount >= 5 ? 'Five pieces in' : 'Grow to 5 pieces',
      sub: itemCount >= 5 ? `${itemCount} pieces and counting` : `${itemCount}/5. Logging adds them, or snap favorites`,
      to: '/add-item',
    },
    {
      done: suggested,
      icon: <Wand2 size={17} />,
      title: 'Get your first styled look',
      sub: suggested ? 'Sakhi styled you' : 'Styled from your own closet',
      to: '/suggest',
    },
  ]
  const doneCount = steps.filter(s => s.done).length
  const allDone = doneCount === steps.length

  const finish = () => {
    localStorage.setItem('sakhi_journey_done', 'true')
    setAppFlag('journey_done')
    setDismissed(true)
  }

  // Completing the journey retires the card on its own — the congrats card
  // shows this one time, and the persisted flag keeps it gone from then on
  useEffect(() => {
    if (allDone && !localStorage.getItem('sakhi_journey_done')) {
      localStorage.setItem('sakhi_journey_done', 'true')
      setAppFlag('journey_done')
    }
  }, [allDone])

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
