import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export function Splash() {
  const navigate = useNavigate()

  useEffect(() => {
    const t = setTimeout(() => navigate('/onboarding'), 2200)
    return () => clearTimeout(t)
  }, [navigate])

  return (
    <div className="flex flex-col items-center justify-center h-full bg-bg" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="text-5xl font-light tracking-[14px] uppercase text-text-primary animate-fade-up">
        Sakhi
      </div>
      <div
        className="text-[11px] tracking-[3px] uppercase text-text-tertiary mt-3.5"
        style={{ animation: 'fadeUp 0.8s ease-out 0.25s both' }}
      >
        Your wardrobe, with a brain
      </div>
    </div>
  )
}
