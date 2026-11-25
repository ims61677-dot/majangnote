'use client'
import { useEffect, useRef, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { sendPush } from '@/lib/pushNotify'
import { FormRenderer, TemplateEditor } from '@/components/InterviewTemplate'
import { buildHallTemplate, Tpl } from '@/lib/interviewSeed'

const LIST_COLS = 'id,store_id,name,phone,phone_digits,part_id,part_name,scheduled_at,attend,result,result_reason,start_date,created_at,sms,interviewer'
const RESULT_META: Record<string, { l: string; c: string; bg: string }> = {
  pass: { l: '합격', c: '#00B894', bg: 'rgba(0,184,148,0.12)' },
  fail: { l: '불합격', c: '#E84393', bg: 'rgba(232,67,147,0.12)' },
  hold: { l: '보류', c: '#B8860B', bg: 'rgba(253,196,0,0.18)' },
}
const ATTEND_META: Record<string, { l: string; c: string; bg: string }> = {
  scheduled: { l: '예정', c: '#6C5CE7', bg: 'rgba(108,92,231,0.1)' },
  came: { l: '면접 봄', c: '#00B894', bg: 'rgba(0,184,148,0.1)' },
  no_show: { l: '안 옴', c: '#E84393', bg: 'rgba(232,67,147,0.1)' },
  cancelled: { l: '취소', c: '#999', bg: 'rgba(150,150,150,0.12)' },
}
const DOW = ['일', '월', '화', '수', '목', '금', '토']

const inp = {
  width: '100%', padding: '10px 12px', borderRadius: 10, background: '#F8F9FB',
  border: '1px solid #E0E4E8', color: '#1a1a2e', fontSize: 13, outline: 'none',
  boxSizing: 'border-box' as const, fontFamily: 'inherit',
}
const bx = { background: '#fff', borderRadius: 14, border: '1px solid #E8ECF0', padding: 14, marginBottom: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }

const digits = (s: string) => (s || '').replace(/\D/g, '')
const pad = (n: number) => String(n).padStart(2, '0')
function fmtDT(iso?: string | null) {
  if (!iso) return '일시 미정'
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}(${DOW[d.getDay()]}) ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function fmtDate(iso?: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`
}
function toLocalInput(iso?: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function smsHref(phone: string, body: string) {
  const isIos = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent)
  return `sms:${digits(phone)}${isIos ? '&' : '?'}body=${encodeURIComponent(body)}`
}

function Badge({ meta }: { meta: { l: string; c: string; bg: string } }) {
  return <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, fontWeight: 700, color: meta.c, background: meta.bg }}>{meta.l}</span>
}

// 문자 발송 상태: 해당되는 문자만 (key, 라벨, 보냈는지)
function smsList(it: any) {
  const sms = it.sms || {}
  const out: { key: string; label: string; sent: boolean }[] = []
  if (it.attend === 'came' || it.result) out.push({ key: 'thanks', label: '수고', sent: !!sms.thanks })
  if (it.result) out.push({ key: 'result', label: '결과', sent: !!sms.result })
  if (it.result === 'pass' && it.start_date) out.push({ key: 'before', label: '출근 전', sent: !!sms.before })
  return out
}
const smsMissing = (it: any) => smsList(it).filter(x => !x.sent).map(x => x.label)

function InterviewCard({ it, onClick, storeName }: { it: any; onClick: () => void; storeName?: string }) {
  const smsItems = smsList(it)
  return (
    <div onClick={onClick} style={{ ...bx, cursor: 'pointer', padding: 12, marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: '#1a1a2e' }}>{it.name}</span>
        {storeName && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 7, background: '#FFF1EA', color: '#FF6B35', fontWeight: 700 }}>{storeName}</span>}
        {it.part_name && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 7, background: '#F1EFFC', color: '#6C5CE7', fontWeight: 700 }}>{it.part_name}</span>}
        {it.result && <Badge meta={RESULT_META[it.result]} />}
        {!it.result && <Badge meta={ATTEND_META[it.attend] || ATTEND_META.scheduled} />}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#999' }}>{fmtDT(it.scheduled_at)}</span>
      </div>
      <div style={{ fontSize: 11, color: '#999', marginTop: 5, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {it.phone && <span>📞 {it.phone}</span>}
        {it.start_date && <span style={{ color: '#00B894', fontWeight: 700 }}>🗓 출근 {it.start_date}</span>}
        {it.result && it.result !== 'pass' && it.result_reason && <span style={{ color: '#E84393' }}>사유: {it.result_reason.length > 24 ? it.result_reason.slice(0, 24) + '…' : it.result_reason}</span>}
      </div>
      {smsItems.length > 0 && (
        <div style={{ display: 'flex', gap: 5, marginTop: 7, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, color: '#aaa' }}>✉️ 문자</span>
          {smsItems.map(x => (
            <span key={x.key} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 7, fontWeight: 700, color: x.sent ? '#00B894' : '#E8590C', background: x.sent ? 'rgba(0,184,148,0.1)' : 'rgba(255,107,53,0.12)' }}>
              {x.label} {x.sent ? '✓' : '미발송'}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ───────── 새 면접 예약 ─────────
function NewModal({ parts, store, stores, dupStoreIds, user, accessFrom, onClose, onSaved }: any) {
  const supabase = createSupabaseBrowserClient()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [storeId, setStoreId] = useState(store.id)
  const storeParts = parts.filter((p: any) => p.store_id === storeId)
  const [partId, setPartId] = useState(parts.filter((p: any) => p.store_id === store.id)[0]?.id || '')
  const [when, setWhen] = useState('')
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!name.trim()) { alert('이름을 입력해주세요'); return }
    if (!when) { alert('면접 일시를 입력해주세요'); return }
    setSaving(true)
    const dg = digits(phone)
    const safeName = name.trim().replace(/[,()]/g, ' ')
    // 재지원 이력 확인
    let q = supabase.from('interviews').select(LIST_COLS + ',result_reason').in('store_id', dupStoreIds)
    q = dg.length >= 7 ? q.or(`name.eq.${safeName},phone_digits.eq.${dg}`) : q.eq('name', name.trim())
    const { data: prev } = await q.order('scheduled_at', { ascending: false }).limit(20)
    const all = prev || []
    const visible = accessFrom ? all.filter((r: any) => r.created_at >= accessFrom) : all
    const hidden = all.length - visible.length
    if (all.length > 0) {
      const lines = visible.map((r: any) => `• ${dupStoreIds.length > 1 ? (stores.find((x: any) => x.id === r.store_id)?.name || '') + ' ' : ''}${fmtDate(r.scheduled_at || r.created_at)} ${r.part_name || ''} — ${r.result ? RESULT_META[r.result].l : (ATTEND_META[r.attend]?.l || '')}${r.result_reason ? ` (사유: ${r.result_reason})` : ''}`)
      if (hidden > 0) lines.push(`• 이전 면접 이력 ${hidden}건 있음 (상세 내용은 대표님께 문의해주세요)`)
      const ok = confirm(`⚠️ 이미 면접 이력이 있는 분이에요\n\n${lines.join('\n')}\n\n그래도 예약을 등록할까요?`)
      if (!ok) { setSaving(false); return }
    }
    const part = parts.find((p: any) => p.id === partId)
    const { error } = await supabase.from('interviews').insert({
      store_id: storeId, part_id: part?.id || null, part_name: part?.name || null,
      name: name.trim(), phone: phone.trim() || null, phone_digits: dg || null,
      scheduled_at: new Date(when).toISOString(), memo: memo.trim() || null, created_by: user.nm,
    })
    if (error) { alert('저장 실패: ' + error.message); setSaving(false); return }
    sendPush('interview', storeId, '📅 면접 예약', `${name.trim()}${part ? `(${part.name})` : ''} · ${fmtDT(new Date(when).toISOString())}`, '/interview', user.id, ['owner', 'manager'])
    setSaving(false); onSaved(); onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#fff', width: '100%', maxWidth: 480, borderRadius: '20px 20px 0 0', padding: 20 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 14 }}>📅 면접 예약 등록</div>
        {stores.length > 1 && (
          <select value={storeId} onChange={e => { setStoreId(e.target.value); setPartId(parts.filter((p: any) => p.store_id === e.target.value)[0]?.id || '') }} style={{ ...inp, marginBottom: 8 }}>
            {stores.map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        )}
        <input value={name} onChange={e => setName(e.target.value)} placeholder="이름" style={{ ...inp, marginBottom: 8 }} />
        <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="연락처 (010-0000-0000)" inputMode="tel" style={{ ...inp, marginBottom: 8 }} />
        <select value={partId} onChange={e => setPartId(e.target.value)} style={{ ...inp, marginBottom: 8 }}>
          {storeParts.length === 0 && <option value="">(파트 없음 — 양식 관리에서 먼저 만들어주세요)</option>}
          {storeParts.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} style={{ ...inp, marginBottom: 8 }} />
        <input value={memo} onChange={e => setMemo(e.target.value)} placeholder="메모 (선택)" style={{ ...inp, marginBottom: 14 }} />
        <button onClick={submit} disabled={saving} style={{ width: '100%', padding: 13, borderRadius: 12, border: 'none', background: saving ? '#ccc' : 'linear-gradient(135deg,#6C5CE7,#2DC6D6)', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>{saving ? '저장 중...' : '예약 등록'}</button>
      </div>
    </div>
  )
}

// ───────── 면접 상세 / 면접지 작성 ─────────
function DetailModal({ id, parts, store: storeProp, stores, user, isOwner, onClose, onChanged }: any) {
  const supabase = createSupabaseBrowserClient()
  const [row, setRow] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [f, setF] = useState<any>({})
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [tpl, setTpl] = useState<Tpl>({ sections: [] })
  const [sms, setSms] = useState<Record<string, string>>({})
  const store = (row && (stores || []).find((x: any) => x.id === row.store_id)) || storeProp

  useEffect(() => { load() }, [id])

  async function load() {
    const { data } = await supabase.from('interviews').select('*').eq('id', id).maybeSingle()
    if (!data) { alert('면접 정보를 찾을 수 없어요'); onClose(); return }
    setRow(data)
    setF({
      name: data.name || '', phone: data.phone || '', part_id: data.part_id || '',
      when: toLocalInput(data.scheduled_at), attend: data.attend || 'scheduled', memo: data.memo || '',
      result: data.result || '', result_reason: data.result_reason || '', start_date: data.start_date || '',
      desired_pay: data.desired_pay || '', agreed_pay: data.agreed_pay || '', summary: data.summary || '',
    })
    setAnswers(data.answers || {})
    setSms(data.sms || {})
    setTpl(data.template_snapshot || parts.find((p: any) => p.id === data.part_id)?.template || { sections: [] })
    setLoading(false)
  }

  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }))

  function changePart(pid: string) {
    set('part_id', pid)
    if (Object.keys(answers).length === 0) setTpl(parts.find((p: any) => p.id === pid)?.template || { sections: [] })
  }

  async function save() {
    if (!f.name.trim()) { alert('이름을 입력해주세요'); return }
    if ((f.result === 'fail' || f.result === 'hold') && !f.result_reason.trim()) { alert(`${RESULT_META[f.result].l} 사유를 적어주세요 (나중에 다시 지원했을 때 확인하려고 남겨요)`); return }
    setSaving(true)
    const part = parts.find((p: any) => p.id === f.part_id)
    const hasAnswers = Object.keys(answers).length > 0
    let attend = f.attend
    if (f.result && attend === 'scheduled') attend = 'came'
    const payload: any = {
      name: f.name.trim(), phone: f.phone.trim() || null, phone_digits: digits(f.phone) || null,
      part_id: f.part_id || null, part_name: part?.name || row.part_name || null,
      scheduled_at: f.when ? new Date(f.when).toISOString() : null, attend, memo: f.memo.trim() || null,
      answers, template_snapshot: tpl, sms,
      result: f.result || null, result_reason: f.result_reason.trim() || null, start_date: f.start_date || null,
      desired_pay: f.desired_pay.trim() || null, agreed_pay: f.agreed_pay.trim() || null, summary: f.summary.trim() || null,
      interviewer: row.interviewer || user.nm, interviewer_id: row.interviewer_id || user.id,
      interviewed_at: row.interviewed_at || ((hasAnswers || f.result) ? new Date().toISOString() : null),
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('interviews').update(payload).eq('id', id)
    if (error) { alert('저장 실패: ' + error.message); setSaving(false); return }
    if (f.result && f.result !== row.result) {
      sendPush('interview', store.id, '📝 면접 등록', `${payload.name}${payload.part_name ? `(${payload.part_name})` : ''} 면접 결과: ${RESULT_META[f.result].l}${f.result === 'pass' && f.start_date ? ` · 출근 ${f.start_date}` : ''}`, '/interview', user.id, ['owner', 'manager'])
    }
    setSaving(false); onChanged(); onClose()
  }

  async function remove() {
    if (!confirm('이 면접 기록을 삭제할까요? 되돌릴 수 없어요.')) return
    await supabase.from('interviews').delete().eq('id', id)
    onChanged(); onClose()
  }

  if (loading) return null
  const sname = f.name || ''
  const base = `${sname}님 안녕하세요, 파스타랑 ${store.name}입니다.`
  const resultMsg = f.result === 'pass'
    ? `${base} 면접 결과 합격하셨습니다. 축하드립니다! 출근 일정은 따로 안내드리겠습니다.`
    : f.result === 'fail'
      ? `${base} 면접에 참여해주셔서 감사합니다. 아쉽게도 이번에는 함께하지 못하게 되었습니다. 좋은 결과 있으시길 바랍니다.`
      : f.result === 'hold'
        ? `${base} 면접에 참여해주셔서 감사합니다. 결과는 검토 후 다시 연락드리겠습니다.`
        : ''
  const SMS_ITEMS = [
    { key: 'thanks', label: '면접 수고 문자', body: `${base} 오늘 면접 보시느라 수고 많으셨습니다. 결과는 따로 안내드리겠습니다.` },
    { key: 'result', label: '합격/불합격 결과 문자', body: resultMsg },
    { key: 'before', label: '출근 전 확인 문자', body: `${base} ${f.start_date ? `${f.start_date}에` : ''} 출근 예정이신 것 확인차 연락드립니다. 변동 사항이 있으면 알려주세요.` },
  ]
  const lbl = { fontSize: 11, color: '#999', fontWeight: 600, marginBottom: 4 } as const

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: '#F4F6F9', width: '100%', maxWidth: 560, height: '95vh', borderRadius: '20px 20px 0 0', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 16px', background: '#fff', borderRadius: '20px 20px 0 0', borderBottom: '1px solid #E8ECF0', display: 'flex', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800 }}>🧑‍💼 {f.name || '면접'} 면접지</div>
            <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>면접일 {fmtDate(row.interviewed_at || row.scheduled_at) || '-'} · 면접관 {row.interviewer || user.nm}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: '#aaa', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
          {/* 기본 정보 */}
          <div style={bx}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 1 }}><div style={lbl}>이름</div><input value={f.name} onChange={e => set('name', e.target.value)} style={inp} /></div>
              <div style={{ flex: 1 }}>
                <div style={lbl}>연락처</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <input value={f.phone} onChange={e => set('phone', e.target.value)} inputMode="tel" style={inp} />
                  {f.phone && <a href={`tel:${digits(f.phone)}`} style={{ padding: '10px 10px', borderRadius: 10, background: '#F1EFFC', color: '#6C5CE7', fontSize: 13, textDecoration: 'none' }}>📞</a>}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={lbl}>파트</div>
                <select value={f.part_id} onChange={e => changePart(e.target.value)} style={inp}>
                  {!f.part_id && <option value="">{row.part_name || '(선택)'}</option>}
                  {parts.filter((p: any) => !row.store_id || p.store_id === row.store_id).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div style={{ flex: 1.2 }}><div style={lbl}>면접 일시</div><input type="datetime-local" value={f.when} onChange={e => set('when', e.target.value)} style={inp} /></div>
            </div>
            <div style={lbl}>면접 참석</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              {[{ k: 'scheduled', l: '예정' }, { k: 'came', l: '✅ 옴' }, { k: 'no_show', l: '❌ 안 옴' }, { k: 'cancelled', l: '취소' }].map(o => (
                <button key={o.k} onClick={() => set('attend', o.k)} style={{ flex: 1, padding: '9px 0', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: `1px solid ${f.attend === o.k ? '#6C5CE7' : '#E0E4E8'}`, background: f.attend === o.k ? 'rgba(108,92,231,0.1)' : '#fff', color: f.attend === o.k ? '#6C5CE7' : '#888' }}>{o.l}</button>
              ))}
            </div>
            <input value={f.memo} onChange={e => set('memo', e.target.value)} placeholder="예약 메모 (선택)" style={inp} />
          </div>

          {/* 면접지 */}
          <FormRenderer tpl={tpl} answers={answers} onChange={(k, v) => setAnswers(p => ({ ...p, [k]: v }))} />

          {/* 종합 평가 */}
          <div style={bx}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#6C5CE7', marginBottom: 12 }}>종합 평가</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              {(['pass', 'hold', 'fail'] as const).map(k => (
                <button key={k} onClick={() => set('result', f.result === k ? '' : k)} style={{ flex: 1, padding: '12px 0', borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: 'pointer', border: `2px solid ${f.result === k ? RESULT_META[k].c : '#E0E4E8'}`, background: f.result === k ? RESULT_META[k].bg : '#fff', color: f.result === k ? RESULT_META[k].c : '#aaa' }}>{RESULT_META[k].l}</button>
              ))}
            </div>
            <div style={lbl}>{f.result === 'fail' || f.result === 'hold' ? '사유 (필수 · 나중에 재지원 시 확인용)' : '사유 / 판단 근거'}</div>
            <textarea value={f.result_reason} onChange={e => set('result_reason', e.target.value)} rows={2} style={{ ...inp, resize: 'vertical', marginBottom: 8 }} />
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 1 }}><div style={lbl}>희망 급여</div><input value={f.desired_pay} onChange={e => set('desired_pay', e.target.value)} style={inp} /></div>
              <div style={{ flex: 1 }}><div style={lbl}>협의 급여</div><input value={f.agreed_pay} onChange={e => set('agreed_pay', e.target.value)} style={inp} /></div>
            </div>
            <div style={lbl}>출근 예정일</div>
            <input type="date" value={f.start_date} onChange={e => set('start_date', e.target.value)} style={{ ...inp, marginBottom: 8 }} />
            <div style={lbl}>총평</div>
            <textarea value={f.summary} onChange={e => set('summary', e.target.value)} rows={3} style={{ ...inp, resize: 'vertical' }} />
          </div>

          {/* 문자 체크 */}
          <div style={bx}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#6C5CE7', marginBottom: 10 }}>문자 발송 체크</div>
            {SMS_ITEMS.map(s => {
              const done = sms[s.key]
              return (
                <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #F1F3F5' }}>
                  <div onClick={() => setSms(p => { const n = { ...p }; if (n[s.key]) delete n[s.key]; else n[s.key] = new Date().toISOString(); return n })}
                    style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, cursor: 'pointer', border: `2px solid ${done ? '#00B894' : '#D0D5DD'}`, background: done ? '#00B894' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {done && <span style={{ color: '#fff', fontSize: 12, fontWeight: 800 }}>✓</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>{s.label}</div>
                    {done && <div style={{ fontSize: 10, color: '#00B894' }}>{fmtDT(done)} 보냄</div>}
                  </div>
                  {f.phone && s.body ? (
                    <a href={smsHref(f.phone, s.body)} onClick={() => { if (!sms[s.key]) setSms(p => ({ ...p, [s.key]: new Date().toISOString() })) }}
                      style={{ padding: '6px 10px', borderRadius: 8, background: '#F1EFFC', color: '#6C5CE7', fontSize: 11, fontWeight: 700, textDecoration: 'none' }}>✉️ 문자 열기</a>
                  ) : <span style={{ fontSize: 10, color: '#ccc' }}>{!f.phone ? '연락처 없음' : '결과 선택 후'}</span>}
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ padding: 12, background: '#fff', borderTop: '1px solid #E8ECF0', display: 'flex', gap: 8 }}>
          {isOwner && <button onClick={remove} style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(232,67,147,0.3)', background: '#fff', color: '#E84393', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>🗑</button>}
          <button onClick={save} disabled={saving} style={{ flex: 1, padding: 12, borderRadius: 12, border: 'none', background: saving ? '#ccc' : 'linear-gradient(135deg,#6C5CE7,#2DC6D6)', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>{saving ? '저장 중...' : '💾 저장'}</button>
        </div>
      </div>
    </div>
  )
}

// ───────── 메인 ─────────
export default function InterviewPage() {
  const supabase = createSupabaseBrowserClient()
  const [user, setUser] = useState<any>(null)
  const [store, setStore] = useState<any>(null)
  const [accessFrom, setAccessFrom] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [parts, setParts] = useState<any[]>([])
  const [list, setList] = useState<any[]>([])
  const [filter, setFilter] = useState('all')
  const [showForms, setShowForms] = useState(false)
  const [q, setQ] = useState('')
  const [searchRes, setSearchRes] = useState<any[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [editPart, setEditPart] = useState<any>(null)
  const [newPartName, setNewPartName] = useState('')
  const [useHall, setUseHall] = useState(true)
  const [stores, setStores] = useState<any[]>([])
  const [scope, setScope] = useState('all')
  const [formStore, setFormStore] = useState('')
  const [tick, setTick] = useState(0)
  const autoSeeded = useRef(false)

  const role = user?.role
  const isOwner = role === 'owner'
  const allowed = role === 'owner' || role === 'manager'

  useEffect(() => {
    (async () => {
      const u = JSON.parse(localStorage.getItem('mj_user') || '{}')
      const s = JSON.parse(localStorage.getItem('mj_store') || '{}')
      setUser(u); setStore(s)
      let af: string | null = null
      if (u.role === 'manager' && u.id && s.id) {
        const { data } = await supabase.from('store_members').select('interview_access_from').eq('profile_id', u.id).eq('store_id', s.id).maybeSingle()
        af = (data as any)?.interview_access_from || null
      }
      setAccessFrom(af)
      // 대표는 소유한 모든 지점을 한 번에 볼 수 있어요
      let storeList: any[] = [{ id: s.id, name: s.name }]
      if (u.role === 'owner' && u.id) {
        const { data } = await supabase.from('store_members').select('store_id, stores(id, name)').eq('profile_id', u.id).eq('role', 'owner').eq('active', true)
        const mine = (data || []).map((m: any) => m.stores).filter(Boolean).map((x: any) => ({ id: x.id, name: x.name }))
        if (mine.length > 0) storeList = mine.some((x: any) => x.id === s.id) ? mine : [...mine, { id: s.id, name: s.name }]
      }
      setStores(storeList); setFormStore(s.id)
      setReady(true)
      if ((u.role === 'owner' || u.role === 'manager') && s.id) await loadAll(storeList, 'all', u.role === 'owner', af, s.id)
      else setLoading(false)
    })()
  }, [])

  useEffect(() => { if (ready) loadAll() }, [scope])

  // 지금 보고 있는 지점 id들
  function currentIds(sl = stores, sc = scope, owner = isOwner, sid = store?.id): string[] {
    if (!owner || sl.length <= 1) return [sid]
    return sc === 'all' ? sl.map((x: any) => x.id) : [sc]
  }

  async function loadAll(sl = stores, sc = scope, owner = isOwner, af = accessFrom, sid = store?.id) {
    setLoading(true)
    const ids = currentIds(sl, sc, owner, sid)
    const partIds = owner ? sl.map((x: any) => x.id) : [sid]
    let lq = supabase.from('interviews').select(LIST_COLS).in('store_id', ids)
    if (af) lq = lq.gte('created_at', af)
    const [{ data: p }, { data: l }] = await Promise.all([
      supabase.from('interview_parts').select('*').in('store_id', partIds).order('created_at'),
      lq.order('scheduled_at', { ascending: false }).limit(1000),
    ])
    let partRows = p || []
    // 대표가 처음 열었을 때 현재 지점에 파트가 하나도 없으면 "홀 직원" 파트를 기본 양식과 함께 자동 생성 (한 번만)
    if (owner && !partRows.some((x: any) => x.store_id === sid) && !autoSeeded.current) {
      autoSeeded.current = true
      const { data: created } = await supabase.from('interview_parts').insert({ store_id: sid, name: '홀 직원', template: buildHallTemplate() }).select().single()
      if (created) partRows = [...partRows, created]
    }
    setParts(partRows); setList(l || [])
    setTick(t => t + 1)
    setLoading(false)
  }

  // 이름 / 연락처 검색 (전체 기간)
  useEffect(() => {
    const term = q.trim()
    if (!term || !store?.id) { setSearchRes(null); setSearching(false); return }
    setSearching(true)
    const h = setTimeout(async () => {
      const safe = term.replace(/[%,()*\\]/g, ' ')
      const dg = digits(term)
      let sq = supabase.from('interviews').select(LIST_COLS).in('store_id', currentIds())
      if (accessFrom) sq = sq.gte('created_at', accessFrom)
      sq = dg.length >= 3 ? sq.or(`name.ilike.%${safe}%,phone_digits.like.%${dg}%`) : sq.ilike('name', `%${safe}%`)
      const { data } = await sq.order('scheduled_at', { ascending: false }).limit(100)
      setSearchRes(data || []); setSearching(false)
    }, 300)
    return () => clearTimeout(h)
  }, [q, store?.id, accessFrom, tick, scope])

  async function addPart() {
    const nm = newPartName.trim()
    if (!nm) { alert('파트 이름을 입력해주세요'); return }
    const template = useHall ? buildHallTemplate() : { sections: [] }
    const { data, error } = await supabase.from('interview_parts').insert({ store_id: formStore || store.id, name: nm, template }).select().single()
    if (error) { alert('저장 실패: ' + error.message); return }
    setNewPartName(''); await loadAll(); setEditPart(data)
  }

  async function savePart(name: string, tpl: Tpl) {
    const { error } = await supabase.from('interview_parts').update({ name, template: tpl }).eq('id', editPart.id)
    if (error) { alert('저장 실패: ' + error.message); return }
    setEditPart(null); await loadAll()
  }

  async function deletePart() {
    if (!confirm(`"${editPart.name}" 파트를 삭제할까요?\n이미 등록된 면접 기록은 그대로 남아요.`)) return
    await supabase.from('interview_parts').delete().eq('id', editPart.id)
    setEditPart(null); await loadAll()
  }

  if (!ready) return <div style={{ padding: 40, textAlign: 'center', color: '#bbb' }}>불러오는 중...</div>
  if (!allowed) return <div style={{ padding: 40, textAlign: 'center', color: '#aaa', fontSize: 14 }}>🔒 대표와 관리자만 볼 수 있는 메뉴예요</div>

  const now = new Date()
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startTomorrow = startToday + 86400000
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const ts = (i: any) => (i.scheduled_at ? new Date(i.scheduled_at).getTime() : 0)

  // 처리 필요: 오늘 면접 / 지난 예약(왔는지 확인) / 면접 봤는데 결과 미입력
  const isTodo = (i: any) => (i.attend === 'scheduled' && ts(i) < startTomorrow) || (i.attend === 'came' && !i.result) || smsMissing(i).length > 0
  const todo = list.filter(isTodo).sort((a, b) => ts(a) - ts(b))
  const todoWhy = (i: any) => i.attend === 'came' && !i.result ? '결과 입력 필요' : i.attend === 'scheduled' ? (ts(i) < startToday ? '왔는지 확인 필요' : '오늘 면접') : `문자 미발송: ${smsMissing(i).join(', ')}`

  const matches = (i: any, f: string) => {
    if (f === 'scheduled') return i.attend === 'scheduled'
    if (f === 'sms') return smsMissing(i).length > 0
    if (f === 'startsoon') return i.result === 'pass' && i.start_date && i.start_date >= todayStr
    if (f === 'no_show') return i.attend === 'no_show'
    return i.result === f
  }
  const FILTERS = [
    { k: 'all', l: '전체' }, { k: 'todo', l: '처리 필요' }, { k: 'scheduled', l: '예정' }, { k: 'sms', l: '문자 미발송' }, { k: 'pass', l: '합격' },
    { k: 'hold', l: '보류' }, { k: 'fail', l: '불합격' }, { k: 'startsoon', l: '출근 예정' }, { k: 'no_show', l: '안 옴' },
  ]
  const count = (k: string) => k === 'all' ? list.length : k === 'todo' ? todo.length : list.filter(i => matches(i, k)).length

  const rest = list.filter(i => !isTodo(i))
  const upcoming = rest.filter(i => i.attend === 'scheduled').sort((a, b) => ts(a) - ts(b))
  const past = rest.filter(i => i.attend !== 'scheduled').sort((a, b) => ts(b) - ts(a))
  const filtered = filter === 'all' || filter === 'todo' ? [] : list.filter(i => matches(i, filter))
    .sort((a, b) => filter === 'startsoon' ? String(a.start_date).localeCompare(String(b.start_date)) : filter === 'scheduled' ? ts(a) - ts(b) : ts(b) - ts(a))

  const storeLabel = (i: any) => (isOwner && stores.length > 1 && scope === 'all') ? stores.find((x: any) => x.id === i.store_id)?.name : undefined

  const Group = ({ title, items, color, why }: { title: string; items: any[]; color?: string; why?: boolean }) => items.length === 0 ? null : (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: color || '#6C5CE7', marginBottom: 6 }}>{title} ({items.length})</div>
      {items.map(i => (
        <div key={i.id}>
          {why && <div style={{ fontSize: 10, fontWeight: 700, color: i.attend === 'came' ? '#B8860B' : '#E84393', margin: '0 0 2px 4px' }}>👉 {todoWhy(i)}</div>}
          <InterviewCard it={i} storeName={storeLabel(i)} onClick={() => setOpenId(i.id)} />
        </div>
      ))}
    </div>
  )

  return (
    <div style={{ padding: 16, paddingBottom: 90, maxWidth: 560, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <span style={{ fontSize: 17, fontWeight: 800, color: '#1a1a2e' }}>🧑‍💼 {showForms ? '면접지 양식' : '면접'}</span>
        <span style={{ flex: 1 }} />
        {showForms ? (
          <button onClick={() => setShowForms(false)} style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid #E0E4E8', background: '#fff', color: '#666', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>← 면접 목록</button>
        ) : (
          <>
            {isOwner && <button onClick={() => setShowForms(true)} title="면접지 양식 관리" style={{ padding: '8px 11px', borderRadius: 10, border: '1px solid #E0E4E8', background: '#fff', fontSize: 14, cursor: 'pointer' }}>⚙️</button>}
            <button onClick={() => setShowNew(true)} style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#6C5CE7,#2DC6D6)', color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>+ 면접 예약</button>
          </>
        )}
      </div>

      {showForms && isOwner ? (
        <>
          <div style={{ fontSize: 12, color: '#999', marginBottom: 10, lineHeight: 1.6 }}>파트별로 면접지 양식을 만들어요. 파트를 누르면 질문과 항목을 수정할 수 있어요.</div>
          {stores.length > 1 && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              {stores.map((x: any) => (
                <button key={x.id} onClick={() => setFormStore(x.id)} style={{ flex: 1, padding: '8px 0', borderRadius: 10, fontSize: 12, fontWeight: 800, cursor: 'pointer', border: 'none', background: formStore === x.id ? '#1a1a2e' : '#fff', color: formStore === x.id ? '#fff' : '#888', boxShadow: formStore === x.id ? 'none' : '0 1px 3px rgba(0,0,0,0.06)' }}>{x.name}</button>
              ))}
            </div>
          )}
          {parts.filter(p => p.store_id === (formStore || store.id)).map(p => (
            <div key={p.id} onClick={() => setEditPart(p)} style={{ ...bx, cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 800 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>섹션 {p.template?.sections?.length || 0}개 · 항목 {(p.template?.sections || []).reduce((n: number, s: any) => n + (s.items?.length || 0), 0)}개</div>
              </div>
              <span style={{ color: '#ccc' }}>✏️</span>
            </div>
          ))}
          <div style={{ ...bx, background: '#FAFBFC' }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>+ 새 파트 추가</div>
            <input value={newPartName} onChange={e => setNewPartName(e.target.value)} placeholder="파트 이름 (예: 주방, 파트타임, 팀장, 점장, 홀매니저)" style={{ ...inp, marginBottom: 8 }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#666', marginBottom: 10 }}>
              <input type="checkbox" checked={useHall} onChange={e => setUseHall(e.target.checked)} /> 홀 직원 기본 양식으로 시작 (끄면 빈 양식)
            </label>
            <button onClick={addPart} style={{ width: '100%', padding: 11, borderRadius: 10, border: 'none', background: '#6C5CE7', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>파트 만들기</button>
          </div>
        </>
      ) : (
        <>
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="🔍 이름 또는 연락처로 검색 (전체 기간)" style={inp} />
            {q && <button onClick={() => setQ('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#aaa', fontSize: 16, cursor: 'pointer' }}>✕</button>}
          </div>

          {searchRes !== null || searching ? (
            <div>
              <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>{searching ? '검색 중...' : `검색 결과 ${searchRes?.length || 0}건`}</div>
              {(searchRes || []).map(i => <InterviewCard key={i.id} it={i} storeName={storeLabel(i)} onClick={() => setOpenId(i.id)} />)}
              {!searching && searchRes && searchRes.length === 0 && <div style={{ textAlign: 'center', padding: 30, color: '#bbb', fontSize: 13 }}>검색 결과가 없어요</div>}
            </div>
          ) : (
            <>
              {isOwner && stores.length > 1 && (
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  {[{ id: 'all', name: '전지점' }, ...stores].map((x: any) => (
                    <button key={x.id} onClick={() => setScope(x.id)} style={{ flex: 1, padding: '8px 0', borderRadius: 10, fontSize: 12, fontWeight: 800, cursor: 'pointer', border: 'none', background: scope === x.id ? '#1a1a2e' : '#fff', color: scope === x.id ? '#fff' : '#888', boxShadow: scope === x.id ? 'none' : '0 1px 3px rgba(0,0,0,0.06)' }}>{x.name}</button>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 12 }}>
                {FILTERS.map(o => {
                  const on = filter === o.k
                  const c = count(o.k)
                  return (
                    <button key={o.k} onClick={() => setFilter(o.k)} style={{ flexShrink: 0, padding: '6px 12px', borderRadius: 16, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: `1px solid ${on ? '#6C5CE7' : '#E0E4E8'}`, background: on ? 'rgba(108,92,231,0.1)' : '#fff', color: on ? '#6C5CE7' : '#888' }}>
                      {o.l}{c > 0 ? ` ${c}` : ''}
                    </button>
                  )
                })}
              </div>

              {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#bbb' }}>불러오는 중...</div> : (
                <>
                  {filter === 'all' && (
                    <>
                      <Group title="🔔 처리 필요" items={todo} color="#E84393" why />
                      <Group title="📅 다가오는 면접" items={upcoming} />
                      <Group title="📋 지난 면접" items={past} color="#888" />
                      {list.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#bbb', fontSize: 13 }}>등록된 면접이 없어요<br />오른쪽 위 "+ 면접 예약"으로 등록해보세요</div>}
                    </>
                  )}
                  {filter === 'todo' && (todo.length === 0 ? <div style={{ textAlign: 'center', padding: 40, color: '#bbb', fontSize: 13 }}>🎉 처리할 면접이 없어요</div> : <Group title="🔔 처리 필요" items={todo} color="#E84393" why />)}
                  {filter !== 'all' && filter !== 'todo' && (filtered.length === 0
                    ? <div style={{ textAlign: 'center', padding: 40, color: '#bbb', fontSize: 13 }}>해당하는 면접이 없어요</div>
                    : filtered.map(i => <InterviewCard key={i.id} it={i} storeName={storeLabel(i)} onClick={() => setOpenId(i.id)} />))}
                </>
              )}
            </>
          )}
        </>
      )}

      {showNew && <NewModal parts={parts} store={store} stores={stores} dupStoreIds={currentIds(stores, 'all')} user={user} accessFrom={accessFrom} onClose={() => setShowNew(false)} onSaved={() => loadAll()} />}
      {openId && <DetailModal id={openId} parts={parts} store={store} stores={stores} user={user} isOwner={isOwner} onClose={() => setOpenId(null)} onChanged={() => loadAll()} />}
      {editPart && <TemplateEditor name={editPart.name} tpl={editPart.template || { sections: [] }} onSave={savePart} onClose={() => setEditPart(null)} onDelete={deletePart} />}
    </div>
  )
}
