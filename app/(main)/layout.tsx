'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<any>(null)
  const [store, setStore] = useState<any>(null)

  useEffect(() => {
    const u = localStorage.getItem('mj_user')
    const s = localStorage.getItem('mj_store')
    if (!u || !s) { router.push('/login'); return }
    setUser(JSON.parse(u))
    setStore(JSON.parse(s))
  }, [])

  const nav = [
    { href: '/dash', label: '대시', icon: '📊' },
    { href: '/schedule', label: '스케줄', icon: '📅' },
    { href: '/closing', label: '마감', icon: '💰' },
    { href: '/inventory', label: '재고', icon: '📦' },
    { href: '/recipe', label: '레시피', icon: '🍳' },
  ]

  return (
    <div style={{maxWidth:480,margin:'0 auto',minHeight:'100vh',display:'flex',flexDirection:'column'}}>
      <header style={{background:'rgba(255,255,255,0.05)',padding:'12px 16px',display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'1px solid rgba(255,255,255,0.1)'}}>
        <span style={{fontWeight:'bold'}}>{store?.name || '매장노트'}</span>
        <button onClick={()=>{localStorage.clear();router.push('/login')}}
          style={{background:'none',border:'1px solid rgba(255,255,255,0.3)',color:'white',padding:'4px 12px',borderRadius:6,cursor:'pointer'}}>
          로그아웃
        </button>
      </header>
      <main style={{flex:1,padding:16,paddingBottom:80}}>
        {children}
      </main>
      <nav style={{position:'fixed',bottom:0,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:480,background:'#16213e',borderTop:'1px solid rgba(255,255,255,0.1)',display:'flex',justifyContent:'space-around',padding:'8px 0'}}>
        {nav.map(n => (
          <Link key={n.href} href={n.href} style={{display:'flex',flexDirection:'column',alignItems:'center',textDecoration:'none',color:pathname.startsWith(n.href)?'#FF6B35':'rgba(255,255,255,0.5)',fontSize:12,padding:'4px 8px'}}>
            <span style={{fontSize:20}}>{n.icon}</span>
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  )
}
