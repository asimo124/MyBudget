/** Cron time helpers for push notification schedules (minute hour * * *). */

export function pad2(n) {
  return String(n).padStart(2, '0')
}

export function parseCronLines(text) {
  const rows = []
  const lines = String(text || '').split(/\r\n|\r|\n/)
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    const parts = line.split(/\s+/)
    if (parts.length >= 2) {
      rows.push({
        minute: Number(parts[0]) || 0,
        hour: Number(parts[1]) || 0,
      })
    }
  }
  return rows
}

export function cronLinesFromRows(rows) {
  return rows
    .map((r) => `${Number(r.minute) || 0} ${Number(r.hour) || 0} * * *`)
    .join('\n')
}

export function defaultCronRows() {
  return [{ minute: 0, hour: 8 }]
}

export function toDatetimeLocalValue(value) {
  if (!value) return ''
  const d = new Date(String(value).replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) {
    const s = String(value)
    return s.length >= 16 ? s.slice(0, 16) : s
  }
  const y = d.getFullYear()
  const m = pad2(d.getMonth() + 1)
  const day = pad2(d.getDate())
  const h = pad2(d.getHours())
  const min = pad2(d.getMinutes())
  const sec = pad2(d.getSeconds())
  return `${y}-${m}-${day}T${h}:${min}:${sec}`
}

export function nowDatetimeLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

export function dateOnly(value) {
  if (!value) return ''
  return String(value).slice(0, 10)
}
