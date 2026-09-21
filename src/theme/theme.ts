export type ThemePref = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'pm.theme';
const COLORS: Record<ResolvedTheme, string> = { light: '#faf6ee', dark: '#1a1712' };
const media = () => window.matchMedia('(prefers-color-scheme: dark)');

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function resolveTheme(pref: ThemePref = getThemePref()): ResolvedTheme {
  if (pref !== 'system') return pref;
  return media().matches ? 'dark' : 'light';
}

function apply(theme: ResolvedTheme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COLORS[theme]);
}

export function setThemePref(pref: ThemePref) {
  try {
    if (pref === 'system') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    /* ignore */
  }
  apply(resolveTheme(pref));
}

/** Apply the stored preference and follow OS changes while set to "system". */
export function initTheme() {
  apply(resolveTheme());
  media().addEventListener('change', () => {
    if (getThemePref() === 'system') apply(resolveTheme('system'));
  });
}
