import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api/client'

const TOKEN_KEY = 'mybudget_token'
const USER_KEY = 'mybudget_user'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem(TOKEN_KEY) || '')
  const user = ref(JSON.parse(localStorage.getItem(USER_KEY) || 'null'))
  const loading = ref(false)
  const error = ref('')

  const isAuthenticated = computed(() => Boolean(token.value))

  function persist(sessionToken, sessionUser) {
    token.value = sessionToken
    user.value = sessionUser
    localStorage.setItem(TOKEN_KEY, sessionToken)
    localStorage.setItem(USER_KEY, JSON.stringify(sessionUser))
  }

  function clear() {
    token.value = ''
    user.value = null
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  }

  async function login(username, password) {
    loading.value = true
    error.value = ''
    try {
      const { data } = await api.post('/api/auth/login.php', { username, password })
      if (!data?.token) {
        throw new Error(data?.message || 'Login failed')
      }
      persist(data.token, data.user)
      return true
    } catch (err) {
      clear()
      error.value =
        err.response?.data?.message || err.message || 'Invalid username or password'
      return false
    } finally {
      loading.value = false
    }
  }

  async function fetchMe() {
    if (!token.value) return false
    try {
      const { data } = await api.get('/api/auth/me.php')
      if (data?.user) {
        user.value = data.user
        localStorage.setItem(USER_KEY, JSON.stringify(data.user))
        return true
      }
      clear()
      return false
    } catch {
      clear()
      return false
    }
  }

  async function logout() {
    try {
      if (token.value) {
        await api.post('/api/auth/logout.php')
      }
    } catch {
      // ignore network errors on logout
    } finally {
      clear()
    }
  }

  return {
    token,
    user,
    loading,
    error,
    isAuthenticated,
    login,
    logout,
    fetchMe,
    clear,
  }
})
