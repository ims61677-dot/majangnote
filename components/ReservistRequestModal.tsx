'use client'
import { useState, useEffect } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { sendPush } from '@/lib/pushNotify'

const inp = { width: '100%', padding: '8px 10px', borderRadius: 8, background: '#fff', border: '1px solid #E0E4E8', color: '#1a1a2e', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// 🪖 예비군 휴무 신청 (일반 휴무 요청과 별개)
// - 증빙 서류 필수, 요청 불가 날짜/요청 기간과 상관없이 신청 가능
// - 같은 날 '대기 중'인 다른 사람의 일반 휴무 요청은 자동 거절 + 알림
// - 이미 '승인'된 휴무는 건드리지 않고, 대표님이 조정할 수 있게 사유에 표시
export default function ReservistRequestModal({ storeId, myName, onClose, onSaved }: {
  storeId: string; myName: string; onClose: () => void; onSaved: () => void
}) {
  const supabase = createSupabaseBrowserClient()
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  const canSubmit = !!date && !!file && !saving

  async function handleSubmit() {
    if (!date) { alert('예비군 날짜를 선택해주세요'); return }
    if (!file) { alert('증빙 서류(사진)를 올려야 신청할 수 있어요'); return }
    if (saving) return
    setSaving(true)
    try {
      const targetMonth = date.slice(0, 7)

      // 같은 날짜의 기존 휴무 요청 / 내 확정 휴일 확인
      const [{ data: dayReqs }, { data: mySched }] = await Promise.all([
        supabase.from('off_requests').select('*').eq('store_id', storeId).eq('request_date', date),
        supabase.from('schedules').select('status').eq('store_id', storeId).eq('staff_name', myName).eq('schedule_date', date),
      ])
      const reqs = dayReqs || []

      if (reqs.some((r: any) => r.staff_name === myName && r.request_type === 'reservist' && (r.status === 'pending' || r.status === 'approved'))) {
        alert('이미 이 날짜에 예비군 신청을 했어요.'); setSaving(false); return
      }
      const myOwn = reqs.find((r: any) => r.staff_name === myName && (r.status === 'pending' || r.status === 'approved'))
      const othersPending = reqs.filter((r: any) => r.staff_name !== myName && r.request_type !== 'reservist' && r.status === 'pending')
      const othersApproved = reqs.filter((r: any) => r.staff_name !== myName && r.request_type !== 'reservist' && r.status === 'approved')
      const alreadyOff = (mySched || []).some((s: any) => s.status === 'off') || myOwn?.status === 'approved'

      // 마지막 확인 메시지
      let msg = `${date} 예비군 휴무를 신청할까요?\n\n⚠️ 같은 날 먼저 휴무를 요청한 사람이 있으면 자동으로 거절돼요.`
      if (othersPending.length > 0) msg += `\n(현재 거절 대상: ${othersPending.map((r: any) => r.staff_name).join(', ')})`
      if (othersApproved.length > 0) msg += `\n※ 이미 승인된 휴무(${othersApproved.map((r: any) => r.staff_name).join(', ')})는 자동 거절되지 않고 대표님이 조정해요.`
      if (alreadyOff) msg += `\n\n📌 이미 휴일로 정해진 날이라 예비군과 겹쳐도 별도 휴일은 챙겨주지 않아요.`
      if (!confirm(msg)) { setSaving(false); return }

      // 증빙 업로드
      const ext = file.name.split('.').pop()
      const path = `off-requests/reservist-${date}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${(ext || 'jpg').replace(/[^a-zA-Z0-9]/g, '') || 'jpg'}`
      const buf = await file.arrayBuffer()
      const { error: upErr } = await supabase.storage.from('staff-documents').upload(path, buf, { upsert: true, contentType: file.type || 'image/jpeg' })
      if (upErr) { alert('증빙 서류 업로드 실패: ' + upErr.message); setSaving(false); return }

      // 예비군 요청 등록
      let reason = '🪖 예비군' + (note.trim() ? ` - ${note.trim()}` : '')
      if (othersApproved.length > 0) reason += ` (⚠️ 이미 승인된 휴무와 겹침: ${othersApproved.map((r: any) => r.staff_name).join(', ')})`
      if (alreadyOff) reason += ' (이미 휴일로 정해진 날)'
      const { error } = await supabase.from('off_requests').insert({
        store_id: storeId, staff_name: myName, target_month: targetMonth, request_date: date,
        reason, status: 'pending', attachment_path: path, request_type: 'reservist',
      })
      if (error) { alert('신청에 실패했어요: ' + error.message); setSaving(false); return }

      // 같은 날 대기 중인 일반 휴무 요청 자동 거절 + 알림
      for (const r of othersPending) {
        await supabase.from('off_requests').update({ status: 'rejected' }).eq('id', r.id)
        sendPush('schedule', storeId, '❌ 휴무 거절 (예비군)', `${myName}님이 예비군 신청을 해서 ${date} 휴무가 거절되었어요`, '/schedule', undefined, undefined, r.staff_name)
      }
      sendPush('request', storeId, '🪖 예비군 휴무 신청', `${myName}님이 ${date} 예비군 휴무를 신청했습니다${othersPending.length > 0 ? ` (${othersPending.length}명 자동 거절)` : ''}`, '/schedule', undefined, ['owner', 'manager'])

      onSaved(); onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 20, width: '100%', maxWidth: 360, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', marginBottom: 4 }}>🪖 예비군 휴무 신청</div>
        <div style={{ fontSize: 11, color: '#aaa', marginBottom: 14 }}>{myName}님 · 일반 휴무 요청과 별개예요 (요청 불가 날짜도 신청 가능)</div>

        <div style={{ background: 'rgba(108,92,231,0.06)', border: '1px solid rgba(108,92,231,0.2)', borderRadius: 10, padding: '10px 12px', marginBottom: 14, fontSize: 11, color: '#555', lineHeight: 1.7 }}>
          📌 스케줄이 나온 뒤 예비군을 알게 된 경우, 정해진 휴일과 겹치면 <b>별도로 휴일을 챙겨주지 않아요.</b><br />
          📌 예비군 훈련이 끝난 뒤에는 <b>출근하는 것이 기본 원칙</b>이에요.<br />
          📌 같은 날 먼저 휴무를 요청한 사람은 <b>자동 거절</b>되고, 그 날짜는 다른 사람이 요청할 수 없어요.
        </div>

        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>예비군 날짜 <span style={{ color: '#E84393' }}>*</span></div>
          <input type="date" value={date} min={todayStr()} onChange={e => setDate(e.target.value)} style={inp} />
        </div>

        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>증빙 서류 사진 <span style={{ color: '#E84393' }}>* 필수</span> <span style={{ color: '#aaa' }}>(예비군 소집통지서 등)</span></div>
          <input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] || null)} style={{ fontSize: 11, width: '100%' }} />
          {file && <div style={{ fontSize: 10, color: '#6C5CE7', marginTop: 4 }}>📎 {file.name}</div>}
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>메모 (선택)</div>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="예: 동원훈련 1일차" style={inp} />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleSubmit} disabled={!canSubmit}
            style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: 'none', background: canSubmit ? 'linear-gradient(135deg,#6C5CE7,#a29bfe)' : '#E8ECF0', color: canSubmit ? '#fff' : '#aaa', fontSize: 13, fontWeight: 700, cursor: canSubmit ? 'pointer' : 'default' }}>
            {saving ? '신청 중...' : '예비군 휴무 신청'}
          </button>
          <button onClick={onClose} style={{ padding: '11px 16px', borderRadius: 10, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', cursor: 'pointer' }}>취소</button>
        </div>
      </div>
    </div>
  )
}

