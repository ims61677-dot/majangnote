import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '매장노트',
  description: '매장 관리 앱',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body style={{ margin: 0, padding: 0, background: '#F4F6F9' }}>
        {children}
      </body>
    </html>
  )
}
