import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'ONE LIGHT-DAY — Voyager Mission Explorer', description: 'A collective journey and message archive by the Astronomy & Space Physics Society, PEC.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en" suppressHydrationWarning><body>{children}</body></html>; }
