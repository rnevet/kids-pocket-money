import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../locales/en.json';
import he from '../locales/he.json';

/** Adding a language: add a JSON file and one entry here. */
export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'he', label: 'עברית' },
] as const;
export type LanguageCode = (typeof LANGUAGES)[number]['code'];
export type LanguagePref = 'system' | LanguageCode;

const STORAGE_KEY = 'pm.lang';
const FALLBACK: LanguageCode = 'en';

export function getLanguagePref(): LanguagePref {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v && LANGUAGES.some((l) => l.code === v) ? (v as LanguageCode) : 'system';
  } catch {
    return 'system';
  }
}

export function detectLanguage(candidates: readonly string[] = navigator.languages): LanguageCode {
  for (const c of candidates) {
    const base = c.toLowerCase().split('-')[0];
    const hit = LANGUAGES.find((l) => l.code === base);
    if (hit) return hit.code;
  }
  return FALLBACK;
}

export function resolveLanguage(pref: LanguagePref = getLanguagePref()): LanguageCode {
  return pref === 'system' ? detectLanguage() : pref;
}

function applyDocumentLanguage(lang: string) {
  document.documentElement.lang = lang;
  document.documentElement.dir = i18next.dir(lang);
}

export async function setLanguagePref(pref: LanguagePref): Promise<void> {
  try {
    if (pref === 'system') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    /* ignore */
  }
  await i18next.changeLanguage(resolveLanguage(pref));
}

export async function initI18n(): Promise<typeof i18next> {
  await i18next.use(initReactI18next).init({
    resources: { en: { translation: en }, he: { translation: he } },
    lng: resolveLanguage(),
    fallbackLng: FALLBACK,
    supportedLngs: LANGUAGES.map((l) => l.code),
    interpolation: { escapeValue: false },
  });
  applyDocumentLanguage(i18next.language);
  i18next.on('languageChanged', applyDocumentLanguage);
  // Follow OS language changes while the preference is "system".
  window.addEventListener('languagechange', () => {
    if (getLanguagePref() === 'system') void i18next.changeLanguage(detectLanguage());
  });
  return i18next;
}

export default i18next;
