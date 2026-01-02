'use client';

import { ThemeProvider as NextThemesProvider, useTheme as useNextTheme } from 'next-themes';
import React, { createContext, useContext, useEffect, useState } from 'react';

type ThemeContextType = {
    isDark: boolean;
    toggleTheme: () => void;
};

// Re-exporting ThemeProvider but using next-themes inside
export function ThemeProvider({ children }: { children: React.ReactNode }) {
    return (
        <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
            {children}
        </NextThemesProvider>
    );
}

// Wrapper hook to maintain the existing API (isDark, toggleTheme)
// Used by components that might expect the old specific API
export function useTheme() {
    const { theme, setTheme, resolvedTheme } = useNextTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const isDark = mounted ? (theme === 'dark' || (theme === 'system' && resolvedTheme === 'dark')) : false;

    const toggleTheme = () => {
        if (theme === 'dark' || (theme === 'system' && resolvedTheme === 'dark')) {
            setTheme('light');
        } else {
            setTheme('dark');
        }
    };

    return {
        isDark,
        toggleTheme,
        // Expose original next-themes values if needed
        theme,
        setTheme,
        resolvedTheme
    };
}
