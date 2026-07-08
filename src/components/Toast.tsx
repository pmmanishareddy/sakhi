import { useEffect } from 'react'
import { Check, AlertCircle } from 'lucide-react'

interface ToastProps {
  message: string
  visible: boolean
  onHide: () => void
  color?: string
}

// Errors get a red badge, everything else the accent check —
// call sites just pass a message, tone is inferred
const ERROR_HINTS = /could not|failed|wrong|try again|unable|error/i

export function Toast({ message, visible, onHide, color }: ToastProps) {
  useEffect(() => {
    if (visible) {
      const t = setTimeout(onHide, 2400)
      return () => clearTimeout(t)
    }
  }, [visible, onHide])

  const isError = ERROR_HINTS.test(message)

  return (
    <div
      className={`fixed left-1/2 -translate-x-1/2 bottom-24 z-[999] ${
        visible ? 'toast-in' : 'opacity-0 translate-y-2 pointer-events-none transition-all duration-300'
      }`}
      style={{ maxWidth: '85%' }}
    >
      <div
        className="flex items-center gap-3 pl-2 pr-5 py-2 rounded-full border border-white/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.5)]"
        style={{ background: color || 'rgba(30,29,28,0.92)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
      >
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
          isError ? 'bg-red-500/[0.15]' : 'bg-accent shadow-[0_0_14px_rgba(200,139,110,0.45)]'
        }`}>
          {isError
            ? <AlertCircle size={16} className="text-red-400" />
            : <Check size={15} strokeWidth={3} className="text-white" />}
        </div>
        <span className="text-[13px] font-medium text-text-primary leading-snug py-1">{message}</span>
      </div>
    </div>
  )
}
