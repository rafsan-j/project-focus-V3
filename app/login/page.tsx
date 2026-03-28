'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function handleAuth() {
    if (!email || !password) {
      setError('Please enter both email and password.')
      return
    }

    setLoading(true)
    setError('')
    setMessage('')

    const supabase = createClient()

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message)
        setLoading(false)
      } else {
        setMessage('Account created! Now log in below.')
        setIsSignUp(false)
        setLoading(false)
      }
      return
    }

    // LOGIN
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    if (!data.session) {
      setError('No session returned. Try again.')
      setLoading(false)
      return
    }

    // Success — hard redirect
    window.location.href = '/'
  }

  const inp: React.CSSProperties = {
    width: '100%',
    background: '#0d0f14',
    border: '1px solid #2a2f45',
    borderRadius: '10px',
    padding: '11px 14px',
    color: '#e8eaf2',
    fontSize: '14px',
    outline: 'none',
    marginTop: '6px',
    fontFamily: 'sans-serif',
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d0f14', padding: '20px' }}>
      <div style={{ background: '#13161e', border: '1px solid #2a2f45', borderRadius: '20px', padding: '40px', width: '100%', maxWidth: '400px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ width: '44px', height: '44px', background: '#5b7cff', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            </svg>
          </div>
          <div style={{ fontWeight: 800, fontSize: '20px', color: '#e8eaf2', letterSpacing: '-0.5px' }}>PROJECT FOCUS</div>
          <div style={{ color: '#9aa0bb', fontSize: '13px', marginTop: '4px' }}>
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </div>
        </div>

        {/* Env check — tells you immediately if keys are missing */}
        <div style={{ background: '#0d0f14', borderRadius: '8px', padding: '10px 12px', marginBottom: '16px', fontSize: '12px' }}>
          <div style={{ color: supabaseUrl ? '#3ddc84' : '#ff5c7a', marginBottom: '3px' }}>
            {supabaseUrl ? '✓ Supabase URL connected' : '✗ SUPABASE URL MISSING — add to Vercel env vars'}
          </div>
          <div style={{ color: supabaseKey ? '#3ddc84' : '#ff5c7a' }}>
            {supabaseKey ? '✓ Anon key connected' : '✗ ANON KEY MISSING — add to Vercel env vars'}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: 'rgba(255,92,122,0.1)', border: '1px solid rgba(255,92,122,0.3)', borderRadius: '10px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#ff5c7a' }}>
            {error}
          </div>
        )}

        {/* Success */}
        {message && (
          <div style={{ background: 'rgba(61,220,132,0.1)', border: '1px solid rgba(61,220,132,0.3)', borderRadius: '10px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#3ddc84' }}>
            {message}
          </div>
        )}

        {/* Email */}
        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.8px', color: '#9aa0bb' }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAuth()}
            placeholder="you@email.com"
            style={inp}
          />
        </div>

        {/* Password */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.8px', color: '#9aa0bb' }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAuth()}
            placeholder="••••••••"
            style={inp}
          />
        </div>

        {/* Button */}
        <button
          onClick={handleAuth}
          disabled={loading || !supabaseUrl || !supabaseKey}
          style={{
            width: '100%',
            background: (!supabaseUrl || !supabaseKey) ? '#22263a' : '#5b7cff',
            border: 'none',
            borderRadius: '10px',
            padding: '13px',
            color: '#fff',
            fontWeight: 700,
            fontSize: '15px',
            cursor: (loading || !supabaseUrl || !supabaseKey) ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {!supabaseUrl || !supabaseKey
            ? 'Missing env vars — check above'
            : loading
            ? 'Please wait...'
            : isSignUp
            ? 'Create Account'
            : 'Log In'}
        </button>

        {/* Toggle */}
        <div style={{ textAlign: 'center', marginTop: '18px', fontSize: '13px', color: '#9aa0bb' }}>
          {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
          <span
            style={{ color: '#5b7cff', cursor: 'pointer', fontWeight: 500 }}
            onClick={() => { setIsSignUp(!isSignUp); setError(''); setMessage('') }}
          >
            {isSignUp ? 'Log in' : 'Sign up free'}
          </span>
        </div>

      </div>
    </div>
  )
}
