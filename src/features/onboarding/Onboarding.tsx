import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, Sparkles, Wand2 } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { updateProfile } from '../../lib/api'
import { MeetSakhi } from './MeetSakhi'

export const CITIES = [
  { name: 'Mumbai', currency: 'INR' },
  { name: 'Delhi', currency: 'INR' },
  { name: 'Bangalore', currency: 'INR' },
  { name: 'Hyderabad', currency: 'INR' },
  { name: 'Chennai', currency: 'INR' },
  { name: 'Pune', currency: 'INR' },
  { name: 'Kolkata', currency: 'INR' },
  { name: 'Dubai', currency: 'AED' },
  { name: 'London', currency: 'GBP' },
  { name: 'New York', currency: 'USD' },
]

export const STYLE_WORDS = [
  'Minimal', 'Classic', 'Effortless', 'Boho', 'Edgy',
  'Feminine', 'Earthy', 'Polished', 'Playful', 'Timeless',
  'Glamorous', 'Bold', 'Romantic', 'Understated', 'Artsy',
  'Sharp', 'Androgynous', 'Maximalist',
]

export const OCCASIONS = [
  { icon: '💼', name: 'Work / Office', freq: ['Daily', 'A few days', 'Rarely'] },
  { icon: '☕', name: 'Casual / Errands', freq: ['Most days', 'Sometimes', 'Rarely'] },
  { icon: '🥂', name: 'Going out', freq: ['Weekly', 'Monthly', 'Rarely'] },
  { icon: '💍', name: 'Weddings & events', freq: ['Monthly', 'Few times a year', 'Rarely'] },
  { icon: '🪔', name: 'Festivals & religious', freq: ['Regularly', 'Few times a year', 'Rarely'] },
  { icon: '✈️', name: 'Travel', freq: ['Often', 'Few times a year', 'Rarely'] },
]

export const SHOP_TOGGLES = [
  { a: 'Fewer, better pieces', b: 'I love variety', key: 'quality_vs_variety', valA: 'quality', valB: 'variety' },
  { a: 'I plan my purchases', b: 'I buy on impulse', key: 'planned_vs_impulse', valA: 'planned', valB: 'impulse' },
  { a: "I don't mind repeating outfits", b: 'I hate being seen in the same thing', key: 'repeat_comfort', valA: 'comfortable', valB: 'avoids_repeats' },
] as const

export const AVOID_CHIPS = [
  'Sleeveless', 'Short hemlines', 'Tight fits', 'Bold prints',
  'Synthetic fabrics', 'High heels', 'Crop tops', 'Low necklines',
]

const TOTAL_STEPS = 6

