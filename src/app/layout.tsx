import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "G3-Tornado",
  description: "UP.FIT task management and follow-up cadence tracking.",
  icons: {
    icon: "/tornado.svg",
  },
};

// Script to apply theme before React hydrates (prevents flash)
// Default is AUTO mode - uses user's local time (dark 6pm-6am)
const themeScript = `
  (function() {
    try {
      var stored = localStorage.getItem('g3-theme');
      var theme = stored || 'auto';
      var isDark = false;
      
      if (theme === 'dark') {
        isDark = true;
      } else if (theme === 'light') {
        isDark = false;
      } else {
        // Auto: dark from 6pm to 6am based on user's local time
        var hour = new Date().getHours();
        isDark = hour < 6 || hour >= 18;
      }
      
      document.documentElement.classList.remove('dark');
      if (isDark) {
        document.documentElement.classList.add('dark');
      }
    } catch (e) {}
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
