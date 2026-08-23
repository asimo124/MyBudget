export const LOAN_COUNTDOWN_STORAGE_KEY = 'loanCountdownForm'
export const LOAN_SLOT_COUNT = 5
export const LOAN_SLOT_FIELDS = [
  'name',
  'remaining_balance',
  'adjust_disposable_per_paycheck1',
  'adjust_disposable_per_paycheck15',
  'min_to_principal',
  'minimum_payment_percent',
  'day_of_month',
]

export function emptyLoanSlot() {
  return {
    name: '',
    remaining_balance: null,
    adjust_disposable_per_paycheck1: null,
    adjust_disposable_per_paycheck15: null,
    min_to_principal: null,
    minimum_payment_percent: null,
    day_of_month: null,
  }
}

export function defaultLoanFormState() {
  const state = {
    disposable_per_paycheck1: null,
    disposable_per_paycheck15: null,
    already_spent_on_first_paycheck: null,
    already_spent_on_second_paycheck: null,
    starting_month: '',
    push_to_next_paycheck: false,
  }
  for (let n = 1; n <= LOAN_SLOT_COUNT; n++) {
    const slot = emptyLoanSlot()
    LOAN_SLOT_FIELDS.forEach((field) => {
      state[`loan${n}_${field}`] = slot[field]
    })
  }
  return state
}

export function loanSlotHasData(slot) {
  if (!slot) return false
  if (slot.name != null && String(slot.name).trim() !== '') return true
  const numberFields = [
    'remaining_balance',
    'adjust_disposable_per_paycheck1',
    'adjust_disposable_per_paycheck15',
    'min_to_principal',
    'minimum_payment_percent',
    'day_of_month',
  ]
  return numberFields.some((field) => {
    const v = slot[field]
    return v !== null && v !== undefined && v !== ''
  })
}

export function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100
}

export function startOfLocalDay(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function addDays(d, n) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return startOfLocalDay(x)
}

export function parseStartYm(startYm) {
  const parts = String(startYm).split('-')
  const y = parseInt(parts[0], 10)
  const m0 = parseInt(parts[1], 10) - 1
  if (!Number.isFinite(y) || !Number.isFinite(m0)) return null
  return { y, m0 }
}

export function listPaycheckDatesFromPlanStart(startYm, maxEvents) {
  const parsed = parseStartYm(startYm)
  if (!parsed) return []
  let yy = parsed.y
  let mm = parsed.m0
  const out = []
  while (out.length < maxEvents) {
    out.push(startOfLocalDay(new Date(yy, mm, 1)))
    if (out.length >= maxEvents) break
    out.push(startOfLocalDay(new Date(yy, mm, 15)))
    if (out.length >= maxEvents) break
    mm += 1
    if (mm > 11) {
      mm = 0
      yy += 1
    }
  }
  return out
}

