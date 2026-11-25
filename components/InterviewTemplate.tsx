'use client'
import { useState } from 'react'
import { Tpl, TplItem, TplSection, newId } from '@/lib/interviewSeed'

const inp = {
  width: '100%', padding: '9px 11px', borderRadius: 9, background: '#F8F9FB',
  border: '1px solid #E0E4E8', color: '#1a1a2e', fontSize: 13, outline: 'none',
  boxSizing: 'border-box' as const, fontFamily: 'inherit',
}
const card = { background: '#fff', borderRadius: 14, border: '1px solid #E8ECF0', padding: 14, marginBottom: 10 }

// ───────── 면접지 작성 화면 ─────────
function guideColor(line: string) {
  if (line.startsWith('✅')) return '#00B894'
  if (line.startsWith('⚠️')) return '#B8860B'
  if (line.startsWith('❌')) return '#E84393'
  return '#888'
}

function ItemView({ it, v, onChange }: { it: TplItem; v: any; onChange: (v: any) => void }) {
  const lbl = it.label ? <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 6 }}>{it.label}</div> : null
  if (it.type === 'note') {
    return <div style={{ fontSize: 12, color: '#777', whiteSpace: 'pre-wrap', lineHeight: 1.6, margin: '6px 0 12px', background: '#F8F9FB', padding: '8px 10px', borderRadius: 8 }}>{it.text}</div>
  }
  if (it.type === 'text') {
    return (
      <div style={{ marginBottom: 12 }}>
        {lbl}
        {it.text && <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>{it.text}</div>}
        <input value={v || ''} onChange={e => onChange(e.target.value)} style={inp} />
      </div>
    )
  }
  if (it.type === 'long') {
    return (
      <div style={{ marginBottom: 12 }}>
        {lbl}
        {it.text && <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>{it.text}</div>}
        <textarea value={v || ''} onChange={e => onChange(e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} />
      </div>
    )
  }
  if (it.type === 'question') {
    const guide = (it.guide || '').split('\n').filter(l => l.trim())
    return (
      <div style={{ marginBottom: 14, paddingBottom: 12, borderBottom: '1px dashed #EEF0F3' }}>
        {lbl}
        {it.text && <div style={{ fontSize: 12.5, color: '#444', whiteSpace: 'pre-wrap', lineHeight: 1.6, marginBottom: 6 }}>“{it.text}”</div>}
        {guide.length > 0 && (
          <div style={{ marginBottom: 6 }}>
            {guide.map((g, i) => <div key={i} style={{ fontSize: 11, color: guideColor(g), lineHeight: 1.6 }}>{g}</div>)}
          </div>
        )}
        <textarea value={v || ''} onChange={e => onChange(e.target.value)} rows={2} placeholder="답변 / 평가 메모" style={{ ...inp, resize: 'vertical' }} />
      </div>
    )
  }
  if (it.type === 'checks') {
    const opts = (it.options || '').split('\n').filter(l => l.trim())
    const checked: number[] = Array.isArray(v) ? v : []
    return (
      <div style={{ marginBottom: 12 }}>
        {lbl}
        {opts.map((o, i) => {
          const on = checked.includes(i)
          return (
            <div key={i} onClick={() => onChange(on ? checked.filter(x => x !== i) : [...checked, i])}
              style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 2px', cursor: 'pointer' }}>
              <div style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, marginTop: 1, border: `2px solid ${on ? '#6C5CE7' : '#D0D5DD'}`, background: on ? '#6C5CE7' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {on && <span style={{ color: '#fff', fontSize: 11, fontWeight: 800 }}>✓</span>}
              </div>
              <span style={{ fontSize: 13, color: '#333', lineHeight: 1.5 }}>{o}</span>
            </div>
          )
        })}
      </div>
    )
  }
  if (it.type === 'yesno') {
    const val = v && typeof v === 'object' ? v : { v: '', memo: '' }
    return (
      <div style={{ marginBottom: 14 }}>
        {lbl}
        {it.text && <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>{it.text}</div>}
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          {[{ k: 'yes', l: '✅ 수용' }, { k: 'no', l: '❌ 거부' }, { k: 'hold', l: '➖ 보류' }].map(o => (
            <button key={o.k} onClick={() => onChange({ ...val, v: val.v === o.k ? '' : o.k })}
              style={{ flex: 1, padding: '8px 0', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: `1px solid ${val.v === o.k ? '#6C5CE7' : '#E0E4E8'}`, background: val.v === o.k ? 'rgba(108,92,231,0.1)' : '#fff', color: val.v === o.k ? '#6C5CE7' : '#888' }}>{o.l}</button>
          ))}
        </div>
        <input value={val.memo || ''} onChange={e => onChange({ ...val, memo: e.target.value })} placeholder="메모 (선택)" style={inp} />
      </div>
    )
  }
  return null
}

