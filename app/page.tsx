'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

type Category = { id: string; name: string }
type Module = { id: string; course_id: string; title: string; resource_url: string; order_index: number; is_completed: boolean; notes: string; duration_mins: number }
type Course = { id: string; category_id: string; title: string; source_url: string; app_deeplink: string; pdf_path: string; status: string; is_override: boolean; priority_score: number; urgency: number; importance: number; difficulty: number; ai_generated: boolean; modules: Module[]; categories?: Category }
type Profile = { goals: string[]; hours_per_day: number; deadline: string | null; onboarding_complete: boolean }

export default function App() {
  const supabase = createClient()
  const [view, setView] = useState<'dashboard'|'planner'|'wishlist'|'course'>('dashboard')
  const [courseView, setCourseView] = useState<string|null>(null)
  const [filterCat, setFilterCat] = useState('all')
  const [categories, setCategories] = useState<Category[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [profile, setProfile] = useState<Profile|null>(null)
  const [userId, setUserId] = useState('')
  const [toast, setToast] = useState('')
  const [modal, setModal] = useState<{title:string;body:string;label:string;fn:()=>void}|null>(null)
  const [loading, setLoading] = useState(true)

  // planner form
  const [newTitle, setNewTitle] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [newCatId, setNewCatId] = useState('')
  const [newAppLink, setNewAppLink] = useState('')
  const [newPdfPath, setNewPdfPath] = useState('')
  const [slU, setSlU] = useState(5)
  const [slI, setSlI] = useState(5)
  const [slD, setSlD] = useState(5)
  const [aiModules, setAiModules] = useState<{title:string;url:string;duration_mins:number}[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [manualMode, setManualMode] = useState(false)
  const [manualModules, setManualModules] = useState('')

  const toastTimer = useRef<any>(null)

  function showToast(msg: string) {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2800)
  }

  const score = parseFloat(((slU*0.6)+(slI*0.3)+(slD*0.1)).toFixed(1))

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.replace('/login'); return }
    setUserId(user.id)

    const [{ data: cats }, { data: coursesData }, { data: prof }] = await Promise.all([
      supabase.from('categories').select('*').order('name'),
      supabase.from('courses').select('*, categories(*), modules(*)').eq('user_id', user.id).order('priority_score', { ascending: false }),
      supabase.from('user_profiles').select('*').eq('id', user.id).single(),
    ])

    if (!prof?.onboarding_complete) { window.location.replace('/onboarding'); return }

    if (cats) { setCategories(cats); if (!newCatId && cats.length) setNewCatId(cats[0].id) }
    if (prof) setProfile(prof)
    if (coursesData) {
      setCourses(coursesData.map((c: Course) => ({
        ...c, modules: (c.modules||[]).sort((a: Module, b: Module) => a.order_index - b.order_index)
      })))
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [])

  // Register service worker + push
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(async reg => {
        if ('Notification' in window && Notification.permission === 'default') {
          const perm = await Notification.requestPermission()
          if (perm === 'granted') {
            showToast('Notifications enabled!')
          }
        }
      })
    }
  }, [])

  // ── HELPERS ──
  function courseProgress(c: Course) {
    if (!c.modules?.length) return 0
    return Math.round((c.modules.filter(m=>m.is_completed).length / c.modules.length) * 100)
  }
  function currentModule(c: Course) {
    const idx = c.modules?.findIndex(m=>!m.is_completed) ?? -1
    return idx === -1 ? c.modules?.[c.modules.length-1] : c.modules?.[idx]
  }
  function activeInCat(catId: string) {
    return courses.filter(c=>c.category_id===catId&&c.status==='active').length
  }
  function daysLeft() {
    if (!profile?.deadline) return null
    const diff = Math.ceil((new Date(profile.deadline).getTime() - Date.now()) / 86400000)
    return diff > 0 ? diff : 0
  }

  // ── OPEN LINK (fixes the subpath bug) ──
  function openLink(url: string) {
    if (!url || url === '#') { showToast('No link set for this module.'); return }
    // Force absolute URL
    const href = url.startsWith('http') ? url : 'https://' + url
    window.open(href, '_blank', 'noopener,noreferrer')
  }

  // ── AI MODULE GENERATION ──
  async function generateModules() {
  if (!newUrl && !newTitle) { showToast('Enter a URL or title first.'); return }
  setAiLoading(true)
  setAiModules([])
  try {
    const res = await fetch('/api/ai-course', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: newUrl,
        title: newTitle,
        category: categories.find(c => c.id === newCatId)?.name,
        goals: profile?.goals || []
      })
    })
    const data = await res.json()
    console.log('AI response:', JSON.stringify(data, null, 2))

    if (data.modules?.length) {
      setAiModules(data.modules)
      showToast(`✨ AI generated ${data.modules.length} modules via ${data.model_used?.split('/')[1] || 'AI'}!`)
    } else {
      const detail = data.openrouter_message || data.openrouter_code || data.error || 'Unknown'
      showToast(`AI error: ${detail}`)
      console.error('Full AI error:', data)
      setManualMode(true)
    }
  } catch (err: any) {
    showToast(`Network error: ${err.message}`)
    setManualMode(true)
  }
  setAiLoading(false)
}

  // ── ADD COURSE ──
  async function addCourse() {
    if (!newTitle.trim()) { showToast('Enter a course title.'); return }

    const { data: courseData, error } = await supabase.from('courses').insert({
      user_id: userId, category_id: newCatId, title: newTitle.trim(),
      source_url: newUrl, app_deeplink: newAppLink, pdf_path: newPdfPath,
      status: 'wishlist', priority_score: score,
      urgency: slU, importance: slI, difficulty: slD,
      ai_generated: aiModules.length > 0
    }).select().single()

    if (error || !courseData) { showToast('Error saving course.'); return }

    const finalModules = aiModules.length > 0
      ? aiModules.map((m, i) => ({ course_id: courseData.id, title: m.title, resource_url: m.url, order_index: i, is_completed: false, notes: '', duration_mins: m.duration_mins || 0 }))
      : manualModules.trim().split('\n').filter(l=>l.trim()).map((l, i) => {
          const parts = l.split('|')
          return { course_id: courseData.id, title: parts[0].trim(), resource_url: parts[1]?.trim() || newUrl || '#', order_index: i, is_completed: false, notes: '', duration_mins: 0 }
        })

    if (finalModules.length) await supabase.from('modules').insert(finalModules)
    else if (newUrl) await supabase.from('modules').insert({ course_id: courseData.id, title: 'Start here', resource_url: newUrl, order_index: 0, is_completed: false, notes: '', duration_mins: 0 })

    setNewTitle(''); setNewUrl(''); setNewAppLink(''); setNewPdfPath('')
    setManualModules(''); setAiModules([]); setSlU(5); setSlI(5); setSlD(5)
    showToast(`"${newTitle.trim()}" added!`)
    await loadData()
    setView('wishlist')
  }

  // ── ACTIVATE ──
  async function activateCourse(c: Course) {
    const active = activeInCat(c.category_id)
    if (active >= 3) { showToast('Slot full! Complete or remove a course.'); return }
    if (active === 2) {
      setModal({ title:'Override Warning ⚠', body:`You already have 2 active courses. Activating "${c.title}" uses your override slot.`, label:'Force Activate',
        fn: async () => {
          await supabase.from('courses').update({status:'active',is_override:true}).eq('id',c.id)
          await loadData(); showToast('Override activated!')
        }
      })
    } else {
      await supabase.from('courses').update({status:'active',is_override:false}).eq('id',c.id)
      await loadData(); showToast(`"${c.title}" is now active!`)
    }
  }

  async function demoteCourse(c: Course) {
    setModal({ title:'Move to Wishlist?', body:`"${c.title}" will be moved to wishlist.`, label:'Move',
      fn: async () => { await supabase.from('courses').update({status:'wishlist',is_override:false}).eq('id',c.id); setCourseView(null); setView('dashboard'); await loadData() }
    })
  }

  async function completeCourse(c: Course) {
    setModal({ title:'Mark Complete?', body:`Mark "${c.title}" as completed?`, label:'Complete',
      fn: async () => { await supabase.from('courses').update({status:'completed'}).eq('id',c.id); setCourseView(null); setView('dashboard'); await loadData(); showToast('Course completed! 🎉') }
    })
  }

  async function deleteCourse(c: Course) {
    setModal({ title:'Delete?', body:`Delete "${c.title}" permanently?`, label:'Delete',
      fn: async () => { await supabase.from('courses').delete().eq('id',c.id); setCourseView(null); setView('dashboard'); await loadData() }
    })
  }

  async function toggleModule(courseId: string, mod: Module) {
    await supabase.from('modules').update({ is_completed: !mod.is_completed }).eq('id', mod.id)
    await loadData()
  }

  async function saveNote(modId: string, notes: string) {
    await supabase.from('modules').update({ notes }).eq('id', modId)
  }

  async function saveDeadline(d: string) {
    await supabase.from('user_profiles').update({ deadline: d }).eq('id', userId)
    setProfile(prev => prev ? { ...prev, deadline: d } : prev)
    showToast('Deadline saved!')
  }

  async function signOut() {
    await supabase.auth.signOut(); window.location.replace('/login')
  }

  // ── RING ──
  function Ring({ pct, size=44 }: { pct: number; size?: number }) {
    const r = size/2-3, circ = 2*Math.PI*r, fill = circ*(pct/100)
    return (
      <div style={{position:'relative',width:size,height:size,flexShrink:0}}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{transform:'rotate(-90deg)'}}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#22263a" strokeWidth="3"/>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#5b7cff" strokeWidth="3" strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"/>
        </svg>
        <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:'10px',color:'#e8eaf2'}}>{pct}%</div>
      </div>
    )
  }

  if (loading) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0d0f14',color:'#9aa0bb',gap:'12px'}}>
      <svg className="spinner" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5b7cff" strokeWidth="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/></svg>
      Loading...
    </div>
  )

  const activeCourse = courseView ? courses.find(x=>x.id===courseView) : null
  const days = daysLeft()

  // shared styles
  const navBtn = (active: boolean): React.CSSProperties => ({
    background: active?'rgba(91,124,255,0.15)':'none',
    border: active?'1px solid rgba(91,124,255,0.25)':'1px solid transparent',
    color: active?'#5b7cff':'#9aa0bb',
    fontFamily:'DM Sans,sans-serif', fontSize:'13px', fontWeight:500,
    padding:'6px 14px', borderRadius:'10px', cursor:'pointer', transition:'all .15s'
  })

  const btn = (variant: 'primary'|'ghost'|'danger' = 'primary', small = false): React.CSSProperties => ({
    background: variant==='primary'?'#5b7cff':variant==='danger'?'rgba(255,92,122,0.15)':'none',
    border: variant==='primary'?'none':variant==='danger'?'1px solid rgba(255,92,122,0.3)':'1px solid #2a2f45',
    borderRadius:'8px', padding: small?'5px 12px':'8px 18px',
    color: variant==='primary'?'#fff':variant==='danger'?'#ff5c7a':'#9aa0bb',
    fontSize: small?'12px':'13px', fontWeight:600, cursor:'pointer',
    fontFamily:'DM Sans,sans-serif', transition:'all .15s', whiteSpace:'nowrap' as const
  })

  const inp: React.CSSProperties = {
    width:'100%', background:'#0d0f14', border:'1px solid #2a2f45',
    borderRadius:'10px', padding:'10px 13px', color:'#e8eaf2',
    fontSize:'13px', outline:'none', fontFamily:'DM Sans,sans-serif'
  }

  const label: React.CSSProperties = {
    display:'block', fontSize:'11px', fontWeight:600,
    textTransform:'uppercase', letterSpacing:'.8px', color:'#9aa0bb', marginBottom:'6px'
  }

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh',overflow:'hidden',background:'#0d0f14'}}>

      {/* TOPBAR */}
      <div style={{display:'flex',alignItems:'center',gap:'0',background:'#13161e',borderBottom:'1px solid #2a2f45',padding:'0 16px',height:'52px',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:'8px',fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:'15px',marginRight:'20px',letterSpacing:'-0.5px',color:'#e8eaf2',flexShrink:0}}>
          <div style={{width:'28px',height:'28px',background:'#5b7cff',borderRadius:'8px',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>
          </div>
          <span style={{display:'none'}}>PROJECT FOCUS</span>
        </div>
        <div style={{display:'flex',gap:'2px',flex:1,overflowX:'auto'}}>
          {(['dashboard','planner','wishlist'] as const).map(v => (
            <button key={v} style={navBtn(view===v&&!activeCourse||(v==='dashboard'&&!!activeCourse&&view==='course'))} onClick={()=>{setCourseView(null);setView(v)}}>
              {v.charAt(0).toUpperCase()+v.slice(1)}
            </button>
          ))}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'10px',flexShrink:0}}>
          {days !== null && (
            <div style={{display:'flex',alignItems:'center',gap:'6px',background:'#1a1d27',border:'1px solid #2a2f45',borderRadius:'20px',padding:'4px 12px',cursor:'pointer'}}
              onClick={()=>{const d=prompt('University start date (YYYY-MM-DD):',profile?.deadline||'');if(d)saveDeadline(d)}}>
              <span style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:'16px',color:'#5b7cff'}}>{days}</span>
              <span style={{fontSize:'10px',color:'#5c6280',textTransform:'uppercase',letterSpacing:'.5px'}}>days</span>
            </div>
          )}
          {days === null && (
            <button style={{...btn('ghost',true)}} onClick={()=>{const d=prompt('Set deadline (YYYY-MM-DD):');if(d)saveDeadline(d)}}>Set deadline</button>
          )}
          <button style={btn('ghost',true)} onClick={signOut}>Sign out</button>
        </div>
      </div>

      <div style={{display:'flex',flex:1,overflow:'hidden'}}>

        {/* SIDEBAR */}
        <div style={{width:'180px',background:'#13161e',borderRight:'1px solid #2a2f45',flexShrink:0,padding:'12px 8px',display:'flex',flexDirection:'column',gap:'2px',overflowY:'auto'}}>
          <div style={{fontSize:'10px',fontWeight:600,textTransform:'uppercase',letterSpacing:'1px',color:'#5c6280',padding:'8px 8px 4px'}}>Filter</div>
          {[{id:'all',name:'All'},...categories].map(cat => {
            const count = cat.id==='all' ? courses.filter(c=>c.status==='active').length : courses.filter(c=>c.status==='active'&&c.category_id===cat.id).length
            const active = filterCat===cat.id
            return (
              <button key={cat.id} onClick={()=>{setFilterCat(cat.id);setCourseView(null);setView('dashboard')}}
                style={{display:'flex',alignItems:'center',padding:'8px',borderRadius:'8px',cursor:'pointer',fontSize:'13px',color:active?'#5b7cff':'#9aa0bb',background:active?'rgba(91,124,255,0.1)':'none',border:active?'1px solid rgba(91,124,255,0.2)':'1px solid transparent',width:'100%',textAlign:'left',fontFamily:'DM Sans,sans-serif',gap:'6px'}}>
                {cat.name}
                <span style={{marginLeft:'auto',background:active?'rgba(91,124,255,0.2)':'#22263a',color:active?'#5b7cff':'#9aa0bb',fontSize:'10px',fontWeight:600,padding:'1px 6px',borderRadius:'20px'}}>{count}</span>
              </button>
            )
          })}
          <div style={{height:'1px',background:'#2a2f45',margin:'8px 0'}}/>
          <button onClick={()=>{setCourseView(null);setView('planner')}}
            style={{display:'flex',alignItems:'center',padding:'8px',borderRadius:'8px',cursor:'pointer',fontSize:'13px',color:'#9aa0bb',background:'none',border:'1px solid transparent',width:'100%',textAlign:'left',fontFamily:'DM Sans,sans-serif',gap:'6px'}}>
            + New course
          </button>
        </div>

        {/* MAIN */}
        <div style={{flex:1,overflowY:'auto',padding:'24px'}} className="fade-in">

          {/* ── COURSE DETAIL ── */}
          {view==='course' && activeCourse && (() => {
            const c = activeCourse
            const pct = courseProgress(c)
            return (
              <div>
                <button style={{...btn('ghost',true),marginBottom:'20px',display:'flex',alignItems:'center',gap:'6px'}} onClick={()=>{setCourseView(null);setView('dashboard')}}>
                  ← Dashboard
                </button>
                <div style={{display:'flex',alignItems:'flex-start',gap:'16px',marginBottom:'20px',flexWrap:'wrap'}}>
                  <div style={{flex:1}}>
                    <div style={{fontFamily:'Syne,sans-serif',fontSize:'22px',fontWeight:800,letterSpacing:'-0.5px',marginBottom:'4px'}}>{c.title}</div>
                    <div style={{color:'#9aa0bb',fontSize:'13px'}}>{c.modules?.filter(m=>m.is_completed).length}/{c.modules?.length} modules · {pct}%</div>
                  </div>
                  <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                    {c.app_deeplink && (
                      <button style={btn('primary',true)} onClick={()=>openLink(c.app_deeplink)}>Open App</button>
                    )}
                    {c.source_url && (
                      <button style={btn('ghost',true)} onClick={()=>openLink(c.source_url)}>Source ↗</button>
                    )}
                    {c.pdf_path && (
                      <button style={btn('ghost',true)} onClick={()=>showToast('PDF path: '+c.pdf_path)}>📄 PDF</button>
                    )}
                    <button style={btn('primary',true)} onClick={()=>completeCourse(c)}>Complete</button>
                    <button style={btn('ghost',true)} onClick={()=>demoteCourse(c)}>Wishlist</button>
                    <button style={btn('danger',true)} onClick={()=>deleteCourse(c)}>Delete</button>
                  </div>
                </div>
                <div style={{height:'6px',background:'#22263a',borderRadius:'3px',marginBottom:'24px',overflow:'hidden'}}>
                  <div style={{height:'100%',background:'#5b7cff',width:`${pct}%`,borderRadius:'3px',transition:'width .4s'}}/>
                </div>
                <div style={{fontSize:'11px',fontWeight:600,textTransform:'uppercase',letterSpacing:'1.5px',color:'#5c6280',marginBottom:'14px'}}>Modules</div>
                <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                  {c.modules?.map((m, i) => {
                    const prevDone = i===0||c.modules[i-1].is_completed
                    const isActive = !m.is_completed&&prevDone
                    const isLocked = !m.is_completed&&!prevDone
                    return <ModuleRow key={m.id} m={m} i={i} isActive={isActive} isLocked={isLocked} courseId={c.id} onToggle={toggleModule} onNote={saveNote} onOpen={openLink}/>
                  })}
                </div>
              </div>
            )
          })()}

          {/* ── DASHBOARD ── */}
          {view==='dashboard' && !activeCourse && (
            <div>
              <div style={{fontFamily:'Syne,sans-serif',fontSize:'22px',fontWeight:800,letterSpacing:'-0.5px',marginBottom:'4px'}}>Dashboard</div>
              <div style={{color:'#9aa0bb',fontSize:'13px',marginBottom:'24px'}}>
                {courses.filter(c=>c.status==='active').length} active · {courses.filter(c=>c.status==='wishlist').length} queued
              </div>
              {(filterCat==='all'?categories:categories.filter(c=>c.id===filterCat)).map(cat => {
                const catCourses = courses.filter(c=>c.status==='active'&&c.category_id===cat.id)
                return (
                  <div key={cat.id} style={{marginBottom:'28px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'14px'}}>
                      <div style={{fontFamily:'Syne,sans-serif',fontSize:'17px',fontWeight:700}}>{cat.name}</div>
                      <div style={{fontSize:'11px',color:'#9aa0bb',background:'#1a1d27',padding:'2px 10px',borderRadius:'20px',border:'1px solid #2a2f45'}}>{catCourses.length}/3</div>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(230px,1fr))',gap:'12px'}}>
                      {catCourses.map(c => {
                        const pct = courseProgress(c)
                        const cur = currentModule(c)
                        return (
                          <div key={c.id} style={{background:'#13161e',border:`1px solid ${c.is_override?'rgba(255,92,122,0.3)':'#2a2f45'}`,borderRadius:'14px',padding:'16px',cursor:'pointer',position:'relative',transition:'border-color .2s'}}
                            onClick={()=>{setCourseView(c.id);setView('course')}}>
                            {c.is_override&&<div style={{position:'absolute',top:'10px',right:'10px',background:'rgba(255,92,122,0.12)',color:'#ff5c7a',fontSize:'9px',fontWeight:700,textTransform:'uppercase',letterSpacing:'.8px',padding:'2px 7px',borderRadius:'20px',border:'1px solid rgba(255,92,122,0.25)'}}>OVERRIDE</div>}
                            {c.ai_generated&&<div style={{position:'absolute',top:'10px',left:'10px',background:'rgba(91,124,255,0.12)',color:'#5b7cff',fontSize:'9px',fontWeight:700,textTransform:'uppercase',letterSpacing:'.8px',padding:'2px 7px',borderRadius:'20px',border:'1px solid rgba(91,124,255,0.25)'}}>AI</div>}
                            <div style={{fontFamily:'Syne,sans-serif',fontSize:'14px',fontWeight:700,marginBottom:'4px',paddingTop:c.ai_generated?'16px':'0',paddingRight:c.is_override?'60px':'0',lineHeight:1.3}}>{c.title}</div>
                            <div style={{fontSize:'11px',color:'#9aa0bb',marginBottom:'12px'}}>{c.modules?.length||0} modules</div>
                            <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'12px'}}>
                              <Ring pct={pct}/>
                              <div style={{flex:1}}>
                                <div style={{height:'4px',background:'#22263a',borderRadius:'2px',overflow:'hidden',marginBottom:'3px'}}>
                                  <div style={{height:'100%',background:'#5b7cff',width:`${pct}%`,borderRadius:'2px'}}/>
                                </div>
                                <div style={{fontSize:'11px',color:'#9aa0bb'}}>{c.modules?.filter(m=>m.is_completed).length}/{c.modules?.length} done</div>
                              </div>
                            </div>
                            {cur&&<div style={{fontSize:'11px',color:'#9aa0bb',marginBottom:'12px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>▶ {cur.title}</div>}
                            <button
                              onClick={e=>{e.stopPropagation();openLink(cur?.resource_url||'')}}
                              style={{width:'100%',background:'#5b7cff',border:'none',borderRadius:'8px',padding:'8px',fontSize:'12px',fontWeight:600,color:'#fff',cursor:'pointer'}}>
                              Go to lesson ↗
                            </button>
                          </div>
                        )
                      })}
                      {catCourses.length<2&&(
                        <div onClick={()=>setView('wishlist')} style={{background:'#0d0f14',border:'1px dashed #2a2f45',borderRadius:'14px',display:'flex',alignItems:'center',justifyContent:'center',color:'#5c6280',fontSize:'13px',cursor:'pointer',minHeight:'120px'}}>
                          + Activate from wishlist
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── PLANNER ── */}
          {view==='planner' && !activeCourse && (
            <div>
              <div style={{fontFamily:'Syne,sans-serif',fontSize:'22px',fontWeight:800,letterSpacing:'-0.5px',marginBottom:'4px'}}>Add Course</div>
              <div style={{color:'#9aa0bb',fontSize:'13px',marginBottom:'24px'}}>Paste a URL and let AI break it into modules, or add manually.</div>

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'20px'}}>
                <div>
                  {/* Title */}
                  <div style={{marginBottom:'14px'}}>
                    <label style={label}>Course Title</label>
                    <input style={inp} value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder="e.g., Arabic Grammar Basics"/>
                  </div>

                  {/* URL */}
                  <div style={{marginBottom:'14px'}}>
                    <label style={label}>Course / Playlist URL</label>
                    <div style={{display:'flex',gap:'8px'}}>
                      <input style={{...inp,flex:1}} value={newUrl} onChange={e=>setNewUrl(e.target.value)} placeholder="https://youtube.com/playlist?list=..."/>
                      <button style={{...btn('primary'),flexShrink:0,display:'flex',alignItems:'center',gap:'6px'}} onClick={generateModules} disabled={aiLoading}>
                        {aiLoading ? <svg className="spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/></svg> : '✨'}
                        {aiLoading ? 'Analyzing...' : 'AI Parse'}
                      </button>
                    </div>
                    <div style={{fontSize:'11px',color:'#5c6280',marginTop:'5px'}}>Works best with YouTube playlists. AI will suggest modules for other sites.</div>
                  </div>

                  {/* Category */}
                  <div style={{marginBottom:'14px'}}>
                    <label style={label}>Category</label>
                    <select style={{...inp,appearance:'none'}} value={newCatId} onChange={e=>setNewCatId(e.target.value)}>
                      {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>

                  {/* App deeplink */}
                  <div style={{marginBottom:'14px'}}>
                    <label style={label}>App Deep Link <span style={{textTransform:'none',letterSpacing:0,fontSize:'11px',color:'#5c6280'}}>(optional — opens an app)</span></label>
                    <input style={inp} value={newAppLink} onChange={e=>setNewAppLink(e.target.value)} placeholder="duolingo:// or https://www.duolingo.com"/>
                    <div style={{fontSize:'11px',color:'#5c6280',marginTop:'5px'}}>e.g. duolingo://, sololearn://, anki://</div>
                  </div>

                  {/* PDF path */}
                  <div style={{marginBottom:'14px'}}>
                    <label style={label}>PDF File Path <span style={{textTransform:'none',letterSpacing:0,fontSize:'11px',color:'#5c6280'}}>(optional — no upload, just path)</span></label>
                    <input style={inp} value={newPdfPath} onChange={e=>setNewPdfPath(e.target.value)} placeholder="/storage/emulated/0/Downloads/book.pdf"/>
                    <div style={{fontSize:'11px',color:'#5c6280',marginTop:'5px'}}>Saves the file location only. Nothing is uploaded.</div>
                  </div>

                  {/* AI modules result */}
                  {aiModules.length > 0 && (
                    <div style={{background:'rgba(91,124,255,0.08)',border:'1px solid rgba(91,124,255,0.2)',borderRadius:'12px',padding:'14px',marginBottom:'14px'}}>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'10px'}}>
                        <div style={{fontSize:'12px',fontWeight:600,color:'#5b7cff'}}>✨ AI generated {aiModules.length} modules</div>
                        <button style={{...btn('ghost',true),fontSize:'11px'}} onClick={()=>{setAiModules([]);setManualMode(true)}}>Edit manually</button>
                      </div>
                      {aiModules.map((m,i) => (
                        <div key={i} style={{display:'flex',alignItems:'center',gap:'10px',padding:'8px 0',borderBottom:i<aiModules.length-1?'1px solid #2a2f45':'none'}}>
                          <span style={{fontSize:'11px',color:'#5c6280',width:'20px',flexShrink:0,fontFamily:'Syne,sans-serif',fontWeight:700}}>{i+1}</span>
                          <div style={{flex:1}}>
                            <div style={{fontSize:'13px',color:'#e8eaf2'}}>{m.title}</div>
                            <div style={{fontSize:'11px',color:'#5c6280',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.url}</div>
                          </div>
                          {m.duration_mins>0&&<span style={{fontSize:'11px',color:'#9aa0bb',flexShrink:0}}>{m.duration_mins}m</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Manual modules */}
                  {(manualMode || aiModules.length===0) && (
                    <div style={{marginBottom:'14px'}}>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'6px'}}>
                        <label style={{...label,margin:0}}>Manual Modules</label>
                        <span style={{fontSize:'11px',color:'#5c6280'}}>Title | URL (one per line)</span>
                      </div>
                      <textarea style={{...inp,resize:'vertical'}} value={manualModules} onChange={e=>setManualModules(e.target.value)} rows={4}
                        placeholder={"Intro to Arabic | https://youtube.com/watch?v=...\nLesson 2 | https://..."}/>
                    </div>
                  )}

                  {/* Priority sliders */}
                  <div style={{background:'#1a1d27',border:'1px solid #2a2f45',borderRadius:'12px',padding:'14px',marginBottom:'14px'}}>
                    <div style={{fontSize:'11px',fontWeight:600,textTransform:'uppercase',letterSpacing:'.8px',color:'#5c6280',marginBottom:'12px'}}>Priority</div>
                    {[['Urgency',slU,setSlU],['Importance',slI,setSlI],['Difficulty',slD,setSlD]].map(([lbl,val,set]) => (
                      <div key={lbl as string} style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'8px'}}>
                        <span style={{fontSize:'12px',color:'#9aa0bb',width:'80px',flexShrink:0}}>{lbl as string}</span>
                        <input type="range" min={1} max={10} value={val as number} onChange={e=>(set as any)(Number(e.target.value))} style={{flex:1,accentColor:'#5b7cff'}}/>
                        <span style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:'14px',color:'#5b7cff',width:'18px',textAlign:'right'}}>{val as number}</span>
                      </div>
                    ))}
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:'8px',paddingTop:'10px',borderTop:'1px solid #2a2f45'}}>
                      <span style={{fontSize:'11px',color:'#5c6280',fontFamily:'monospace'}}>P=(U×0.6)+(I×0.3)+(D×0.1)</span>
                      <span style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:'20px',color:'#5b7cff'}}>{score}</span>
                    </div>
                  </div>

                  <button onClick={addCourse} style={{width:'100%',background:'#5b7cff',border:'none',borderRadius:'10px',padding:'13px',color:'#fff',fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:'15px',cursor:'pointer',letterSpacing:'.3px'}}>
                    Add to Wishlist →
                  </button>
                </div>

                {/* Slot status panel */}
                <div>
                  <div style={{fontSize:'11px',fontWeight:600,textTransform:'uppercase',letterSpacing:'1.5px',color:'#5c6280',marginBottom:'14px'}}>Active Slot Status</div>
                  {categories.map(cat => {
                    const a = activeInCat(cat.id)
                    return (
                      <div key={cat.id} style={{background:'#13161e',border:'1px solid #2a2f45',borderRadius:'12px',padding:'14px',marginBottom:'10px'}}>
                        <div style={{display:'flex',justifyContent:'space-between',marginBottom:'8px',fontSize:'13px'}}>
                          <span>{cat.name}</span>
                          <span style={{color:a>=3?'#ff5c7a':a===2?'#ffc142':'#3ddc84',fontWeight:700,fontFamily:'Syne,sans-serif'}}>{a}/3</span>
                        </div>
                        <div style={{height:'4px',background:'#22263a',borderRadius:'2px',overflow:'hidden'}}>
                          <div style={{height:'100%',width:`${(a/3)*100}%`,background:a>=3?'#ff5c7a':a===2?'#ffc142':'#5b7cff',borderRadius:'2px',transition:'width .3s'}}/>
                        </div>
                      </div>
                    )
                  })}
                  <div style={{background:'#13161e',border:'1px solid #2a2f45',borderRadius:'12px',padding:'14px',marginTop:'4px'}}>
                    <div style={{fontSize:'12px',fontWeight:600,color:'#e8eaf2',marginBottom:'8px'}}>App Deep Link Examples</div>
                    {[['Duolingo','duolingo://'],['Sololearn','sololearn://'],['Anki','anki://'],['Khan Academy','https://www.khanacademy.org']].map(([name,link]) => (
                      <div key={name} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid #2a2f45',fontSize:'12px'}}>
                        <span style={{color:'#9aa0bb'}}>{name}</span>
                        <code style={{color:'#5b7cff',fontSize:'11px'}}>{link}</code>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── WISHLIST ── */}
          {view==='wishlist' && !activeCourse && (
            <div>
              <div style={{fontFamily:'Syne,sans-serif',fontSize:'22px',fontWeight:800,letterSpacing:'-0.5px',marginBottom:'4px'}}>Wishlist</div>
              <div style={{color:'#9aa0bb',fontSize:'13px',marginBottom:'24px'}}>{courses.filter(c=>c.status==='wishlist').length} queued · sorted by priority score</div>
              <div style={{display:'flex',flexDirection:'column',gap:'10px',marginBottom:'24px'}}>
                {courses.filter(c=>c.status==='wishlist').sort((a,b)=>b.priority_score-a.priority_score).map(c => {
                  const cat = categories.find(x=>x.id===c.category_id)
                  const a = activeInCat(c.category_id)
                  return (
                    <div key={c.id} style={{background:'#13161e',border:`1px solid ${c.is_override?'rgba(255,92,122,0.3)':'#2a2f45'}`,borderRadius:'14px',padding:'14px 16px'}}>
                      <div style={{display:'flex',alignItems:'center',gap:'14px'}}>
                        <div style={{textAlign:'center',flexShrink:0}}>
                          <div style={{fontSize:'10px',textTransform:'uppercase',color:'#5c6280',marginBottom:'2px'}}>Score</div>
                          <div style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:'20px',color:'#5b7cff'}}>{c.priority_score}</div>
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontFamily:'Syne,sans-serif',fontSize:'14px',fontWeight:700,marginBottom:'2px'}}>{c.title}</div>
                          <div style={{fontSize:'11px',color:'#9aa0bb'}}>{cat?.name} · {c.modules?.length||0} modules{c.ai_generated?' · ✨ AI':''}</div>
                        </div>
                        <div style={{display:'flex',gap:'8px',flexShrink:0}}>
                          <button disabled={a>=3} onClick={()=>activateCourse(c)}
                            style={{...btn(a>=3?'ghost':'primary',true),opacity:a>=3?0.5:1,cursor:a>=3?'not-allowed':'pointer'}}>
                            {a>=3?'Full':'Activate →'}
                          </button>
                          <button style={btn('danger',true)} onClick={()=>deleteCourse(c)}>Del</button>
                        </div>
                      </div>
                    </div>
                  )
                })}
                {!courses.filter(c=>c.status==='wishlist').length && (
                  <div style={{display:'flex',flexDirection:'column',alignItems:'center',padding:'48px 24px',textAlign:'center',gap:'10px',color:'#9aa0bb'}}>
                    <div style={{fontSize:'16px',fontFamily:'Syne,sans-serif',fontWeight:700}}>Wishlist is empty</div>
                    <button onClick={()=>setView('planner')} style={{...btn('primary'),marginTop:'8px'}}>Add a Course →</button>
                  </div>
                )}
              </div>
              {courses.filter(c=>c.status==='completed').length>0&&(
                <>
                  <div style={{height:'1px',background:'#2a2f45',margin:'24px 0'}}/>
                  <div style={{fontSize:'11px',fontWeight:600,textTransform:'uppercase',letterSpacing:'1.5px',color:'#5c6280',marginBottom:'14px'}}>Completed</div>
                  {courses.filter(c=>c.status==='completed').map(c=>(
                    <div key={c.id} style={{background:'#13161e',border:'1px solid #2a2f45',borderRadius:'14px',padding:'12px 16px',display:'flex',alignItems:'center',gap:'12px',opacity:.6,marginBottom:'8px'}}>
                      <span style={{color:'#3ddc84',fontSize:'16px'}}>✓</span>
                      <div style={{flex:1}}>
                        <div style={{fontFamily:'Syne,sans-serif',fontSize:'13px',fontWeight:700}}>{c.title}</div>
                        <div style={{fontSize:'11px',color:'#9aa0bb'}}>{categories.find(x=>x.id===c.category_id)?.name}</div>
                      </div>
                      <button style={btn('danger',true)} onClick={()=>deleteCourse(c)}>Remove</button>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* MODAL */}
      {modal&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,backdropFilter:'blur(4px)'}}>
          <div style={{background:'#13161e',border:'1px solid #2a2f45',borderRadius:'20px',padding:'28px',maxWidth:'360px',width:'90%'}}>
            <div style={{fontFamily:'Syne,sans-serif',fontSize:'18px',fontWeight:700,marginBottom:'10px'}}>{modal.title}</div>
            <p style={{color:'#9aa0bb',fontSize:'13px',marginBottom:'22px',lineHeight:1.6}}>{modal.body}</p>
            <div style={{display:'flex',gap:'10px'}}>
              <button onClick={()=>setModal(null)} style={{...btn('ghost'),flex:1}}>Cancel</button>
              <button onClick={()=>{modal.fn();setModal(null)}} style={{...btn('danger'),flex:1}}>{modal.label}</button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast&&(
        <div style={{position:'fixed',bottom:'20px',right:'20px',background:'#1a1d27',border:'1px solid #343a55',borderRadius:'10px',padding:'10px 16px',fontSize:'13px',color:'#e8eaf2',zIndex:2000,boxShadow:'0 8px 24px rgba(0,0,0,.5)'}}>
          {toast}
        </div>
      )}
    </div>
  )
}

// ── MODULE ROW COMPONENT ──
function ModuleRow({ m, i, isActive, isLocked, courseId, onToggle, onNote, onOpen }:
  { m: Module; i: number; isActive: boolean; isLocked: boolean; courseId: string; onToggle: (cid:string,m:Module)=>void; onNote: (mid:string,n:string)=>void; onOpen: (url:string)=>void }) {
  const [noteOpen, setNoteOpen] = useState(!!m.notes)
  const [noteVal, setNoteVal] = useState(m.notes||'')

  return (
    <div>
      <div style={{display:'flex',alignItems:'stretch',gap:'0',background:'#13161e',border:`1px solid ${isActive?'#5b7cff':'#2a2f45'}`,borderRadius:'12px',overflow:'hidden',opacity:isLocked?0.4:1,transition:'border-color .2s'}}>
        <div style={{width:'52px',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:'#1a1d27',borderRight:'1px solid #2a2f45',flexShrink:0,padding:'10px 0'}}>
          <div style={{fontSize:'9px',fontWeight:600,textTransform:'uppercase',letterSpacing:'1px',color:'#5c6280'}}>MOD</div>
          <div style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:'18px',color:'#e8eaf2'}}>{String(i+1).padStart(2,'0')}</div>
        </div>
        <div style={{flex:1,padding:'12px 14px',display:'flex',alignItems:'center',gap:'12px',minWidth:0}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:'13px',fontWeight:500,marginBottom:'2px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.title}</div>
            {m.duration_mins>0&&<div style={{fontSize:'11px',color:'#5c6280'}}>{m.duration_mins} min</div>}
          </div>
          <div style={{fontSize:'11px',fontWeight:600,color:m.is_completed?'#3ddc84':isActive?'#5b7cff':'#5c6280',whiteSpace:'nowrap',flexShrink:0}}>
            {m.is_completed?'✓ Done':isActive?'▶ Now':'⬡ Locked'}
          </div>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:'5px',padding:'10px 12px',alignItems:'flex-end',justifyContent:'center',flexShrink:0}}>
          <button disabled={isLocked} onClick={()=>onOpen(m.resource_url)}
            style={{background:isLocked?'#22263a':'#5b7cff',color:isLocked?'#5c6280':'#fff',border:'none',borderRadius:'7px',padding:'5px 14px',fontSize:'12px',fontWeight:600,cursor:isLocked?'not-allowed':'pointer',whiteSpace:'nowrap'}}>
            Open ↗
          </button>
          <button onClick={()=>onToggle(courseId,m)}
            style={{background:'none',border:'1px solid #2a2f45',borderRadius:'7px',padding:'4px 10px',fontSize:'11px',color:m.is_completed?'#3ddc84':'#9aa0bb',cursor:'pointer',whiteSpace:'nowrap'}}>
            {m.is_completed?'✓ Done':'Mark done'}
          </button>
          <button onClick={()=>setNoteOpen(!noteOpen)}
            style={{background:'none',border:'none',fontSize:'11px',color:noteVal.trim()?'#5b7cff':'#5c6280',cursor:'pointer',padding:'0'}}>
            {noteVal.trim()?'📝 Notes':'+ Note'}
          </button>
        </div>
      </div>
      {noteOpen&&(
        <textarea value={noteVal} rows={2} placeholder="Notes..."
          onChange={e=>{setNoteVal(e.target.value);onNote(m.id,e.target.value)}}
          style={{width:'100%',background:'#0d0f14',border:'1px solid #2a2f45',borderTop:'none',borderRadius:'0 0 12px 12px',color:'#e8eaf2',fontFamily:'DM Sans,sans-serif',fontSize:'12px',resize:'none',padding:'10px 14px',outline:'none'}}/>
      )}
    </div>
  )
}