export function Onboarding({ onComplete }: { onComplete?: () => void }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [step, setStep] = useState(0)
  const [showIntro, setShowIntro] = useState(() => !localStorage.getItem('sakhi_intro_seen'))

  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [selectedStyleWords, setSelectedStyleWords] = useState<Set<string>>(new Set())
  const [occasionFreq, setOccasionFreq] = useState<Record<string, string>>({})
  const [shopMindset, setShopMindset] = useState<Record<string, string>>({})
  const [avoids, setAvoids] = useState<Set<string>>(new Set())
  const [avoidsNote, setAvoidsNote] = useState('')
  const [nothingAvoided, setNothingAvoided] = useState(false)

  const toggleStyleWord = (word: string) => {
    const next = new Set(selectedStyleWords)
    if (next.has(word)) {
      next.delete(word)
    } else if (next.size < 3) {
      next.add(word)
    }
    setSelectedStyleWords(next)
  }

  const toggleAvoid = (chip: string) => {
    setNothingAvoided(false)
    const next = new Set(avoids)
    next.has(chip) ? next.delete(chip) : next.add(chip)
    setAvoids(next)
  }

  const handleNothingAvoided = () => {
    setNothingAvoided(!nothingAvoided)
    setAvoids(new Set())
    setAvoidsNote('')
  }

  const getCurrency = () => {
    const city = CITIES.find(c => c.name.toLowerCase() === location.trim().toLowerCase())
    return city?.currency || 'INR'
  }

  const getMindsetSummary = () => {
    if (shopMindset.quality_vs_variety === 'quality') return 'You invest in pieces that last.'
    if (shopMindset.quality_vs_variety === 'variety') return 'You love keeping things fresh.'
    return ''
  }

  const selectedOccasions = Object.keys(occasionFreq)
  const canContinueOccasions = selectedOccasions.length >= 2

  const finish = async () => {
    if (onComplete) {
      onComplete()
    } else {
      localStorage.setItem('sakhi_onboarded', 'true')
    }
    localStorage.setItem('sakhi_name', name || 'Friend')

    if (user) {
      try {
        const stylePrefs: Record<string, unknown> = {
          style_words: Array.from(selectedStyleWords),
          occasion_frequency: occasionFreq,
          shopping_mindset: shopMindset,
          avoids: Array.from(avoids),
        }
        if (avoidsNote.trim()) {
          stylePrefs.avoids_note = avoidsNote.trim()
        }

        await updateProfile({
          display_name: name || 'Friend',
          occasions: selectedOccasions,
          style_preferences: stylePrefs as Record<string, string>,
          location: location.trim() || undefined,
          currency: getCurrency(),
        })
      } catch { /* best-effort */ }
    }

    navigate('/')
  }

  const btnClass = "w-full mt-7 py-4 rounded-[14px] text-[15px] font-semibold bg-accent text-white border-none cursor-pointer transition-all active:scale-[0.97] disabled:opacity-35 disabled:pointer-events-none"

  if (showIntro) {
    return <MeetSakhi onDone={() => { localStorage.setItem('sakhi_intro_seen', 'true'); setShowIntro(false) }} />
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-bg overflow-y-auto">
      {/* Progress bar */}
      <div className="flex gap-1 px-7 pt-14 pb-8">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div
            key={i}
            className={`flex-1 h-[3px] rounded-sm transition-colors ${
              i < step ? 'bg-accent' : i === step ? 'bg-accent opacity-60' : 'bg-white/[0.08]'
            }`}
          />
        ))}
      </div>

      <div className="px-7 flex-1">

        {/* ── Step 0: Name ── */}
        {step === 0 && (
          <div className="animate-fade-up">
            <h1 className="text-[22px] font-bold tracking-tight mb-3">What should we call you?</h1>
            <p className="text-sm text-text-tertiary mb-8 leading-relaxed">Just a first name. Sakhi keeps it personal.</p>
            <input
              className="w-full bg-card border border-border rounded-[14px] px-[18px] py-4 text-base text-text-primary outline-none focus:border-accent transition-colors"
              placeholder="Your name"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
            <button onClick={() => setStep(1)} disabled={!name.trim()} className={btnClass}>
              Continue
            </button>
          </div>
        )}

        {/* ── Step 1: Location ── */}
        {step === 1 && (
          <div className="animate-fade-up">
            <h1 className="text-[22px] font-bold tracking-tight mb-3">Where's home?</h1>
            <p className="text-sm text-text-tertiary mb-6 leading-relaxed">Helps Sakhi suggest weather-smart outfits.</p>

            <input
              className="w-full bg-card border border-border rounded-[14px] px-[18px] py-4 text-base text-text-primary outline-none focus:border-accent transition-colors mb-4"
              placeholder="Type your city..."
              value={location}
              onChange={e => setLocation(e.target.value)}
              autoFocus
            />

            <div className="flex flex-wrap gap-2">
              {CITIES.filter(c =>
                !location.trim() || c.name.toLowerCase().includes(location.trim().toLowerCase())
              ).map(c => (
                <button
                  key={c.name}
                  onClick={() => setLocation(c.name)}
                  className={`px-3.5 py-2 rounded-xl text-[13px] font-medium border-[1.5px] cursor-pointer transition-all ${
                    location === c.name
                      ? 'border-accent bg-accent-soft text-text-primary'
                      : 'border-transparent bg-card text-text-secondary'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>

            <button onClick={() => setStep(2)} className={btnClass}>
              {location.trim() ? 'Continue' : 'Skip'}
            </button>
          </div>
        )}

        {/* ── Step 2: Style words ── */}
        {step === 2 && (
          <div className="animate-fade-up">
            <h1 className="text-[22px] font-bold tracking-tight mb-3">Your style in 3 words</h1>
            <p className="text-sm text-text-tertiary mb-6 leading-relaxed">
              Tap the ones that feel like you.
              <span className="text-accent font-medium"> {selectedStyleWords.size}/3</span>
            </p>

            <div className="flex flex-wrap gap-2">
              {STYLE_WORDS.map(word => {
                const sel = selectedStyleWords.has(word)
                const maxed = selectedStyleWords.size >= 3 && !sel
                return (
                  <button
                    key={word}
                    onClick={() => toggleStyleWord(word)}
                    className={`px-4 py-2.5 rounded-xl text-[13px] font-medium border-[1.5px] cursor-pointer transition-all ${
                      sel
                        ? 'border-accent bg-accent-soft text-text-primary'
                        : maxed
                        ? 'border-transparent bg-card text-text-tertiary opacity-40'
                        : 'border-transparent bg-card text-text-secondary'
                    }`}
                  >
                    {word}
                  </button>
                )
              })}
            </div>

            <button onClick={() => setStep(3)} disabled={selectedStyleWords.size === 0} className={btnClass}>
              Continue
            </button>
          </div>
        )}

        {/* ── Step 3: Occasion frequency ── */}
        {step === 3 && (
          <div className="animate-fade-up">
            <h1 className="text-[22px] font-bold tracking-tight mb-3">What fills your week?</h1>
            <p className="text-sm text-text-tertiary mb-5 leading-relaxed">Tap how often, skip what doesn't apply.</p>

            <div className="flex flex-col gap-3">
              {OCCASIONS.map(occ => {
                const selected = occasionFreq[occ.name]
                return (
                  <div key={occ.name} className="bg-card rounded-[14px] p-3.5">
                    <div className="flex items-center gap-2 mb-2.5">
                      <span className="text-lg">{occ.icon}</span>
                      <span className="text-[13px] font-semibold text-text-primary">{occ.name}</span>
                    </div>
                    <div className="flex gap-1.5">
                      {occ.freq.map(f => (
                        <button
                          key={f}
                          onClick={() => {
                            const next = { ...occasionFreq }
                            if (next[occ.name] === f) {
                              delete next[occ.name]
                            } else {
                              next[occ.name] = f
                            }
                            setOccasionFreq(next)
                          }}
                          className={`flex-1 py-2 rounded-lg text-[11px] font-medium border-[1.5px] cursor-pointer transition-all ${
                            selected === f
                              ? 'border-accent bg-accent-soft text-accent'
                              : 'border-transparent bg-white/[0.04] text-text-tertiary'
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            <button onClick={() => setStep(4)} disabled={!canContinueOccasions} className={btnClass}>
              Continue
            </button>
          </div>
        )}

        {/* ── Step 4: Shopping mindset + avoids ── */}
        {step === 4 && (
          <div className="animate-fade-up">
            <h1 className="text-[22px] font-bold tracking-tight mb-5">A few more things</h1>

            {/* Shopping toggles */}
            <div className="flex flex-col gap-2.5 mb-6">
              {SHOP_TOGGLES.map(toggle => (
                <div key={toggle.key} className="flex gap-2">
                  <button
                    onClick={() => setShopMindset({ ...shopMindset, [toggle.key]: toggle.valA })}
                    className={`flex-1 py-3 px-3 rounded-[12px] text-[12px] font-medium border-[1.5px] cursor-pointer transition-all text-left leading-tight ${
                      shopMindset[toggle.key] === toggle.valA
                        ? 'border-accent bg-accent-soft text-text-primary'
                        : 'border-transparent bg-card text-text-secondary'
                    }`}
                  >
                    {toggle.a}
                  </button>
                  <button
                    onClick={() => setShopMindset({ ...shopMindset, [toggle.key]: toggle.valB })}
                    className={`flex-1 py-3 px-3 rounded-[12px] text-[12px] font-medium border-[1.5px] cursor-pointer transition-all text-left leading-tight ${
                      shopMindset[toggle.key] === toggle.valB
                        ? 'border-accent bg-accent-soft text-text-primary'
                        : 'border-transparent bg-card text-text-secondary'
                    }`}
                  >
                    {toggle.b}
                  </button>
                </div>
              ))}
            </div>

            {/* Avoids */}
            <div className="mb-3">
              <p className="text-[13px] text-text-secondary font-medium mb-3">Anything you'd rather avoid?</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {AVOID_CHIPS.map(chip => {
                  const sel = avoids.has(chip)
                  return (
                    <button
                      key={chip}
                      onClick={() => toggleAvoid(chip)}
                      disabled={nothingAvoided}
                      className={`px-3.5 py-2 rounded-xl text-[12px] font-medium border-[1.5px] cursor-pointer transition-all ${
                        sel
                          ? 'border-accent bg-accent-soft text-text-primary'
                          : nothingAvoided
                          ? 'border-transparent bg-card text-text-tertiary opacity-40'
                          : 'border-transparent bg-card text-text-secondary'
                      }`}
                    >
                      {chip}
                    </button>
                  )
                })}
                <button
                  onClick={handleNothingAvoided}
                  className={`px-3.5 py-2 rounded-xl text-[12px] font-medium border-[1.5px] cursor-pointer transition-all ${
                    nothingAvoided
                      ? 'border-accent bg-accent-soft text-text-primary'
                      : 'border-transparent bg-card text-text-secondary'
                  }`}
                >
                  Nothing, I'll wear anything
                </button>
              </div>

              {!nothingAvoided && (
                <input
                  className="w-full bg-card border border-border rounded-[14px] px-4 py-3 text-[13px] text-text-primary outline-none focus:border-accent transition-colors placeholder:text-text-tertiary"
                  placeholder="Anything else? e.g. no animal leather..."
                  value={avoidsNote}
                  onChange={e => setAvoidsNote(e.target.value)}
                />
              )}
            </div>

            <button onClick={() => setStep(5)} className={btnClass}>
              Continue
            </button>
          </div>
        )}

        {/* ── Step 5: Ready ── */}
        {step === 5 && (
          <div className="animate-fade-up pt-5">
            <div className="w-20 h-20 rounded-full bg-accent-soft flex items-center justify-center mx-auto mb-6">
              <Sparkles size={36} className="text-accent" />
            </div>
            <h1 className="text-[22px] font-bold tracking-tight mb-3 text-center">You're all set, {name || 'Friend'}!</h1>

            {selectedStyleWords.size > 0 && (
              <p className="text-sm text-text-tertiary mb-2 text-center leading-relaxed">
                Sakhi knows you're{' '}
                <span className="text-text-secondary font-medium">
                  {Array.from(selectedStyleWords).join(', ').toLowerCase()}
                </span>
                {location ? <>, based in <span className="text-text-secondary font-medium">{location}</span></> : ''}
                .{' '}{getMindsetSummary()}
              </p>
            )}

            <p className="text-sm text-text-tertiary mb-8 text-center leading-relaxed">
              Start with 5 items to unlock smart suggestions.
            </p>

            <div className="flex flex-col gap-2">
              {[
                { icon: <Camera size={18} className="text-accent" />, text: 'Snap photos of your clothes' },
                { icon: <Wand2 size={18} className="text-accent" />, text: 'AI tags everything automatically' },
                { icon: <Sparkles size={18} className="text-accent" />, text: 'Get smart outfit suggestions daily' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2.5 px-4 py-3 bg-card rounded-xl">
                  {item.icon}
                  <span className="text-[13px] text-text-secondary">{item.text}</span>
                </div>
              ))}
            </div>
            <button onClick={finish} className={btnClass}>
              Start adding items
            </button>
            <button
              onClick={finish}
              className="w-full py-3.5 text-[13px] text-text-tertiary bg-transparent border-none cursor-pointer"
            >
              Explore first
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
