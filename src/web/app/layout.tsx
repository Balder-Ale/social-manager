import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import TenantSwitcher from "../components/TenantSwitcher";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Social Manager",
  description: "Multibrand Social Media Manager",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 24px',
            borderBottom: '1px solid #e5e7eb',
            background: '#f9fafb',
          }}
        >
          <nav style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            <a href="/" style={{ fontWeight: 700, fontSize: 18, color: '#111', textDecoration: 'none' }}>
              Social Manager
            </a>
            <a href="/brand-lab" style={{ color: '#374151', textDecoration: 'none', fontSize: 14 }}>
              Brand Lab
            </a>
            <a href="/post-wizard" style={{ color: '#374151', textDecoration: 'none', fontSize: 14 }}>
              New Post
            </a>
            <a href="/playbook" style={{ color: '#374151', textDecoration: 'none', fontSize: 14 }}>
              Growth Playbook
            </a>
            <a href="/settings" style={{ color: '#374151', textDecoration: 'none', fontSize: 14 }}>
              Settings
            </a>
          </nav>
          <TenantSwitcher />
        </header>
        <main style={{ flex: 1 }}>{children}</main>
      </body>
    </html>
  );
}