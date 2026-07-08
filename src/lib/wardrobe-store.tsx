import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useAuth } from './auth'
import { fetchWardrobeItems, type DbWardrobeItem } from './api'

interface WardrobeState {
  items: DbWardrobeItem[]
  loading: boolean
  refresh: () => Promise<void>
}

const WardrobeContext = createContext<WardrobeState>({
  items: [],
  loading: true,
  refresh: async () => {},
})

export function WardrobeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [items, setItems] = useState<DbWardrobeItem[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user) {
      setItems([])
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      const data = await fetchWardrobeItems()
      setItems(data)
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { refresh() }, [refresh])

  return (
    <WardrobeContext.Provider value={{ items, loading, refresh }}>
      {children}
    </WardrobeContext.Provider>
  )
}

export const useWardrobe = () => useContext(WardrobeContext)
