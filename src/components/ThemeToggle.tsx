'use client';

import { useState, useEffect } from 'react';

type Theme = 'light' | 'dark' | 'auto';

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('auto');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem('g3-theme') as Theme | null;
    if (stored) {
      setTheme(stored);
      applyTheme(stored);
    } else {
      applyTheme('auto');
    }
    
    // Listen for system preference changes (when OS switches to dark mode)
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      const currentTheme = localStorage.getItem('g3-theme') as Theme | null;
      if (!currentTheme || currentTheme === 'auto') {
        applyTheme('auto');
      }
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const applyTheme = (newTheme: Theme) => {
    const root = document.documentElement;
    
    if (newTheme === 'auto') {
      // Follow system preference (respects OS dark mode / sunset settings)
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
    } else {
      root.classList.toggle('dark', newTheme === 'dark');
    }
  };

  const handleChange = (newTheme: Theme) => {
    setTheme(newTheme);
    localStorage.setItem('g3-theme', newTheme);
    applyTheme(newTheme);
  };

  if (!mounted) return null;

  // Get current effective theme for display
  const effectiveTheme = theme === 'auto' 
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme;

  return (
    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
      <button
        onClick={() => handleChange('light')}
        className={`p-1.5 rounded-md transition-all ${
          theme === 'light'
            ? 'bg-white dark:bg-slate-700 shadow-sm text-amber-500'
            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
        }`}
        title="Light mode"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      </button>
      <button
        onClick={() => handleChange('dark')}
        className={`p-1.5 rounded-md transition-all ${
          theme === 'dark'
            ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-500'
            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
        }`}
        title="Dark mode"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      </button>
      <button
        onClick={() => handleChange('auto')}
        className={`p-1.5 rounded-md transition-all ${
          theme === 'auto'
            ? 'bg-white dark:bg-slate-700 shadow-sm text-cyan-500'
            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
        }`}
        title={`Auto (follows system - currently ${effectiveTheme})`}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </button>
    </div>
  );
}
