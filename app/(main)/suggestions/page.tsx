'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'

// ─── 상수 ────────────────────────────────────────────────
const CATEGORIES = [
  { value: 'app',     label: '앱 기능',   color: '#6C5CE7', bg: 'rgba(108,92,231,0.1)' },
  { value: 'store',   label: '매장 건의', color: '#FF6B35', bg: 'rgba(255,107,53,0.1)' },
  { value: 'sales',   label: '매출 건의', color: '#B8860B', bg: 'rgba(253,196,0,0.15)' },
  { value: 'report',  label: '제보',      color: '#E84393', bg: 'rgba(232,67,147,0.1)' },
  { value: 'consult', label: '고민상담',  color: '#00B894', bg: 'rgba(0,184,148,0.1)'  },
]

// ─── 스타일 상수 ─────────────────────────────────────────
const bx = {
  background: '#ffffff', borderRadius: 16, border: '1px solid #E8ECF0',
  padding: 14, marginBottom: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
}
const inp = {
  width: '100%', padding: '10px 12px', borderRadius: 10,
  background: '#F8F9FB', border: '1px solid #E0E4E8', color: '#1a1a2e',
  fontSize: 13, outline: 'none', boxSizing: 'border-box' as const,
  fontFamily: 'inherit'
}

// ─── 헬퍼 ────────────────────────────────────────────────
function getCat(value: string) {
  return CATEGORIES.find(c => c.value === value) || CATEGORIES[0]
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return '방금'
  if (m < 60) return `${m}분 전`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}시간 전`
  return `${Math.floor(h / 24)}일 전`
}

// ─── 뱃지 ────────────────────────────────────────────────
function CatBadge({ value }: { value: string }) {
  const cat = getCat(value)
  return (
    <span style={{
      fontSize: 10, padding: '2px 7px', borderRadius: 6, fontWeight: 600,
      background: cat.bg, color: cat.color
    }}>{cat.label}</span>
  )
}

// ─── 비밀번호 변경 넛지 ───────────────────────────────────
function PwNudge({ onClose }: { onClose: () => void }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(108,92,231,0.08), rgba(232,67,147,0.05))',
      border: '1px dashed rgba(108,92,231,0.25)', borderRadius: 12,
      padding: '12px 14px', marginBottom: 10, display: 'flex', gap: 10, alignItems: 'center'
    }}>
      <span style={{ fontSize: 20, flexShrink: 0 }}>🔒</span>
      <div style={{ flex: 1, fontSize: 12, color: '#666', lineHeight: 1.6 }}>
        이 공간은 <strong style={{ color: '#6C5CE7' }}>나와 대표님만</strong> 볼 수 있어요.<br />
        비밀번호가 초기 설정이라면 소중한 글이 노출될 수 있어요.
      </div>
      <button
        onClick={onClose}
        style={{
          padding: '6px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700,
          background: 'rgba(108,92,231,0.1)', border: '1px solid rgba(108,92,231,0.25)',
          color: '#6C5CE7', cursor: 'pointer', whiteSpace: 'nowrap'
        }}
      >변경하기</button>
    </div>
  )
}

// ─── 직원: 카드 ───────────────────────────────────────────
function StaffCard({ item, isNew, onClick }: { item: any; isNew: boolean; onClick: () => void }) {
  const hasNewAnswer = isNew && item.status === 'answered'
  return (
    <div
      onClick={onClick}
      style={{
        ...bx,
        borderLeft: item.status === 'answered' ? '3px solid #00B894' : '3px solid #FF6B35',
        cursor: 'pointer'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          <CatBadge value={item.category} />
          {hasNewAnswer && (
            <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, fontWeight: 700, background: 'rgba(0,184,148,0.1)', color: '#00B894' }}>
              🔔 새 답변
            </span>
          )}
          {item.status === 'pending' && (
            <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, fontWeight: 700, background: 'rgba(255,107,53,0.1)', color: '#FF6B35' }}>
              답변 대기
            </span>
          )}
        </div>
        <span style={{ fontSize: 10, color: '#bbb', flexShrink: 0 }}>{timeAgo(item.created_at)}</span>
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e', marginBottom: 3 }}>{item.title}</div>
      <div style={{ fontSize: 12, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {item.content}
      </div>
      {item.status === 'answered' && item.answer && (
        <div style={{
          marginTop: 10, padding: '8px 10px', borderRadius: 10,
          background: 'rgba(0,184,148,0.04)', border: '1px solid rgba(0,184,148,0.2)'
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#00B894', marginBottom: 3 }}>💬 대표님 답변</div>
          <div style={{ fontSize: 12, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.answer}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── 대표: 카드 ───────────────────────────────────────────
function OwnerCard({ item, historyCount, onClick }: { item: any; historyCount: number; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        ...bx,
        borderLeft: item.status === 'pending' ? '3px solid #FF6B35' : '3px solid #00B894',
        cursor: 'pointer'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          <CatBadge value={item.category} />
          {item.status === 'pending'
            ? <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, fontWeight: 700, background: '#FF6B35', color: '#fff' }}>미답변</span>
            : <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, fontWeight: 700, background: 'rgba(0,184,148,0.1)', color: '#00B894' }}>✓ 답변완료</span>
          }
          {historyCount > 0 && (
            <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 6, background: 'rgba(108,92,231,0.08)', color: '#aaa', fontWeight: 600 }}>
              수정이력 {historyCount}건
            </span>
          )}
        </div>
        <span style={{ fontSize: 10, color: '#bbb', flexShrink: 0 }}>{timeAgo(item.created_at)}</span>
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e', marginBottom: 2 }}>{item.title}</div>
      <div style={{ fontSize: 11, color: '#bbb', marginBottom: 6 }}>{item.author_name}</div>
      <div style={{ fontSize: 12, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {item.content}
      </div>
      {item.status === 'pending' && (
        <div style={{ marginTop: 10, textAlign: 'right' }}>
          <span style={{
            fontSize: 11, padding: '4px 10px', borderRadius: 7, fontWeight: 700,
            background: 'linear-gradient(135deg,#FF6B35,#E84393)', color: '#fff'
          }}>답변하기 →</span>
        </div>
      )}
    </div>
  )
}

// ─── 상세 모달 (직원용) ───────────────────────────────────
function StaffDetailModal({
  item, onClose, onEdit, userName
}: {
  item: any; onClose: () => void; onEdit: (item: any) => void; userName: string
}) {
  const isMyPost = item.author_name === userName
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center'
    }}>
      <div style={{
        width: '100%', maxWidth: 480, background: '#F4F6F9',
        borderRadius: '20px 20px 0 0', padding: '20px 16px 40px', maxHeight: '85vh', overflowY: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <CatBadge value={item.category} />
            {item.status === 'pending'
              ? <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, fontWeight: 700, background: 'rgba(255,107,53,0.1)', color: '#FF6B35' }}>답변 대기</span>
              : <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, fontWeight: 700, background: 'rgba(0,184,148,0.1)', color: '#00B894' }}>✓ 답변완료</span>
            }
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {isMyPost && (
              <button onClick={() => onEdit(item)} style={{
                fontSize: 12, color: '#6C5CE7', background: 'rgba(108,92,231,0.08)',
                border: '1px solid rgba(108,92,231,0.2)', borderRadius: 7, padding: '4px 10px', cursor: 'pointer', fontWeight: 600
              }}>수정</button>
            )}
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: '#bbb', cursor: 'pointer' }}>✕</button>
          </div>
        </div>

        <div style={{ fontSize: 17, fontWeight: 700, color: '#1a1a2e', marginBottom: 4 }}>{item.title}</div>
        <div style={{ fontSize: 11, color: '#bbb', marginBottom: 12 }}>
          {new Date(item.created_at).toLocaleString('ko', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}
          {item.updated_at !== item.created_at && <span style={{ marginLeft: 6, color: '#ccc' }}>(수정됨)</span>}
        </div>

        <div style={{ fontSize: 14, color: '#444', lineHeight: 1.8, background: '#fff', borderRadius: 12, padding: '14px', marginBottom: 14, border: '1px solid #E8ECF0' }}>
          {item.content}
        </div>

        {item.status === 'answered' && item.answer && (
          <div style={{ background: 'rgba(0,184,148,0.04)', border: '1px solid rgba(0,184,148,0.25)', borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#00B894', marginBottom: 8 }}>
              💬 {item.answered_by || '대표'} 님의 답변
            </div>
            <div style={{ fontSize: 14, color: '#444', lineHeight: 1.7 }}>{item.answer}</div>
            <div style={{ fontSize: 10, color: '#bbb', marginTop: 8 }}>
              {item.answered_at && new Date(item.answered_at).toLocaleString('ko', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}
            </div>
          </div>
        )}

        {item.status === 'pending' && (
          <div style={{ textAlign: 'center', padding: '20px 0', color: '#bbb', fontSize: 13 }}>
            ⏳ 대표님 답변을 기다리고 있어요
          </div>
        )}
      </div>
    </div>
  )
}

// ─── 상세 모달 (대표용) ───────────────────────────────────
function OwnerDetailModal({
  item, history, onClose, onAnswered, onDelete, ownerName
}: {
  item: any; history: any[]; onClose: () => void
  onAnswered: (id: string, answer: string) => void
  onDelete: (id: string) => void
  ownerName: string
}) {
  const [answerText, setAnswerText] = useState(item.answer || '')
  const [showHistory, setShowHistory] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleAnswer() {
    if (!answerText.trim()) { alert('답변을 입력해주세요'); return }
    setSaving(true)
    await onAnswered(item.id, answerText)
    setSaving(false)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center'
    }}>
      <div style={{
        width: '100%', maxWidth: 480, background: '#F4F6F9',
        borderRadius: '20px 20px 0 0', padding: '20px 16px 40px', maxHeight: '90vh', overflowY: 'auto'
      }}>
        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <CatBadge value={item.category} />
            {item.status === 'pending'
              ? <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, fontWeight: 700, background: '#FF6B35', color: '#fff' }}>미답변</span>
              : <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, fontWeight: 700, background: 'rgba(0,184,148,0.1)', color: '#00B894' }}>✓ 답변완료</span>
            }
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => { if (confirm('이 글을 삭제할까요?')) onDelete(item.id) }} style={{
              fontSize: 12, color: '#E84393', background: 'rgba(232,67,147,0.08)',
              border: '1px solid rgba(232,67,147,0.2)', borderRadius: 7, padding: '4px 10px', cursor: 'pointer', fontWeight: 600
            }}>삭제</button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: '#bbb', cursor: 'pointer' }}>✕</button>
          </div>
        </div>

        {/* 작성자 정보 */}
        <div style={{ fontSize: 12, color: '#FF6B35', fontWeight: 700, marginBottom: 4 }}>
          👤 {item.author_name}
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#1a1a2e', marginBottom: 4 }}>{item.title}</div>
        <div style={{ fontSize: 11, color: '#bbb', marginBottom: 12 }}>
          {new Date(item.created_at).toLocaleString('ko', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}
        </div>

        {/* 본문 */}
        <div style={{ fontSize: 14, color: '#444', lineHeight: 1.8, background: '#fff', borderRadius: 12, padding: 14, marginBottom: 12, border: '1px solid #E8ECF0' }}>
          {item.content}
        </div>

        {/* 수정이력 (대표만) */}
        {history.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <button
              onClick={() => setShowHistory(p => !p)}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                background: 'rgba(108,92,231,0.04)', border: '1px solid rgba(108,92,231,0.15)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: '#6C5CE7' }}>📋 수정이력 {history.length}건 <span style={{ fontSize: 9, background: 'rgba(108,92,231,0.1)', padding: '1px 5px', borderRadius: 4, marginLeft: 4 }}>👑 대표만 열람</span></span>
              <span style={{ fontSize: 11, color: '#bbb' }}>{showHistory ? '▲ 닫기' : '▼ 보기'}</span>
            </button>

            {showHistory && (
              <div style={{ background: '#fff', borderRadius: '0 0 12px 12px', border: '1px solid rgba(108,92,231,0.15)', borderTop: 'none', padding: 12 }}>
                {history.map((h, i) => (
                  <div key={h.id} style={{ borderLeft: '2px solid rgba(108,92,231,0.2)', paddingLeft: 10, marginBottom: i < history.length - 1 ? 14 : 0 }}>
                    <div style={{ fontSize: 10, color: '#bbb', marginBottom: 5 }}>
                      v{history.length - i} — {new Date(h.edited_at).toLocaleString('ko', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })} 이전 내용
                    </div>
                    {h.prev_title !== item.title && (
                      <div style={{ fontSize: 11, marginBottom: 4 }}>
                        <span style={{ color: '#bbb' }}>제목: </span>
                        <span style={{ color: '#E84393', textDecoration: 'line-through' }}>{h.prev_title}</span>
                        <span style={{ color: '#bbb', margin: '0 4px' }}>→</span>
                        <span style={{ color: '#00B894' }}>{item.title}</span>
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: '#666', background: '#FFF5F0', borderRadius: 8, padding: '8px 10px', lineHeight: 1.6, border: '1px solid rgba(232,67,147,0.1)' }}>
                      {h.prev_content}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 답변 영역 */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(0,184,148,0.2)', padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#00B894', marginBottom: 10 }}>
            💬 {item.status === 'answered' ? '답변 수정' : '답변 작성'}
          </div>
          <textarea
            value={answerText}
            onChange={e => setAnswerText(e.target.value)}
            placeholder="답변을 입력해주세요..."
            rows={4}
            style={{ ...inp, resize: 'none', lineHeight: 1.7, marginBottom: 10 }}
          />
          <button
            onClick={handleAnswer}
            disabled={saving}
            style={{
              width: '100%', padding: '13px 0', borderRadius: 12,
              background: saving ? '#ddd' : 'linear-gradient(135deg,#00B894,#00cec9)',
              border: 'none', color: '#fff', fontSize: 14, fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer'
            }}
          >
            {saving ? '저장 중...' : item.status === 'answered' ? '답변 수정 저장' : '답변 등록 & 알림 발송'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── 글쓰기/수정 폼 ──────────────────────────────────────
function WriteForm({
  storeId, userName, editItem, onSaved, onClose
}: {
  storeId: string; userName: string; editItem?: any; onSaved: () => void; onClose: () => void
}) {
  const supabase = createSupabaseBrowserClient()
  const [category, setCategory] = useState(editItem?.category || 'store')
  const [title, setTitle] = useState(editItem?.title || '')
  const [content, setContent] = useState(editItem?.content || '')
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    if (!title.trim()) { alert('제목을 입력해주세요'); return }
    if (!content.trim()) { alert('내용을 입력해주세요'); return }
    setSaving(true)
    try {
      if (editItem) {
        // 수정이력 저장 후 업데이트
        await supabase.from('suggestion_edit_history').insert({
          suggestion_id: editItem.id,
          prev_title: editItem.title,
          prev_content: editItem.content
        })
        await supabase.from('suggestions').update({
          category, title, content,
          updated_at: new Date().toISOString()
        }).eq('id', editItem.id)
      } else {
        // 새 글 작성
        const { data } = await supabase.from('suggestions').insert({
          store_id: storeId,
          author_name: userName,
          category, title, content,
          status: 'pending'
        }).select().single()

        // 대표에게 알림 (같은 매장 owner에게)
        if (data) {
          const { data: owners } = await supabase
            .from('store_members')
            .select('profiles(nm)')
            .eq('store_id', storeId)
            .eq('role', 'owner')
            .eq('active', true)

          if (owners && owners.length > 0) {
            const notifs = owners.map((o: any) => ({
              suggestion_id: data.id,
              store_id: storeId,
              target_name: o.profiles?.nm || '',
              type: 'new_post'
            }))
            await supabase.from('suggestion_notifications').insert(notifs)
          }
        }
      }
      onSaved()
    } catch (e: any) {
      alert('저장 실패: ' + e?.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center'
    }}>
      <div style={{
        width: '100%', maxWidth: 480, background: '#F4F6F9',
        borderRadius: '20px 20px 0 0', padding: '20px 16px 40px', maxHeight: '90vh', overflowY: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>
            {editItem ? '✏️ 글 수정' : '💬 건의&제보 작성'}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: '#bbb', cursor: 'pointer' }}>✕</button>
        </div>

        {/* 비공개 안내 */}
        <div style={{
          background: 'rgba(255,107,53,0.06)', borderRadius: 10, padding: '10px 12px',
          marginBottom: 14, fontSize: 12, color: '#888', lineHeight: 1.6
        }}>
          🔒 나와 대표님만 볼 수 있어요. 부담 없이 솔직하게 적어주세요.
        </div>

        {/* 카테고리 */}
        <div style={{ fontSize: 11, color: '#888', fontWeight: 600, marginBottom: 6 }}>카테고리</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat.value}
              onClick={() => setCategory(cat.value)}
              style={{
                padding: '6px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer', fontWeight: 600,
                border: category === cat.value ? `1px solid ${cat.color}` : '1px solid #E8ECF0',
                background: category === cat.value ? cat.bg : '#F8F9FB',
                color: category === cat.value ? cat.color : '#888',
              }}
            >{cat.label}</button>
          ))}
        </div>

        {/* 제목 */}
        <div style={{ fontSize: 11, color: '#888', fontWeight: 600, marginBottom: 6 }}>제목</div>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="제목을 입력해주세요"
          style={{ ...inp, marginBottom: 12 }}
        />

        {/* 내용 */}
        <div style={{ fontSize: 11, color: '#888', fontWeight: 600, marginBottom: 6 }}>내용</div>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="솔직하게 적어주세요. 나와 대표님만 볼 수 있어요."
          rows={5}
          style={{ ...inp, resize: 'none', lineHeight: 1.7, marginBottom: 12 }}
        />

        {/* 안내 문구 */}
        {!editItem && (
          <div style={{ fontSize: 11, color: '#bbb', marginBottom: 12, lineHeight: 1.6 }}>
            ✏️ 작성 후 수정 가능 · 🗑️ 삭제는 대표님만 가능
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={saving}
          style={{
            width: '100%', padding: '13px 0', borderRadius: 12,
            background: saving ? '#ddd' : 'linear-gradient(135deg,#FF6B35,#E84393)',
            border: 'none', color: '#fff', fontSize: 14, fontWeight: 700,
            cursor: saving ? 'not-allowed' : 'pointer'
          }}
        >
          {saving ? '저장 중...' : editItem ? '수정 저장' : '등록하기'}
        </button>
      </div>
    </div>
  )
}

// ─── 메인 페이지 ─────────────────────────────────────────
export default function SuggestionsPage() {
  const supabase = createSupabaseBrowserClient()

  const [storeId, setStoreId] = useState('')
  const [userName, setUserName] = useState('')
  const [userRole, setUserRole] = useState('')
  const isOwner = userRole === 'owner'

  // 데이터
  const [items, setItems] = useState<any[]>([])
  const [historyMap, setHistoryMap] = useState<Record<string, any[]>>({})
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // 필터 (대표용)
  const [filterStatus, setFilterStatus] = useState('all')   // all | pending | answered
  const [filterStaff, setFilterStaff] = useState('all')
  const [filterCat, setFilterCat] = useState('all')

  // 직원 목록 (대표용 필터)
  const [staffList, setStaffList] = useState<string[]>([])

  // 모달
  const [showWrite, setShowWrite] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [detailItem, setDetailItem] = useState<any>(null)
  const [showPwNudge, setShowPwNudge] = useState(true)

  useEffect(() => {
    const store = JSON.parse(localStorage.getItem('mj_store') || '{}')
    const user = JSON.parse(localStorage.getItem('mj_user') || '{}')
    if (!store.id) return
    setStoreId(store.id)
    setUserName(user.nm || '')
    setUserRole(user.role || '')
    loadData(store.id, user.nm || '', user.role || '')
  }, [])

  async function loadData(sid: string, uname: string, role: string) {
    setLoading(true)
    try {
      let query = supabase
        .from('suggestions')
        .select('*')
        .eq('store_id', sid)
        .order('created_at', { ascending: false })

      // 직원은 본인 글만
      if (role !== 'owner') {
        query = query.eq('author_name', uname)
      }

      const { data } = await query
      const list = data || []
      setItems(list)

      // 직원 목록 추출 (대표용)
      if (role === 'owner') {
        const names = [...new Set(list.map((i: any) => i.author_name))] as string[]
        setStaffList(names)
      }

      // 수정이력 로드
      if (list.length > 0) {
        const ids = list.map((i: any) => i.id)
        const { data: hist } = await supabase
          .from('suggestion_edit_history')
          .select('*')
          .in('suggestion_id', ids)
          .order('edited_at', { ascending: false })

        const hm: Record<string, any[]> = {}
        ;(hist || []).forEach((h: any) => {
          if (!hm[h.suggestion_id]) hm[h.suggestion_id] = []
          hm[h.suggestion_id].push(h)
        })
        setHistoryMap(hm)
      }

      // 알림 로드
      const { data: notifs } = await supabase
        .from('suggestion_notifications')
        .select('*')
        .eq('store_id', sid)
        .eq('target_name', uname)
        .eq('is_read', false)
      setNotifications(notifs || [])
    } finally {
      setLoading(false)
    }
  }

  // 알림 읽음 처리
  async function markNotifsRead(suggestionId: string) {
    const related = notifications.filter(n => n.suggestion_id === suggestionId)
    if (related.length === 0) return
    const ids = related.map(n => n.id)
    await supabase.from('suggestion_notifications').update({ is_read: true }).in('id', ids)
    setNotifications(p => p.filter(n => !ids.includes(n.id)))
  }

  // 상세 열기
  async function openDetail(item: any) {
    setDetailItem(item)
    await markNotifsRead(item.id)
  }

  // 대표 답변 등록
  async function handleAnswer(id: string, answer: string) {
    await supabase.from('suggestions').update({
      answer,
      status: 'answered',
      answered_by: userName,
      answered_at: new Date().toISOString()
    }).eq('id', id)

    // 작성자에게 알림
    const item = items.find(i => i.id === id)
    if (item) {
      await supabase.from('suggestion_notifications').insert({
        suggestion_id: id,
        store_id: storeId,
        target_name: item.author_name,
        type: 'new_answer'
      })
    }

    await loadData(storeId, userName, userRole)
    setDetailItem(null)
  }

  // 삭제 (대표만)
  async function handleDelete(id: string) {
    await supabase.from('suggestions').delete().eq('id', id)
    await loadData(storeId, userName, userRole)
    setDetailItem(null)
  }

  // 필터링된 목록
  const filtered = items.filter(item => {
    if (isOwner) {
      const statusOk = filterStatus === 'all' || item.status === filterStatus
      const staffOk = filterStaff === 'all' || item.author_name === filterStaff
      const catOk = filterCat === 'all' || item.category === filterCat
      return statusOk && staffOk && catOk
    }
    return true
  })

  const pendingCount = items.filter(i => i.status === 'pending').length
  const answeredCount = items.filter(i => i.status === 'answered').length
  const newNotifCount = notifications.length

  // 이 글에 새 알림 있는지 체크
  function hasNewNotif(itemId: string) {
    return notifications.some(n => n.suggestion_id === itemId)
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: '5px 10px', borderRadius: 20, fontSize: 11, fontWeight: active ? 700 : 500,
    border: '1px solid', cursor: 'pointer', whiteSpace: 'nowrap',
    borderColor: active ? '#1a1a2e' : '#E8ECF0',
    background: active ? '#1a1a2e' : '#F8F9FB',
    color: active ? '#fff' : '#888',
  })

  return (
    <div>
      {/* 페이지 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: '#1a1a2e' }}>💬 건의&amp;제보</span>
          {isOwner && pendingCount > 0 && (
            <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: '#FF6B35', color: '#fff', fontWeight: 700 }}>
              미답변 {pendingCount}
            </span>
          )}
          {!isOwner && newNotifCount > 0 && (
            <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: '#00B894', color: '#fff', fontWeight: 700 }}>
              새 답변 {newNotifCount}
            </span>
          )}
          {isOwner && (
            <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(255,107,53,0.1)', color: '#FF6B35', fontWeight: 700 }}>
              👑 대표
            </span>
          )}
        </div>
        {!isOwner && (
          <button
            onClick={() => { setEditItem(undefined); setShowWrite(true) }}
            style={{
              padding: '6px 14px', borderRadius: 9,
              background: 'rgba(255,107,53,0.1)', border: '1px solid rgba(255,107,53,0.3)',
              color: '#FF6B35', fontSize: 12, fontWeight: 700, cursor: 'pointer'
            }}
          >+ 글쓰기</button>
        )}
      </div>

      {/* 직원: 비밀번호 넛지 */}
      {!isOwner && showPwNudge && (
        <PwNudge onClose={() => setShowPwNudge(false)} />
      )}

      {/* 직원: 안내 문구 */}
      {!isOwner && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(255,107,53,0.07), rgba(232,67,147,0.04))',
          border: '1px solid rgba(255,107,53,0.15)', borderRadius: 14,
          padding: '12px 14px', marginBottom: 14, display: 'flex', gap: 10, alignItems: 'flex-start'
        }}>
          <span style={{ fontSize: 18 }}>🤫</span>
          <div style={{ fontSize: 12, color: '#666', lineHeight: 1.6 }}>
            <strong>나와 대표님만 볼 수 있어요.</strong><br />
            부담 없이 솔직하게 적어주세요. 모든 내용은 비공개로 처리됩니다.
          </div>
        </div>
      )}

      {/* 대표: 필터 */}
      {isOwner && (
        <div style={{ ...bx, marginBottom: 12 }}>
          {/* 상태 */}
          <div style={{ fontSize: 10, fontWeight: 700, color: '#aaa', marginBottom: 6 }}>상태</div>
          <div style={{ display: 'flex', gap: 5, marginBottom: 12 }}>
            {[
              { val: 'all', label: `전체 ${items.length}` },
              { val: 'pending', label: `미답변 ${pendingCount}`, color: '#FF6B35' },
              { val: 'answered', label: `답변완료 ${answeredCount}`, color: '#00B894' },
            ].map(opt => (
              <button key={opt.val} onClick={() => setFilterStatus(opt.val)} style={tabStyle(filterStatus === opt.val)}>
                {opt.label}
              </button>
            ))}
          </div>

          {/* 직원 */}
          {staffList.length > 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#aaa', marginBottom: 6 }}>직원</div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
                <button onClick={() => setFilterStaff('all')} style={tabStyle(filterStaff === 'all')}>전체</button>
                {staffList.map(name => (
                  <button key={name} onClick={() => setFilterStaff(name)} style={tabStyle(filterStaff === name)}>
                    {name} {items.filter(i => i.author_name === name).length}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* 카테고리 */}
          <div style={{ fontSize: 10, fontWeight: 700, color: '#aaa', marginBottom: 6 }}>카테고리</div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            <button onClick={() => setFilterCat('all')} style={tabStyle(filterCat === 'all')}>전체</button>
            {CATEGORIES.map(cat => (
              <button key={cat.value} onClick={() => setFilterCat(cat.value)} style={tabStyle(filterCat === cat.value)}>
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 결과 카운트 */}
      {isOwner && (
        <div style={{ fontSize: 11, color: '#aaa', marginBottom: 8, paddingLeft: 2 }}>
          {filterStatus === 'all' && filterStaff === 'all' && filterCat === 'all'
            ? `전체 ${filtered.length}건`
            : `필터 결과 ${filtered.length}건`
          }
        </div>
      )}

      {/* 카드 목록 */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#bbb', fontSize: 13 }}>불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div style={{ ...bx, textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>
            {isOwner ? '🔍' : '📝'}
          </div>
          <div style={{ fontSize: 13, color: '#bbb' }}>
            {isOwner ? '해당 조건의 게시물이 없어요' : '아직 작성한 글이 없어요'}
          </div>
          {!isOwner && (
            <button
              onClick={() => setShowWrite(true)}
              style={{
                marginTop: 14, padding: '10px 20px', borderRadius: 10,
                background: 'rgba(255,107,53,0.1)', border: '1px solid rgba(255,107,53,0.3)',
                color: '#FF6B35', fontSize: 13, fontWeight: 700, cursor: 'pointer'
              }}
            >첫 글 작성하기</button>
          )}
        </div>
      ) : filtered.map(item => (
        isOwner
          ? <OwnerCard
              key={item.id}
              item={item}
              historyCount={(historyMap[item.id] || []).length}
              onClick={() => openDetail(item)}
            />
          : <StaffCard
              key={item.id}
              item={item}
              isNew={hasNewNotif(item.id)}
              onClick={() => openDetail(item)}
            />
      ))}

      {/* 직원 카테고리 필터 */}
      {!isOwner && items.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
          {/* 직원은 카테고리 필터만 제공 */}
        </div>
      )}

      {/* 모달들 */}
      {showWrite && (
        <WriteForm
          storeId={storeId}
          userName={userName}
          editItem={editItem}
          onSaved={async () => {
            setShowWrite(false)
            setEditItem(null)
            await loadData(storeId, userName, userRole)
          }}
          onClose={() => { setShowWrite(false); setEditItem(null) }}
        />
      )}

      {detailItem && !isOwner && (
        <StaffDetailModal
          item={detailItem}
          onClose={() => setDetailItem(null)}
          onEdit={(item) => {
            setDetailItem(null)
            setEditItem(item)
            setShowWrite(true)
          }}
          userName={userName}
        />
      )}

      {detailItem && isOwner && (
        <OwnerDetailModal
          item={detailItem}
          history={historyMap[detailItem.id] || []}
          onClose={() => setDetailItem(null)}
          onAnswered={handleAnswer}
          onDelete={handleDelete}
          ownerName={userName}
        />
      )}
    </div>
  )
}