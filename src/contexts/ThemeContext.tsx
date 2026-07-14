import { createContext, useContext, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { TRANSLATIONS, LANGUAGES } from '../i18n/translations';
import type { Translation, Language } from '../i18n/translations';

export type ThemeMode = 'dark' | 'light';

// ── UiPath Brand Colors ───────────────────────────────────────────────
// Primary: Robotic Orange var(--brand-primary) | Agentic Teal var(--brand-primary) | Deep Blue #182126
// Secondary: Dark Blue #1E6482 | Offset Orange #A32200 | Bright Blue #CCF2FF

export const DARK = {
  bgPrimary:       '#182126',                                                          // Deep Blue
  bgPage:          'linear-gradient(160deg,#0d1a20 0%,#182126 55%,#0d1a20 100%)',     // Deep Blue gradient
  bgCard:          'rgba(255,255,255,0.05)',
  bgCardStrong:    'rgba(255,255,255,0.08)',
  bgInput:         'rgba(255,255,255,0.05)',
  bgIconBox:       'rgba(var(--brand-primary-rgb),0.12)',                                             // Orange tint
  border:          'rgba(255,255,255,0.08)',
  borderStrong:    'rgba(255,255,255,0.14)',
  divider:         'rgba(255,255,255,0.07)',
  textPrimary:     '#ffffff',
  textBody:        'rgba(255,255,255,0.85)',
  textSecondary:   'rgba(var(--brand-primary-rgb),0.75)',                                            // Agentic Teal
  textMuted:       'rgba(255,255,255,0.35)',
  textLabel:       'rgba(var(--brand-primary-rgb),0.45)',                                            // Agentic Teal muted
  navBg:           'rgba(18,30,35,0.97)',                                              // Deep Blue dark
  navBorder:       'rgba(255,255,255,0.06)',
  navInactive:     'rgba(255,255,255,0.38)',
  navLabelActive:  'rgba(255,255,255,0.9)',
  navLabelInactive:'rgba(255,255,255,0.35)',
  aiBubbleBg:      'rgba(var(--brand-primary-rgb),0.08)',                                            // Teal tint for AI
  aiBubbleBorder:  'rgba(var(--brand-primary-rgb),0.18)',
  aiBubbleText:    'rgba(255,255,255,0.92)',
  dropdownBg:      'rgba(13,26,32,0.97)',
  backBtnBg:       'rgba(255,255,255,0.07)',
  backBtnIcon:     'rgba(255,255,255,0.7)',
  chevron:         'rgba(255,255,255,0.2)',
  headerName:      '#ffffff',
  headerChevron:   'rgba(255,255,255,0.4)',
  headerMenu:      'rgba(255,255,255,0.4)',
  headerBorder:    'rgba(255,255,255,0.06)',
  orbBlend:        'screen' as const,
};

export const LIGHT = {
  bgPrimary:       '#e8ebed',                                                          // Near white
  bgPage:          'linear-gradient(160deg,#ffffff 0%,#f0f0f0 55%,#ffffff 100%)',
  bgCard:          'rgba(255,255,255,0.88)',
  bgCardStrong:    '#ffffff',
  bgInput:         'rgba(0,0,0,0.04)',
  bgIconBox:       'rgba(var(--brand-primary-rgb),0.08)',                                             // Orange tint
  border:          'rgba(0,0,0,0.08)',
  borderStrong:    'rgba(0,0,0,0.12)',
  divider:         'rgba(0,0,0,0.06)',
  textPrimary:     '#182126',                                                          // Deep Blue
  textBody:        'rgba(24,33,38,0.85)',
  textSecondary:   'rgba(var(--brand-primary-rgb),0.8)',                                             // Agentic Teal
  textMuted:       'rgba(0,0,0,0.35)',
  textLabel:       'rgba(var(--brand-primary-rgb),0.5)',
  navBg:           'rgba(246,246,246,0.97)',
  navBorder:       'rgba(0,0,0,0.07)',
  navInactive:     'rgba(0,0,0,0.38)',
  navLabelActive:  'rgba(0,0,0,0.88)',
  navLabelInactive:'rgba(0,0,0,0.38)',
  aiBubbleBg:      'rgba(255,255,255,0.95)',
  aiBubbleBorder:  'rgba(0,0,0,0.08)',
  aiBubbleText:    '#182126',
  dropdownBg:      'rgba(255,255,255,0.98)',
  backBtnBg:       'rgba(0,0,0,0.07)',
  backBtnIcon:     'rgba(0,0,0,0.55)',
  chevron:         'rgba(0,0,0,0.2)',
  headerName:      '#182126',
  headerChevron:   'rgba(0,0,0,0.4)',
  headerMenu:      'rgba(0,0,0,0.4)',
  headerBorder:    'rgba(0,0,0,0.07)',
  orbBlend:        'multiply' as const,
};

export type ThemeColors = typeof DARK | typeof LIGHT;

interface ThemeContextValue {
  theme: ThemeMode;
  t: ThemeColors;
  toggleTheme: () => void;
  lang: string;
  setLang: (code: string) => void;
  tr: Translation;
  currentLanguage: Language;
  isRtl: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light', t: LIGHT, toggleTheme: () => {},
  lang: 'en', setLang: () => {}, tr: TRANSLATIONS.en,
  currentLanguage: LANGUAGES[0], isRtl: false,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeMode>(
    () => (localStorage.getItem('aura_theme') as ThemeMode) || 'light'
  );
  const [lang, setLangState] = useState<string>(
    () => localStorage.getItem('aura_lang') || 'en'
  );

  const toggleTheme = () =>
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('aura_theme', next);
      return next;
    });

  const setLang = (code: string) => {
    localStorage.setItem('aura_lang', code);
    setLangState(code);
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (Capacitor.isNativePlatform()) {
      const bg = theme === 'light' ? '#e8ebed' : '#182126';
      StatusBar.setBackgroundColor({ color: bg }).catch(() => {});
      StatusBar.setStyle({ style: theme === 'light' ? Style.Dark : Style.Light }).catch(() => {});
    }
  }, [theme]);

  const tr = TRANSLATIONS[lang] ?? TRANSLATIONS.en;
  const currentLanguage = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];
  const isRtl = currentLanguage.rtl;

  return (
    <ThemeContext.Provider value={{ theme, t: theme === 'dark' ? DARK : LIGHT, toggleTheme, lang, setLang, tr, currentLanguage, isRtl }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export { LANGUAGES };
