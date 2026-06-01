import { useEffect, useState } from 'react'

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem('theme') || ''
  })

  useEffect(() => {
    if (theme === 'day') {
      document.body.dataset.theme = 'day'
    } else {
      delete document.body.dataset.theme
    }
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme((t) => (t === 'day' ? '' : 'day'))

  return { theme, isDay: theme === 'day', toggleTheme }
}
