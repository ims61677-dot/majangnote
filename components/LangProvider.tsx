'use client'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { toEnglish } from '@/lib/i18n'

const LANG_KEY = 'mj_lang'
// 영어 전환 버튼을 보여줄 화면
const TOGGLE_PATHS = ['/login', '/select-store', '/attendance', '/schedule']

type Rec = { orig: string; out: string }

export default function LangProvider() {
  const pathname = usePathname()
  const [lang, setLang] = useState<'ko' | 'en'>('ko')
  const langRef = useRef<'ko' | 'en'>('ko')
  const textRecs = useRef(new WeakMap<Text, Rec>())
  const attrRecs = useRef(new WeakMap<Element, Record<string, Rec>>())

  useEffect(() => {
    try { const v = localStorage.getItem(LANG_KEY); if (v === 'en') setLang('en') } catch {}
  }, [])

  useEffect(() => {
    langRef.current = lang
    document.documentElement.lang = lang === 'en' ? 'en' : 'ko'
    try { localStorage.setItem(LANG_KEY, lang) } catch {}

    const origAlert = window.alert.bind(window)
    const origConfirm = window.confirm.bind(window)
    ;(window as any).__mjOrigAlert ||= origAlert
    ;(window as any).__mjOrigConfirm ||= origConfirm
    const baseAlert = (window as any).__mjOrigAlert as typeof window.alert
    const baseConfirm = (window as any).__mjOrigConfirm as typeof window.confirm
    window.alert = (msg?: any) => baseAlert(lang === 'en' ? toEnglish(String(msg ?? '')) : msg)
    window.confirm = (msg?: string) => baseConfirm(lang === 'en' ? toEnglish(String(msg ?? '')) : msg)

    const recs = textRecs.current
    const origOf = (n: Text) => {
      const r = recs.get(n)
      return r && n.data === r.out ? r.orig : n.data
    }
    const setText = (n: Text, orig: string, out: string) => {
      recs.set(n, { orig, out })
      if (n.data !== out) n.data = out
    }

    function processElement(el: Element) {
      const tag = el.tagName
      if (tag === 'SCRIPT' || tag === 'STYLE') return
      const kids = Array.from(el.childNodes)
      const texts = kids.filter(k => k.nodeType === 3) as Text[]
      if (texts.length) {
        const onlyText = kids.length === texts.length
        if (onlyText && texts.length >= 2) {
          // {숫자}월 {숫자}일 처럼 조각난 문구는 합쳐서 번역
          const origs = texts.map(origOf)
          const combined = origs.join('')
          const out = lang === 'en' ? toEnglish(combined) : combined
          if (lang === 'en' && out !== combined) {
            texts.forEach((t, i) => setText(t, origs[i], i === 0 ? out : ''))
            return
          }
          texts.forEach((t, i) => setText(t, origs[i], origs[i]))
          // 합쳐서 번역이 안 되면 조각별로 시도
          if (lang === 'en') texts.forEach((t, i) => { const o = toEnglish(origs[i]); if (o !== origs[i]) setText(t, origs[i], o) })
          return
        }
        for (const t of texts) {
          const o = origOf(t)
          const out = lang === 'en' ? toEnglish(o) : o
          setText(t, o, out)
        }
      }
      // placeholder / title / alt
      for (const a of ['placeholder', 'title', 'alt', 'aria-label']) {
        if (!el.hasAttribute(a)) continue
        const store = attrRecs.current.get(el) || {}
        const cur = el.getAttribute(a) || ''
        const rec = store[a]
        const o = rec && cur === rec.out ? rec.orig : cur
        const out = lang === 'en' ? toEnglish(o) : o
        store[a] = { orig: o, out }
        attrRecs.current.set(el, store)
        if (cur !== out) el.setAttribute(a, out)
      }
    }

    function processTree(root: Node) {
      if (root.nodeType === 3) { if (root.parentElement) processElement(root.parentElement); return }
      if (root.nodeType !== 1) return
      const el = root as Element
      processElement(el)
      el.querySelectorAll('*').forEach(processElement)
    }

    let queued = false
    const pending = new Set<Node>()
    const flush = () => {
      queued = false
      const items = Array.from(pending); pending.clear()
      obs.disconnect()
      items.forEach(n => { if (document.body.contains(n)) processTree(n) })
      obs.observe(document.body, OBS_OPTS)
    }
    const OBS_OPTS: MutationObserverInit = { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'title', 'alt', 'aria-label'] }
    const obs = new MutationObserver(muts => {
      for (const m of muts) {
        if (m.type === 'characterData') pending.add(m.target.parentElement || m.target)
        else if (m.type === 'attributes') pending.add(m.target)
        else m.addedNodes.forEach(n => pending.add(n)), pending.add(m.target)
      }
      if (!queued) { queued = true; requestAnimationFrame(flush) }
    })

    processTree(document.body)
    obs.observe(document.body, OBS_OPTS)
    return () => { obs.disconnect() }
  }, [lang, pathname])

  if (!TOGGLE_PATHS.some(p => pathname === p || pathname?.startsWith(p + '/'))) return null
  return (
    <button
      onClick={() => setLang(l => (l === 'en' ? 'ko' : 'en'))}
      aria-label="language"
      title=""
      style={{
        position: 'fixed', bottom: 78, right: 10, zIndex: 2000,
        padding: '5px 10px', borderRadius: 14, border: '1px solid #E0E4E8',
        background: 'rgba(255,255,255,0.92)', color: '#555', fontSize: 11, fontWeight: 700,
        cursor: 'pointer', boxShadow: '0 1px 6px rgba(0,0,0,0.1)',
      }}>
      🌐 {lang === 'en' ? 'English' : '한국어'}
    </button>
  )
}
