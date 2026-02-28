'use client'
import { useState } from 'react'

interface YearMonthPickerProps {
  year: number
  month: number // 0-based
  onChange: (year: number, month: number) => void
  color?: string
}

export default function YearMonthPicker({ year, month, onChange, color = '#6C5CE7' }: YearMonthPickerProps) {
  const [open, setOpen] = useState(false)
  const [pickYear, setPickYear] = useState(year)
  const nowYear = new Date().getFullYear()
  const years = Array.from({ length: 6 }, (_, i) => nowYear - 2 + i) // 2년 전 ~ 3년 후
  const months = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

  function handleSelect(y: number, m: number) {
    onChange(y, m)
    setOpen(false)
  }

  return (
    <>
      {/* 헤더 버튼 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          onClick={() => month === 0 ? onChange(year - 1, 11) : onChange(year, month - 1)}
          style={{ width: 36, height: 36, borderRadius: 10, background: '#F4F6F9', border: '1px solid #E8ECF0', fontSize: 18, color: '#888', cursor: 'pointer' }}>
          ‹
        </button>

        {/* 년/월 클릭하면 피커 오픈 */}
        <button onClick={() => { setPickYear(year); setOpen(true) }}
          style={{ fontSize: 17, fontWeight: 700, color: '#1a1a2e', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 12px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          {year}년 {month + 1}월
          <span style={{ fontSize: 10, color: '#bbb' }}>▼</span>
        </button>

        <button
          onClick={() => month === 11 ? onChange(year + 1, 0) : onChange(year, month + 1)}
          style={{ width: 36, height: 36, borderRadius: 10, background: '#F4F6F9', border: '1px solid #E8ECF0', fontSize: 18, color: '#888', cursor: 'pointer' }}>
          ›
        </button>
      </div>

      {/* 피커 모달 */}
      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 500, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={() => setOpen(false)}>
          <div style={{ background: '#fff', width: '100%', maxWidth: 480, borderRadius: '20px 20px 0 0', padding: 20, paddingBottom: 32 }}
            onClick={e => e.stopPropagation()}>

            {/* 년도 선택 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <button onClick={() => setPickYear(p => p - 1)}
                style={{ width: 36, height: 36, borderRadius: 10, background: '#F4F6F9', border: '1px solid #E8ECF0', fontSize: 18, color: '#888', cursor: 'pointer' }}>‹</button>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>{pickYear}년</span>
              <button onClick={() => setPickYear(p => p + 1)}
                style={{ width: 36, height: 36, borderRadius: 10, background: '#F4F6F9', border: '1px solid #E8ECF0', fontSize: 18, color: '#888', cursor: 'pointer' }}>›</button>
            </div>

            {/* 빠른 년도 선택 */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
              {years.map(y => (
                <button key={y} onClick={() => setPickYear(y)}
                  style={{ flex: 1, minWidth: 60, padding: '7px 0', borderRadius: 10,
                    border: pickYear === y ? `1.5px solid ${color}` : '1px solid #E8ECF0',
                    background: pickYear === y ? `${color}15` : '#F4F6F9',
                    color: pickYear === y ? color : '#888',
                    fontSize: 13, fontWeight: pickYear === y ? 700 : 400, cursor: 'pointer' }}>
                  {y}
                </button>
              ))}
            </div>

            {/* 월 선택 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {months.map((m, i) => {
                const isSelected = pickYear === year && i === month
                return (
                  <button key={i} onClick={() => handleSelect(pickYear, i)}
                    style={{ padding: '12px 0', borderRadius: 12,
                      border: isSelected ? `2px solid ${color}` : '1px solid #E8ECF0',
                      background: isSelected ? `${color}15` : '#F8F9FB',
                      color: isSelected ? color : '#555',
                      fontSize: 14, fontWeight: isSelected ? 700 : 400, cursor: 'pointer' }}>
                    {m}
                  </button>
                )
              })}
            </div>

            <button onClick={() => setOpen(false)}
              style={{ width: '100%', marginTop: 16, padding: '12px 0', borderRadius: 12, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#aaa', fontSize: 13, cursor: 'pointer' }}>
              닫기
            </button>
          </div>
        </div>
      )}
    </>
  )
}