import { useEffect } from 'react'

interface ToastProps {
  message: string
  visible: boolean
  onHide: () => void
  color?: string
}

export function Toast({ message, visible, onHide, color }: ToastProps) {
  useEffect(() => {
    if (visible) {
      const t = setTimeout(onHide, 2000)
      return () => clearTimeout(t)
    }
  }, [visible, onHide])

  return (
    <div
      className={`fixed left-1/2 -translate-x-1/2 px-5 py-3 rounded-xl text-sm font-medium text-white z-[999] transition-all duration-300 ${
        visible ? 'bottom-24 opacity-100' : 'bottom-16 opacity-0 pointer-events-none'
      }`}
      style={{ background: color || '#333', maxWidth: '85%' }}
    >
      {message}
    </div>
  )
}
