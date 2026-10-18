import '../styles/globals.css';
import { Inter, Noto_Sans_Devanagari } from 'next/font/google';
import { AppWrapper } from '../components/layout/AppWrapper';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const notoDevanagari = Noto_Sans_Devanagari({
  subsets: ['devanagari'],
  weight: ['400', '600', '700'],
  variable: '--font-noto-devanagari',
  display: 'swap',
});

export const metadata = {
  title: 'WorkPulse | Direct Micro-contracting & Escrow for Blue-collar Workers',
  description:
    'Guaranteed escrow payments, proof-of-work attendance, and voice job matching for daily-wage workers in India.',
  manifest: '/manifest.json',
};

export const viewport = {
  themeColor: '#1e3a8a',
};

export default function RootLayout({ children }) {
  return (
    <html lang="hi" className={`${inter.variable} ${notoDevanagari.variable}`}>
      <head>
        <meta name="application-name" content="WorkPulse" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="WorkPulse" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="icon" href="/icons/icon.svg" type="image/svg+xml" />
      </head>
      <body className="bg-slate-950 text-slate-100 min-h-screen antialiased flex flex-col">
        <AppWrapper>{children}</AppWrapper>
      </body>
    </html>
  );
}
