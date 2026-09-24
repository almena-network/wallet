import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { catalogues, defaultLocale, resolveLocale, type Dictionary } from "./locales";

type I18nValue = {
  /** The active locale, a BCP 47 tag, as the system asked for it. */
  locale: string;
  /** The active catalogue, always complete: missing keys fall back to English. */
  t: Dictionary;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale] = useState<string>(() => resolveLocale());

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<I18nValue>(
    () => ({ locale, t: catalogues[locale] ?? catalogues[defaultLocale] }),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error("useI18n was called outside of I18nProvider");
  }
  return value;
}

/** Shorthand for the common case of only needing the catalogue. */
export function useTranslations(): Dictionary {
  return useI18n().t;
}
