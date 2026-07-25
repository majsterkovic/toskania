/**
 * Motyw jasny/ciemny — ustawiany PRZED pierwszym malowaniem, żeby nie było
 * mignięcia jasnego tła (FOUC). Każdy entry point woła to jako pierwszą rzecz.
 */
const STORAGE_KEY = 'theme';

export function applyStoredTheme() {
  const saved = localStorage.getItem(STORAGE_KEY);
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (saved === 'dark' || (!saved && prefersDark)) {
    document.documentElement.classList.add('dark');
  }
}

/** Przełącza motyw i zapamiętuje wybór. Zwraca `true`, jeśli włączono ciemny. */
export function toggleTheme() {
  const nowDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem(STORAGE_KEY, nowDark ? 'dark' : 'light');
  return nowDark;
}

export function isDark() {
  return document.documentElement.classList.contains('dark');
}
