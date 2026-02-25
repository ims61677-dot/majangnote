'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'

const bx = {
  background: '#ffffff', borderRadius: 16,
  border: '1px solid #E8ECF0', padding: 16, marginBottom: 12,
  boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
}
const inp = {
  width: '100%', padding: '8px 10px', borderRadius: 8,
  background: '#F8F9FB', border: '1px solid #E0E4E8',
  color: '#1a1a2e', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const
}

export default function NoticePage() {
  const supabase = createSupabaseBrowserClient()
  const [storeId, setStoreId] = useState('')
  const [user, setUser] = useState<any>(null)
  const [notices, setNotices] = useState<any[]>([])
  const [checks, setChecks] = useState<any[]>([])
  const [tab, setTab] = useState<'notice' | 'check'>('notice')
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [pinned, setPinned] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showCheckForm, setShowCheckForm] = useState(false)
  const [newTask, setNewTask] = useState('')

  const today = new Date().toISOString().split('T')[0]
  const isManager = user?.role === 'owner' || user?.role === 'manager'

  useEffect(() => {
    const store = JSON.parse(localStorage.getItem('mj_store') || '{}')
    const u = JSON.parse(localStorage.getItem('mj_user') || '{}')
    if (!store.id) return
    setStoreId(store.id); setUser(u)
    loadNotices(store.id); loadChecks(store.id)
  }, [])

  async function loadNotices(sid: string) {
    const { data } = await supabase.from('notices').select('*').eq('store_id', sid)
      .order('pinned', { ascending: false }).order('created_at', { ascending: false })
    setNotices(data || [])
  }

  async function loadChecks(sid: string) {
    const { data } = await supabase.from('checklist_items').select('*').eq('store_id', sid).eq('date', today).order('created_at')
    setChecks(data || [])
  }

  async function saveNotice() {
    if (!title.trim() || !storeId) return
    setSaving(true)
    const { data } = await supabase.from('notices').insert({
      store_id: storeId, title: title.trim(), body: body.trim(), pinned, author_nm: user?.nm || ''
    }).select().single()
    if (data) setNotices(p => [data, ...p].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)))
    setTitle(''); setBody(''); setPinned(false); setShowForm(false); setSaving(false)
  }

  async function deleteNotice(id: string) {
    if (!confirm('공지를 삭제할까요?')) return
    await supabase.from('notices').delete().eq('id', id)
    setNotices(p => p.filter(n => n.id !== id))
  }

  async function toggleCheck(id: string, done: boolean) {
    const now = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    await supabase.from('checklist_items').update({
      done: !done, done_by: !done ? user?.nm : null, done_at: !done ? now : null
    }).eq('id', id)
    setChecks(p => p.map(c => c.id === id ? { ...c, done: !done, done_by: !done ? user?.nm : null, done_at: !done ? now : null } : c))
  }

  async function addCheck() {
    if (!newTask.trim() || !storeId) return
    const { data } = await supabase.from('checklist_items').insert({
      store_id: storeId, date: today, task: newTask.trim()
    }).select().single()
    if (data) setChecks(p => [...p, data])
    setNewTask(''); setShowCheckForm(false)
  }

  async function deleteCheck(id: string) {
    await supabase.from('checklist_items').delete().eq('id', id)
    setChecks(p => p.filter(c => c.id !== id))
  }

  const doneCount = checks.filter(c => c.done).length

  return (
    <div>
      {/* 탭 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['notice', 'check'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
              fontWeight: 700, fontSize: 13,
              background: tab === t ? 'linear-gradient(135deg,#FF6B35,#E84393)' : '#F4F6F9',
              color: tab === t ? '#fff' : '#999' }}>
            {t === 'notice' ? `📢 공지사항 (${notices.length})` : `✅ 체크리스트 (${doneCount}/${checks.length})`}
          </button>
        ))}
      </div>

      {tab === 'notice' && (
        <div>
          {isManager && (
            <button onClick={() => setShowForm(p => !p)}
              style={{ width: '100%', padding: '10px 0', borderRadius: 10, marginBottom: 12,
                background: showForm ? '#F4F6F9' : 'rgba(255,107,53,0.08)',
                border: '1px solid rgba(255,107,53,0.3)',
                color: '#FF6B35', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              {showForm ? '✕ 취소' : '+ 공지 작성'}
            </button>
          )}
          {showForm && (
            <div style={{ ...bx, border: '1px solid rgba(255,107,53,0.3)', marginBottom: 16 }}>
              <input value={title} onChange={e => setTitle(e.target.value)}
                placeholder="제목" style={{ ...inp, marginBottom: 8 }} />
              <textarea value={body} onChange={e => setBody(e.target.value)}
                placeholder="내용 (선택)" rows={3} style={{ ...inp, resize: 'vertical', marginBottom: 8 }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <input type="checkbox" id="pin" checked={pinned} onChange={e => setPinned(e.target.checked)} />
                <label htmlFor="pin" style={{ fontSize: 12, color: '#888', cursor: 'pointer' }}>📌 상단 고정</label>
              </div>
              <button onClick={saveNotice} disabled={saving}
                style={{ padding: '8px 20px', borderRadius: 8,
                  background: saving ? '#ccc' : 'linear-gradient(135deg,#FF6B35,#E84393)',
                  border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                {saving ? '저장 중...' : '등록'}
              </button>
            </div>
          )}
          {notices.length === 0 ? (
            <div style={{ ...bx, textAlign: 'center', padding: 32 }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>📢</div>
              <div style={{ fontSize: 13, color: '#bbb' }}>등록된 공지사항이 없습니다</div>
            </div>
          ) : notices.map(n => (
            <div key={n.id} style={{ ...bx, border: n.pinned ? '1px solid rgba(255,107,53,0.3)' : '1px solid #E8ECF0',
              background: n.pinned ? '#FFF8F5' : '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    {n.pinned && <span style={{ fontSize: 10, color: '#FF6B35', fontWeight: 700 }}>📌 고정</span>}
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>{n.title}</span>
                  </div>
                  {n.body && <div style={{ fontSize: 12, color: '#666', marginBottom: 6, lineHeight: 1.6 }}>{n.body}</div>}
                  <div style={{ fontSize: 10, color: '#bbb' }}>
                    {n.author_nm} · {new Date(n.created_at).toLocaleDateString('ko-KR')}
                  </div>
                </div>
                {isManager && (
                  <button onClick={() => deleteNotice(n.id)}
                    style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 14, padding: '0 4px' }}>✕</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'check' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: '#999' }}>
              {new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })} 체크리스트
            </span>
            {isManager && (
              <button onClick={() => setShowCheckForm(p => !p)}
                style={{ padding: '6px 12px', borderRadius: 8,
                  background: 'rgba(45,198,214,0.1)', border: '1px solid rgba(45,198,214,0.3)',
                  color: '#2DC6D6', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                + 항목 추가
              </button>
            )}
          </div>

          {showCheckForm && (
            <div style={{ ...bx, display: 'flex', gap: 8, marginBottom: 12 }}>
              <input value={newTask} onChange={e => setNewTask(e.target.value)}
                placeholder="할 일 입력" style={{ ...inp, flex: 1 }}
                onKeyDown={e => e.key === 'Enter' && addCheck()} />
              <button onClick={addCheck}
                style={{ padding: '8px 16px', borderRadius: 8, background: '#2DC6D6',
                  border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>추가</button>
            </div>
          )}

          {checks.length > 0 && (
            <div style={{ ...bx, padding: 14, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8 }}>
                <span style={{ color: '#999' }}>진행률</span>
                <span style={{ color: '#00B894', fontWeight: 700 }}>{doneCount}/{checks.length}</span>
              </div>
              <div style={{ background: '#F4F6F9', borderRadius: 6, height: 8, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 6,
                  width: `${checks.length ? (doneCount / checks.length) * 100 : 0}%`,
                  background: 'linear-gradient(90deg,#00B894,#2DC6D6)', transition: 'width 0.3s' }} />
              </div>
            </div>
          )}

          {checks.length === 0 ? (
            <div style={{ ...bx, textAlign: 'center', padding: 32 }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>✅</div>
              <div style={{ fontSize: 13, color: '#bbb' }}>오늘의 체크리스트가 없습니다</div>
            </div>
          ) : checks.map(c => (
            <div key={c.id} style={{ ...bx, display: 'flex', alignItems: 'center', gap: 12,
              opacity: c.done ? 0.6 : 1, transition: 'opacity 0.2s' }}>
              <button onClick={() => toggleCheck(c.id, c.done)}
                style={{ width: 26, height: 26, borderRadius: 6, flexShrink: 0, cursor: 'pointer',
                  background: c.done ? '#00B894' : '#F4F6F9',
                  border: c.done ? 'none' : '1px solid #E0E4E8',
                  color: '#fff', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {c.done ? '✓' : ''}
              </button>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500,
                  textDecoration: c.done ? 'line-through' : 'none',
                  color: c.done ? '#bbb' : '#1a1a2e' }}>
                  {c.task}
                </div>
                {c.done && c.done_by && (
                  <div style={{ fontSize: 10, color: '#bbb', marginTop: 2 }}>{c.done_by} · {c.done_at}</div>
                )}
              </div>
              {isManager && (
                <button onClick={() => deleteCheck(c.id)}
                  style={{ background: 'none', border: 'none', color: '#ddd', cursor: 'pointer', fontSize: 14 }}>✕</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}