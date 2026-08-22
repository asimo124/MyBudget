import { ref, onMounted } from 'vue'

const STORAGE_KEY = 'color-theme'

export function useTheme() {
  const isDark = ref(false)

  function apply(dark) {
    isDark.value = dark
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light')
  }

  function toggle() {
    apply(!isDark.value)
  }

  function init() {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'dark') {
      apply(true)
    } else if (stored === 'light') {
      apply(false)
    } else {
      apply(window.matchMedia('(prefers-color-scheme: dark)').matches)
    }
  }

  onMounted(init)

  return { isDark, toggle, init, apply }
}
