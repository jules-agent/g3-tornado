'use client';

import { useEffect } from 'react';
import Script from 'next/script';
import { initializeWebMCP } from '@/lib/webmcp';

export function WebMCPProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Initialize WebMCP once the script is loaded
    if (typeof window !== 'undefined' && window.WebMCP) {
      try {
        const mcp = initializeWebMCP();
        window.tornadoMCP = mcp;
      } catch (error) {
        console.error('[G3 Tornado] Failed to initialize WebMCP:', error);
      }
    }
  }, []);

  return (
    <>
      <Script
        src="/webmcp.js"
        strategy="afterInteractive"
        onLoad={() => {
          console.log('[WebMCP] Script loaded');
          try {
            const mcp = initializeWebMCP();
            window.tornadoMCP = mcp;
          } catch (error) {
            console.error('[G3 Tornado] Failed to initialize WebMCP:', error);
          }
        }}
      />
      {children}
    </>
  );
}
