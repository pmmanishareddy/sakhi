import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { Sparkles } from 'lucide-react'

export function LoginScreen() {
  const navigate = useNavigate()
  const { user, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth()
  const [isSignUp, setIsSignUp] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) {
      const onboarded = localStorage.getItem('sakhi_onboarded')
      if (onboarded) {
        navigate('/')
      } else {
        navigate('/onboarding')
      }
    }
  }, [user, navigate])

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const result = isSignUp
      ? await signUpWithEmail(email, password, name)
      : await signInWithEmail(email, password)

    if (result.error) {
      setError(result.error)
    } else if (isSignUp) {
      setError(null)
      setIsSignUp(false)
      setPassword('')
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-col items-center justify-center h-full bg-bg px-7">
      <div className="w-20 h-20 rounded-full bg-accent-soft flex items-center justify-center mb-6">
        <Sparkles size={36} className="text-accent" />
      </div>

      <h1 className="text-[28px] font-light tracking-[10px] uppercase text-text-primary mb-3">Sakhi</h1>
      <p className="text-sm text-text-tertiary text-center mb-8 leading-relaxed">
        Your wardrobe, intelligently organized
      </p>

      <form onSubmit={handleEmailAuth} className="w-full space-y-3 mb-4">
        {isSignUp && (
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            className="w-full py-3.5 px-4 rounded-xl bg-white text-[15px] text-[#333] border border-[#e5e5e5] outline-none focus:border-accent"
          />
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="w-full py-3.5 px-4 rounded-xl bg-white text-[15px] text-[#333] border border-[#e5e5e5] outline-none focus:border-accent"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          minLength={6}
          className="w-full py-3.5 px-4 rounded-xl bg-white text-[15px] text-[#333] border border-[#e5e5e5] outline-none focus:border-accent"
        />

        {error && (
          <p className="text-[13px] text-red-500 text-center">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 rounded-[14px] bg-accent text-white text-[15px] font-semibold border-none cursor-pointer active:scale-[0.97] transition-transform disabled:opacity-50"
        >
          {loading ? '...' : isSignUp ? 'Create Account' : 'Sign In'}
        </button>
      </form>

      <button
        onClick={() => { setIsSignUp(!isSignUp); setError(null) }}
        className="text-[13px] text-accent bg-transparent border-none cursor-pointer mb-6"
      >
        {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
      </button>

      <div className="w-full flex items-center gap-3 mb-4">
        <div className="flex-1 h-px bg-[#e5e5e5]" />
        <span className="text-[12px] text-text-tertiary">or</span>
        <div className="flex-1 h-px bg-[#e5e5e5]" />
      </div>

      <button
        onClick={signInWithGoogle}
        className="w-full flex items-center justify-center gap-3 py-4 rounded-[14px] bg-white text-[#333] text-[15px] font-semibold border border-[#e5e5e5] cursor-pointer active:scale-[0.97] transition-transform"
      >
        <svg width="20" height="20" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Continue with Google
      </button>

      <button
        onClick={() => navigate('/onboarding')}
        className="w-full py-3.5 text-[13px] text-text-tertiary bg-transparent border-none cursor-pointer mt-3"
      >
        Continue without account
      </button>

      <p className="text-[11px] text-text-tertiary mt-4 leading-relaxed text-center">
        By continuing you agree to how Sakhi handles your data — photos and wardrobe stay private to you,
        and AI features are powered by Anthropic's Claude.{' '}
        <span className="text-accent cursor-pointer underline" onClick={() => navigate('/privacy')}>
          Privacy
        </span>
      </p>
    </div>
  )
}
