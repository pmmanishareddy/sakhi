import { useState, useEffect, useMemo } from 'react'
import { X, Link2, Share2, Check, Loader2 } from 'lucide-react'
import { GROUP_LABELS, groupOf } from '../../lib/categories'
import {
  createShare, revokeShare, fetchLiveShares, normalizeGroups, shareUrl,
  SHARE_EXPIRY_DAYS, type ShareLink, type DbWardrobeItem,
} from '../../lib/api'

interface ShareSheetProps {
  items: DbWardrobeItem[]
  // The wardrobe tab that was open, so the thing you were looking at is
  // already selected and sharing it is one tap.
  initialGroup: string
  onClose: () => void
  onToast: (message: string) => void
}

function sameGroups(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const [x, y] = [normalizeGroups(a), normalizeGroups(b)]
  return x.every((g, i) => y[i] === g)
}

// "Expires Friday" reads better than a date for something a week out.
function expiryLabel(iso: string): string {
  const d = new Date(iso)
  const days = Math.ceil((d.getTime() - Date.now()) / (24 * 3600 * 1000))
  if (days <= 0) return 'Expires today'
  if (days === 1) return 'Expires tomorrow'
  if (days <= 6) return `Expires ${d.toLocaleDateString(undefined, { weekday: 'long' })}`
  return `Expires ${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`
}

