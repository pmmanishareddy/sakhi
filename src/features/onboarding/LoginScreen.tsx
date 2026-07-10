import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { MirrorMark } from '../../components/MirrorMark'

export function LoginScreen() {
  const navigate = useNavigate()
  const { user, signInWithEmail, signUpWithEmail } = useAuth()
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
        <MirrorMark size={38} />
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

      <p className="text-[11px] text-text-tertiary mt-4 leading-relaxed text-center">
        By continuing you agree to how Sakhi handles your data. Photos and wardrobe stay private to you,
        and AI features are powered by Anthropic's Claude.{' '}
        <span className="text-accent cursor-pointer underline" onClick={() => navigate('/privacy')}>
          Privacy
        </span>
      </p>
    </div>
  )
}
