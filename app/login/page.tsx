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
    if (!email || !password) { setError('Enter email and password.'); return }
    setLoading(true); setError(''); setMessage('')
    const supabase = createClient()
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin + '/auth/callback' }
        })
        if (error) setError(error.message)
        else setMessage('Account created! You can now log in.')
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) { setError(error.message); setLoading(false); return }
        if (data.session) { window.location.replace('/'); return }
        setError('Login failed. Please try again.')
      }
    } catch (e: any) { setError(e.message) }
    setLoading(false)
  }

  const inp: React.CSSProperties = {
    width:'100%', background:'#0d0f14', border:'1px solid #2a2f45',
    borderRadius:'10px', padding:'11px 14px', color:'#e8eaf2',
    fontSize:'14px', outline:'none', marginTop:'6px'
  }

  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0d0f14',padding:'20px'}}>
      <div style={{background:'#13161e',border:'1px solid #2a2f45',borderRadius:'20px',padding:'40px',width:'100%',maxWidth:'400px'}}>
        <div style={{textAlign:'center',marginBottom:'32px'}}>
          <div style={{width:'48px',height:'48px',background:'#5b7cff',borderRadius:'14px',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px'}}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
            </svg>
          </div>
          <div style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:'22px',color:'#e8eaf2',letterSpacing:'-0.5px'}}>PROJECT FOCUS</div>
          <div style={{color:'#9aa0bb',fontSize:'13px',marginTop:'4px'}}>{isSignUp ? 'Create your account' : 'Welcome back'}</div>
        </div>

        {error && <div style={{background:'rgba(255,92,122,0.1)',border:'1px solid rgba(255,92,122,0.3)',borderRadius:'10px',padding:'11px 14px',marginBottom:'16px',fontSize:'13px',color:'#ff5c7a'}}>{error}</div>}
        {message && <div style={{background:'rgba(61,220,132,0.1)',border:'1px solid rgba(61,220,132,0.3)',borderRadius:'10px',padding:'11px 14px',marginBottom:'16px',fontSize:'13px',color:'#3ddc84'}}>{message}</div>}

        <div style={{marginBottom:'14px'}}>
          <label style={{fontSize:'11px',fontWeight:600,textTransform:'uppercase',letterSpacing:'.8px',color:'#9aa0bb'}}>Email</label>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleAuth()} placeholder="you@email.com" style={inp}/>
        </div>
        <div style={{marginBottom:'24px'}}>
          <label style={{fontSize:'11px',fontWeight:600,textTransform:'uppercase',letterSpacing:'.8px',color:'#9aa0bb'}}>Password</label>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleAuth()} placeholder="••••••••" style={inp}/>
        </div>

        <button onClick={handleAuth} disabled={loading}
          style={{width:'100%',background:'#5b7cff',border:'none',borderRadius:'10px',padding:'13px',color:'#fff',fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:'15px',cursor:loading?'not-allowed':'pointer',opacity:loading?0.7:1,letterSpacing:'.3px'}}>
          {loading ? 'Please wait...' : isSignUp ? 'Create Account' : 'Log In'}
        </button>

        <div style={{textAlign:'center',marginTop:'18px',fontSize:'13px',color:'#9aa0bb'}}>
          {isSignUp ? 'Have an account? ' : 'No account? '}
          <span style={{color:'#5b7cff',cursor:'pointer',fontWeight:500}} onClick={()=>{setIsSignUp(!isSignUp);setError('');setMessage('')}}>
            {isSignUp ? 'Log in' : 'Sign up free'}
          </span>
        </div>
      </div>
    </div>
  )
}