export function ShareSheet({ items, initialGroup, onClose, onToast }: ShareSheetProps) {
  const [everything, setEverything] = useState(initialGroup === 'all')
  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(initialGroup === 'all' ? [] : [initialGroup])
  )
  const [title, setTitle] = useState('')
  const [titleEdited, setTitleEdited] = useState(false)
  const [shares, setShares] = useState<ShareLink[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [confirmStop, setConfirmStop] = useState(false)

  useEffect(() => {
    fetchLiveShares()
      .then(setShares)
      .catch(() => setShares([]))
      .finally(() => setLoading(false))
  }, [])

  const groupsWithItems = useMemo(() => {
    const counts = new Map<string, number>()
    for (const i of items) {
      const g = groupOf(i.category)
      counts.set(g, (counts.get(g) || 0) + 1)
    }
    return GROUP_LABELS.filter(l => counts.has(l)).map(l => ({ label: l, count: counts.get(l)! }))
  }, [items])

  const scope = everything ? [] : [...picked]
  const visibleCount = everything
    ? items.length
    : items.filter(i => picked.has(groupOf(i.category))).length

  // An empty scope means "everything", so deselecting every chip must not be
  // read as a match against the full-wardrobe link.
  const hasSelection = everything || picked.size > 0
  const existing = hasSelection ? shares.find(s => sameGroups(s.groups, scope)) : undefined

  // Prefill follows the selection until you type your own title
  const suggestedTitle = useMemo(() => {
    const name = (localStorage.getItem('sakhi_name') || '').trim()
    const owner = name && name !== 'Friend' ? `${name}'s ` : 'My '
    if (everything) return `${owner}wardrobe`
    if (picked.size === 1) return `${owner}${[...picked][0].toLowerCase()}`
    return `${owner}picks`
  }, [everything, picked])

  useEffect(() => {
    if (!titleEdited) setTitle(suggestedTitle)
  }, [suggestedTitle, titleEdited])

  // A different selection is a different link, so any pending confirm is stale
  useEffect(() => { setConfirmStop(false) }, [everything, picked])

  const toggleGroup = (label: string) => {
    setEverything(false)
    setPicked(prev => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  const handleCreate = async () => {
    setCreating(true)
    try {
      const link = await createShare(scope, title)
      setShares(prev => [link, ...prev])
    } catch {
      onToast('Could not create the link. Try again.')
    } finally {
      setCreating(false)
    }
  }

  const handleCopy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(shareUrl(token))
      onToast('Link copied')
    } catch {
      onToast('Could not copy the link')
    }
  }

  const handleShare = async (token: string) => {
    const url = shareUrl(token)
    if (navigator.share) {
      // A cancelled share sheet rejects; that is not an error worth surfacing
      try { await navigator.share({ title: title || 'My wardrobe', url }) } catch { /* dismissed */ }
    } else {
      handleCopy(token)
    }
  }

  const handleStop = async (token: string) => {
    if (!confirmStop) { setConfirmStop(true); return }
    setConfirmStop(false)
    setShares(prev => prev.filter(s => s.token !== token))
    try {
      await revokeShare(token)
      onToast('Link stopped')
    } catch {
      onToast('Could not stop the link. Try again.')
      fetchLiveShares().then(setShares).catch(() => {})
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative w-full bg-bg rounded-t-[24px] px-6 pt-6 animate-fade-up max-h-[88%] overflow-y-auto"
        style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-[12px] bg-accent-soft flex items-center justify-center">
              <Share2 size={17} className="text-accent" />
            </div>
            <span className="text-[15px] font-bold text-text-primary">Share your wardrobe</span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full bg-card flex items-center justify-center border-none cursor-pointer"
          >
            <X size={16} className="text-text-tertiary" />
          </button>
        </div>

        {/* Scope */}
        <div className="text-[12px] text-text-tertiary mb-2.5">What can they see?</div>
        <div className="flex flex-wrap gap-2 mb-4">
          {groupsWithItems.map(g => {
            const active = !everything && picked.has(g.label)
            return (
              <button
                key={g.label}
                onClick={() => toggleGroup(g.label)}
                className={`px-3.5 py-2 rounded-full text-[12.5px] font-medium border cursor-pointer transition-colors ${
                  active
                    ? 'bg-accent text-white border-accent'
                    : 'bg-card text-text-secondary border-white/[0.06]'
                }`}
              >
                {g.label} <span className={active ? 'text-white/70' : 'text-text-tertiary'}>{g.count}</span>
              </button>
            )
          })}
          <button
            onClick={() => { setEverything(true); setPicked(new Set()) }}
            className={`px-3.5 py-2 rounded-full text-[12.5px] font-medium border cursor-pointer transition-colors ${
              everything
                ? 'bg-accent text-white border-accent'
                : 'bg-card text-text-secondary border-white/[0.06]'
            }`}
          >
            Everything
          </button>
        </div>

        <div className="text-[12px] text-text-tertiary mb-5">
          {visibleCount === 0
            ? 'Pick at least one category'
            : `${visibleCount} piece${visibleCount !== 1 ? 's' : ''} will be visible. No prices, no wear counts, no outfit photos.`}
        </div>

        {/* Title. Hidden once a link exists: the name is baked into that link,
            so an editable field there would look like it still does something. */}
        {!existing && (
          <>
            <div className="text-[12px] text-text-tertiary mb-2">Call it something</div>
            <input
              value={title}
              onChange={e => { setTitle(e.target.value); setTitleEdited(true) }}
              maxLength={60}
              aria-label="Share title"
              className="w-full bg-card rounded-xl px-3.5 py-3 mb-5 border border-white/[0.06] outline-none text-[13px] text-text-primary placeholder:text-text-tertiary"
            />
          </>
        )}

        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 size={18} className="text-text-tertiary animate-spin" />
          </div>
        ) : existing ? (
          <>
            <div className="bg-card rounded-[14px] px-3.5 py-3 mb-3 border border-white/[0.06]">
              {existing.title && (
                <div className="text-[13px] font-semibold text-text-primary mb-1.5">{existing.title}</div>
              )}
              <div className="flex items-center gap-2 mb-1.5">
                <Link2 size={13} className="text-accent shrink-0" />
                <span className="text-[12px] text-text-secondary truncate">{shareUrl(existing.token)}</span>
              </div>
              <div className="text-[11px] text-text-tertiary">
                {expiryLabel(existing.expires_at)}
                {existing.view_count > 0 && ` · ${existing.view_count} view${existing.view_count !== 1 ? 's' : ''}`}
              </div>
            </div>

            <div className="flex gap-2.5">
              <button
                onClick={() => handleCopy(existing.token)}
                className="flex-1 py-3.5 rounded-[14px] text-[14px] font-semibold bg-card text-text-primary border border-white/[0.06] cursor-pointer active:scale-[0.97] transition-all"
              >
                Copy link
              </button>
              <button
                onClick={() => handleShare(existing.token)}
                className="flex-1 py-3.5 rounded-[14px] text-[14px] font-semibold bg-accent text-white border-none cursor-pointer active:scale-[0.97] transition-all"
              >
                Share
              </button>
            </div>

            <div className="flex items-center justify-between mt-1">
              <button
                onClick={() => window.open(shareUrl(existing.token), '_blank')}
                className="py-3 text-[12px] text-text-tertiary bg-transparent border-none cursor-pointer"
              >
                Preview
              </button>
              <button
                onClick={() => handleStop(existing.token)}
                className={`py-3 text-[12px] bg-transparent border-none cursor-pointer ${
                  confirmStop ? 'text-red-400 font-semibold' : 'text-text-tertiary'
                }`}
              >
                {confirmStop ? 'Tap again to stop' : 'Stop sharing'}
              </button>
            </div>
          </>
        ) : (
          <>
            <button
              onClick={handleCreate}
              disabled={visibleCount === 0 || creating}
              className="w-full py-4 rounded-[14px] text-[15px] font-semibold bg-accent text-white border-none cursor-pointer active:scale-[0.97] transition-all disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {creating ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              Create link
            </button>
            <div className="text-[11px] text-text-tertiary text-center mt-3 leading-relaxed">
              The link works for {SHARE_EXPIRY_DAYS} days, then stops on its own.
              Anyone who has it can open it, so send it to people you trust.
            </div>
          </>
        )}
      </div>
    </div>
  )
}
