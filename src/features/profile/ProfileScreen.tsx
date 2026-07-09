import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Trash2, Sparkles, Shield, Pencil, Camera } from 'lucide-react'
import { BottomNav } from '../../components/BottomNav'
import { Toast } from '../../components/Toast'
import { useAuth } from '../../lib/auth'
import { getProfile, updateProfile, deleteAccount, uploadImage, signImageUrl } from '../../lib/api'
import { CITIES, STYLE_WORDS, OCCASIONS, SHOP_TOGGLES, AVOID_CHIPS } from '../onboarding/Onboarding'

const GENDERS = ['Female', 'Male', 'Non-binary', 'Prefer not to say']

export function ProfileScreen() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [extraPrefs, setExtraPrefs] = useState<Record<string, unknown>>({})
  const [editing, setEditing] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState('')
  const [avatarSaving, setAvatarSaving] = useState(false)
  const avatarRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState('')
  const [gender, setGender] = useState('')
  const [location, setLocation] = useState('')
  const [styleWords, setStyleWords] = useState<Set<string>>(new Set())
  const [occasionFreq, setOccasionFreq] = useState<Record<string, string>>({})
  const [shopMindset, setShopMindset] = useState<Record<string, string>>({})
  const [avoids, setAvoids] = useState<Set<string>>(new Set())
  const [avoidsNote, setAvoidsNote] = useState('')

  useEffect(() => {
    getProfile().then(profile => {
      if (!profile) return
      const prefs = (profile.style_preferences || {}) as Record<string, unknown>
      setName(profile.display_name || '')
      setLocation(profile.location || '')
      setGender((prefs.gender as string) || '')
      setStyleWords(new Set((prefs.style_words as string[]) || []))
      setOccasionFreq((prefs.occasion_frequency as Record<string, string>) || {})
      setShopMindset((prefs.shopping_mindset as Record<string, string>) || {})
      setAvoids(new Set((prefs.avoids as string[]) || []))
      setAvoidsNote((prefs.avoids_note as string) || '')
      const { style_words, occasion_frequency, shopping_mindset, avoids: _a, avoids_note, gender: _g, ...rest } = prefs
      setExtraPrefs(rest)
      if (rest.avatar_url) signImageUrl(rest.avatar_url as string).then(setAvatarUrl)
    }).catch(() => setToast('Could not load profile')).finally(() => setLoading(false))
  }, [])

  const buildPrefs = (extra: Record<string, unknown> = extraPrefs): Record<string, unknown> => {
    const prefs: Record<string, unknown> = {
      ...extra,
      style_words: Array.from(styleWords),
      occasion_frequency: occasionFreq,
      shopping_mindset: shopMindset,
      avoids: Array.from(avoids),
    }
    if (avoidsNote.trim()) prefs.avoids_note = avoidsNote.trim()
    if (gender) prefs.gender = gender
    return prefs
  }

  const handleAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarSaving(true)
    try {
      const url = await uploadImage(file, 'profile')
      const nextExtra = { ...extraPrefs, avatar_url: url }
      await updateProfile({ style_preferences: buildPrefs(nextExtra) })
      setExtraPrefs(nextExtra)
      setAvatarUrl(await signImageUrl(url))
      setToast('Photo updated')
    } catch {
      setToast('Could not update photo. Try again.')
    } finally {
      setAvatarSaving(false)
      if (avatarRef.current) avatarRef.current.value = ''
    }
  }

  const toggleStyleWord = (word: string) => {
    const next = new Set(styleWords)
    if (next.has(word)) next.delete(word)
    else if (next.size < 3) next.add(word)
    setStyleWords(next)
  }

  const toggleAvoid = (chip: string) => {
    const next = new Set(avoids)
    next.has(chip) ? next.delete(chip) : next.add(chip)
    setAvoids(next)
  }

  const save = async () => {
    setSaving(true)
    try {
      const city = CITIES.find(c => c.name.toLowerCase() === location.trim().toLowerCase())
      await updateProfile({
        display_name: name.trim() || 'Friend',
        occasions: Object.keys(occasionFreq),
        style_preferences: buildPrefs(),
        location: location.trim() || undefined,
        ...(city ? { currency: city.currency } : {}),
      })
      localStorage.setItem('sakhi_name', name.trim() || 'Friend')
      setToast('Profile saved')
      setEditing(false)
    } catch {
      setToast('Failed to save. Try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteAccount()
      localStorage.removeItem('sakhi_onboarded')
      localStorage.removeItem('sakhi_name')
      navigate('/login')
    } catch {
      setToast('Could not delete account. Try again.')
      setDeleting(false)
      setShowDelete(false)
    }
  }

  const chipClass = (selected: boolean, dimmed = false) =>
    `px-3.5 py-2 rounded-xl text-[12px] font-medium border-[1.5px] cursor-pointer transition-all ${
      selected
        ? 'border-accent bg-accent-soft text-text-primary'
        : dimmed
        ? 'border-transparent bg-card text-text-tertiary opacity-40'
        : 'border-transparent bg-card text-text-secondary'
    }`

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-bg">
        <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-bg">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-7 pt-6 animate-fade-up">
          <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={handleAvatar} />

          {/* Header */}
          <div className="flex items-center gap-4 mb-7">
            <button
              onClick={() => avatarRef.current?.click()}
              className="relative w-16 h-16 rounded-full shrink-0 bg-accent-soft border-none cursor-pointer p-0 overflow-visible active:scale-95 transition-transform"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-16 h-16 rounded-full object-cover" />
              ) : (
                <span className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-accent">
                  {(name || 'S').charAt(0).toUpperCase()}
                </span>
              )}
              <span className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-accent flex items-center justify-center border-2 border-bg">
                {avatarSaving
                  ? <span className="w-3 h-3 rounded-full border-[1.5px] border-white border-t-transparent animate-spin" />
                  : <Camera size={11} className="text-white" />}
              </span>
            </button>
            <div className="min-w-0">
              <h1 className="text-[22px] font-bold tracking-tight truncate">{name || 'Profile'}</h1>
              <div className="text-[12px] text-text-tertiary truncate">{user?.email}</div>
              {(gender || location) && (
                <div className="text-[12px] text-text-secondary mt-0.5">{[gender, location].filter(Boolean).join(' · ')}</div>
              )}
            </div>
          </div>

          {/* ── View mode: compact style profile ── */}
          {!editing && (
            <div className="bg-card rounded-[18px] p-5 mb-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[13px] font-semibold text-text-primary">Your style profile</span>
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent-soft text-accent text-[12px] font-semibold border-none cursor-pointer active:scale-95 transition-transform"
                >
                  <Pencil size={12} /> Edit
                </button>
              </div>

              {styleWords.size > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {Array.from(styleWords).map(w => (
                    <span key={w} className="px-3 py-1.5 rounded-full bg-accent-soft text-accent text-[12px] font-medium">{w}</span>
                  ))}
                </div>
              )}

              {Object.keys(occasionFreq).length > 0 && (
                <div className="grid grid-cols-2 gap-x-3 gap-y-2 mb-4">
                  {OCCASIONS.filter(o => occasionFreq[o.name]).map(o => (
                    <div key={o.name} className="flex items-center gap-2 min-w-0">
                      <span className="text-[14px]">{o.icon}</span>
                      <div className="min-w-0">
                        <div className="text-[12px] text-text-primary truncate">{o.name}</div>
                        <div className="text-[10px] text-text-tertiary">{occasionFreq[o.name]}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {Object.keys(shopMindset).length > 0 && (
                <div className="text-[12px] text-text-secondary leading-relaxed mb-3">
                  {SHOP_TOGGLES.filter(t => shopMindset[t.key]).map(t => shopMindset[t.key] === t.valA ? t.a : t.b).join(' · ')}
                </div>
              )}

              {(avoids.size > 0 || avoidsNote) && (
                <div className="text-[12px] text-text-tertiary leading-relaxed">
                  <span className="text-text-secondary">Avoids:</span> {[...Array.from(avoids), avoidsNote].filter(Boolean).join(', ')}
                </div>
              )}

              {styleWords.size === 0 && Object.keys(occasionFreq).length === 0 && (
                <p className="text-[12px] text-text-tertiary">No preferences yet. Tap Edit to tell Sakhi your style.</p>
              )}
            </div>
          )}

          {/* ── Edit mode ── */}
          {editing && (<>
          {/* Name */}
          <div className="mb-6">
            <p className="text-[13px] text-text-secondary font-medium mb-2.5">Name</p>
            <input
              className="w-full bg-card border border-border rounded-[14px] px-[18px] py-3.5 text-[15px] text-text-primary outline-none focus:border-accent transition-colors"
              placeholder="Your name"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          {/* Gender */}
          <div className="mb-6">
            <p className="text-[13px] text-text-secondary font-medium mb-2.5">Gender</p>
            <div className="flex flex-wrap gap-2">
              {GENDERS.map(g => (
                <button key={g} onClick={() => setGender(gender === g ? '' : g)} className={chipClass(gender === g)}>
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Location */}
          <div className="mb-6">
            <p className="text-[13px] text-text-secondary font-medium mb-2.5">Home city</p>
            <input
              className="w-full bg-card border border-border rounded-[14px] px-[18px] py-3.5 text-[15px] text-text-primary outline-none focus:border-accent transition-colors mb-2.5"
              placeholder="Type your city..."
              value={location}
              onChange={e => setLocation(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              {CITIES.filter(c => !location.trim() || c.name.toLowerCase().includes(location.trim().toLowerCase())).slice(0, 6).map(c => (
                <button key={c.name} onClick={() => setLocation(c.name)} className={chipClass(location === c.name)}>
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Style words */}
          <div className="mb-6">
            <p className="text-[13px] text-text-secondary font-medium mb-2.5">
              Your style in 3 words <span className="text-accent">{styleWords.size}/3</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {STYLE_WORDS.map(word => (
                <button
                  key={word}
                  onClick={() => toggleStyleWord(word)}
                  className={chipClass(styleWords.has(word), styleWords.size >= 3 && !styleWords.has(word))}
                >
                  {word}
                </button>
              ))}
            </div>
          </div>

          {/* Occasion frequency */}
          <div className="mb-6">
            <p className="text-[13px] text-text-secondary font-medium mb-2.5">What fills your week?</p>
            <div className="flex flex-col gap-2.5">
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
                            if (next[occ.name] === f) delete next[occ.name]
                            else next[occ.name] = f
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
          </div>

          {/* Shopping mindset */}
          <div className="mb-6">
            <p className="text-[13px] text-text-secondary font-medium mb-2.5">Shopping mindset</p>
            <div className="flex flex-col gap-2.5">
              {SHOP_TOGGLES.map(toggle => (
                <div key={toggle.key} className="flex gap-2">
                  {[{ label: toggle.a, val: toggle.valA }, { label: toggle.b, val: toggle.valB }].map(opt => (
                    <button
                      key={opt.val}
                      onClick={() => setShopMindset({ ...shopMindset, [toggle.key]: opt.val })}
                      className={`flex-1 py-3 px-3 rounded-[12px] text-[12px] font-medium border-[1.5px] cursor-pointer transition-all text-left leading-tight ${
                        shopMindset[toggle.key] === opt.val
                          ? 'border-accent bg-accent-soft text-text-primary'
                          : 'border-transparent bg-card text-text-secondary'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Avoids */}
          <div className="mb-6">
            <p className="text-[13px] text-text-secondary font-medium mb-2.5">Things you'd rather avoid</p>
            <div className="flex flex-wrap gap-2 mb-2.5">
              {AVOID_CHIPS.map(chip => (
                <button key={chip} onClick={() => toggleAvoid(chip)} className={chipClass(avoids.has(chip))}>
                  {chip}
                </button>
              ))}
            </div>
            <input
              className="w-full bg-card border border-border rounded-[14px] px-4 py-3 text-[13px] text-text-primary outline-none focus:border-accent transition-colors placeholder:text-text-tertiary"
              placeholder="Anything else? e.g. no animal leather..."
              value={avoidsNote}
              onChange={e => setAvoidsNote(e.target.value)}
            />
          </div>

          <button
            onClick={save}
            disabled={saving || !name.trim()}
            className="w-full py-4 rounded-[14px] text-[15px] font-semibold bg-accent text-white border-none cursor-pointer active:scale-[0.97] transition-all disabled:opacity-35 disabled:pointer-events-none"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            onClick={() => setEditing(false)}
            disabled={saving}
            className="w-full py-3.5 text-[13px] text-text-tertiary bg-transparent border-none cursor-pointer mb-6"
          >
            Cancel
          </button>
          </>)}

          {/* Account */}
          <p className="text-[13px] text-text-secondary font-medium mb-2.5">Account</p>
          <button
            onClick={() => navigate('/welcome')}
            className="w-full flex items-center gap-3 px-4 py-4 rounded-[14px] bg-card border-none cursor-pointer active:scale-[0.98] transition-transform text-left mb-2.5"
          >
            <Sparkles size={18} className="text-accent" />
            <span className="text-[14px] font-medium text-text-primary">How Sakhi works</span>
          </button>
          <button
            onClick={() => navigate('/privacy')}
            className="w-full flex items-center gap-3 px-4 py-4 rounded-[14px] bg-card border-none cursor-pointer active:scale-[0.98] transition-transform text-left mb-2.5"
          >
            <Shield size={18} className="text-text-secondary" />
            <span className="text-[14px] font-medium text-text-primary">Privacy</span>
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-4 rounded-[14px] bg-card border-none cursor-pointer active:scale-[0.98] transition-transform text-left mb-2.5"
          >
            <LogOut size={18} className="text-text-secondary" />
            <span className="text-[14px] font-medium text-text-primary">Log out</span>
          </button>
          <button
            onClick={() => setShowDelete(true)}
            className="w-full flex items-center gap-3 px-4 py-4 rounded-[14px] bg-card border-none cursor-pointer active:scale-[0.98] transition-transform text-left"
          >
            <Trash2 size={18} className="text-red-400" />
            <span className="text-[14px] font-medium text-red-400">Delete account</span>
          </button>

          <DiagFooter />
          <div className="h-8" />
        </div>
      </div>

      {/* Delete confirmation */}
      {showDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-8">
          <div className="bg-card rounded-2xl p-6 w-full max-w-[300px] text-center">
            <div className="text-[15px] font-semibold text-text-primary mb-2">Delete your account?</div>
            <div className="text-[13px] text-text-tertiary mb-5 leading-relaxed">
              Your wardrobe, outfits, photos, and profile will be permanently deleted. This can't be undone.
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDelete(false)}
                disabled={deleting}
                className="flex-1 py-3 rounded-xl text-[13px] font-semibold bg-white/[0.06] text-text-secondary border-none cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-3 rounded-xl text-[13px] font-semibold bg-red-500/15 text-red-400 border-none cursor-pointer disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast message={toast} visible={!!toast} onHide={() => setToast('')} />
      <BottomNav />
    </div>
  )
}

// Tiny device diagnostic: build stamp plus what this phone reports for
// safe areas and display mode. Reads from a probe element, not assumptions.
function DiagFooter() {
  const [diag, setDiag] = useState('')
  useEffect(() => {
    const probe = document.createElement('div')
    probe.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:env(safe-area-inset-top);visibility:hidden'
    document.body.appendChild(probe)
    const inset = Math.round(probe.getBoundingClientRect().height)
    probe.remove()
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone
    const built = new Date(__BUILD_TIME__).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    setDiag(`build ${built} · inset ${inset}px · ${standalone ? 'standalone' : 'browser'} · ${window.innerWidth}x${window.innerHeight}`)
  }, [])
  return <p className="text-[10px] text-text-tertiary/60 text-center mt-6">{diag}</p>
}
