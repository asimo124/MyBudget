import api from '@/api/client'

let cached = null
let inflight = null

export function getCachedTestMode() {
  return cached === true
}

export async function fetchTestMode() {
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const { data } = await api.get('/api/settings/test_mode.php')
      cached = Number(data?.test_mode) === 1
      return cached
    } catch {
      cached = false
      return false
    } finally {
      inflight = null
    }
  })()
  return inflight
}

export async function saveTestMode(enabled) {
  const { data } = await api.post('/api/settings/test_mode.php', {
    test_mode: enabled ? 1 : 0,
  })
  cached = Number(data?.test_mode) === 1
  return {
    enabled: cached,
    message: data?.message || (cached ? 'Test mode is ON.' : 'Test mode is OFF.'),
  }
}

/** @deprecated localStorage helpers — kept for Budget Progress checkbox only */
export function isTestMode() {
  return getCachedTestMode()
}

export function setTestMode() {
  // no-op: use saveTestMode()
}
