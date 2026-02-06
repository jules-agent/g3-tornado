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
// Default is LIGHT mode unless user explicitly chose dark or auto
const themeScript = `
  (function() {
    try {
      var stored = localStorage.getItem('g3-theme');
      var theme = stored || 'light';
      var isDark = false;
      
      if (theme === 'dark') {
        isDark = true;
      } else if (theme === 'auto') {
        // Auto: dark from 6pm to 6am
        var hour = new Date().getHours();
        isDark = hour < 6 || hour >= 18;
      }
      // 'light' = isDark stays false
      
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
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
