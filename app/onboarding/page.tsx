'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const GOALS = [
  { id:'career', label:'Career & Skills', icon:'💼' },
  { id:'academic', label:'University / Academic', icon:'🎓' },
  { id:'religious', label:'Islamic / Ilm Studies', icon:'📖' },
  { id:'language', label:'Language Learning', icon:'🌍' },
  { id:'programming', label:'Programming', icon:'💻' },
  { id:'hobby', label:'Hobby & Personal', icon:'🎯' },
]

export default function OnboardingPage() {
  const [step, setStep] = useState(0)
  const [goals, setGoals] = useState<string[]>([])
  const [hours, setHours] = useState(2)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  function toggleGoal(id: string) {
    setGoals(prev => prev.includes(id) ? prev.filter(g=>g!==id) : [...prev, id])
  }

  async function finish() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.replace('/login'); return }
    await supabase.from('user_profiles').upsert({
      id: user.id, goals, hours_per_day: hours, onboarding_complete: true
    })
    window.location.replace('/')
  }

  const card: React.CSSProperties = {
    background:'#13161e', border:'1px solid #2a2f45', borderRadius:'20px',
    padding:'40px', width:'100%', maxWidth:'500px'
  }

  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0d0f14',padding:'20px'}}>
      <div style={card}>
        {/* Progress */}
        <div style={{display:'flex',gap:'6px',marginBottom:'32px'}}>
          {[0,1].map(i => (
            <div key={i} style={{flex:1,height:'3px',borderRadius:'2px',background:i<=step?'#5b7cff':'#2a2f45',transition:'background .3s'}}/>
          ))}
        </div>

        {step === 0 && (
          <>
            <div style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:'22px',color:'#e8eaf2',marginBottom:'6px'}}>What are you learning?</div>
            <div style={{color:'#9aa0bb',fontSize:'13px',marginBottom:'24px'}}>Pick all that apply. This helps prioritize your courses.</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'28px'}}>
              {GOALS.map(g => (
                <button key={g.id} onClick={()=>toggleGoal(g.id)}
                  style={{background:goals.includes(g.id)?'rgba(91,124,255,0.15)':'#1a1d27',border:`1px solid ${goals.includes(g.id)?'#5b7cff':'#2a2f45'}`,borderRadius:'12px',padding:'14px',cursor:'pointer',textAlign:'left',transition:'all .15s'}}>
                  <div style={{fontSize:'20px',marginBottom:'4px'}}>{g.icon}</div>
                  <div style={{fontSize:'13px',fontWeight:500,color:goals.includes(g.id)?'#5b7cff':'#e8eaf2'}}>{g.label}</div>
                </button>
              ))}
            </div>
            <button onClick={()=>setStep(1)} disabled={!goals.length}
              style={{width:'100%',background:'#5b7cff',border:'none',borderRadius:'10px',padding:'13px',color:'#fff',fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:'15px',cursor:goals.length?'pointer':'not-allowed',opacity:goals.length?1:0.5}}>
              Continue →
            </button>
          </>
        )}

        {step === 1 && (
          <>
            <div style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:'22px',color:'#e8eaf2',marginBottom:'6px'}}>How many hours can you study daily?</div>
            <div style={{color:'#9aa0bb',fontSize:'13px',marginBottom:'32px'}}>Used to help prioritize your active courses realistically.</div>
            <div style={{textAlign:'center',marginBottom:'16px'}}>
              <div style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:'56px',color:'#5b7cff',lineHeight:1}}>{hours}</div>
              <div style={{fontSize:'13px',color:'#9aa0bb',marginTop:'4px'}}>hours per day</div>
            </div>
            <input type="range" min={0.5} max={12} step={0.5} value={hours} onChange={e=>setHours(Number(e.target.value))}
              style={{width:'100%',accentColor:'#5b7cff',marginBottom:'32px'}}/>
            <div style={{display:'flex',gap:'10px'}}>
              <button onClick={()=>setStep(0)}
                style={{flex:1,background:'none',border:'1px solid #2a2f45',borderRadius:'10px',padding:'12px',color:'#9aa0bb',cursor:'pointer',fontSize:'14px'}}>
                Back
              </button>
              <button onClick={finish} disabled={saving}
                style={{flex:2,background:'#5b7cff',border:'none',borderRadius:'10px',padding:'12px',color:'#fff',fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:'15px',cursor:'pointer',opacity:saving?0.7:1}}>
                {saving ? 'Saving...' : "Let's Focus →"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