// ─── 스케줄 "🪖 예비군" 탭 화면: 안내 + 신청 버튼 + 내 신청 내역 ───

const STATUS_TEXT: Record<string, { label: string; color: string }> = {
  pending: { label: '승인 대기', color: '#CC9900' },
  approved: { label: '승인됨', color: '#00B894' },
  rejected: { label: '거절됨', color: '#E84393' },
}

export function ReservistTab({ storeId, myName, onChanged }: { storeId: string; myName: string; onChanged: () => void }) {
  const supabase = createSupabaseBrowserClient()
  const [show, setShow] = useState(false)
  const [list, setList] = useState<any[]>([])

  async function load() {
    const { data } = await supabase.from('off_requests').select('*').eq('store_id', storeId).eq('staff_name', myName).eq('request_type', 'reservist').order('request_date', { ascending: false })
    setList(data || [])
  }
  useEffect(() => { if (storeId && myName) load() }, [storeId, myName])

  async function handleDelete(r: any) {
    const msg = r.status === 'approved'
      ? `${r.request_date} 예비군 신청은 이미 승인됐어요.\n삭제하면 휴무 확정도 취소돼요. 삭제할까요?`
      : `${r.request_date} 예비군 신청을 삭제할까요?`
    if (!confirm(msg)) return
    const { error } = await supabase.from('off_requests').delete().eq('id', r.id)
    if (error) { alert('삭제하지 못했어요: ' + error.message); return }
    if (r.attachment_path) await supabase.storage.from('staff-documents').remove([r.attachment_path])
    if (r.status !== 'rejected') sendPush('request', storeId, '🪖 예비군 신청 취소', `${myName}님이 ${r.request_date} 예비군 신청을 삭제했습니다`, '/schedule', undefined, ['owner', 'manager'])
    load(); onChanged()
  }

  return (
    <div>
      <div style={{ background: 'rgba(108,92,231,0.06)', border: '1px solid rgba(108,92,231,0.2)', borderRadius: 14, padding: '14px 16px', marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#6C5CE7', marginBottom: 8 }}>🪖 예비군 휴무 신청</div>
        <div style={{ fontSize: 12, color: '#555', lineHeight: 1.8 }}>
          · 증빙 서류(소집통지서 사진)를 올려야 신청할 수 있어요.<br />
          · 요청 불가 날짜, 요청 기간과 상관없이 신청할 수 있어요.<br />
          · 같은 날 먼저 휴무를 요청한 사람은 <b>자동 거절</b>되고 알림이 가요.<br />
          · 스케줄이 나온 뒤 알게 된 경우, 정해진 휴일과 겹치면 별도 휴일은 챙겨주지 않아요.<br />
          · 예비군 훈련이 끝난 뒤에는 출근이 기본 원칙이에요.
        </div>
      </div>
      <button onClick={() => setShow(true)} style={{ width: '100%', padding: '13px 0', marginBottom: 18, borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#6C5CE7,#a29bfe)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>🪖 예비군 휴무 신청하기</button>

      <div style={{ fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 8 }}>내 신청 내역</div>
      {list.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 24, color: '#bbb', fontSize: 12, background: '#fff', borderRadius: 12, border: '1px solid #E8ECF0' }}>신청 내역이 없어요</div>
      ) : list.map(r => {
        const st = STATUS_TEXT[r.status] || { label: r.status, color: '#888' }
        return (
          <div key={r.id} style={{ background: '#fff', border: '1px solid #E8ECF0', borderRadius: 12, padding: '10px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>{r.request_date}</span>
            <span style={{ fontSize: 10, color: '#888', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.reason}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: st.color }}>{st.label}</span>
            <button onClick={() => handleDelete(r)} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(232,67,147,0.3)', background: '#fff', color: '#E84393', cursor: 'pointer' }}>삭제</button>
          </div>
        )
      })}

      {show && <ReservistRequestModal storeId={storeId} myName={myName} onClose={() => setShow(false)} onSaved={() => { load(); onChanged() }} />}
    </div>
  )
}
