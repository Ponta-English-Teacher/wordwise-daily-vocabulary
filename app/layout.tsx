import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Wordwise — A Word for Today',
  description: 'Calibrate, learn, and review the vocabulary of educated English.',
  openGraph: {
    title: 'Wordwise — A Word for Today',
    description: 'Calibrate, learn, and review the vocabulary of educated English.',
    images: [{ url: '/og.png', width: 1729, height: 910, alt: 'Wordwise — A Word for Today' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Wordwise — A Word for Today',
    description: 'Calibrate, learn, and review the vocabulary of educated English.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
