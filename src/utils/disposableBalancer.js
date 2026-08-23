export const DISPOSABLE_BALANCER_STORAGE_KEY = 'disposableBalancerRows'

export function emptyRow() {
  return {
    payPeriod: '',
    disposable: 0,
    expenseAmount: 0,
    transferType: '',
    robPeter: 0,
  }
}

/** Next 10 pay periods (1st and 15th) starting from current half-month. */
export function buildPayPeriods(fromDate = new Date()) {
  const periods = []
  let month = fromDate.getMonth()
  let year = fromDate.getFullYear()
  let day = fromDate.getDate() < 15 ? 1 : 15

  for (let i = 0; i < 10; i++) {
    const mm = String(month + 1).padStart(2, '0')
    const dd = String(day).padStart(2, '0')
    periods.push(`${mm}/${dd}/${year}`)

    if (day === 1) {
      day = 15
    } else {
      day = 1
      month++
      if (month > 11) {
        month = 0
        year++
      }
    }
  }

  return periods
}

export function loadSavedRows() {
  try {
    const saved = localStorage.getItem(DISPOSABLE_BALANCER_STORAGE_KEY)
    if (!saved) return null
    const parsed = JSON.parse(saved)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function saveRows(rows) {
  localStorage.setItem(DISPOSABLE_BALANCER_STORAGE_KEY, JSON.stringify(rows))
}

/**
 * Rob Peter & Pay Paul: subtract robPeter from Peter rows' disposable,
 * add to expense; split total equally across Paul rows.
 * @returns {{ ok: true, rows: object[] } | { ok: false, error: string }}
 */
export function robPeterPayPaul(rows) {
  const next = rows.map((row) => ({ ...row }))
  let totalRobbed = 0

  next.forEach((row, index) => {
    if (row.transferType === 'Peter') {
      next[index].disposable = parseFloat(row.disposable) - parseFloat(row.robPeter)
      next[index].expenseAmount = parseFloat(row.expenseAmount) + parseFloat(row.robPeter)
      totalRobbed += parseFloat(row.robPeter) || 0
    }
  })

  const paulsCount = next.filter((row) => row.transferType === 'Paul').length
  if (paulsCount === 0) {
    return { ok: false, error: 'No Paul rows to transfer to!' }
  }

  const paulAlottment = totalRobbed / paulsCount

  next.forEach((row, index) => {
    if (row.transferType === 'Paul') {
      next[index].disposable = parseFloat(row.disposable) + paulAlottment
      next[index].expenseAmount = parseFloat(row.expenseAmount) - paulAlottment
    }
  })

  return { ok: true, rows: next }
}
