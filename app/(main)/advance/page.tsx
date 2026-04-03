'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'

const bx = {
  background: '#ffffff', borderRadius: 16, border: '1px solid #E8ECF0',
  padding: 14, marginBottom: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
}
const inp = {
  width: '100%', padding: '10px 12px', borderRadius: 10,
  background: '#F8F9FB', border: '1px solid #E0E4E8', color: '#1a1a2e',
  fontSize: 13, outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'inherit'
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return '방금'
  if (m < 60) return `${m}분 전`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}시간 전`
  return `${Math.floor(h / 24)}일 전`
}

// ─── 진행 단계 표시 컴포넌트 ──────────────────────────────
function ProgressSteps({ item }: { item: any }) {
  const steps = [
    {
      label: '신청 완료',
      sub: timeAgo(item.created_at),
      done: true,
      color: '#00B894',
    },
    {
      label: '관리자 승인',
      sub: item.manager_approved_by
        ? `${item.manager_approved_by} 승인 ✓`
        : item.status === 'rejected' && !item.manager_approved_by
        ? '반려됨'
        : '대기 중',
      done: !!item.manager_approved_by || item.status === 'approved',
      color: item.manager_approved_by || item.status === 'approved' ? '#6C5CE7' : '#bbb',
      current: item.status === 'pending',
    },
    {
      label: '대표 최종 승인',
      sub: item.status === 'approved'
        ? `${item.owner_approved_by || '대표'} 승인 ✓`
        : item.status === 'rejected' && item.manager_approved_by
        ? '반려됨'
        : item.status === 'manager_approved'
        ? '검토 중'
        : '대기 중',
      done: item.status === 'approved',
      color: item.status === 'approved' ? '#FF6B35' : '#bbb',
      current: item.status === 'manager_approved',
    },
  ]

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, marginBottom: 12, marginTop: 4 }}>
      {steps.map((step, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
          {/* 연결선 */}
          {i < steps.length - 1 && (
            <div style={{
              position: 'absolute', top: 11, left: '50%', width: '100%', height: 2,
              background: steps[i + 1].done || steps[i + 1].current ? steps[i].color : '#E8ECF0',
              zIndex: 0,
            }} />
          )}
          {/* 원 */}
          <div style={{
            width: 22, height: 22, borderRadius: '50%', zIndex: 1, flexShrink: 0,
            background: step.done ? step.color : step.current ? '#fff' : '#F4F6F9',
            border: step.current ? `2px solid ${step.color === '#bbb' ? '#FF6B35' : step.color}` : step.done ? 'none' : '2px solid #E8ECF0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: step.current ? `0 0 0 3px ${step.color === '#bbb' ? 'rgba(255,107,53,0.15)' : 'rgba(108,92,231,0.15)'}` : 'none',
          }}>
            {step.done
              ? <span style={{ fontSize: 11, color: '#fff', fontWeight: 800 }}>✓</span>
              : step.current
              ? <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#FF6B35', display: 'block' }} />
              : <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ddd', display: 'block' }} />
            }
          </div>
          {/* 텍스트 */}
          <div style={{ marginTop: 6, textAlign: 'center' }}>
            <div style={{ fontSize: 10, fontWeight: step.done || step.current ? 700 : 400, color: step.done ? step.color : step.current ? '#1a1a2e' : '#bbb' }}>
              {step.label}
            </div>
            <div style={{ fontSize: 9, color: step.done ? step.color : step.current ? '#FF6B35' : '#bbb', marginTop: 2, fontWeight: step.current ? 700 : 400 }}>
              {step.sub}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── 신청 폼 ─────────────────────────────────────────────
function ApplyForm({ storeId, userName, userId, onSaved, onClose }: {
  storeId: string; userName: string; userId: string
  onSaved: () => void; onClose: () => void
}) {
  const supabase = createSupabaseBrowserClient()
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [onDuty, setOnDuty] = useState<boolean | null>(null)
  const [checking, setChecking] = useState(true)
  const [blockReason, setBlockReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { checkAttendance() }, [])

  async function checkAttendance() {
    setChecking(true)
    try {
      const now = new Date()
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
      const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-31`
      const { data } = await supabase.from('attendance').select('status, work_date')
        .eq('profile_id', userId).gte('work_date', monthStart).lte('work_date', monthEnd)
      const absents = (data || []).filter((a: any) => a.status === 'absent')
      const lates = (data || []).filter((a: any) => a.status === 'late' || a.status === 'late_early')
      if (absents.length > 0) {
        setBlockReason(`이번 달 결근 ${absents.length}회가 있어 선입금 신청이 불가해요.`)
        setOnDuty(false)
      } else if (lates.length > 0) {
        setBlockReason(`이번 달 지각 ${lates.length}회가 있어 선입금 신청이 불가해요.`)
        setOnDuty(false)
      } else { setOnDuty(true) }
    } catch { setOnDuty(true) }
    finally { setChecking(false) }
  }

  async function handleSubmit() {
    setError('')
    if (!amount || isNaN(Number(amount.replace(/,/g, ''))) || Number(amount.replace(/,/g, '')) <= 0) {
      setError('신청 금액을 올바르게 입력해주세요'); return
    }
    if (reason.length < 200) { setError(`상세 사유를 ${200 - reason.length}자 더 입력해주세요`); return }
    setSaving(true)
    try {
      const { data: req } = await supabase.from('advance_requests').insert({
        store_id: storeId, author_name: userName, author_id: userId,
        amount: Number(amount.replace(/,/g, '')), reason, status: 'pending'
      }).select().single()

      if (req) {
        const { data: managers } = await supabase.from('store_members').select('profiles(nm)')
          .eq('store_id', storeId).in('role', ['owner', 'manager']).eq('active', true)
        if (managers && managers.length > 0) {
          await supabase.from('advance_notifications').insert(
            managers.map((m: any) => ({ request_id: req.id, store_id: storeId, target_name: m.profiles?.nm || '', type: 'new_request' }))
          )
        }
      }
      onSaved()
    } catch (e: any) { setError('저장 실패: ' + e?.message) }
    finally { setSaving(false) }
  }

  function formatAmount(val: string) {
    const num = val.replace(/[^0-9]/g, '')
    return num ? Number(num).toLocaleString() : ''
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 480, background: '#F4F6F9', borderRadius: '20px 20px 0 0', padding: '20px 16px 40px', maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>💸 선입금 신청</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: '#bbb', cursor: 'pointer' }}>✕</button>
        </div>

        {checking ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#bbb' }}>출퇴근 기록 확인 중...</div>
        ) : !onDuty ? (
          <div style={{ ...bx, border: '1px solid rgba(232,67,147,0.3)', background: 'rgba(232,67,147,0.03)', textAlign: 'center', padding: 32 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🚫</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#E84393', marginBottom: 8 }}>선입금 신청 불가</div>
            <div style={{ fontSize: 13, color: '#888', lineHeight: 1.7 }}>{blockReason}</div>
            <div style={{ fontSize: 11, color: '#bbb', marginTop: 12 }}>성실한 근무 후 다음 달에 신청해주세요.</div>
          </div>
        ) : (
          <>
            {/* 안내 */}
            <div style={{ background: 'rgba(255,107,53,0.05)', border: '1px solid rgba(255,107,53,0.2)', borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#FF6B35', marginBottom: 6 }}>⚠️ 신청 전 반드시 확인하세요</div>
              <div style={{ fontSize: 11, color: '#888', lineHeight: 1.8 }}>
                • 선입금은 복지가 아닌 <strong style={{ color: '#1a1a2e' }}>예외적 긴급 지원</strong>입니다<br />
                • 허위 사유 작성 시 불이익이 발생할 수 있습니다<br />
                • 상세 사유는 <strong style={{ color: '#1a1a2e' }}>200자 이상</strong> 구체적으로 작성해야 합니다
              </div>
            </div>

            {/* 승인 단계 안내 */}
            <div style={{ ...bx, marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 10 }}>📋 승인 절차</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                {['신청', '관리자 승인', '대표 최종 승인'].map((step, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                    {i < 2 && <div style={{ position: 'absolute', top: 11, left: '50%', width: '100%', height: 2, background: '#E8ECF0', zIndex: 0 }} />}
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: i === 0 ? '#FF6B35' : '#F4F6F9', border: i === 0 ? 'none' : '2px solid #E8ECF0', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {i === 0 ? <span style={{ fontSize: 11, color: '#fff', fontWeight: 800 }}>✓</span> : <span style={{ fontSize: 9, color: '#bbb', fontWeight: 700 }}>{i + 1}</span>}
                    </div>
                    <div style={{ fontSize: 9, marginTop: 5, textAlign: 'center', color: i === 0 ? '#FF6B35' : '#bbb', fontWeight: i === 0 ? 700 : 400 }}>{step}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 신청 금액 */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 6 }}>신청 금액 <span style={{ color: '#E84393' }}>*</span></div>
              <div style={{ position: 'relative' }}>
                <input value={amount} onChange={e => setAmount(formatAmount(e.target.value))} placeholder="0"
                  style={{ ...inp, paddingRight: 30, textAlign: 'right', fontSize: 16, fontWeight: 700 }} />
                <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#888' }}>원</span>
              </div>
              {amount && <div style={{ fontSize: 11, color: '#6C5CE7', marginTop: 4, textAlign: 'right', fontWeight: 600 }}>{amount}원</div>}
            </div>

            {/* 상세 사유 */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#888' }}>상세 사유 <span style={{ color: '#E84393' }}>*</span></div>
                <span style={{ fontSize: 10, color: reason.length >= 200 ? '#00B894' : '#FF6B35', fontWeight: 700 }}>{reason.length} / 200자 이상</span>
              </div>
              <textarea value={reason} onChange={e => setReason(e.target.value)}
                placeholder={`선입금이 필요한 구체적인 사유를 200자 이상 작성해주세요.\n\n단순히 "개인 사정"이나 "급하게 필요해서" 같은 내용은 반려됩니다.`}
                rows={8} style={{ ...inp, resize: 'none', lineHeight: 1.7, borderColor: reason.length > 0 && reason.length < 200 ? 'rgba(255,107,53,0.5)' : reason.length >= 200 ? 'rgba(0,184,148,0.5)' : '#E0E4E8' }} />
              {reason.length > 0 && reason.length < 200 && <div style={{ fontSize: 11, color: '#FF6B35', marginTop: 4, fontWeight: 600 }}>✗ {200 - reason.length}자 더 작성해주세요</div>}
              {reason.length >= 200 && <div style={{ fontSize: 11, color: '#00B894', marginTop: 4, fontWeight: 600 }}>✓ 작성 완료</div>}
            </div>

            {error && <div style={{ background: '#FFF0F0', border: '1px solid rgba(232,67,147,0.2)', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 12, color: '#E84393', textAlign: 'center', fontWeight: 600 }}>{error}</div>}

            <button onClick={handleSubmit} disabled={saving || reason.length < 200 || !amount}
              style={{ width: '100%', padding: '13px 0', borderRadius: 12, border: 'none', color: '#fff', fontSize: 14, fontWeight: 700,
                background: (saving || reason.length < 200 || !amount) ? '#ddd' : 'linear-gradient(135deg,#FF6B35,#E84393)',
                cursor: (saving || reason.length < 200 || !amount) ? 'not-allowed' : 'pointer' }}>
              {saving ? '제출 중...' : '신청서 제출 (관리자 검토 요청)'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── 관리자 승인 모달 ─────────────────────────────────────
function ManagerApproveModal({ item, managerName, onDone, onClose }: {
  item: any; managerName: string; onDone: () => void; onClose: () => void
}) {
  const supabase = createSupabaseBrowserClient()
  const [scrolled, setScrolled] = useState(false)
  const [comment, setComment] = useState('')
  const [check1, setCheck1] = useState(false)
  const [check2, setCheck2] = useState(false)
  const [saving, setSaving] = useState(false)
  const [mode, setMode] = useState<'view' | 'reject'>('view')
  const [rejectReason, setRejectReason] = useState('')
  const canApprove = scrolled && comment.length >= 100 && check1 && check2

  async function handleApprove() {
    if (!canApprove) return
    if (!confirm('정말 승인하시겠습니까? 이 결정은 대표님께 보고됩니다.')) return
    setSaving(true)
    try {
      await supabase.from('advance_requests').update({
        status: 'manager_approved', manager_approved_by: managerName,
        manager_approved_at: new Date().toISOString(), manager_comment: comment
      }).eq('id', item.id)
      const { data: owners } = await supabase.from('store_members').select('profiles(nm)')
        .eq('store_id', item.store_id).eq('role', 'owner').eq('active', true)
      if (owners && owners.length > 0) {
        await supabase.from('advance_notifications').insert(
          owners.map((o: any) => ({ request_id: item.id, store_id: item.store_id, target_name: o.profiles?.nm || '', type: 'manager_approved' }))
        )
      }
      onDone()
    } finally { setSaving(false) }
  }

  async function handleReject() {
    if (rejectReason.length < 30) { alert('반려 사유를 30자 이상 입력해주세요'); return }
    if (!confirm('반려 처리하시겠습니까?')) return
    setSaving(true)
    try {
      await supabase.from('advance_requests').update({
        status: 'rejected', rejected_by: managerName,
        rejected_at: new Date().toISOString(), reject_reason: rejectReason
      }).eq('id', item.id)
      await supabase.from('advance_notifications').insert({
        request_id: item.id, store_id: item.store_id, target_name: item.author_name, type: 'rejected'
      })
      onDone()
    } finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 480, background: '#F4F6F9', borderRadius: '20px 20px 0 0', padding: '20px 16px 40px', maxHeight: '92vh', overflowY: 'auto' }}
        onScroll={e => { const el = e.currentTarget; if (el.scrollTop + el.clientHeight >= el.scrollHeight - 10) setScrolled(true) }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>📋 선입금 신청 검토</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: '#bbb', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ ...bx, border: '1px solid rgba(255,107,53,0.2)' }}>
          <div style={{ fontSize: 11, color: '#aaa', marginBottom: 8, fontWeight: 700 }}>신청 내용</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: '#888' }}>신청자</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>{item.author_name}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 13, color: '#888' }}>금액</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#FF6B35' }}>{Number(item.amount).toLocaleString()}원</span>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 6 }}>상세 사유</div>
          <div style={{ fontSize: 13, color: '#444', lineHeight: 1.8, background: '#F8F9FB', borderRadius: 10, padding: 12, border: '1px solid #E8ECF0' }}>{item.reason}</div>
        </div>
        <div style={{ background: 'rgba(108,92,231,0.05)', border: '1px solid rgba(108,92,231,0.15)', borderRadius: 12, padding: '12px 14px', marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#6C5CE7', marginBottom: 6 }}>관리자 승인 전 필수 확인사항</div>
          <div style={{ fontSize: 11, color: '#888', lineHeight: 1.8 }}>
            • 끝까지 스크롤해야 승인 버튼이 활성화됩니다<br />
            • 승인 의견은 <strong style={{ color: '#1a1a2e' }}>100자 이상</strong> 작성해야 합니다<br />
            • 승인 시 <strong style={{ color: '#1a1a2e' }}>대표님께 자동 보고</strong>됩니다<br />
            • 허위 승인 시 관리자에게 책임이 귀속됩니다
          </div>
        </div>
        {!scrolled && (
          <div style={{ textAlign: 'center', fontSize: 11, color: '#FF6B35', fontWeight: 700, marginBottom: 10, padding: '8px', background: 'rgba(255,107,53,0.06)', borderRadius: 8 }}>
            ↓ 끝까지 스크롤해야 승인 버튼이 활성화됩니다
          </div>
        )}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#888' }}>승인 의견 <span style={{ color: '#E84393' }}>*</span></div>
            <span style={{ fontSize: 10, color: comment.length >= 100 ? '#00B894' : '#FF6B35', fontWeight: 700 }}>{comment.length} / 100자 이상</span>
          </div>
          <textarea value={comment} onChange={e => setComment(e.target.value)}
            placeholder="신청자와 면담한 내용, 승인 사유, 특이사항 등을 100자 이상 구체적으로 작성해주세요."
            rows={4} style={{ ...inp, resize: 'none', lineHeight: 1.7 }} />
        </div>
        <div style={{ marginBottom: 14 }}>
          {[
            { key: 'c1', val: check1, set: setCheck1, label: '신청자와 직접 면담하여 사유의 사실 여부를 확인했습니다' },
            { key: 'c2', val: check2, set: setCheck2, label: '이 승인의 책임은 관리자인 본인에게 있음을 확인합니다' },
          ].map(({ key, val, set, label }) => (
            <div key={key} onClick={() => set(!val)} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 10, border: `1px solid ${val ? 'rgba(108,92,231,0.3)' : '#E8ECF0'}`, background: val ? 'rgba(108,92,231,0.04)' : '#F8F9FB', cursor: 'pointer', marginBottom: 8 }}>
              <div style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, marginTop: 1, border: `2px solid ${val ? '#6C5CE7' : '#D0D5DD'}`, background: val ? '#6C5CE7' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {val && <span style={{ color: '#fff', fontSize: 11, fontWeight: 800 }}>✓</span>}
              </div>
              <span style={{ fontSize: 12, color: val ? '#6C5CE7' : '#666', lineHeight: 1.6, fontWeight: val ? 600 : 400 }}>{label}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setMode(mode === 'reject' ? 'view' : 'reject')} style={{ flex: 1, padding: '13px 0', borderRadius: 12, background: 'rgba(232,67,147,0.08)', border: '1px solid rgba(232,67,147,0.25)', color: '#E84393', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>반려</button>
          <button onClick={handleApprove} disabled={!canApprove || saving} style={{ flex: 2, padding: '13px 0', borderRadius: 12, background: canApprove ? 'linear-gradient(135deg,#6C5CE7,#E84393)' : '#ddd', border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: canApprove ? 'pointer' : 'not-allowed' }}>
            {saving ? '처리 중...' : canApprove ? '대표님께 승인 요청' : '위 항목을 모두 완료해주세요'}
          </button>
        </div>
        {mode === 'reject' && (
          <div style={{ marginTop: 12, padding: 14, background: '#fff', borderRadius: 12, border: '1px solid rgba(232,67,147,0.2)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#E84393', marginBottom: 8 }}>반려 사유 (30자 이상)</div>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="반려 사유를 구체적으로 작성해주세요." rows={3} style={{ ...inp, resize: 'none', marginBottom: 8 }} />
            <button onClick={handleReject} disabled={saving} style={{ width: '100%', padding: '10px 0', borderRadius: 10, background: '#E84393', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>반려 처리</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── 대표 최종 승인 모달 ──────────────────────────────────
function OwnerApproveModal({ item, ownerName, onDone, onClose }: {
  item: any; ownerName: string; onDone: () => void; onClose: () => void
}) {
  const supabase = createSupabaseBrowserClient()
  const [scrolled, setScrolled] = useState(false)
  const [comment, setComment] = useState('')
  const [check1, setCheck1] = useState(false)
  const [check2, setCheck2] = useState(false)
  const [saving, setSaving] = useState(false)
  const [mode, setMode] = useState<'view' | 'reject'>('view')
  const [rejectReason, setRejectReason] = useState('')
  const canApprove = scrolled && comment.length >= 100 && check1 && check2

  async function handleApprove() {
    if (!canApprove) return
    if (!confirm('최종 승인하시겠습니까? 승인 후 취소가 불가합니다.')) return
    setSaving(true)
    try {
      await supabase.from('advance_requests').update({
        status: 'approved', owner_approved_by: ownerName,
        owner_approved_at: new Date().toISOString(), owner_comment: comment
      }).eq('id', item.id)
      await supabase.from('advance_notifications').insert({
        request_id: item.id, store_id: item.store_id, target_name: item.author_name, type: 'approved'
      })
      onDone()
    } finally { setSaving(false) }
  }

  async function handleReject() {
    if (rejectReason.length < 30) { alert('반려 사유를 30자 이상 입력해주세요'); return }
    if (!confirm('반려 처리하시겠습니까?')) return
    setSaving(true)
    try {
      await supabase.from('advance_requests').update({
        status: 'rejected', rejected_by: ownerName,
        rejected_at: new Date().toISOString(), reject_reason: rejectReason
      }).eq('id', item.id)
      await supabase.from('advance_notifications').insert({
        request_id: item.id, store_id: item.store_id, target_name: item.author_name, type: 'rejected'
      })
      onDone()
    } finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 480, background: '#F4F6F9', borderRadius: '20px 20px 0 0', padding: '20px 16px 40px', maxHeight: '92vh', overflowY: 'auto' }}
        onScroll={e => { const el = e.currentTarget; if (el.scrollTop + el.clientHeight >= el.scrollHeight - 10) setScrolled(true) }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>👑 최종 승인 검토</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: '#bbb', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ ...bx, border: '1px solid rgba(108,92,231,0.2)', background: 'rgba(108,92,231,0.02)', marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6C5CE7', marginBottom: 8 }}>✓ 관리자 사전 승인 완료</div>
          <div style={{ fontSize: 12, color: '#666' }}>승인자: <strong>{item.manager_approved_by}</strong></div>
          <div style={{ fontSize: 12, color: '#666', marginTop: 4, lineHeight: 1.6 }}>의견: {item.manager_comment}</div>
        </div>
        <div style={{ ...bx, border: '1px solid rgba(255,107,53,0.2)' }}>
          <div style={{ fontSize: 11, color: '#aaa', marginBottom: 8, fontWeight: 700 }}>신청 내용</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: '#888' }}>신청자</span>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{item.author_name}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 13, color: '#888' }}>금액</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#FF6B35' }}>{Number(item.amount).toLocaleString()}원</span>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 6 }}>상세 사유</div>
          <div style={{ fontSize: 13, color: '#444', lineHeight: 1.8, background: '#F8F9FB', borderRadius: 10, padding: 12 }}>{item.reason}</div>
        </div>
        {!scrolled && (
          <div style={{ textAlign: 'center', fontSize: 11, color: '#FF6B35', fontWeight: 700, marginBottom: 10, padding: '8px', background: 'rgba(255,107,53,0.06)', borderRadius: 8 }}>
            ↓ 끝까지 스크롤해야 최종 승인 버튼이 활성화됩니다
          </div>
        )}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#888' }}>최종 승인 의견 <span style={{ color: '#E84393' }}>*</span></div>
            <span style={{ fontSize: 10, color: comment.length >= 100 ? '#00B894' : '#FF6B35', fontWeight: 700 }}>{comment.length} / 100자 이상</span>
          </div>
          <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="최종 승인 사유 및 특이사항을 100자 이상 작성해주세요." rows={4} style={{ ...inp, resize: 'none', lineHeight: 1.7 }} />
        </div>
        <div style={{ marginBottom: 14 }}>
          {[
            { key: 'c1', val: check1, set: setCheck1, label: '관리자의 면담 결과를 확인하였으며 사유가 타당하다고 판단합니다' },
            { key: 'c2', val: check2, set: setCheck2, label: '선입금은 복지가 아닌 예외적 지원임을 직원에게 충분히 고지하겠습니다' },
          ].map(({ key, val, set, label }) => (
            <div key={key} onClick={() => set(!val)} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 10, border: `1px solid ${val ? 'rgba(255,107,53,0.3)' : '#E8ECF0'}`, background: val ? 'rgba(255,107,53,0.04)' : '#F8F9FB', cursor: 'pointer', marginBottom: 8 }}>
              <div style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, marginTop: 1, border: `2px solid ${val ? '#FF6B35' : '#D0D5DD'}`, background: val ? '#FF6B35' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {val && <span style={{ color: '#fff', fontSize: 11, fontWeight: 800 }}>✓</span>}
              </div>
              <span style={{ fontSize: 12, color: val ? '#FF6B35' : '#666', lineHeight: 1.6, fontWeight: val ? 600 : 400 }}>{label}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setMode(mode === 'reject' ? 'view' : 'reject')} style={{ flex: 1, padding: '13px 0', borderRadius: 12, background: 'rgba(232,67,147,0.08)', border: '1px solid rgba(232,67,147,0.25)', color: '#E84393', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>반려</button>
          <button onClick={handleApprove} disabled={!canApprove || saving} style={{ flex: 2, padding: '13px 0', borderRadius: 12, background: canApprove ? 'linear-gradient(135deg,#FF6B35,#E84393)' : '#ddd', border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: canApprove ? 'pointer' : 'not-allowed' }}>
            {saving ? '처리 중...' : canApprove ? '최종 승인' : '위 항목을 모두 완료해주세요'}
          </button>
        </div>
        {mode === 'reject' && (
          <div style={{ marginTop: 12, padding: 14, background: '#fff', borderRadius: 12, border: '1px solid rgba(232,67,147,0.2)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#E84393', marginBottom: 8 }}>반려 사유 (30자 이상)</div>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="반려 사유를 구체적으로 작성해주세요." rows={3} style={{ ...inp, resize: 'none', marginBottom: 8 }} />
            <button onClick={handleReject} disabled={saving} style={{ width: '100%', padding: '10px 0', borderRadius: 10, background: '#E84393', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>반려 처리</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── 메인 페이지 ─────────────────────────────────────────
export default function AdvancePage() {
  const supabase = createSupabaseBrowserClient()
  const [storeId, setStoreId] = useState('')
  const [storeName, setStoreName] = useState('')
  const [userName, setUserName] = useState('')
  const [userId, setUserId] = useState('')
  const [userRole, setUserRole] = useState('')

  const [viewTab, setViewTab] = useState<'my' | 'all'>('my')
  const [myStores, setMyStores] = useState<any[]>([])
  const [storeMap, setStoreMap] = useState<Record<string, string>>({})

  const [items, setItems] = useState<any[]>([])
  const [allItems, setAllItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showApply, setShowApply] = useState(false)
  const [approveItem, setApproveItem] = useState<any>(null)
  const [filterStatus, setFilterStatus] = useState('all')

  const isOwner = userRole === 'owner'
  const isManager = userRole === 'manager' || userRole === 'owner'
  const isStaff = !isManager

  useEffect(() => {
    const store = JSON.parse(localStorage.getItem('mj_store') || '{}')
    const user = JSON.parse(localStorage.getItem('mj_user') || '{}')
    if (!store.id) return
    setStoreId(store.id)
    setStoreName(store.name || '')
    setUserName(user.nm || '')
    setUserId(user.id || '')
    setUserRole(user.role || '')
    loadData(store.id, user.nm || '', user.role || '', user.id || '')
  }, [])

  async function loadData(sid: string, uname: string, role: string, uid: string) {
    setLoading(true)
    try {
      const { data } = await supabase.from('advance_requests').select('*')
        .eq('store_id', sid).order('created_at', { ascending: false })
      setItems(data || [])

      if (role === 'owner') {
        const { data: memberData } = await supabase.from('store_members')
          .select('store_id, stores(id, name)').eq('profile_id', uid).eq('role', 'owner').eq('active', true)
        if (memberData && memberData.length > 0) {
          setMyStores(memberData.map((m: any) => m.stores))
          const sm: Record<string, string> = {}
          memberData.forEach((m: any) => { sm[m.stores.id] = m.stores.name })
          setStoreMap(sm)
          const allStoreIds = memberData.map((m: any) => m.store_id)
          const { data: allData } = await supabase.from('advance_requests').select('*')
            .in('store_id', allStoreIds).order('created_at', { ascending: false })
          setAllItems(allData || [])
        }
      }
    } finally { setLoading(false) }
  }

  const baseItems = (isOwner && viewTab === 'all') ? allItems : items
  const myItems = baseItems.filter((i: any) => i.author_name === userName)
  const otherItems = items.filter((i: any) => i.author_name !== userName)
  const filtered = isManager
    ? baseItems.filter((i: any) => filterStatus === 'all' || i.status === filterStatus)
    : myItems
  const pendingForManager = items.filter((i: any) => i.status === 'pending').length
  const pendingForOwner = (isOwner && viewTab === 'all' ? allItems : items).filter((i: any) => i.status === 'manager_approved').length

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: '5px 8px', borderRadius: 20, fontSize: 11, fontWeight: active ? 700 : 500,
    border: '1px solid', cursor: 'pointer', whiteSpace: 'nowrap',
    borderColor: active ? '#1a1a2e' : '#E8ECF0',
    background: active ? '#1a1a2e' : '#F8F9FB',
    color: active ? '#fff' : '#888',
  })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: '#1a1a2e' }}>💸 선입금 신청</span>
          {isOwner && pendingForOwner > 0 && (
            <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: '#FF6B35', color: '#fff', fontWeight: 700 }}>최종승인 {pendingForOwner}</span>
          )}
          {isManager && !isOwner && pendingForManager > 0 && (
            <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: '#6C5CE7', color: '#fff', fontWeight: 700 }}>검토 {pendingForManager}</span>
          )}
        </div>
        {isStaff && (
          <button onClick={() => setShowApply(true)} style={{ padding: '6px 14px', borderRadius: 9, background: 'rgba(255,107,53,0.1)', border: '1px solid rgba(255,107,53,0.3)', color: '#FF6B35', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ 신청하기</button>
        )}
      </div>

      {/* 대표: 지점 탭 */}
      {isOwner && myStores.length > 1 && (
        <div style={{ display: 'flex', background: '#F4F6F9', borderRadius: 12, padding: 4, marginBottom: 14 }}>
          <button onClick={() => setViewTab('my')} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: viewTab === 'my' ? 700 : 400, background: viewTab === 'my' ? '#fff' : 'transparent', color: viewTab === 'my' ? '#1a1a2e' : '#aaa', boxShadow: viewTab === 'my' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>📍 {storeName}</button>
          <button onClick={() => setViewTab('all')} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: viewTab === 'all' ? 700 : 400, background: viewTab === 'all' ? '#fff' : 'transparent', color: viewTab === 'all' ? '#1a1a2e' : '#aaa', boxShadow: viewTab === 'all' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>
            🏢 전체 지점 {allItems.filter((i: any) => i.status === 'manager_approved').length > 0 ? `(${allItems.filter((i: any) => i.status === 'manager_approved').length})` : ''}
          </button>
        </div>
      )}

      {/* 직원: 다른 직원 신청 현황 */}
      {isStaff && otherItems.length > 0 && (
        <div style={{ ...bx, border: '1px solid rgba(255,107,53,0.2)', background: 'rgba(255,107,53,0.02)', marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#FF6B35', marginBottom: 10 }}>📢 이번 달 선입금 신청 현황</div>
          {otherItems.map((item: any) => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #F4F6F9' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>{item.author_name}</span>
              <span style={{ fontSize: 11, color: '#bbb' }}>{Number(item.amount).toLocaleString()}원</span>
            </div>
          ))}
        </div>
      )}

      {/* 관리자/대표: 상태 필터 */}
      {isManager && (
        <div style={{ display: 'flex', gap: 5, marginBottom: 12, flexWrap: 'wrap' }}>
          {[
            { val: 'all', label: `전체 ${baseItems.length}` },
            { val: 'pending', label: `대기 ${baseItems.filter((i: any) => i.status === 'pending').length}` },
            { val: 'manager_approved', label: `관리자승인 ${baseItems.filter((i: any) => i.status === 'manager_approved').length}` },
            { val: 'approved', label: `최종승인 ${baseItems.filter((i: any) => i.status === 'approved').length}` },
            { val: 'rejected', label: `반려 ${baseItems.filter((i: any) => i.status === 'rejected').length}` },
          ].map(opt => (
            <button key={opt.val} onClick={() => setFilterStatus(opt.val)} style={tabStyle(filterStatus === opt.val)}>{opt.label}</button>
          ))}
        </div>
      )}

      {/* 목록 */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#bbb', fontSize: 13 }}>불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div style={{ ...bx, textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>💸</div>
          <div style={{ fontSize: 13, color: '#bbb' }}>{isStaff ? '신청 내역이 없어요' : '해당 내역이 없어요'}</div>
        </div>
      ) : filtered.map((item: any) => {
        const canManagerApprove = isManager && !isOwner && item.status === 'pending'
        const canOwnerApprove = isOwner && item.status === 'manager_approved'
        return (
          <div key={item.id} style={{
            ...bx,
            borderLeft: item.status === 'pending' ? '3px solid #FF6B35'
              : item.status === 'manager_approved' ? '3px solid #6C5CE7'
              : item.status === 'approved' ? '3px solid #00B894'
              : '3px solid #E84393'
          }}>
            {/* 헤더 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                {isManager && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 12, color: '#FF6B35', fontWeight: 700 }}>{item.author_name}</span>
                    {isOwner && viewTab === 'all' && storeMap[item.store_id] && (
                      <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 6, fontWeight: 600, background: 'rgba(108,92,231,0.1)', color: '#6C5CE7' }}>📍 {storeMap[item.store_id]}</span>
                    )}
                  </div>
                )}
                <div style={{ fontSize: 16, fontWeight: 800, color: '#1a1a2e' }}>{Number(item.amount).toLocaleString()}원</div>
                <div style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>{timeAgo(item.created_at)}</div>
              </div>
            </div>

            {/* 진행 단계 */}
            <ProgressSteps item={item} />

            {/* 사유 (관리자/대표만) */}
            {isManager && (
              <div style={{ fontSize: 12, color: '#666', background: '#F8F9FB', borderRadius: 8, padding: '8px 10px', marginBottom: 10, lineHeight: 1.6 }}>
                {item.reason.length > 80 ? item.reason.slice(0, 80) + '...' : item.reason}
              </div>
            )}

            {/* 반려 사유 */}
            {item.status === 'rejected' && item.reject_reason && (
              <div style={{ fontSize: 11, color: '#E84393', background: 'rgba(232,67,147,0.05)', borderRadius: 8, padding: '8px 10px', marginBottom: 8, border: '1px solid rgba(232,67,147,0.15)' }}>
                반려 사유: {item.reject_reason}
              </div>
            )}

            {(canManagerApprove || canOwnerApprove) && (
              <button onClick={() => setApproveItem(item)} style={{ width: '100%', padding: '10px 0', borderRadius: 10, cursor: 'pointer', background: canOwnerApprove ? 'linear-gradient(135deg,#FF6B35,#E84393)' : 'linear-gradient(135deg,#6C5CE7,#E84393)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700 }}>
                {canOwnerApprove ? '👑 최종 승인 검토' : '📋 관리자 검토하기'}
              </button>
            )}
          </div>
        )
      })}

      {showApply && (
        <ApplyForm storeId={storeId} userName={userName} userId={userId}
          onSaved={() => { setShowApply(false); loadData(storeId, userName, userRole, userId) }}
          onClose={() => setShowApply(false)} />
      )}
      {approveItem && !isOwner && (
        <ManagerApproveModal item={approveItem} managerName={userName}
          onDone={() => { setApproveItem(null); loadData(storeId, userName, userRole, userId) }}
          onClose={() => setApproveItem(null)} />
      )}
      {approveItem && isOwner && (
        <OwnerApproveModal item={approveItem} ownerName={userName}
          onDone={() => { setApproveItem(null); loadData(storeId, userName, userRole, userId) }}
          onClose={() => setApproveItem(null)} />
      )}
    </div>
  )
}