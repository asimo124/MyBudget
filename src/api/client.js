import axios from 'axios'
import { safeRedirectPath } from '@/utils/safeRedirect'

const baseURL = import.meta.env.VITE_API_BASE_URL || ''

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

function readToken() {
  try {
    return localStorage.getItem('mybudget_token')
  } catch {
    return null
  }
}

function clearStoredSession() {
  try {
    localStorage.removeItem('mybudget_token')
    localStorage.removeItem('mybudget_user')
  } catch {
    // iOS private browsing can throw
  }
}

api.interceptors.request.use((config) => {
  const token = readToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearStoredSession()
      if (window.location.pathname !== '/login') {
        const redirect = safeRedirectPath(
          `${window.location.pathname}${window.location.search}${window.location.hash}`
        )
        const params = new URLSearchParams()
        if (redirect) {
          params.set('redirect', redirect)
        }
        window.location.assign(`/login?${params.toString()}`)
      }
    }
    return Promise.reject(error)
  }
)

export default api
