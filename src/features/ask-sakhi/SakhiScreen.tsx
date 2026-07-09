import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, Image, ArrowLeft, Check, XCircle, CheckCircle, AlertTriangle, Shirt, Search, BarChart3, ChevronDown, ChevronUp, Lightbulb, Plus } from 'lucide-react'
import { BottomNav } from '../../components/BottomNav'
import { Toast } from '../../components/Toast'
import { useWardrobe } from '../../lib/wardrobe-store'
import { useAuth } from '../../lib/auth'
import { getPurchaseVerdict, getWardrobeGaps, savePurchaseVerdict, fetchVerdictHistory, fetchUserStats, fileToBase64, type VerdictResult, type GapCard, type DbPurchaseVerdict } from '../../lib/api'

const SCAN_STEPS = [
  { icon: Shirt, text: 'Scanning your wardrobe...' },
  { icon: Search, text: 'Checking pairings...' },
  { icon: BarChart3, text: 'Reviewing your patterns...' },
]

type View = 'main' | 'analyzing' | 'verdict' | 'gaps' | 'history'

export function SakhiScreen() {
  const { user } = useAuth()
  const { items } = useWardrobe()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [view, setView] = useState<View>('main')
  const [scanStep, setScanStep] = useState(0)
  const [toast, setToast] = useState('')
  const [showAddPrompt, setShowAddPrompt] = useState(false)

  const [itemPhoto, setItemPhoto] = useState<File | null>(null)
  const [itemPreview, setItemPreview] = useState<string | null>(null)
  const [itemName, setItemName] = useState('')
  const [itemPrice, setItemPrice] = useState('')

  const [verdictResult, setVerdictResult] = useState<VerdictResult | null>(null)
  const [evidenceExpanded, setEvidenceExpanded] = useState(false)
  const [gapCards, setGapCards] = useState<GapCard[]>([])
  const [loadingGaps, setLoadingGaps] = useState(false)
  const [refreshingGaps, setRefreshingGaps] = useState(false)
  const [pastVerdicts, setPastVerdicts] = useState<DbPurchaseVerdict[]>([])
  const [moneySaved, setMoneySaved] = useState(0)

  useEffect(() => {
    if (user) {
      fetchVerdictHistory().then(setPastVerdicts).catch(() => {})
      fetchUserStats().then(stats => {
        if (stats) setMoneySaved(stats.money_saved)
      }).catch(() => {})
    }
  }, [user])

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setItemPhoto(file)
    setItemPreview(URL.createObjectURL(file))
    e.target.value = ''
  }

  const openCamera = () => {
    if (fileRef.current) {
      fileRef.current.setAttribute('capture', 'environment')
      fileRef.current.click()
    }
  }

  const openGallery = () => {
    if (fileRef.current) {
      fileRef.current.removeAttribute('capture')
      fileRef.current.click()
    }
  }

  const startAnalysis = async () => {
    setView('analyzing')
    setScanStep(0)
    setEvidenceExpanded(false)

    const stepTimers = SCAN_STEPS.map((_, i) =>
      setTimeout(() => setScanStep(i + 1), (i + 1) * 800)
    )

    try {
      if (user) {
        const input: Parameters<typeof getPurchaseVerdict>[0] = {}
        if (itemPhoto) {
          const base64 = await fileToBase64(itemPhoto)
          input.image_base64 = base64
          input.image_content_type = itemPhoto.type
        }
        if (itemName.trim()) input.item_name = itemName.trim()
        if (itemPrice.trim()) input.item_price = parseFloat(itemPrice)

        const result = await getPurchaseVerdict(input)
        stepTimers.forEach(clearTimeout)
        setVerdictResult(result)

        setView('verdict')
        return
      }
    } catch (err) {
      stepTimers.forEach(clearTimeout)
      const msg = err instanceof Error ? err.message : 'Unknown error'
      console.error('Ask Sakhi error:', msg)
      setToast(msg.length > 80 ? 'Something went wrong. Try again.' : msg)
      setView('main')
      return
    }

    setTimeout(() => setView('main'), 3000)
  }

  const saveVerdict = useCallback(async (action: 'bought' | 'skipped') => {
    if (!user || !verdictResult) return
    try {
      const saved = await savePurchaseVerdict({
        itemName: itemName || verdictResult.title || 'Unnamed item',
        itemPrice: itemPrice ? parseFloat(itemPrice) : undefined,
        verdict: verdictResult.verdict,
        reasoning: verdictResult.reason,
        estimatedCpw: verdictResult.estimated_cpw,
        pairingsCount: verdictResult.pairings_count,
        evidence: verdictResult.evidence,
        actionTaken: action,
      })
      setPastVerdicts(prev => [saved, ...prev])

      if (action === 'skipped' && itemPrice) {
        setMoneySaved(prev => prev + parseFloat(itemPrice))
        setToast(`₹${parseFloat(itemPrice).toLocaleString()} added to savings`)
      }
    } catch {
      setToast('Could not save. Try again.')
    }
  }, [user, verdictResult, itemName, itemPrice])

  const handleUserAction = async (action: 'bought' | 'skipped') => {
    if (action === 'bought') {
      await saveVerdict('bought')
      setShowAddPrompt(true)
      return
    }

    await saveVerdict('skipped')
    setTimeout(() => {
      resetInput()
      setView('main')
    }, 1200)
  }

  const handleAddToWardrobe = () => {
    setShowAddPrompt(false)
    navigate('/add-item', { state: { prefillPhoto: itemPhoto, prefillName: itemName } })
  }

  const handleSkipAdd = () => {
    setShowAddPrompt(false)
    setToast('Noted. Enjoy your new piece!')
    setTimeout(() => {
      resetInput()
      setView('main')
    }, 1200)
  }

  const handleShowGaps = async () => {
    setView('gaps')
    if (!user) return
    if (items.length < 5) return

    // Show the last result instantly and refresh behind it
    const cached = localStorage.getItem('sakhi_gaps_cache')
    if (cached) {
      try { setGapCards(JSON.parse(cached)) } catch { /* stale junk, ignore */ }
      setRefreshingGaps(true)
    } else {
      setLoadingGaps(true)
    }
    try {
      const gaps = await getWardrobeGaps()
      setGapCards(gaps)
      localStorage.setItem('sakhi_gaps_cache', JSON.stringify(gaps))
    } catch {
      if (!cached) {
        setGapCards([])
        setToast('Could not load gaps. Try again later.')
      }
    } finally {
      setLoadingGaps(false)
      setRefreshingGaps(false)
    }
  }

  const resetInput = () => {
    setItemPhoto(null)
    setItemPreview(null)
    setItemName('')
    setItemPrice('')
    setVerdictResult(null)
    setEvidenceExpanded(false)
  }

  const handleDone = () => {
    resetInput()
    setView('main')
  }

  const canAnalyze = !!(itemPhoto || itemName.trim())
  const skipCount = pastVerdicts.filter(v => v.verdict === 'skip').length

  const verdictConfig: Record<string, { bg: string; text: string; icon: typeof XCircle; label: string; emoji: string }> = {
    skip: { bg: 'bg-danger/10', text: 'text-danger', icon: XCircle, label: 'Skip This', emoji: '❌' },
    buy: { bg: 'bg-success/10', text: 'text-success', icon: CheckCircle, label: 'Great Addition', emoji: '✅' },
    maybe: { bg: 'bg-warning/10', text: 'text-warning', icon: AlertTriangle, label: 'Think About It', emoji: '🤔' },
  }

  const verdictHistoryConfig: Record<string, { text: string; label: string }> = {
    skip: { text: 'text-danger', label: 'Skipped' },
    buy: { text: 'text-success', label: 'Buy' },
    maybe: { text: 'text-warning', label: 'Maybe' },
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
      <div className="flex-1 min-h-0 overflow-y-auto">

        {/* ── MAIN VIEW: Input IS the home ── */}
        {view === 'main' && (
          <div className="animate-fade-up">
            <div className="px-6 pt-5 pb-4 text-[22px] font-bold tracking-tight">Ask Sakhi</div>

            {/* Photo area */}
            <div className="px-5 mb-3">
              {itemPreview ? (
                <div className="rounded-[18px] overflow-hidden aspect-[4/3] max-h-[200px] relative">
                  <img src={itemPreview} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={openGallery}
                    className="absolute top-3 right-3 px-3 py-2 rounded-xl bg-black/60 backdrop-blur-sm text-white text-xs font-medium border-none cursor-pointer"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="flex gap-2.5">
                  <button onClick={openCamera} className="flex-1 flex flex-col items-center gap-2 py-5 rounded-[16px] bg-accent-soft border-none cursor-pointer active:scale-[0.97] transition-transform">
                    <Camera size={22} className="text-accent" />
                    <span className="text-[12px] font-semibold text-accent">Take photo</span>
                  </button>
                  <button onClick={openGallery} className="flex-1 flex flex-col items-center gap-2 py-5 rounded-[16px] bg-card border-none cursor-pointer active:scale-[0.97] transition-transform">
                    <Image size={22} className="text-text-secondary" />
                    <span className="text-[12px] font-semibold text-text-secondary">From gallery</span>
                  </button>
                </div>
              )}
            </div>

            {/* Description */}
            <div className="px-5 mb-2.5">
              <input
                className="w-full bg-card border border-border rounded-[14px] px-4 py-3.5 text-sm text-text-primary outline-none focus:border-accent transition-colors placeholder:text-text-tertiary"
                placeholder="Describe the item..."
                value={itemName}
                onChange={e => setItemName(e.target.value)}
              />
            </div>

            {/* Price */}
            <div className="px-5 mb-4">
              <div className="flex items-center gap-2">
                <input
                  className="flex-1 bg-card border border-border rounded-[14px] px-4 py-3.5 text-sm text-text-primary outline-none focus:border-accent transition-colors placeholder:text-text-tertiary"
                  placeholder="₹ Price"
                  value={itemPrice}
                  onChange={e => setItemPrice(e.target.value)}
                  inputMode="decimal"
                />
                <span className="text-[11px] text-text-tertiary shrink-0">optional</span>
              </div>
            </div>

            {/* CTA */}
            <div className="px-5 mb-5">
              <button
                onClick={startAnalysis}
                disabled={!canAnalyze}
                className="w-full py-4 rounded-[14px] text-[15px] font-semibold bg-accent text-white border-none cursor-pointer active:scale-[0.97] transition-all disabled:opacity-30 disabled:pointer-events-none"
              >
                Should I Buy This?
              </button>
            </div>

            {/* Divider */}
            <div className="mx-5 mb-4 border-t border-border" />

            {/* Gaps + History cards */}
            <div className="flex gap-2.5 px-5 mb-6">
              <button
                onClick={handleShowGaps}
                className="flex-1 bg-card rounded-[16px] p-4 border-none cursor-pointer text-left active:scale-[0.97] transition-transform"
              >
                <span className="text-lg block mb-1">🧩</span>
                <span className="text-[13px] font-semibold text-text-primary block">Gaps</span>
                <span className="text-[11px] text-text-tertiary block mt-0.5">What am I missing?</span>
              </button>
              <button
                onClick={() => setView('history')}
                className="flex-1 bg-card rounded-[16px] p-4 border-none cursor-pointer text-left active:scale-[0.97] transition-transform"
              >
                <span className="text-lg block mb-1">📋</span>
                <span className="text-[13px] font-semibold text-text-primary block">History</span>
                <span className="text-[11px] text-text-tertiary block mt-0.5">
                  {pastVerdicts.length > 0
                    ? `${pastVerdicts.length} evaluated${moneySaved > 0 ? ` · ₹${moneySaved.toLocaleString()} saved` : ''}`
                    : 'Past verdicts'
                  }
                </span>
              </button>
            </div>

            <div className="h-24" />
          </div>
        )}

        {/* ── ANALYZING VIEW ── */}
        {view === 'analyzing' && (
          <div className="px-7 pt-16 animate-fade-up">
            <div className="flex items-center gap-3 p-4 bg-card rounded-[16px] mb-8">
              {itemPreview ? (
                <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0">
                  <img src={itemPreview} alt="" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-14 h-14 rounded-xl bg-white/[0.06] flex items-center justify-center shrink-0">
                  <Shirt size={22} className="text-text-tertiary" />
                </div>
              )}
              <div>
                <div className="text-[15px] font-semibold">{itemName || 'Analyzing item...'}</div>
                {itemPrice && <div className="text-[13px] text-text-tertiary">₹{itemPrice}</div>}
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {SCAN_STEPS.map((s, i) => {
                const Icon = s.icon
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-3 px-4 py-4 rounded-[14px] transition-all duration-500 ${
                      i < scanStep ? 'bg-card' : i === scanStep ? 'bg-card animate-pulse' : 'bg-card opacity-30'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      i < scanStep ? 'bg-accent' : 'bg-white/[0.06]'
                    }`}>
                      {i < scanStep ? <Check size={18} className="text-white" /> : <Icon size={18} className="text-text-secondary" />}
                    </div>
                    <span className="text-[14px] text-text-secondary">{s.text}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── VERDICT VIEW ── */}
        {view === 'verdict' && verdictResult && (
          <div className="animate-fade-up">
            <div className="px-5 pt-4 pb-2">
              <button onClick={handleDone} className="flex items-center gap-1 text-sm text-text-secondary bg-transparent border-none cursor-pointer">
                <ArrowLeft size={18} /> Back
              </button>
            </div>

            {/* Verdict hero */}
            {(() => {
              const cfg = verdictConfig[verdictResult.verdict]
              const VerdictIcon = cfg.icon
              return (
                <div className={`mx-5 p-5 rounded-[18px] ${cfg.bg} mb-4`}>
                  <div className="flex items-center gap-2.5 mb-2">
                    <VerdictIcon size={24} className={cfg.text} />
                    <span className={`text-lg font-bold ${cfg.text}`}>{cfg.label}</span>
                  </div>
                  <p className="text-[14px] text-text-secondary leading-relaxed">{verdictResult.reason}</p>
                  <p className="text-[11px] text-text-tertiary mt-2.5">Sakhi's take. You know your closet best.</p>
                </div>
              )
            })()}

            {/* Item summary */}
            <div className="flex items-center gap-3 mx-5 p-3 bg-card rounded-[14px] mb-4">
              {itemPreview ? (
                <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0">
                  <img src={itemPreview} alt="" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-xl bg-white/[0.06] flex items-center justify-center shrink-0">
                  <Shirt size={18} className="text-text-tertiary" />
                </div>
              )}
              <div>
                <div className="text-[14px] font-semibold">{itemName || 'Item'}</div>
                {itemPrice && <div className="text-[12px] text-text-tertiary">₹{itemPrice}</div>}
              </div>
            </div>

            {/* Overlap note */}
            {verdictResult.overlap && (
              <div className="mx-5 mb-4 px-4 py-3 bg-card rounded-[14px] flex items-center gap-2.5">
                <Shirt size={18} className="text-text-tertiary shrink-0" />
                <span className="text-[13px] text-text-secondary">{verdictResult.overlap}</span>
              </div>
            )}

            {/* Evidence — collapsed by default */}
            {verdictResult.evidence && verdictResult.evidence.length > 0 && (
              <div className="mx-5 mb-5">
                <button
                  onClick={() => setEvidenceExpanded(!evidenceExpanded)}
                  className="flex items-center gap-2 w-full text-left bg-transparent border-none cursor-pointer py-2"
                >
                  <span className="text-[13px] font-medium text-text-secondary">Detailed breakdown</span>
                  {evidenceExpanded
                    ? <ChevronUp size={16} className="text-text-tertiary" />
                    : <ChevronDown size={16} className="text-text-tertiary" />
                  }
                </button>
                {evidenceExpanded && (
                  <div className="flex flex-col gap-2.5 mt-1 animate-fade-up">
                    {verdictResult.evidence.map((e, i) => (
                      <div key={i} className="bg-card rounded-[12px] p-3.5">
                        <div className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wide mb-1.5">{e.label}</div>
                        {e.metric && <div className="text-lg font-bold text-text-primary mb-0.5">{e.metric}</div>}
                        <div className="text-[12px] text-text-secondary leading-relaxed">{e.text}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* User action buttons */}
            {!showAddPrompt ? (
              <div className="flex gap-2.5 px-5 mb-8">
                <button
                  onClick={() => handleUserAction('skipped')}
                  className="flex-1 py-4 rounded-[14px] text-[15px] font-semibold bg-card text-text-primary border border-border cursor-pointer active:scale-[0.97] transition-transform"
                >
                  Skipping it
                </button>
                <button
                  onClick={() => handleUserAction('bought')}
                  className="flex-1 py-4 rounded-[14px] text-[15px] font-semibold bg-accent text-white border-none cursor-pointer active:scale-[0.97] transition-transform"
                >
                  Buying it
                </button>
              </div>
            ) : (
              <div className="mx-5 mb-8 p-4 bg-card rounded-[16px] animate-fade-up">
                <p className="text-[14px] text-text-primary font-medium mb-3">Add this to your wardrobe?</p>
                <div className="flex gap-2.5">
                  <button
                    onClick={handleSkipAdd}
                    className="flex-1 py-3 rounded-[12px] text-[14px] font-medium bg-transparent text-text-secondary border border-border cursor-pointer active:scale-[0.97] transition-transform"
                  >
                    Not now
                  </button>
                  <button
                    onClick={handleAddToWardrobe}
                    className="flex-1 py-3 rounded-[12px] text-[14px] font-medium bg-accent text-white border-none cursor-pointer active:scale-[0.97] transition-transform flex items-center justify-center gap-1.5"
                  >
                    <Plus size={16} /> Add item
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── GAPS VIEW ── */}
        {view === 'gaps' && (
          <div className="animate-fade-up">
            <div className="px-5 pt-4 pb-2">
              <button onClick={() => setView('main')} className="flex items-center gap-1 text-sm text-text-secondary bg-transparent border-none cursor-pointer">
                <ArrowLeft size={18} /> Back
              </button>
            </div>

            <div className="px-6 mb-5">
              <h1 className="text-[22px] font-bold tracking-tight mb-1.5">What's Missing?</h1>
              <p className="text-sm text-text-tertiary leading-relaxed">Based on your {items.length} items</p>
              {refreshingGaps && (
                <div className="inline-flex items-center gap-2 mt-2.5 px-3 py-1.5 rounded-full bg-card text-[11px] text-text-tertiary">
                  <span className="w-3 h-3 rounded-full border-[1.5px] border-accent border-t-transparent animate-spin" />
                  Taking a fresh look at your closet
                </div>
              )}
            </div>

            {items.length < 5 ? (
              <div className="px-7 py-16 text-center">
                <div className="text-3xl mb-3">👗</div>
                <div className="text-[14px] text-text-secondary mb-1">Add at least 5 items first</div>
                <div className="text-[12px] text-text-tertiary">Sakhi needs enough items to spot meaningful gaps.</div>
              </div>
            ) : loadingGaps ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                <span className="text-[13px] text-text-tertiary">Analyzing your wardrobe...</span>
              </div>
            ) : gapCards.length === 0 ? (
              <div className="px-7 py-16 text-center">
                <div className="text-[14px] text-text-secondary">Could not load gaps. Tap to retry.</div>
                <button onClick={handleShowGaps} className="mt-3 px-5 py-2.5 rounded-xl bg-card text-text-primary text-[13px] font-medium border-none cursor-pointer">
                  Retry
                </button>
              </div>
            ) : (
              <div className="px-5 flex flex-col gap-3 mb-8">
                {gapCards.map((gap, i) => (
                  <div key={i} className="bg-card rounded-[16px] p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{gap.icon}</span>
                      <span className="text-[14px] font-semibold text-text-primary">{gap.title}</span>
                    </div>
                    <p className="text-[13px] text-text-secondary leading-relaxed mb-3">{gap.body}</p>
                    {gap.tags && (
                      <div className="flex flex-wrap gap-1.5">
                        {gap.tags.map(tag => (
                          <span key={tag} className="px-2.5 py-1 rounded-lg bg-white/[0.06] text-[11px] font-medium text-text-tertiary">{tag}</span>
                        ))}
                      </div>
                    )}
                    {gap.pairing && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <Lightbulb size={13} className="text-accent" />
                        <span className="text-[12px] text-accent font-medium">{gap.pairing}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── HISTORY VIEW ── */}
        {view === 'history' && (
          <div className="animate-fade-up">
            <div className="px-5 pt-4 pb-2">
              <button onClick={() => setView('main')} className="flex items-center gap-1 text-sm text-text-secondary bg-transparent border-none cursor-pointer">
                <ArrowLeft size={18} /> Back
              </button>
            </div>

            <div className="px-6 mb-4">
              <h1 className="text-[22px] font-bold tracking-tight mb-1.5">Verdict History</h1>
            </div>

            {/* Savings banner */}
            {moneySaved > 0 && (
              <div className="mx-5 mb-4 px-4 py-3.5 bg-success/5 rounded-[14px] flex items-center gap-3">
                <div className="text-2xl">💰</div>
                <div>
                  <div className="text-[15px] font-bold text-success">₹{moneySaved.toLocaleString()} saved</div>
                  <div className="text-[11px] text-text-tertiary">from {skipCount} skipped purchase{skipCount !== 1 ? 's' : ''}</div>
                </div>
              </div>
            )}

            {pastVerdicts.length === 0 ? (
              <div className="px-7 py-16 text-center">
                <div className="text-3xl mb-3">🔍</div>
                <div className="text-[14px] text-text-secondary">No verdicts yet</div>
                <div className="text-[12px] text-text-tertiary mt-1">Evaluate an item to get started.</div>
              </div>
            ) : (
              <div className="px-5 flex flex-col gap-2.5 mb-8">
                {pastVerdicts.map((v, i) => {
                  const cfg = verdictHistoryConfig[v.verdict] || verdictHistoryConfig.maybe
                  return (
                    <div key={i} className="bg-card rounded-[14px] p-3.5">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-[11px] font-semibold ${cfg.text}`}>{cfg.label}</span>
                        {v.item_price && <span className="text-[11px] text-text-tertiary">₹{v.item_price.toLocaleString()}</span>}
                      </div>
                      <div className="text-[13px] font-semibold truncate">{v.item_name}</div>
                      <div className="text-[11px] text-text-tertiary mt-1 leading-relaxed line-clamp-2">{v.reasoning}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {(view === 'main' || view === 'history') && <BottomNav />}
      <Toast message={toast} visible={!!toast} onHide={() => setToast('')} />
    </div>
  )
}
