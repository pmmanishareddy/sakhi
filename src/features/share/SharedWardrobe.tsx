import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { X, Loader2 } from 'lucide-react'
import { fetchSharedWardrobe, type SharedWardrobe as Shared, type SharedItem } from '../../lib/api'
import { sectionize } from '../../lib/categories'
import { MirrorMark } from '../../components/MirrorMark'

// The one screen a signed-out stranger ever sees. No nav, no account, no way
// to walk from here into anything else the owner has.

type State =
  | { status: 'loading' }
  | { status: 'error'; kind: 'expired' | 'missing' | 'offline' }
  | { status: 'ready'; data: Shared }

const ERROR_COPY = {
  expired: {
    title: 'This link has expired',
    body: 'Shared wardrobes stay open for a week. Ask for a fresh link.',
  },
  missing: {
    title: 'This link is not active',
    body: 'It may have been stopped, or the address is not quite right.',
  },
  offline: {
    title: 'Could not load this wardrobe',
    body: 'Check your connection and try again.',
  },
}

export function SharedWardrobe() {
  const { token } = useParams()
  const [state, setState] = useState<State>({ status: 'loading' })
  const [open, setOpen] = useState<SharedItem | null>(null)

  useEffect(() => {
    if (!token) {
      setState({ status: 'error', kind: 'missing' })
      return
    }
    let cancelled = false
    fetchSharedWardrobe(token)
      .then(data => { if (!cancelled) setState({ status: 'ready', data }) })
      .catch((err: Error) => {
        if (cancelled) return
        const kind = err.message === 'expired' ? 'expired'
          : err.message === 'not_found' ? 'missing'
          : 'offline'
        setState({ status: 'error', kind })
      })
    return () => { cancelled = true }
  }, [token])

  // Shared pages are read by people who are not signed in, so the document
  // title is the only naming they get before the content loads.
  useEffect(() => {
    if (state.status === 'ready') {
      document.title = state.data.title || `${state.data.owner_name}'s wardrobe`
    }
    return () => { document.title = 'Sakhi' }
  }, [state])

  if (state.status === 'loading') {
    return (
      <div className="flex items-center justify-center h-full bg-bg">
        <Loader2 size={22} className="text-text-tertiary animate-spin" />
      </div>
    )
  }

  if (state.status === 'error') {
    const copy = ERROR_COPY[state.kind]
    return (
      <div className="flex flex-col items-center justify-center h-full bg-bg px-9 text-center">
        <div className="text-3xl mb-4">🪞</div>
        <h1 className="text-[17px] font-bold tracking-tight mb-2">{copy.title}</h1>
        <p className="text-[13px] text-text-tertiary leading-relaxed">{copy.body}</p>
      </div>
    )
  }

  const { data } = state
  const sections = sectionize(data.items)
  const heading = data.title || `${data.owner_name}'s wardrobe`

  return (
    <div className="flex flex-col h-full min-h-0 bg-bg">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-6 pt-7 pb-5">
          <h1 className="text-[22px] font-bold tracking-tight leading-tight">{heading}</h1>
          <div className="text-[12.5px] text-text-tertiary mt-1.5">
            Shared by {data.owner_name} · {data.items.length} piece{data.items.length !== 1 ? 's' : ''}
          </div>
        </div>

        {data.items.length === 0 && (
          <div className="px-9 py-12 text-center">
            <p className="text-[13px] text-text-tertiary leading-relaxed">
              There is nothing in here yet.
            </p>
          </div>
        )}

        {sections.map(section => (
          <div key={section.label} className="mb-6">
            {sections.length > 1 && (
              <div className="px-6 mb-2.5 text-[12px] font-semibold text-text-secondary tracking-wide">
                {section.label}
                <span className="text-text-tertiary font-normal ml-1.5">{section.items.length}</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2.5 px-5">
              {section.items.map(item => (
                <button
                  key={item.id}
                  onClick={() => setOpen(item)}
                  className="relative rounded-xl overflow-hidden cursor-pointer bg-card border-none card-press aspect-[3/4]"
                >
                  <img
                    src={item.image_url}
                    alt={item.name}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="absolute bottom-0 left-0 right-0 pt-5 pb-2 px-2 bg-gradient-to-t from-black/75 to-transparent flex items-center gap-1.5">
                    <span
                      className="w-[7px] h-[7px] rounded-full shrink-0 border border-white/20"
                      style={{ background: item.color_hex }}
                    />
                    <span className="text-[11px] font-medium text-white/90 truncate">{item.name}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* The only way out of this page, and the reason it earns its keep */}
        <a
          href="/"
          className="flex flex-col items-center gap-2 px-6 pt-4 pb-12 no-underline"
        >
          <MirrorMark size={26} />
          <span className="text-[12px] text-text-tertiary">Made with Sakhi</span>
        </a>
      </div>

      {open && (
        <div className="fixed inset-0 z-[100] bg-bg flex flex-col animate-fade-up">
          <button
            onClick={() => setOpen(null)}
            aria-label="Close"
            className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-black/55 backdrop-blur-sm flex items-center justify-center border-none cursor-pointer"
          >
            <X size={17} className="text-white" />
          </button>

          <div className="flex-1 min-h-0 flex items-center justify-center bg-black">
            <img src={open.image_url} alt={open.name} className="max-w-full max-h-full object-contain" />
          </div>

          <div className="px-6 pt-5" style={{ paddingBottom: 'calc(1.75rem + env(safe-area-inset-bottom))' }}>
            <div className="text-[17px] font-bold tracking-tight mb-2.5">{open.name}</div>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-text-tertiary">
              <span className="flex items-center gap-1.5">
                <span
                  className="w-[8px] h-[8px] rounded-full border border-white/20"
                  style={{ background: open.color_hex }}
                />
                {open.primary_color}
              </span>
              {open.fabric && <span>{open.fabric}</span>}
              {open.pattern && open.pattern !== 'Solid' && <span>{open.pattern}</span>}
              {open.brand && <span>{open.brand}</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
