import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Loader2, Luggage } from 'lucide-react'
import { Toast } from '../../components/Toast'
import { fetchTrips, createTrip, MAX_TRIPS, type Trip } from '../../lib/api'

export function TripsScreen() {
  const navigate = useNavigate()
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)
  const [naming, setNaming] = useState(false)
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  const load = useCallback(() => {
    fetchTrips()
      .then(setTrips)
      .catch(() => setToast('Could not load your lists'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  const atLimit = trips.length >= MAX_TRIPS

  const handleCreate = async () => {
    if (!title.trim() || saving) return
    setSaving(true)
    try {
      const trip = await createTrip(title)
      navigate(`/trips/${trip.id}`)
    } catch {
      setToast('Could not create that list. Try again.')
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-3 px-5 pt-4 pb-3 shrink-0">
        <button
          onClick={() => navigate('/')}
          aria-label="Back"
          className="w-9 h-9 rounded-full bg-card flex items-center justify-center border-none cursor-pointer shrink-0"
        >
          <ArrowLeft size={18} className="text-text-secondary" />
        </button>
        <h1 className="text-[22px] font-bold tracking-tight">Planning</h1>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-5">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={20} className="text-text-tertiary animate-spin" />
          </div>
        ) : (
          <>
            {trips.length === 0 && !naming && (
              <div className="px-4 py-12 text-center animate-fade-up">
                <div className="w-14 h-14 rounded-2xl bg-accent-soft flex items-center justify-center mx-auto mb-4">
                  <Luggage size={26} className="text-accent" />
                </div>
                <h2 className="text-[17px] font-bold tracking-tight mb-2">Plan what to pack</h2>
                <p className="text-[13px] text-text-tertiary leading-relaxed">
                  Pull outfits and pieces from your closet into a list, and note
                  where each one is going.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2.5">
              {trips.map(trip => (
                <button
                  key={trip.id}
                  onClick={() => navigate(`/trips/${trip.id}`)}
                  className="flex items-center gap-3 p-3 rounded-[16px] bg-card border-none cursor-pointer text-left active:scale-[0.98] transition-transform"
                >
                  {/* Three covers give a sense of the list without opening it */}
                  <div className="flex gap-1 shrink-0">
                    {trip.entries.slice(0, 3).map(e => (
                      <div key={e.id} className="w-11 h-14 rounded-lg overflow-hidden bg-bg">
                        {e.cover_url && <img src={e.cover_url} alt="" className="w-full h-full object-cover" />}
                      </div>
                    ))}
                    {trip.entries.length === 0 && (
                      <div className="w-11 h-14 rounded-lg bg-bg flex items-center justify-center">
                        <Plus size={16} className="text-text-tertiary" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] font-semibold text-text-primary truncate">{trip.title}</div>
                    <div className="text-[12px] text-text-tertiary mt-0.5">
                      {trip.entries.length === 0
                        ? 'Nothing added yet'
                        : `${trip.entries.length} piece${trip.entries.length !== 1 ? 's' : ''}`}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {naming ? (
              <div className="mt-2.5 p-3.5 rounded-[16px] bg-card animate-fade-up">
                <input
                  autoFocus
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  maxLength={40}
                  placeholder="Goa, December"
                  aria-label="List name"
                  className="w-full bg-transparent border-none outline-none text-[15px] font-semibold text-text-primary placeholder:text-text-tertiary mb-3"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => { setNaming(false); setTitle('') }}
                    className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold bg-bg text-text-secondary border-none cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={!title.trim() || saving}
                    className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold bg-accent text-white border-none cursor-pointer disabled:opacity-40"
                  >
                    Create
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => !atLimit && setNaming(true)}
                disabled={atLimit}
                className="w-full mt-2.5 py-3.5 rounded-[16px] text-[14px] font-semibold bg-card text-text-secondary border border-dashed border-white/10 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Plus size={16} />
                New list
              </button>
            )}

            {atLimit && !naming && (
              <div className="text-[11px] text-text-tertiary text-center mt-2.5 leading-relaxed">
                You can keep {MAX_TRIPS} lists at a time. Delete one to start another.
              </div>
            )}
          </>
        )}
        <div className="h-10" />
      </div>

      <Toast message={toast} visible={!!toast} onHide={() => setToast('')} />
    </div>
  )
}
