"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { isLocale, LOCALES, translate, type Locale } from "./i18n";

const STORAGE_KEY = "rollson-language";

type LanguageContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isLocale(stored)) {
      setLocaleState(stored);
      return;
    }
    const languages = navigator.languages?.length ? navigator.languages : [navigator.language];
    for (const language of languages) {
      const code = language.toLowerCase().split("-")[0];
      if (isLocale(code)) {
        setLocaleState(code);
        return;
      }
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = locale;
    root.dir = locale === "ar" ? "rtl" : "ltr";
    root.classList.toggle("language-rtl", locale === "ar");
    window.localStorage.setItem(STORAGE_KEY, locale);
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars),
    [locale]
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}

export function LanguageSwitcher() {
  const { locale, setLocale } = useLanguage();
  const current = LOCALES.find((item) => item.code === locale) ?? LOCALES[0];

  return (
    <details className="language-switcher">
      <summary className="language-switcher-trigger" aria-label="Choose language">
        <span aria-hidden="true">🌐</span>
        <strong>{current.short}</strong>
        <span className="language-chevron" aria-hidden="true">
          ▾
        </span>
      </summary>
      <div className="language-menu" role="menu">
        {LOCALES.map((item) => (
          <button
            key={item.code}
            type="button"
            className={locale === item.code ? "language-option active" : "language-option"}
            onClick={(event) => {
              setLocale(item.code);
              event.currentTarget.closest("details")?.removeAttribute("open");
            }}
          >
            <span className="language-flag" aria-hidden="true">
              {item.flag}
            </span>
            <span>{item.name}</span>
            {locale === item.code ? (
              <span className="language-check" aria-hidden="true">
                ✓
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </details>
  );
}
