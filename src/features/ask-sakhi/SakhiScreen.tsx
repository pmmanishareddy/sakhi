import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, Image, ArrowLeft, Check, XCircle, CheckCircle, AlertTriangle, Shirt, Search, BarChart3, ChevronDown, ChevronUp, Plus, ShoppingBag, ExternalLink, X, Wand2, Pencil } from 'lucide-react'
import { BottomNav } from '../../components/BottomNav'
import { Toast } from '../../components/Toast'
import { useWardrobe } from '../../lib/wardrobe-store'
import { useAuth } from '../../lib/auth'
import { getPurchaseVerdict, getWardrobeGaps, getShopOptions, savePurchaseVerdict, fetchVerdictHistory, fetchUserStats, fileToBase64, type VerdictResult, type GapCard, type ShopOption, type DbPurchaseVerdict, type DbWardrobeItem } from '../../lib/api'

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
  const [shopFor, setShopFor] = useState<GapCard | null>(null)
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

    // Show the last result instantly and refresh behind it.
    // v2 key: the schema changed, old cached cards must not render.
    const cached = localStorage.getItem('sakhi_gaps_cache_v2')
    if (cached) {
      try { setGapCards(JSON.parse(cached)) } catch { /* stale junk, ignore */ }
      setRefreshingGaps(true)
    } else {
      setLoadingGaps(true)
    }
    try {
      // Accept only new-schema cards; an old deployed function returns
      // cards without `kind`, which must not reach the deck
      const gaps = (await getWardrobeGaps()).filter(g => g && ['buy', 'wear', 'fix'].includes(g.kind))
      setGapCards(gaps)
      if (gaps.length) localStorage.setItem('sakhi_gaps_cache_v2', JSON.stringify(gaps))
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
              <GapDeck
                cards={gapCards}
                items={items}
                onShop={gap => setShopFor(gap)}
                onStyle={() => navigate('/suggest')}
                onFix={id => id && navigate(`/item/${id}`)}
              />
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
      {shopFor?.gap && <ShopSheet gap={shopFor} onClose={() => setShopFor(null)} />}
      <Toast message={toast} visible={!!toast} onHide={() => setToast('')} />
    </div>
  )
}

// ── Gap deck: one gap per card, swiped like stories ──

const KIND_BADGE: Record<GapCard['kind'], { label: string; cls: string }> = {
  buy: { label: 'Worth buying', cls: 'text-accent bg-accent-soft' },
  wear: { label: 'Already yours', cls: 'text-success bg-success/10' },
  fix: { label: 'Quick fix', cls: 'text-text-secondary bg-white/[0.06]' },
}

