import type { Metadata } from 'next'
export const metadata: Metadata = { title: '매장노트', description: '매장 관리 시스템' }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body style={{margin:0, fontFamily:'sans-serif', background:'#1a1a2e', color:'white'}}>
        {children}
      </body>
    </html>
  )
}
