import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { PwaRegister } from './pwa-register'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'HtoGestão',
  description: 'Sistema de Gestão Agrícola',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'HtoGestão',
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  themeColor: '#14532d',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" translate="no" suppressHydrationWarning>
      <head>
        <meta name="google" content="notranslate" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="HtoGestão" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className={`${inter.className} notranslate`} suppressHydrationWarning>
        <PwaRegister />
        {children}
      </body>
    </html>
  )
}
