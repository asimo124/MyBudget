import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api/client'

const TOKEN_KEY = 'mybudget_token'
const USER_KEY = 'mybudget_user'

function readStorage(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

function removeStorage(key) {
  try {
    localStorage.removeItem(key)
  } catch {
    // iOS private browsing can throw
  }
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref(readStorage(TOKEN_KEY) || '')
  const user = ref(JSON.parse(readStorage(USER_KEY) || 'null'))
  const loading = ref(false)
  const error = ref('')

  const isAuthenticated = computed(() => Boolean(token.value))

  function persist(sessionToken, sessionUser) {
    token.value = sessionToken
    user.value = sessionUser
    writeStorage(TOKEN_KEY, sessionToken)
    writeStorage(USER_KEY, JSON.stringify(sessionUser))
  }

  function clear() {
    token.value = ''
    user.value = null
    removeStorage(TOKEN_KEY)
    removeStorage(USER_KEY)
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
        writeStorage(USER_KEY, JSON.stringify(data.user))
        return true
      }
      clear()
      return false
    } catch (err) {
      if (err.response?.status === 401) {
        clear()
      }
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
