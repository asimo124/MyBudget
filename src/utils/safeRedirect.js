/** Safe in-app path for post-login / deep-link redirects (blocks open redirects). */
export function safeRedirectPath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return ''
  }
  return value
}
