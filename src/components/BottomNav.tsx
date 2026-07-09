import { Home, Shirt, Sparkles, User } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'

const tabs = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/wardrobe', icon: Shirt, label: 'Wardrobe' },
  { path: '/sakhi', icon: Sparkles, label: 'Sakhi' },
  { path: '/profile', icon: User, label: 'Profile' },
]

export function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <nav
      className="flex justify-around items-center px-5 pt-2.5 bg-bg shrink-0"
      style={{ paddingBottom: 'max(1.75rem, calc(0.625rem + env(safe-area-inset-bottom)))' }}
    >
      {tabs.map(({ path, icon: Icon, label }) => {
        const active = location.pathname === path
        return (
          <button
            key={path}
            onClick={() => navigate(path)}
            className={`flex flex-col items-center gap-1 text-[10px] font-medium bg-transparent border-none cursor-pointer transition-colors ${
              active ? 'text-text-primary' : 'text-text-tertiary'
            }`}
          >
            <div className={label === 'Sakhi' && active ? 'sakhi-glow' : ''}>
              <Icon size={22} strokeWidth={active ? 2.2 : 1.5} />
            </div>
            <span>{label}</span>
          </button>
        )
      })}
    </nav>
  )
}
