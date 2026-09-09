import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Wordwise — A Word for Today',
  description: 'Advanced, useful English vocabulary—one carefully chosen word at a time.',
  openGraph: {
    title: 'Wordwise — A Word for Today',
    description: 'Advanced, useful English vocabulary—one carefully chosen word at a time.',
    images: [{ url: '/og.png', width: 1729, height: 910, alt: 'Wordwise — A Word for Today' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Wordwise — A Word for Today',
    description: 'Advanced, useful English vocabulary—one carefully chosen word at a time.',
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
