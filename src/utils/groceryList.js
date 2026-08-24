export const GROCERY_LIST_STORAGE_KEY = 'groceryListItems'

export function createGroceryItem(text = '') {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    text: String(text).trim(),
  }
}

export function loadGroceryItems() {
  try {
    const raw = localStorage.getItem(GROCERY_LIST_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item) => {
        if (typeof item === 'string') {
          return createGroceryItem(item)
        }
        if (item && typeof item === 'object') {
          const text = item.text != null ? String(item.text) : ''
          const id =
            item.id != null && String(item.id).trim() !== ''
              ? String(item.id)
              : createGroceryItem().id
          return { id, text }
        }
        return null
      })
      .filter((item) => item && item.text !== '')
  } catch {
    return []
  }
}

export function saveGroceryItems(items) {
  try {
    const clean = (items || [])
      .map((item) => ({
        id: String(item.id),
        text: String(item.text || '').trim(),
      }))
      .filter((item) => item.text !== '')
    localStorage.setItem(GROCERY_LIST_STORAGE_KEY, JSON.stringify(clean))
    return true
  } catch {
    return false
  }
}

export function clearGroceryItems() {
  try {
    localStorage.removeItem(GROCERY_LIST_STORAGE_KEY)
  } catch {
    // ignore
  }
}

export function groceryItemsToPlainText(items) {
  return (items || [])
    .map((item) => String(item.text || '').trim())
    .filter(Boolean)
    .join('\n')
}

/** One non-empty line → one item (same format as export / Apple Notes). */
export function groceryItemsFromPlainText(raw) {
  const lines = String(raw || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  return lines.map((text) => createGroceryItem(text))
}

