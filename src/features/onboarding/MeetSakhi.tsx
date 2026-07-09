import { useEffect, useState } from 'react'
import { Sparkles, Check, Camera, PenLine, Wand2 } from 'lucide-react'

// Interactive first-run experience: instead of describing Sakhi, let the user
// try her — pick an occasion and watch an outfit assemble, then ask for a
// purchase verdict. Everything here is mocked and self-contained.

const DEMO_OUTFITS: Record<string, { pieces: { emoji: string; name: string; tag: string; hue: string }[]; note: string }> = {
  Brunch: {
    pieces: [
      { emoji: '👗', name: 'Olive Linen Midi', tag: 'dress', hue: 'from-lime-900/60 to-emerald-950/60' },
      { emoji: '👡', name: 'Tan Strappy Sandals', tag: 'shoes', hue: 'from-amber-900/60 to-orange-950/60' },
      { emoji: '👜', name: 'Straw Tote', tag: 'bag', hue: 'from-yellow-900/50 to-amber-950/60' },
    ],
    note: 'Linen breathes in the heat. Keep jewellery minimal and let the olive do the talking.',
  },
  Office: {
    pieces: [
      { emoji: '👔', name: 'White Cotton Shirt', tag: 'top', hue: 'from-slate-700/60 to-slate-900/60' },
      { emoji: '👖', name: 'Cream Trousers', tag: 'bottom', hue: 'from-stone-700/60 to-stone-900/60' },
      { emoji: '🥿', name: 'Nude Flats', tag: 'shoes', hue: 'from-rose-900/40 to-stone-950/60' },
    ],
    note: 'Crisp neutrals always read polished. Roll the sleeves and tuck loosely for ease.',
  },
  Wedding: {
    pieces: [
      { emoji: '🥻', name: 'Fuchsia Silk Saree', tag: 'saree', hue: 'from-fuchsia-800/60 to-pink-950/60' },
      { emoji: '✨', name: 'Matching Blouse', tag: 'blouse', hue: 'from-pink-800/60 to-fuchsia-950/60' },
      { emoji: '💎', name: 'Gold Jhumkas', tag: 'jewellery', hue: 'from-yellow-800/50 to-amber-950/60' },
    ],
    note: 'Classic nivi drape with the pallu pinned. The jhumkas finish it, silk like this needs nothing else.',
  },
}

