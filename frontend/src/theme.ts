export type Theme = 'dark' | 'light'

export function getTheme(): Theme {
  try {
    const t = localStorage.getItem('theme')
    return t === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export function applyTheme(t: Theme): void {
  document.documentElement.classList.toggle('light', t === 'light')
}

export function setTheme(t: Theme): void {
  try { localStorage.setItem('theme', t) } catch { /* ignore */ }
  applyTheme(t)
}