export function FormRenderer({ tpl, answers, onChange }: { tpl: Tpl; answers: Record<string, any>; onChange: (id: string, v: any) => void }) {
  if (!tpl.sections || tpl.sections.length === 0) {
    return <div style={{ textAlign: 'center', padding: 24, color: '#bbb', fontSize: 13 }}>이 파트에는 아직 면접지 양식이 없어요<br />(면접 → 양식 관리에서 만들어주세요)</div>
  }
  return (
    <>
      {tpl.sections.map(sec => (
        <div key={sec.id} style={card}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#6C5CE7', marginBottom: 12 }}>{sec.title}</div>
          {sec.items.map(it => <ItemView key={it.id} it={it} v={answers[it.id]} onChange={val => onChange(it.id, val)} />)}
        </div>
      ))}
    </>
  )
}

// ───────── 양식 편집 (대표) ─────────
const TYPE_LABEL: Record<TplItem['type'], string> = {
  text: '짧은 입력', long: '긴 입력', question: '질문+평가가이드+답변', checks: '체크박스 목록', yesno: '수용 여부', note: '안내문',
}

export function TemplateEditor({ name, tpl, onSave, onClose, onDelete }: {
  name: string; tpl: Tpl; onSave: (name: string, tpl: Tpl) => Promise<void>; onClose: () => void; onDelete: () => void
}) {
  const [nm, setNm] = useState(name)
  const [t, setT] = useState<Tpl>(JSON.parse(JSON.stringify(tpl)))
  const [saving, setSaving] = useState(false)
  const [addType, setAddType] = useState<Record<string, TplItem['type']>>({})

  const setSec = (si: number, patch: Partial<TplSection>) => setT(p => ({ sections: p.sections.map((s, i) => i === si ? { ...s, ...patch } : s) }))
  const setItem = (si: number, ii: number, patch: Partial<TplItem>) => setT(p => ({ sections: p.sections.map((s, i) => i !== si ? s : { ...s, items: s.items.map((x, j) => j === ii ? { ...x, ...patch } : x) }) }))
  const moveItem = (si: number, ii: number, d: number) => setT(p => ({ sections: p.sections.map((s, i) => {
    if (i !== si) return s
    const items = [...s.items]; const j = ii + d
    if (j < 0 || j >= items.length) return s
    ;[items[ii], items[j]] = [items[j], items[ii]]
    return { ...s, items }
  }) }))
  const delItem = (si: number, ii: number) => setT(p => ({ sections: p.sections.map((s, i) => i !== si ? s : { ...s, items: s.items.filter((_, j) => j !== ii) }) }))
  const addItem = (si: number) => {
    const type = addType[t.sections[si].id] || 'question'
    const it: TplItem = { id: newId(), type, label: '', text: '' }
    setT(p => ({ sections: p.sections.map((s, i) => i !== si ? s : { ...s, items: [...s.items, it] }) }))
  }
  const moveSec = (si: number, d: number) => setT(p => {
    const arr = [...p.sections]; const j = si + d
    if (j < 0 || j >= arr.length) return p
    ;[arr[si], arr[j]] = [arr[j], arr[si]]
    return { sections: arr }
  })
  const delSec = (si: number) => { if (confirm('이 섹션과 안의 항목을 모두 삭제할까요?')) setT(p => ({ sections: p.sections.filter((_, i) => i !== si) })) }
  const addSec = () => setT(p => ({ sections: [...p.sections, { id: newId(), title: `${p.sections.length + 1}. 새 섹션`, items: [] }] }))

  async function save() {
    if (!nm.trim()) { alert('파트 이름을 입력해주세요'); return }
    setSaving(true); await onSave(nm.trim(), t); setSaving(false)
  }

  const smallBtn = { padding: '4px 8px', borderRadius: 7, border: '1px solid #E0E4E8', background: '#fff', color: '#666', fontSize: 11, cursor: 'pointer' } as const

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: '#F4F6F9', width: '100%', maxWidth: 560, height: '94vh', borderRadius: '20px 20px 0 0', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 8, background: '#fff', borderRadius: '20px 20px 0 0', borderBottom: '1px solid #E8ECF0' }}>
          <input value={nm} onChange={e => setNm(e.target.value)} placeholder="파트 이름 (예: 홀 직원)" style={{ ...inp, fontWeight: 700 }} />
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: '#aaa', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
          {t.sections.map((sec, si) => (
            <div key={sec.id} style={card}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
                <input value={sec.title} onChange={e => setSec(si, { title: e.target.value })} style={{ ...inp, fontWeight: 800, color: '#6C5CE7' }} />
                <button onClick={() => moveSec(si, -1)} style={smallBtn}>↑</button>
                <button onClick={() => moveSec(si, 1)} style={smallBtn}>↓</button>
                <button onClick={() => delSec(si)} style={{ ...smallBtn, color: '#E84393' }}>삭제</button>
              </div>
              {sec.items.map((it, ii) => (
                <div key={it.id} style={{ border: '1px solid #EEF0F3', borderRadius: 10, padding: 10, marginBottom: 8, background: '#FAFBFC' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, background: 'rgba(108,92,231,0.1)', color: '#6C5CE7', fontWeight: 700 }}>{TYPE_LABEL[it.type]}</span>
                    <span style={{ flex: 1 }} />
                    <button onClick={() => moveItem(si, ii, -1)} style={smallBtn}>↑</button>
                    <button onClick={() => moveItem(si, ii, 1)} style={smallBtn}>↓</button>
                    <button onClick={() => delItem(si, ii)} style={{ ...smallBtn, color: '#E84393' }}>삭제</button>
                  </div>
                  {it.type !== 'note' && (
                    <input value={it.label || ''} onChange={e => setItem(si, ii, { label: e.target.value })} placeholder="항목 제목" style={{ ...inp, marginBottom: 6 }} />
                  )}
                  {it.type !== 'checks' && (
                    <textarea value={it.text || ''} onChange={e => setItem(si, ii, { text: e.target.value })} rows={it.type === 'note' || it.type === 'question' ? 3 : 2}
                      placeholder={it.type === 'question' ? '질문 문구 (여러 줄 가능)' : it.type === 'note' ? '안내문' : '설명 (선택)'} style={{ ...inp, marginBottom: 6, resize: 'vertical' }} />
                  )}
                  {it.type === 'question' && (
                    <textarea value={it.guide || ''} onChange={e => setItem(si, ii, { guide: e.target.value })} rows={3}
                      placeholder={'평가 가이드 (한 줄에 하나)\n✅ 좋은 답변\n⚠️ 주의\n❌ 나쁜 답변'} style={{ ...inp, resize: 'vertical' }} />
                  )}
                  {it.type === 'checks' && (
                    <textarea value={it.options || ''} onChange={e => setItem(si, ii, { options: e.target.value })} rows={4}
                      placeholder={'체크박스 항목 (한 줄에 하나)'} style={{ ...inp, resize: 'vertical' }} />
                  )}
                </div>
              ))}
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <select value={addType[sec.id] || 'question'} onChange={e => setAddType(p => ({ ...p, [sec.id]: e.target.value as TplItem['type'] }))} style={{ ...inp, flex: 1 }}>
                  {(Object.keys(TYPE_LABEL) as TplItem['type'][]).map(k => <option key={k} value={k}>{TYPE_LABEL[k]}</option>)}
                </select>
                <button onClick={() => addItem(si)} style={{ padding: '8px 14px', borderRadius: 9, border: 'none', background: '#6C5CE7', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>+ 항목 추가</button>
              </div>
            </div>
          ))}
          <button onClick={addSec} style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px dashed #6C5CE7', background: 'rgba(108,92,231,0.05)', color: '#6C5CE7', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 12 }}>+ 섹션 추가</button>
          <div style={{ fontSize: 11, color: '#aaa', marginBottom: 10, lineHeight: 1.6 }}>
            ※ 이름·연락처·면접일·면접관, 그리고 마지막 "종합 평가(합격/불합격/보류, 사유, 급여, 출근예정일, 총평)"는 모든 면접지에 자동으로 들어가요.<br />
            ※ 양식을 바꿔도 이미 작성 중이거나 끝난 면접지는 그대로 유지돼요.
          </div>
        </div>
        <div style={{ padding: 12, background: '#fff', borderTop: '1px solid #E8ECF0', display: 'flex', gap: 8 }}>
          <button onClick={onDelete} style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(232,67,147,0.3)', background: '#fff', color: '#E84393', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>파트 삭제</button>
          <button onClick={save} disabled={saving} style={{ flex: 1, padding: 12, borderRadius: 12, border: 'none', background: saving ? '#ccc' : 'linear-gradient(135deg,#6C5CE7,#2DC6D6)', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>{saving ? '저장 중...' : '💾 양식 저장'}</button>
        </div>
      </div>
    </div>
  )
}