export function MeetSakhi({ onDone }: { onDone: () => void }) {
  const [scene, setScene] = useState(0)
  const [occasion, setOccasion] = useState<string | null>(null)
  const [noteVisible, setNoteVisible] = useState(false)
  const [verdictState, setVerdictState] = useState<'idle' | 'thinking' | 'shown'>('idle')

  // Styling note lands a beat after the pieces cascade in
  useEffect(() => {
    if (!occasion) return
    setNoteVisible(false)
    const t = setTimeout(() => setNoteVisible(true), 700)
    return () => clearTimeout(t)
  }, [occasion])

  const askVerdict = () => {
    setVerdictState('thinking')
    setTimeout(() => setVerdictState('shown'), 1100)
  }

  const demo = occasion ? DEMO_OUTFITS[occasion] : null

  return (
    <div className="flex flex-col h-full min-h-0 bg-bg overflow-y-auto">
      {/* Progress dots + skip */}
      <div className="flex items-center justify-between px-7 pt-14 pb-6 shrink-0">
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === scene ? 'w-6 bg-accent' : 'w-1.5 bg-white/[0.12]'}`} />
          ))}
        </div>
        <button onClick={onDone} className="text-[13px] text-text-tertiary bg-transparent border-none cursor-pointer">Skip</button>
      </div>

      <div className="px-7 flex-1 flex flex-col">

        {/* ── Scene 0: Hello ── */}
        {scene === 0 && (
          <div className="flex-1 flex flex-col justify-center pb-24">
            <div className="glow-orb w-16 h-16 rounded-full bg-accent-soft flex items-center justify-center mb-8 cascade-item">
              <Sparkles size={28} className="text-accent" />
            </div>
            <h1 className="text-[30px] font-bold tracking-tight leading-tight cascade-item" style={{ animationDelay: '250ms' }}>
              Hi, I'm Sakhi
            </h1>
            <p className="text-[19px] text-text-primary font-semibold mt-4 leading-relaxed cascade-item" style={{ animationDelay: '700ms' }}>
              One mirror photo a day. I do the rest.
            </p>
            <p className="text-[15px] text-text-tertiary mt-3 leading-relaxed cascade-item" style={{ animationDelay: '1300ms' }}>
              Your daily outfit builds your closet by itself. I learn what you love wearing, style you from your own clothes, and tell you honestly what's worth buying.
            </p>
            <button
              onClick={() => setScene(1)}
              className="w-full mt-10 py-4 rounded-[14px] text-[15px] font-semibold bg-accent text-white border-none cursor-pointer active:scale-[0.97] transition-all cascade-item"
              style={{ animationDelay: '1900ms' }}
            >
              Let's try it
            </button>
          </div>
        )}

        {/* ── Scene 1: Try a suggestion ── */}
        {scene === 1 && (
          <div className="animate-fade-up pb-10">
            <h1 className="text-[22px] font-bold tracking-tight mb-2">Where are you headed?</h1>
            <p className="text-sm text-text-tertiary mb-6 leading-relaxed">Pick one and I'll build a look from a sample closet.</p>

            <div className="flex gap-2 mb-7">
              {Object.keys(DEMO_OUTFITS).map(o => (
                <button
                  key={o}
                  onClick={() => setOccasion(o)}
                  className={`flex-1 py-3 rounded-[12px] text-sm font-semibold border cursor-pointer transition-all active:scale-[0.97] ${
                    occasion === o ? 'bg-accent text-white border-accent' : 'bg-card text-text-secondary border-border'
                  }`}
                >
                  {o}
                </button>
              ))}
            </div>

            {demo && (
              <div key={occasion}>
                <div className="flex flex-col gap-2.5">
                  {demo.pieces.map((p, i) => (
                    <div
                      key={p.name}
                      className={`cascade-item flex items-center gap-4 p-3.5 rounded-[16px] bg-gradient-to-br ${p.hue} border border-white/[0.06]`}
                      style={{ animationDelay: `${i * 180}ms` }}
                    >
                      <div className="w-12 h-12 rounded-[12px] bg-black/25 flex items-center justify-center text-2xl shrink-0">{p.emoji}</div>
                      <div>
                        <div className="text-[15px] font-semibold text-text-primary">{p.name}</div>
                        <div className="text-[11px] uppercase tracking-wider text-text-tertiary mt-0.5">{p.tag}</div>
                      </div>
                      <Check size={18} className="text-accent ml-auto" />
                    </div>
                  ))}
                </div>

                {noteVisible && (
                  <div className="cascade-item mt-4 p-4 rounded-[14px] bg-accent-soft">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-accent mb-1.5">
                      <Sparkles size={12} /> Styling note
                    </div>
                    <p className="text-sm text-text-secondary leading-relaxed">{demo.note}</p>
                  </div>
                )}

                {noteVisible && (
                  <p className="cascade-item text-[13px] text-text-tertiary mt-4 leading-relaxed" style={{ animationDelay: '250ms' }}>
                    This is a sample closet. In the app, every piece is your own.
                  </p>
                )}
              </div>
            )}

            {noteVisible && (
              <button
                onClick={() => setScene(2)}
                className="cascade-item w-full mt-6 py-4 rounded-[14px] text-[15px] font-semibold bg-accent text-white border-none cursor-pointer active:scale-[0.97] transition-all"
                style={{ animationDelay: '450ms' }}
              >
                There's more
              </button>
            )}
          </div>
        )}

        {/* ── Scene 2: Try a verdict, then how to start ── */}
        {scene === 2 && (
          <div className="animate-fade-up pb-10">
            <h1 className="text-[22px] font-bold tracking-tight mb-2">Tempted in a store?</h1>
            <p className="text-sm text-text-tertiary mb-6 leading-relaxed">Ask me before you buy. I'll check it against what you already own.</p>

            <div className="p-4 rounded-[16px] bg-card border border-border flex items-center gap-4">
              <div className="w-14 h-14 rounded-[12px] bg-gradient-to-br from-zinc-700/70 to-zinc-950 flex items-center justify-center text-2xl shrink-0">🖤</div>
              <div className="flex-1">
                <div className="text-[15px] font-semibold text-text-primary">Black Slip Dress</div>
                <div className="text-[13px] text-text-tertiary mt-0.5">₹3,500 · seen at the mall</div>
              </div>
            </div>

            {verdictState === 'idle' && (
              <button
                onClick={askVerdict}
                className="w-full mt-4 py-3.5 rounded-[14px] text-[15px] font-semibold bg-white/[0.08] text-text-primary border-none cursor-pointer active:scale-[0.97] transition-all"
              >
                Ask Sakhi: worth it?
              </button>
            )}

            {verdictState === 'thinking' && (
              <div className="mt-4 py-3.5 flex items-center justify-center gap-2.5 text-sm text-text-tertiary">
                <div className="w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                Checking your closet…
              </div>
            )}

            {verdictState === 'shown' && (
              <>
                <div className="cascade-item mt-4 p-4 rounded-[16px] bg-red-500/[0.08] border border-red-500/20">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-red-400 mb-1.5">Skip this one</div>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    You already own two black dresses doing the same job, and one hasn't left the closet in months. That's ₹3,500 staying in your pocket.
                  </p>
                </div>

                <div className="cascade-item mt-8" style={{ animationDelay: '350ms' }}>
                  <h2 className="text-[17px] font-bold tracking-tight mb-1">The more you share, the sharper I get</h2>
                  <p className="text-[13px] text-text-tertiary mb-4 leading-relaxed">Three habits, ten seconds each:</p>
                  <div className="flex flex-col gap-2.5">
                    {[
                      { icon: <PenLine size={17} />, title: 'Log your outfit daily', sub: 'One mirror photo before you head out. Your closet builds itself' },
                      { icon: <Camera size={17} />, title: 'Add favorites anytime', sub: 'A quick snap for pieces you want styled sooner' },
                      { icon: <Wand2 size={17} />, title: 'Ask before you buy', sub: 'I\'ll tell you honestly if it\'s worth it' },
                    ].map((s, i) => (
                      <div key={s.title} className="cascade-item flex items-center gap-3.5 p-3 rounded-[14px] bg-card" style={{ animationDelay: `${500 + i * 160}ms` }}>
                        <div className="w-9 h-9 rounded-[10px] bg-accent-soft text-accent flex items-center justify-center shrink-0">{s.icon}</div>
                        <div>
                          <div className="text-sm font-semibold text-text-primary">{s.title}</div>
                          <div className="text-xs text-text-tertiary mt-0.5">{s.sub}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={onDone}
                  className="cascade-item w-full mt-7 py-4 rounded-[14px] text-[15px] font-semibold bg-accent text-white border-none cursor-pointer active:scale-[0.97] transition-all"
                  style={{ animationDelay: '1000ms' }}
                >
                  Let's learn your style
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