export function formatPaycheckDateLabel(d) {
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export function applyMinPrincipalAccrualsInWindow(bals, loansCfg, lastExclusive, endInclusive) {
  let d = addDays(startOfLocalDay(lastExclusive), 1)
  const end = startOfLocalDay(endInclusive)
  while (d.getTime() <= end.getTime()) {
    const yy = d.getFullYear()
    const mm = d.getMonth()
    const dim = new Date(yy, mm + 1, 0).getDate()
    const dayDom = d.getDate()
    for (let loanN = 1; loanN <= 5; loanN++) {
      const bi = loanN - 1
      if (bals[bi] <= 0) continue
      const cfg = loansCfg[bi]
      const reqDom = cfg.dom
      if (!Number.isFinite(reqDom) || reqDom < 1 || reqDom > 31) continue
      const targetDom = Math.min(Math.floor(reqDom), dim)
      if (dayDom !== targetDom) continue
      const minP = cfg.minP
      if (!Number.isFinite(minP) || minP <= 0) continue
      const pay = roundMoney(Math.min(bals[bi], minP))
      bals[bi] = roundMoney(Math.max(0, bals[bi] - pay))
    }
    d = addDays(d, 1)
  }
}

export function appliedPrincipalThisPaycheck(balance, pool, minPrincipal) {
  const b = roundMoney(balance)
  const p = roundMoney(pool)
  const m = Number(minPrincipal)
  if (!Number.isFinite(m) || m <= 0) {
    return roundMoney(Math.min(b, p))
  }
  return roundMoney(Math.min(p, Math.max(Math.min(b, p), Math.min(m, b))))
}

/**
 * Apply spill dollars sequentially to loans 2–5. Mutates balances[0..3] = [loan2..loan5].
 */
export function cascadeSpillFromRoll(result, initialRoll, balances, had, fromLoan1Payoff, firstLoanIndex) {
  const start = firstLoanIndex == null ? 2 : firstLoanIndex
  let r = roundMoney(initialRoll)
  const payoffKeys = ['loan2PayoffLeftover', 'loan3PayoffLeftover', 'loan4PayoffLeftover', 'loan5PayoffLeftover']
  const afterKeys = ['loan3BalanceAfterLoan2Spill', 'loan4BalanceAfterLoan3Spill', 'loan5BalanceAfterLoan4Spill']
  for (let loanN = start; loanN <= 5; loanN++) {
    const i = loanN - 2
    if (balances[i] > 0 && r > 0) {
      const to = roundMoney(Math.min(balances[i], r))
      balances[i] = Math.max(0, roundMoney(balances[i] - to))
      r = roundMoney(r - to)
      if (fromLoan1Payoff && loanN === 2 && had[0]) {
        result.loan2BalanceAfterLoan1Spill = balances[0]
      }
    }
    if (balances[i] <= 0) {
      balances[i] = 0
      if (had[i]) {
        result[payoffKeys[i]] = r
      }
    }
  }
  for (let i = 0; i < 3; i++) {
    if (balances[i] <= 0 && had[i + 1]) {
      result[afterKeys[i]] = balances[i + 1]
    }
  }
}

export function formatMoney(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '0.00'
  return n.toFixed(2)
}

export function fifteenthRunningTotalsText(schedule, minimumPaymentPercent) {
  if (!Array.isArray(schedule) || !schedule.length) return ''
  const pct = Number(minimumPaymentPercent)
  const showMinPmt = Number.isFinite(pct) && pct > 0
  const rows = schedule
    .filter((row) => Number(row.day) === 15)
    .map((row) => {
      const n = Number(row.runningTotal)
      const amount = Number.isFinite(n) ? String(Math.round(n)) : '0'
      const datePrefix = row.dateShort || 'Day 15'
      const bal = Number.isFinite(n) ? n : 0
      const minPmt = showMinPmt ? String(Math.round(bal * (pct / 100))) : ''
      return { datePrefix, amount, minPmt }
    })
  if (!rows.length) return ''
  const dateWidth = Math.max(...rows.map((r) => r.datePrefix.length))
  const amountWidth = Math.max(...rows.map((r) => r.amount.length))
  const padEnd = (s, width) => s + ' '.repeat(Math.max(0, width - s.length))
  return rows
    .map((r) => {
      let line = `${padEnd(r.datePrefix, dateWidth)} | ${padEnd(r.amount, amountWidth)}`
      if (showMinPmt) line += ` | Min Pmt: ${r.minPmt}`
      return line
    })
    .join('\n')
}

export function loanFilled(name, bal) {
  const nName = name != null ? String(name).trim() : ''
  if (!nName || bal === null || bal === '') return false
  const n = Number(bal)
  return Number.isFinite(n) && n >= 0
}

export function startingMonthOptions() {
  const out = []
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  for (let i = 0; i < 13; i++) {
    const y = d.getFullYear()
    const m = d.getMonth()
    const value = `${y}-${String(m + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    out.push({ value, label })
    d.setMonth(d.getMonth() + 1)
  }
  return out
}

export function loadSavedFormInto(form) {
  try {
    const raw = localStorage.getItem(LOAN_COUNTDOWN_STORAGE_KEY)
    if (!raw) return
    const saved = JSON.parse(raw)
    if (!saved || typeof saved !== 'object') return

    if (
      saved.disposable_per_month != null &&
      saved.disposable_per_month !== '' &&
      (saved.disposable_per_paycheck1 == null || saved.disposable_per_paycheck1 === '') &&
      (saved.disposable_per_paycheck15 == null || saved.disposable_per_paycheck15 === '')
    ) {
      const v = Number(saved.disposable_per_month)
      if (Number.isFinite(v)) {
        saved.disposable_per_paycheck1 = v
        saved.disposable_per_paycheck15 = v
      }
    }

    for (let n = 1; n <= 5; n++) {
      const k1 = `loan${n}_adjust_disposable_per_paycheck1`
      const k15 = `loan${n}_adjust_disposable_per_paycheck15`
      if (saved[k1] != null && saved[k1] !== '') continue
      const legacyP = saved[`loan${n}_adjust_disposable_per_paycheck`]
      if (legacyP != null && legacyP !== '') {
        const pv = Number(legacyP)
        if (Number.isFinite(pv)) {
          saved[k1] = pv
          saved[k15] = pv
        }
        continue
      }
      const legacyM = saved[`loan${n}_adjust_disposable_per_month`]
      if (legacyM != null && legacyM !== '') {
        const mv = Number(legacyM) / 2
        if (Number.isFinite(mv)) {
          saved[k1] = mv
          saved[k15] = mv
        }
      }
    }

    const defaults = defaultLoanFormState()
    const numberKeys = new Set([
      'disposable_per_paycheck1',
      'disposable_per_paycheck15',
      'already_spent_on_first_paycheck',
      'already_spent_on_second_paycheck',
      'loan1_remaining_balance',
      'loan2_remaining_balance',
      'loan3_remaining_balance',
      'loan4_remaining_balance',
      'loan5_remaining_balance',
      'loan1_adjust_disposable_per_paycheck1',
      'loan1_adjust_disposable_per_paycheck15',
      'loan2_adjust_disposable_per_paycheck1',
      'loan2_adjust_disposable_per_paycheck15',
      'loan3_adjust_disposable_per_paycheck1',
      'loan3_adjust_disposable_per_paycheck15',
      'loan4_adjust_disposable_per_paycheck1',
      'loan4_adjust_disposable_per_paycheck15',
      'loan5_adjust_disposable_per_paycheck1',
      'loan5_adjust_disposable_per_paycheck15',
      'loan1_min_to_principal',
      'loan2_min_to_principal',
      'loan3_min_to_principal',
      'loan4_min_to_principal',
      'loan5_min_to_principal',
      'loan1_minimum_payment_percent',
      'loan2_minimum_payment_percent',
      'loan3_minimum_payment_percent',
      'loan4_minimum_payment_percent',
      'loan5_minimum_payment_percent',
      'loan1_day_of_month',
      'loan2_day_of_month',
      'loan3_day_of_month',
      'loan4_day_of_month',
      'loan5_day_of_month',
    ])

    Object.keys(defaults).forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(saved, key)) return
      const v = saved[key]
      if (numberKeys.has(key)) {
        if (v === null || v === undefined || v === '') {
          form[key] = null
        } else {
          const n = Number(v)
          form[key] = Number.isNaN(n) ? null : n
        }
      } else if (typeof defaults[key] === 'string') {
        form[key] = v == null ? '' : String(v)
      } else if (typeof defaults[key] === 'boolean') {
        form[key] = !!v
      } else {
        form[key] = v
      }
    })
  } catch (e) {
    console.warn('Could not load loan form from local storage', e)
  }
}
