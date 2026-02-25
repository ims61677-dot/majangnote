'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [users, setUsers] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.from('profiles').select('*').order('nm').then(({ data }) => {
      if (data) setUsers(data)
    })
  }, [])

  async function handleLogin() {
    setLoading(true)
    setError('')
    const user = users.find(u => u.id === selectedId)
    if (!user) { setError('직원을 선택하세요'); setLoading(false); return }
    if (user.pin !== pin) { setError('PIN이 틀렸습니다'); setLoading(false); return }
    const { data: member } = await supabase
      .from('store_members')
      .select('*, stores(*)')
      .eq('profile_id', user.id)
      .eq('active', true)
      .single()
    if (!member) { setError('매장 정보를 찾을 수 없습니다'); setLoading(false); return }
    localStorage.setItem('mj_user', JSON.stringify({...user, role: member.role}))
    localStorage.setItem('mj_store', JSON.stringify(member.stores))
    router.push('/dash')
    setLoading(false)
  }

  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',background:'linear-gradient(135deg,#1a1a2e,#16213e)'}}>
      <div style={{background:'rgba(255,255,255,0.05)',borderRadius:16,padding:40,width:300,border:'1px solid rgba(255,255,255,0.1)'}}>
        <h1 style={{textAlign:'center',marginBottom:32,fontSize:24}}>🏪 매장노트</h1>
        <select value={selectedId} onChange={e=>setSelectedId(e.target.value)}
          style={{width:'100%',padding:12,borderRadius:8,border:'1px solid rgba(255,255,255,0.2)',background:'rgba(255,255,255,0.05)',color:'white',marginBottom:16,fontSize:16}}>
          <option value="">직원 선택</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.nm} ({u.role})</option>)}
        </select>
        <input type="password" placeholder="PIN 4자리" maxLength={4} value={pin} onChange={e=>setPin(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&handleLogin()}
          style={{width:'100%',padding:12,borderRadius:8,border:'1px solid rgba(255,255,255,0.2)',background:'rgba(255,255,255,0.05)',color:'white',marginBottom:16,fontSize:16,boxSizing:'border-box'}} />
        {error && <p style={{color:'#ff6b6b',textAlign:'center',marginBottom:12}}>{error}</p>}
        <button onClick={handleLogin} disabled={loading}
          style={{width:'100%',padding:14,borderRadius:8,background:'#FF6B35',border:'none',color:'white',fontSize:16,cursor:'pointer',fontWeight:'bold'}}>
          {loading ? '로그인 중...' : '로그인'}
        </button>
      </div>
    </div>
  )
}