function GapDeck({ cards, items, onShop, onStyle, onFix }: {
  cards: GapCard[]
  items: DbWardrobeItem[]
  onShop: (card: GapCard) => void
  onStyle: (card: GapCard) => void
  onFix: (itemId?: string) => void
}) {
  const [deckIndex, setDeckIndex] = useState(0)
  const deckRef = useRef<HTMLDivElement>(null)
  const itemsById = new Map(items.map(i => [i.id, i]))
  const resolve = (ids: string[]) => ids.map(id => itemsById.get(id)).filter(Boolean) as DbWardrobeItem[]

  const counts = { buy: 0, wear: 0, fix: 0 }
  for (const c of cards) counts[c.kind]++
  const mix = [
    counts.buy > 0 && `${counts.buy} worth buying`,
    counts.wear > 0 && `${counts.wear} already in your closet`,
    counts.fix > 0 && `${counts.fix} quick fix${counts.fix > 1 ? 'es' : ''}`,
  ].filter(Boolean).join(' · ')

  const onScroll = () => {
    const el = deckRef.current
    if (!el?.firstElementChild) return
    const cardW = (el.firstElementChild as HTMLElement).clientWidth + 12
    setDeckIndex(Math.min(cards.length, Math.round(el.scrollLeft / cardW)))
  }

  return (
    <div className="mb-8">
      <p className="px-6 -mt-2 mb-3 text-[12px] text-text-tertiary">{mix}</p>

      {/* Progress dots */}
      <div className="flex justify-center gap-1.5 mb-3">
        {[...cards, null].map((c, i) => (
          <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${
            i === deckIndex ? 'w-5 bg-accent' : `w-1.5 ${c && c.kind === 'buy' ? 'bg-accent/40' : 'bg-white/[0.12]'}`
          }`} />
        ))}
      </div>

      <div
        ref={deckRef}
        onScroll={onScroll}
        className="flex gap-3 overflow-x-auto px-6 pb-4 snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none' }}
      >
        {cards.map((card, i) => {
          const evidence = resolve(card.evidence_ids).slice(0, card.ghost ? 3 : 4)
          const extra = card.evidence_ids.length - evidence.length
          const unlocks = resolve(card.unlocks_ids).slice(0, 4)
          const badge = KIND_BADGE[card.kind]
          return (
            <div key={i} className="snap-center shrink-0 w-[82vw] max-w-[330px] bg-card rounded-[20px] p-5 flex flex-col cascade-item" style={{ animationDelay: `${i * 120}ms` }}>
              <span className={`self-start px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${badge.cls}`}>{badge.label}</span>

              {/* Evidence collage + ghost slot */}
              {(evidence.length > 0 || card.ghost) && (
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {evidence.map((it, j) => (
                    <div key={it.id} className="relative aspect-square rounded-[12px] overflow-hidden bg-white/[0.04]">
                      {it.image_url && <img src={it.image_url} alt={it.name} className="w-full h-full object-cover" />}
                      {j === evidence.length - 1 && extra > 0 && !card.ghost && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-[15px] font-bold text-white">+{extra}</div>
                      )}
                    </div>
                  ))}
                  {card.ghost && (
                    <div className="aspect-square rounded-[12px] border border-dashed border-accent/50 bg-accent-soft flex flex-col items-center justify-center gap-1.5">
                      <Plus size={20} className="text-accent" />
                      <span className="text-[11px] text-accent font-medium text-center px-2 leading-tight">{card.ghost.label}</span>
                    </div>
                  )}
                </div>
              )}
              {card.evidence_label && <p className="text-[11px] text-text-tertiary mt-2">{card.evidence_label}</p>}

              <h2 className="text-[19px] font-bold tracking-tight mt-3 leading-snug">{card.title}</h2>
              <p className="text-[14px] text-accent font-semibold mt-1">{card.headline}</p>
              <p className="text-[13px] text-text-secondary leading-relaxed mt-2.5 flex-1">{card.body}</p>

              {unlocks.length > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] uppercase tracking-wider text-text-tertiary mb-1.5">Would pair with</p>
                  <div className="flex">
                    {unlocks.map((it, j) => (
                      <div key={it.id} className={`w-10 h-10 rounded-[10px] overflow-hidden border-2 border-bg bg-white/[0.04] ${j > 0 ? '-ml-2' : ''}`}>
                        {it.image_url && <img src={it.image_url} alt="" className="w-full h-full object-cover" />}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* One action per kind */}
              {card.kind === 'buy' && card.gap && (
                <button
                  onClick={() => onShop(card)}
                  className="mt-4 w-full py-3.5 rounded-[13px] text-[14px] font-semibold bg-accent text-white border-none cursor-pointer active:scale-[0.97] transition-all flex items-center justify-center gap-2"
                >
                  <ShoppingBag size={16} /> Show me options
                </button>
              )}
              {card.kind === 'wear' && (
                <button
                  onClick={() => onStyle(card)}
                  className="mt-4 w-full py-3.5 rounded-[13px] text-[14px] font-semibold bg-white/[0.06] text-text-primary border-none cursor-pointer active:scale-[0.97] transition-all flex items-center justify-center gap-2"
                >
                  <Wand2 size={16} /> Style it
                </button>
              )}
              {card.kind === 'fix' && (
                <button
                  onClick={() => onFix(card.evidence_ids[0])}
                  className="mt-4 w-full py-3.5 rounded-[13px] text-[14px] font-semibold bg-white/[0.06] text-text-primary border-none cursor-pointer active:scale-[0.97] transition-all flex items-center justify-center gap-2"
                >
                  <Pencil size={15} /> Fix it now
                </button>
              )}
            </div>
          )
        })}

        {/* Closing summary card */}
        <div className="snap-center shrink-0 w-[82vw] max-w-[330px] bg-card rounded-[20px] p-5 flex flex-col items-center justify-center text-center cascade-item" style={{ animationDelay: `${cards.length * 120}ms` }}>
          <div className="glow-orb w-14 h-14 rounded-full bg-accent-soft flex items-center justify-center mb-4">
            <Check size={24} className="text-accent" />
          </div>
          <h2 className="text-[18px] font-bold tracking-tight">That's the honest picture</h2>
          <p className="text-[13px] text-text-secondary leading-relaxed mt-2">{mix}.</p>
          <p className="text-[12px] text-text-tertiary leading-relaxed mt-3">Sakhi only suggests buying when your closet truly needs it.</p>
        </div>
      </div>
    </div>
  )
}

// ── Shopping options sheet: real products for a buy-gap ──

function ShopSheet({ gap, onClose }: { gap: GapCard; onClose: () => void }) {
  const [options, setOptions] = useState<ShopOption[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!gap.gap) return
    getShopOptions(gap.gap)
      .then(setOptions)
      .catch(() => setError(true))
  }, [gap])

  return (
    <div className="fixed inset-0 z-[70] flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-bg rounded-t-[24px] max-h-[80%] flex flex-col animate-fade-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-3 shrink-0">
          <div>
            <h2 className="text-[17px] font-bold tracking-tight">{gap.ghost?.label || gap.gap?.role}</h2>
            <p className="text-[12px] text-text-tertiary mt-0.5">Found on the open web. Sponsored picks will always say so.</p>
          </div>
          <button onClick={onClose} className="p-2 bg-white/[0.06] rounded-full border-none cursor-pointer text-text-secondary flex">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-10">
          {error ? (
            <p className="text-[13px] text-text-tertiary text-center py-10">Could not fetch options right now. Try again in a bit.</p>
          ) : !options ? (
            <div className="flex flex-col gap-2.5 py-2">
              <div className="flex items-center gap-2.5 justify-center py-3 text-[13px] text-text-tertiary">
                <span className="w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                Sakhi is looking around for you
              </div>
              {[0, 1, 2].map(i => (
                <div key={i} className="h-[72px] rounded-[14px] bg-card animate-pulse" />
              ))}
            </div>
          ) : options.length === 0 ? (
            <p className="text-[13px] text-text-tertiary text-center py-10">Nothing good enough came up. Sakhi doesn't pad results.</p>
          ) : (
            <div className="flex flex-col gap-2.5 py-2">
              {options.map((o, i) => (
                <a
                  key={i}
                  href={o.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3.5 p-3.5 rounded-[14px] bg-card no-underline cascade-item active:scale-[0.98] transition-transform"
                  style={{ animationDelay: `${i * 90}ms` }}
                >
                  <div className="w-10 h-10 rounded-[10px] bg-white/[0.06] flex items-center justify-center shrink-0">
                    <ShoppingBag size={17} className="text-text-secondary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-text-primary truncate">{o.title}</span>
                      {o.sponsored && (
                        <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-accent-soft text-accent">Sponsored</span>
                      )}
                    </div>
                    <div className="text-[11px] text-text-tertiary truncate mt-0.5">
                      {[o.brand, o.price && `${o.currency === 'INR' ? '₹' : o.currency + ' '}${o.price}`, o.source].filter(Boolean).join(' · ')}
                    </div>
                    {o.note && <div className="text-[11px] text-text-secondary mt-1 leading-snug">{o.note}</div>}
                  </div>
                  <ExternalLink size={14} className="text-text-tertiary shrink-0" />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
