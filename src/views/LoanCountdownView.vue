<script setup>
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import {
  LOAN_COUNTDOWN_STORAGE_KEY,
  LOAN_SLOT_COUNT,
  LOAN_SLOT_FIELDS,
  addDays,
  applyMinPrincipalAccrualsInWindow,
  appliedPrincipalThisPaycheck,
  cascadeSpillFromRoll,
  defaultLoanFormState,
  emptyLoanSlot,
  fifteenthRunningTotalsText,
  formatMoney,
  formatPaycheckDateLabel,
  listPaycheckDatesFromPlanStart,
  loadSavedFormInto,
  loanFilled,
  loanSlotHasData,
  parseStartYm,
  roundMoney,
  startOfLocalDay,
  startingMonthOptions,
} from '@/utils/loanCountdown'

const form = reactive(defaultLoanFormState())
const monthOptions = startingMonthOptions()

const loan1Schedule = ref([])
const loan2Schedule = ref([])
const loan3Schedule = ref([])
const loan4Schedule = ref([])
const loan5Schedule = ref([])
const countdownValidationError = ref('')
const loanArrayError = ref('')
const loan1PayoffLeftover = ref(null)
const loan2PayoffLeftover = ref(null)
const loan2BalanceAfterLoan1Spill = ref(null)
const loan3PayoffLeftover = ref(null)
const loan3BalanceAfterLoan2Spill = ref(null)
const loan4PayoffLeftover = ref(null)
const loan4BalanceAfterLoan3Spill = ref(null)
const loan5PayoffLeftover = ref(null)
const loan5BalanceAfterLoan4Spill = ref(null)

const loanFieldDefs = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'remaining_balance', label: 'Remaining balance', type: 'number', step: '0.01', min: '0' },
  { key: 'adjust_disposable_per_paycheck1', label: 'Adjust disposable (1st paycheck)', type: 'number', step: 'any' },
  { key: 'adjust_disposable_per_paycheck15', label: 'Adjust disposable (15th paycheck)', type: 'number', step: 'any' },
  { key: 'min_to_principal', label: 'Min to principal', type: 'number', step: '0.01', min: '0' },
  { key: 'minimum_payment_percent', label: 'Minimum Payment Percent', type: 'number', step: 'any', min: '0' },
  { key: 'day_of_month', label: 'Day of month', type: 'number', step: '1', min: '1', max: '31' },
]

const canShiftLoan = computed(() => {
  for (let n = 1; n <= LOAN_SLOT_COUNT; n++) {
    if (loanSlotHasData(getLoanSlot(n))) return true
  }
  return false
})

const loan1_filled = computed(() => loanFilled(form.loan1_name, form.loan1_remaining_balance))
const loan2_filled = computed(() => loanFilled(form.loan2_name, form.loan2_remaining_balance))
const loan3_filled = computed(() => loanFilled(form.loan3_name, form.loan3_remaining_balance))
const loan4_filled = computed(() => loanFilled(form.loan4_name, form.loan4_remaining_balance))
const loan5_filled = computed(() => loanFilled(form.loan5_name, form.loan5_remaining_balance))

function loanDisplayName(n) {
  const name = form[`loan${n}_name`]
  if (name && String(name).trim()) return String(name).trim()
  return `Loan #${n}`
}

function getLoanSlot(n) {
  const slot = emptyLoanSlot()
  LOAN_SLOT_FIELDS.forEach((field) => {
    slot[field] = form[`loan${n}_${field}`]
  })
  return slot
}

function setLoanSlot(n, slot) {
  const src = slot || emptyLoanSlot()
  LOAN_SLOT_FIELDS.forEach((field) => {
    form[`loan${n}_${field}`] = Object.prototype.hasOwnProperty.call(src, field)
      ? src[field]
      : emptyLoanSlot()[field]
  })
}

function getLoanSlots() {
  const slots = []
  for (let n = 1; n <= LOAN_SLOT_COUNT; n++) {
    slots.push(getLoanSlot(n))
  }
  return slots
}

function setLoanSlots(slots) {
  for (let n = 1; n <= LOAN_SLOT_COUNT; n++) {
    setLoanSlot(n, slots[n - 1] || emptyLoanSlot())
  }
}

function persistLoanForm() {
  loanArrayError.value = ''
  const payload = {
    disposable_per_paycheck1: form.disposable_per_paycheck1,
    disposable_per_paycheck15: form.disposable_per_paycheck15,
    already_spent_on_first_paycheck: form.already_spent_on_first_paycheck,
    already_spent_on_second_paycheck: form.already_spent_on_second_paycheck,
    starting_month: form.starting_month,
    push_to_next_paycheck: form.push_to_next_paycheck,
  }
  getLoanSlots().forEach((slot, i) => {
    const n = i + 1
    LOAN_SLOT_FIELDS.forEach((field) => {
      payload[`loan${n}_${field}`] = slot[field]
    })
  })
  try {
    localStorage.setItem(LOAN_COUNTDOWN_STORAGE_KEY, JSON.stringify(payload))
  } catch (e) {
    console.warn('Could not save loan form to local storage', e)
  }
}

function unshiftLoan() {
  loanArrayError.value = ''
  const slots = getLoanSlots()
  if (loanSlotHasData(slots[LOAN_SLOT_COUNT - 1])) {
    loanArrayError.value =
      'Cannot unshift: all 5 loan slots are in use. Clear Loan #5 first (there is no Loan #6).'
    return
  }
  slots.pop()
  slots.unshift(emptyLoanSlot())
  setLoanSlots(slots)
  persistLoanForm()
  calculateLoanCountdown()
}

function shiftLoan() {
  loanArrayError.value = ''
  const slots = getLoanSlots()
  if (!slots.some(loanSlotHasData)) {
    loanArrayError.value = 'Nothing to shift: all loan slots are already empty.'
    return
  }
  slots.shift()
  slots.push(emptyLoanSlot())
  setLoanSlots(slots)
  persistLoanForm()
  calculateLoanCountdown()
}

function resetResultState() {
  loan1Schedule.value = []
  loan2Schedule.value = []
  loan3Schedule.value = []
  loan4Schedule.value = []
  loan5Schedule.value = []
  loan1PayoffLeftover.value = null
  loan2PayoffLeftover.value = null
  loan2BalanceAfterLoan1Spill.value = null
  loan3PayoffLeftover.value = null
  loan3BalanceAfterLoan2Spill.value = null
  loan4PayoffLeftover.value = null
  loan4BalanceAfterLoan3Spill.value = null
  loan5PayoffLeftover.value = null
  loan5BalanceAfterLoan4Spill.value = null
}

function clearLoanFormData() {
  try {
    localStorage.removeItem(LOAN_COUNTDOWN_STORAGE_KEY)
  } catch (e) {
    console.warn('Could not clear loan form storage', e)
  }
  const d = defaultLoanFormState()
  Object.keys(d).forEach((key) => {
    form[key] = d[key]
  })
  countdownValidationError.value = ''
  loanArrayError.value = ''
  resetResultState()
}

function calculateLoanCountdown() {
  countdownValidationError.value = ''
  resetResultState()

  const base1 = Number(form.disposable_per_paycheck1)
  const base15 = Number(form.disposable_per_paycheck15)
  if (!form.starting_month) {
    countdownValidationError.value = 'Please select a starting month.'
    return
  }
  if (!Number.isFinite(base1) || base1 <= 0 || !Number.isFinite(base15) || base15 <= 0) {
    countdownValidationError.value =
      'Please enter disposable for both the 1st and 15th paychecks (each must be greater than zero).'
    return
  }
  if (!loan1_filled.value) {
    countdownValidationError.value = 'Please enter Loan #1 name and remaining balance.'
    return
  }

  let loan1Bal = roundMoney(form.loan1_remaining_balance)
  let loan2Bal = 0
  if (loan2_filled.value) {
    loan2Bal = roundMoney(form.loan2_remaining_balance)
  } else if (form.loan2_remaining_balance != null && form.loan2_remaining_balance !== '') {
    const b = roundMoney(form.loan2_remaining_balance)
    if (Number.isFinite(b) && b >= 0) loan2Bal = b
  }
  const hadLoan2StartingBalance = loan2Bal > 0

  let loan3Bal = 0
  if (loan3_filled.value) {
    loan3Bal = roundMoney(form.loan3_remaining_balance)
  } else if (form.loan3_remaining_balance != null && form.loan3_remaining_balance !== '') {
    const b3 = roundMoney(form.loan3_remaining_balance)
    if (Number.isFinite(b3) && b3 >= 0) loan3Bal = b3
  }
  const hadLoan3StartingBalance = loan3Bal > 0

  let loan4Bal = 0
  if (loan4_filled.value) {
    loan4Bal = roundMoney(form.loan4_remaining_balance)
  } else if (form.loan4_remaining_balance != null && form.loan4_remaining_balance !== '') {
    const b4 = roundMoney(form.loan4_remaining_balance)
    if (Number.isFinite(b4) && b4 >= 0) loan4Bal = b4
  }
  const hadLoan4StartingBalance = loan4Bal > 0

  let loan5Bal = 0
  if (loan5_filled.value) {
    loan5Bal = roundMoney(form.loan5_remaining_balance)
  } else if (form.loan5_remaining_balance != null && form.loan5_remaining_balance !== '') {
    const b5 = roundMoney(form.loan5_remaining_balance)
    if (Number.isFinite(b5) && b5 >= 0) loan5Bal = b5
  }
  const hadLoan5StartingBalance = loan5Bal > 0

  const hadChain = [
    hadLoan2StartingBalance,
    hadLoan3StartingBalance,
    hadLoan4StartingBalance,
    hadLoan5StartingBalance,
  ]

  const bals = [loan1Bal, loan2Bal, loan3Bal, loan4Bal, loan5Bal]
  const loansCfg = []
  for (let n = 1; n <= 5; n++) {
    loansCfg.push({
      dom: Number(form[`loan${n}_day_of_month`]),
      minP: Number(form[`loan${n}_min_to_principal`]),
    })
  }

  const todayStart = startOfLocalDay(new Date())
  const planParsed = parseStartYm(form.starting_month)
  if (!planParsed) {
    countdownValidationError.value = 'Please select a valid starting month.'
    return
  }
  const planStart = startOfLocalDay(new Date(planParsed.y, planParsed.m0, 1))
  const filterMinMs = Math.max(planStart.getTime(), todayStart.getTime())

  const allPc = listPaycheckDatesFromPlanStart(form.starting_month, 3200)
  let pcDates = allPc.filter((dt) => startOfLocalDay(dt).getTime() >= filterMinMs)
  if (form.push_to_next_paycheck && pcDates.length > 0) {
    pcDates = pcDates.slice(1)
  }
  if (pcDates.length === 0) {
    countdownValidationError.value =
      'No paycheck dates on or after today for the selected starting month.'
    return
  }

  let lastMinExclusive = addDays(todayStart, -1)

  const getAdjustAdd = (loanN, isFirst) => {
    const a1 = Number(form[`loan${loanN}_adjust_disposable_per_paycheck1`])
    const a15 = Number(form[`loan${loanN}_adjust_disposable_per_paycheck15`])
    const v1 = Number.isFinite(a1) ? a1 : 0
    const v15 = Number.isFinite(a15) ? a15 : 0
    return isFirst ? v1 : v15
  }

  const result = {
    loan2BalanceAfterLoan1Spill: null,
    loan2PayoffLeftover: null,
    loan3PayoffLeftover: null,
    loan3BalanceAfterLoan2Spill: null,
    loan4PayoffLeftover: null,
    loan4BalanceAfterLoan3Spill: null,
    loan5PayoffLeftover: null,
    loan5BalanceAfterLoan4Spill: null,
  }

  const schedules = [[], [], [], [], []]
  const maxPaychecks = 1200

  for (let pi = 0; pi < maxPaychecks; pi++) {
    const pcDate = pcDates[pi]
    if (!pcDate) break
    if (!bals.some((b) => b > 0)) break

    let activeN = 0
    for (let j = 0; j < 5; j++) {
      if (bals[j] > 0) {
        activeN = j + 1
        break
      }
    }
    if (!activeN) break

    applyMinPrincipalAccrualsInWindow(bals, loansCfg, lastMinExclusive, pcDate)
    lastMinExclusive = startOfLocalDay(pcDate)

    const isFirst = pcDate.getDate() === 1
    const basePool = isFirst ? base1 : base15
    const adjAdd = getAdjustAdd(activeN, isFirst)
    let pool = roundMoney(basePool + adjAdd)

    // "Already spent" is relative to the next upcoming paychecks before push.
    // With push on, the first paycheck is skipped, so the 2nd-spent amount
    // applies to the new first row (former 2nd paycheck).
    if (form.push_to_next_paycheck) {
      if (pi === 0) {
        const alreadySpent2 = Number(form.already_spent_on_second_paycheck)
        if (Number.isFinite(alreadySpent2) && alreadySpent2 > 0) {
          pool = roundMoney(Math.max(0, pool - alreadySpent2))
        }
      }
    } else if (pi === 0) {
      const alreadySpent = Number(form.already_spent_on_first_paycheck)
      if (Number.isFinite(alreadySpent) && alreadySpent > 0) {
        pool = roundMoney(Math.max(0, pool - alreadySpent))
      }
    } else if (pi === 1) {
      const alreadySpent2 = Number(form.already_spent_on_second_paycheck)
      if (Number.isFinite(alreadySpent2) && alreadySpent2 > 0) {
        pool = roundMoney(Math.max(0, pool - alreadySpent2))
      }
    }

    const dateLabel = formatPaycheckDateLabel(pcDate)
    const day = pcDate.getDate()
    const dateShort = pcDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const bi = activeN - 1
    const applied = appliedPrincipalThisPaycheck(
      bals[bi],
      pool,
      form[`loan${activeN}_min_to_principal`]
    )
    bals[bi] = roundMoney(bals[bi] - applied)
    schedules[bi].push({
      dateLabel,
      day,
      dateShort,
      disposableApplied: applied,
      runningTotal: bals[bi],
    })

    if (bals[bi] <= 0) {
      bals[bi] = 0
      const spill = roundMoney(pool - applied)
      if (activeN === 1) {
        loan1PayoffLeftover.value = spill
        const balances = [bals[1], bals[2], bals[3], bals[4]]
        cascadeSpillFromRoll(result, spill, balances, hadChain, true, 2)
        bals[1] = balances[0]
        bals[2] = balances[1]
        bals[3] = balances[2]
        bals[4] = balances[3]
      } else if (activeN === 2) {
        result.loan2PayoffLeftover = spill
        const balances = [bals[1], bals[2], bals[3], bals[4]]
        cascadeSpillFromRoll(result, spill, balances, hadChain, false, 3)
        bals[1] = balances[0]
        bals[2] = balances[1]
        bals[3] = balances[2]
        bals[4] = balances[3]
      } else if (activeN === 3) {
        result.loan3PayoffLeftover = spill
        const balances = [bals[1], bals[2], bals[3], bals[4]]
        cascadeSpillFromRoll(result, spill, balances, hadChain, false, 4)
        bals[1] = balances[0]
        bals[2] = balances[1]
        bals[3] = balances[2]
        bals[4] = balances[3]
      } else if (activeN === 4) {
        result.loan4PayoffLeftover = spill
        const balances = [bals[1], bals[2], bals[3], bals[4]]
        cascadeSpillFromRoll(result, spill, balances, hadChain, false, 5)
        bals[1] = balances[0]
        bals[2] = balances[1]
        bals[3] = balances[2]
        bals[4] = balances[3]
      } else if (activeN === 5) {
        result.loan5PayoffLeftover = spill
      }
    }
  }

  loan1Schedule.value = schedules[0]
  loan2Schedule.value = schedules[1]
  loan3Schedule.value = schedules[2]
  loan4Schedule.value = schedules[3]
  loan5Schedule.value = schedules[4]
  loan2PayoffLeftover.value = result.loan2PayoffLeftover
  loan2BalanceAfterLoan1Spill.value = result.loan2BalanceAfterLoan1Spill
  loan3PayoffLeftover.value = result.loan3PayoffLeftover
  loan3BalanceAfterLoan2Spill.value = result.loan3BalanceAfterLoan2Spill
  loan4PayoffLeftover.value = result.loan4PayoffLeftover
  loan4BalanceAfterLoan3Spill.value = result.loan4BalanceAfterLoan3Spill
  loan5PayoffLeftover.value = result.loan5PayoffLeftover
  loan5BalanceAfterLoan4Spill.value = result.loan5BalanceAfterLoan4Spill

  if (bals.some((b) => b > 0)) {
    countdownValidationError.value =
      'Schedule stopped after 1200 paychecks (or ran out of dated paychecks); check your amounts.'
    loan1PayoffLeftover.value = null
    loan2PayoffLeftover.value = null
    loan2BalanceAfterLoan1Spill.value = null
    loan3PayoffLeftover.value = null
    loan3BalanceAfterLoan2Spill.value = null
    loan4PayoffLeftover.value = null
    loan4BalanceAfterLoan3Spill.value = null
    loan5PayoffLeftover.value = null
    loan5BalanceAfterLoan4Spill.value = null
  }
}

onMounted(() => {
  loadSavedFormInto(form)
  calculateLoanCountdown()
})

const hasResults = computed(
  () =>
    Boolean(countdownValidationError.value) ||
    (loan1_filled.value && loan1Schedule.value.length > 0) ||
    loan2Schedule.value.length > 0 ||
    loan3Schedule.value.length > 0 ||
    loan4Schedule.value.length > 0 ||
    loan5Schedule.value.length > 0
)

function scrollToResults() {
  const el = document.getElementById('loan-countdown-results')
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

function scrollToTop() {
  const el = document.getElementById('loan-countdown-top')
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  } else {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

async function runCalculateAndScroll() {
  calculateLoanCountdown()
  await nextTick()
  scrollToResults()
}
</script>

<template>
  <div id="loan-countdown-top" class="space-y-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Loan Countdown</h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Snowball payoff schedule — saved in your browser (localStorage).
        </p>
      </div>
      <div class="flex flex-wrap gap-2 sm:justify-end">
        <button
          type="button"
          class="btn bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200"
          @click="clearLoanFormData"
        >
          Clear Data
        </button>
        <button
          type="button"
          class="btn bg-primary-500 text-white hover:bg-primary-600"
          @click="runCalculateAndScroll"
        >
          Calculate Loan Countdown
        </button>
      </div>
    </div>

    <div class="card">
      <div class="card-body space-y-4">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">
              Disposable per paycheck on the 1st of the month
            </label>
            <input
              v-model.number="form.disposable_per_paycheck1"
              type="number"
              step="any"
              class="form-input w-full"
              @blur="persistLoanForm"
            />
          </div>
          <div>
            <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">
              Disposable per paycheck on the 15th of the month
            </label>
            <input
              v-model.number="form.disposable_per_paycheck15"
              type="number"
              step="any"
              class="form-input w-full"
              @blur="persistLoanForm"
            />
          </div>
          <div>
            <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">
              Already spent on first paycheck (1st / next upcoming)
            </label>
            <input
              v-model.number="form.already_spent_on_first_paycheck"
              type="number"
              step="0.01"
              min="0"
              class="form-input w-full"
              @blur="persistLoanForm"
            />
          </div>
          <div>
            <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">
              Already spent on 2nd paycheck (15th / after next)
            </label>
            <input
              v-model.number="form.already_spent_on_second_paycheck"
              type="number"
              step="0.01"
              min="0"
              class="form-input w-full"
              @blur="persistLoanForm"
            />
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              With “Push to next paycheck” checked, this amount is deducted from the first paycheck shown.
            </p>
          </div>
          <div>
            <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">Starting month</label>
            <select
              v-model="form.starting_month"
              class="form-input w-full"
              @change="persistLoanForm"
              @blur="persistLoanForm"
            >
              <option value="">— Select —</option>
              <option v-for="opt in monthOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>
          <div class="flex items-center gap-2 pt-6">
            <input
              id="push_to_next_paycheck"
              v-model="form.push_to_next_paycheck"
              type="checkbox"
              class="rounded"
              @change="persistLoanForm"
            />
            <label for="push_to_next_paycheck" class="text-sm text-gray-700 dark:text-gray-300">
              Push to next paycheck
            </label>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="loanArrayError"
      class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
    >
      {{ loanArrayError }}
    </div>

    <div v-for="n in LOAN_SLOT_COUNT" :key="'loan-form-' + n" class="card">
      <div class="card-body space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-3 dark:border-gray-700">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Loan #{{ n }}</h2>
          <div v-if="n === 1" class="flex flex-wrap gap-2">
            <button
              type="button"
              class="btn bg-gray-200 text-sm text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200"
              title="Insert a blank loan at #1 and push the others down"
              @click="unshiftLoan"
            >
              Insert New First Loan
            </button>
            <button
              type="button"
              class="btn bg-gray-200 text-sm text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200"
              :disabled="!canShiftLoan"
              title="Remove loan #1 and move the others up"
              @click="shiftLoan"
            >
              Remove First Loan
            </button>
          </div>
        </div>
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div v-for="field in loanFieldDefs" :key="n + '-' + field.key">
            <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">{{ field.label }}</label>
            <input
              v-if="field.type === 'text'"
              v-model="form[`loan${n}_${field.key}`]"
              type="text"
              class="form-input w-full"
              @blur="persistLoanForm"
            />
            <input
              v-else
              v-model.number="form[`loan${n}_${field.key}`]"
              type="number"
              :step="field.step"
              :min="field.min"
              :max="field.max"
              class="form-input w-full"
              @blur="persistLoanForm"
            />
          </div>
        </div>
      </div>
    </div>

    <div class="flex flex-wrap justify-end gap-2">
      <button
        type="button"
        class="btn bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200"
        @click="clearLoanFormData"
      >
        Clear Data
      </button>
      <button
        type="button"
        class="btn bg-primary-500 text-white hover:bg-primary-600"
        @click="runCalculateAndScroll"
      >
        Calculate Loan Countdown
      </button>
    </div>

    <div
      id="loan-countdown-results"
      class="scroll-mt-4 space-y-6"
    >
      <div
        v-if="countdownValidationError"
        class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
      >
        {{ countdownValidationError }}
      </div>

      <div v-if="hasResults" class="flex justify-end">
        <button
          type="button"
          class="btn bg-gray-200 text-sm text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200"
          @click="scrollToTop"
        >
          Back to Top
        </button>
      </div>

    <!-- Loan 1 results -->
    <div v-if="loan1_filled && loan1Schedule.length" class="card">
      <div class="card-body space-y-4">
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">{{ form.loan1_name }}</h2>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Date</th>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Disposable per paycheck</th>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Running total</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <tr v-for="(row, idx) in loan1Schedule" :key="'l1-' + idx">
                <td class="px-3 py-2 text-sm">{{ row.dateLabel }}</td>
                <td class="px-3 py-2 text-sm">${{ formatMoney(row.disposableApplied) }}</td>
                <td class="px-3 py-2 text-sm">${{ formatMoney(row.runningTotal) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <pre
          v-if="fifteenthRunningTotalsText(loan1Schedule, form.loan1_minimum_payment_percent)"
          class="overflow-x-auto rounded bg-gray-50 p-3 text-xs dark:bg-gray-900"
        >{{ fifteenthRunningTotalsText(loan1Schedule, form.loan1_minimum_payment_percent) }}</pre>
        <p v-if="loan1PayoffLeftover !== null" class="text-base">
          Money left over from paying {{ form.loan1_name }}:
          <strong>${{ formatMoney(loan1PayoffLeftover) }}</strong>
        </p>
        <p v-if="loan2BalanceAfterLoan1Spill != null" class="text-base">
          New balance for {{ loanDisplayName(2) }}:
          <strong>${{ formatMoney(loan2BalanceAfterLoan1Spill) }}</strong>
        </p>
        <p
          v-if="loan3BalanceAfterLoan2Spill != null && loan3BalanceAfterLoan2Spill > 0 && !loan2Schedule.length"
          class="text-base"
        >
          New balance for {{ loanDisplayName(3) }} (after Loan #2 spill from Loan #1):
          <strong>${{ formatMoney(loan3BalanceAfterLoan2Spill) }}</strong>
        </p>
        <p
          v-if="loan3PayoffLeftover != null && loan3PayoffLeftover > 0 && !loan2Schedule.length && !loan3Schedule.length"
          class="text-base"
        >
          Money left over after spill to {{ loanDisplayName(3) }}:
          <strong>${{ formatMoney(loan3PayoffLeftover) }}</strong>
        </p>
        <p
          v-if="loan4BalanceAfterLoan3Spill != null && loan4BalanceAfterLoan3Spill > 0 && !loan2Schedule.length && !loan3Schedule.length"
          class="text-base"
        >
          New balance for {{ loanDisplayName(4) }} (after upstream spill):
          <strong>${{ formatMoney(loan4BalanceAfterLoan3Spill) }}</strong>
        </p>
        <p
          v-if="loan4PayoffLeftover != null && loan4PayoffLeftover > 0 && !loan2Schedule.length && !loan3Schedule.length && !loan4Schedule.length"
          class="text-base"
        >
          Money left over after spill to {{ loanDisplayName(4) }}:
          <strong>${{ formatMoney(loan4PayoffLeftover) }}</strong>
        </p>
        <p
          v-if="loan5BalanceAfterLoan4Spill != null && loan5BalanceAfterLoan4Spill > 0 && !loan2Schedule.length && !loan3Schedule.length && !loan4Schedule.length"
          class="text-base"
        >
          New balance for {{ loanDisplayName(5) }} (after upstream spill):
          <strong>${{ formatMoney(loan5BalanceAfterLoan4Spill) }}</strong>
        </p>
        <p
          v-if="loan5PayoffLeftover != null && loan5PayoffLeftover > 0 && !loan2Schedule.length && !loan3Schedule.length && !loan4Schedule.length && !loan5Schedule.length"
          class="text-base"
        >
          Money left over after spill to {{ loanDisplayName(5) }}:
          <strong>${{ formatMoney(loan5PayoffLeftover) }}</strong>
        </p>
      </div>
    </div>

    <!-- Loan 2 results -->
    <div v-if="loan2Schedule.length" class="card">
      <div class="card-body space-y-4">
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">{{ loanDisplayName(2) }}</h2>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Date</th>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Disposable per paycheck</th>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Running total</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <tr v-for="(row, idx) in loan2Schedule" :key="'l2-' + idx">
                <td class="px-3 py-2 text-sm">{{ row.dateLabel }}</td>
                <td class="px-3 py-2 text-sm">${{ formatMoney(row.disposableApplied) }}</td>
                <td class="px-3 py-2 text-sm">${{ formatMoney(row.runningTotal) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <pre
          v-if="fifteenthRunningTotalsText(loan2Schedule, form.loan2_minimum_payment_percent)"
          class="overflow-x-auto rounded bg-gray-50 p-3 text-xs dark:bg-gray-900"
        >{{ fifteenthRunningTotalsText(loan2Schedule, form.loan2_minimum_payment_percent) }}</pre>
        <p v-if="loan2PayoffLeftover !== null" class="text-base">
          Money left over from paying {{ loanDisplayName(2) }}:
          <strong>${{ formatMoney(loan2PayoffLeftover) }}</strong>
        </p>
        <p
          v-if="loan3BalanceAfterLoan2Spill != null && loan3BalanceAfterLoan2Spill > 0 && loan2Schedule.length"
          class="text-base"
        >
          New balance for {{ loanDisplayName(3) }}:
          <strong>${{ formatMoney(loan3BalanceAfterLoan2Spill) }}</strong>
        </p>
        <p
          v-if="loan3PayoffLeftover != null && loan3PayoffLeftover > 0 && loan2Schedule.length && !loan3Schedule.length"
          class="text-base"
        >
          Money left over after spill to {{ loanDisplayName(3) }}:
          <strong>${{ formatMoney(loan3PayoffLeftover) }}</strong>
        </p>
        <p
          v-if="loan4BalanceAfterLoan3Spill != null && loan4BalanceAfterLoan3Spill > 0 && loan2Schedule.length && !loan3Schedule.length"
          class="text-base"
        >
          New balance for {{ loanDisplayName(4) }} (after upstream spill):
          <strong>${{ formatMoney(loan4BalanceAfterLoan3Spill) }}</strong>
        </p>
        <p
          v-if="loan4PayoffLeftover != null && loan4PayoffLeftover > 0 && loan2Schedule.length && !loan3Schedule.length && !loan4Schedule.length"
          class="text-base"
        >
          Money left over after spill to {{ loanDisplayName(4) }}:
          <strong>${{ formatMoney(loan4PayoffLeftover) }}</strong>
        </p>
        <p
          v-if="loan5BalanceAfterLoan4Spill != null && loan5BalanceAfterLoan4Spill > 0 && loan2Schedule.length && !loan3Schedule.length && !loan4Schedule.length"
          class="text-base"
        >
          New balance for {{ loanDisplayName(5) }} (after upstream spill):
          <strong>${{ formatMoney(loan5BalanceAfterLoan4Spill) }}</strong>
        </p>
        <p
          v-if="loan5PayoffLeftover != null && loan5PayoffLeftover > 0 && loan2Schedule.length && !loan3Schedule.length && !loan4Schedule.length && !loan5Schedule.length"
          class="text-base"
        >
          Money left over after spill to {{ loanDisplayName(5) }}:
          <strong>${{ formatMoney(loan5PayoffLeftover) }}</strong>
        </p>
      </div>
    </div>

    <!-- Loan 3 results -->
    <div v-if="loan3Schedule.length" class="card">
      <div class="card-body space-y-4">
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">{{ loanDisplayName(3) }}</h2>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Date</th>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Disposable per paycheck</th>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Running total</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <tr v-for="(row, idx) in loan3Schedule" :key="'l3-' + idx">
                <td class="px-3 py-2 text-sm">{{ row.dateLabel }}</td>
                <td class="px-3 py-2 text-sm">${{ formatMoney(row.disposableApplied) }}</td>
                <td class="px-3 py-2 text-sm">${{ formatMoney(row.runningTotal) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <pre
          v-if="fifteenthRunningTotalsText(loan3Schedule, form.loan3_minimum_payment_percent)"
          class="overflow-x-auto rounded bg-gray-50 p-3 text-xs dark:bg-gray-900"
        >{{ fifteenthRunningTotalsText(loan3Schedule, form.loan3_minimum_payment_percent) }}</pre>
        <p v-if="loan3PayoffLeftover !== null" class="text-base">
          Money left over from paying {{ loanDisplayName(3) }}:
          <strong>${{ formatMoney(loan3PayoffLeftover) }}</strong>
        </p>
        <p
          v-if="loan4BalanceAfterLoan3Spill != null && loan4BalanceAfterLoan3Spill > 0 && loan3Schedule.length"
          class="text-base"
        >
          New balance for {{ loanDisplayName(4) }}:
          <strong>${{ formatMoney(loan4BalanceAfterLoan3Spill) }}</strong>
        </p>
        <p
          v-if="loan4PayoffLeftover != null && loan4PayoffLeftover > 0 && loan3Schedule.length && !loan4Schedule.length"
          class="text-base"
        >
          Money left over after spill to {{ loanDisplayName(4) }}:
          <strong>${{ formatMoney(loan4PayoffLeftover) }}</strong>
        </p>
        <p
          v-if="loan5BalanceAfterLoan4Spill != null && loan5BalanceAfterLoan4Spill > 0 && loan3Schedule.length && !loan4Schedule.length"
          class="text-base"
        >
          New balance for {{ loanDisplayName(5) }} (after upstream spill):
          <strong>${{ formatMoney(loan5BalanceAfterLoan4Spill) }}</strong>
        </p>
        <p
          v-if="loan5PayoffLeftover != null && loan5PayoffLeftover > 0 && loan3Schedule.length && !loan4Schedule.length && !loan5Schedule.length"
          class="text-base"
        >
          Money left over after spill to {{ loanDisplayName(5) }}:
          <strong>${{ formatMoney(loan5PayoffLeftover) }}</strong>
        </p>
      </div>
    </div>

    <!-- Loan 4 results -->
    <div v-if="loan4Schedule.length" class="card">
      <div class="card-body space-y-4">
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">{{ loanDisplayName(4) }}</h2>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Date</th>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Disposable per paycheck</th>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Running total</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <tr v-for="(row, idx) in loan4Schedule" :key="'l4-' + idx">
                <td class="px-3 py-2 text-sm">{{ row.dateLabel }}</td>
                <td class="px-3 py-2 text-sm">${{ formatMoney(row.disposableApplied) }}</td>
                <td class="px-3 py-2 text-sm">${{ formatMoney(row.runningTotal) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <pre
          v-if="fifteenthRunningTotalsText(loan4Schedule, form.loan4_minimum_payment_percent)"
          class="overflow-x-auto rounded bg-gray-50 p-3 text-xs dark:bg-gray-900"
        >{{ fifteenthRunningTotalsText(loan4Schedule, form.loan4_minimum_payment_percent) }}</pre>
        <p v-if="loan4PayoffLeftover !== null" class="text-base">
          Money left over from paying {{ loanDisplayName(4) }}:
          <strong>${{ formatMoney(loan4PayoffLeftover) }}</strong>
        </p>
        <p
          v-if="loan5BalanceAfterLoan4Spill != null && loan5BalanceAfterLoan4Spill > 0 && loan4Schedule.length"
          class="text-base"
        >
          New balance for {{ loanDisplayName(5) }}:
          <strong>${{ formatMoney(loan5BalanceAfterLoan4Spill) }}</strong>
        </p>
        <p
          v-if="loan5PayoffLeftover != null && loan5PayoffLeftover > 0 && loan4Schedule.length && !loan5Schedule.length"
          class="text-base"
        >
          Money left over after spill to {{ loanDisplayName(5) }}:
          <strong>${{ formatMoney(loan5PayoffLeftover) }}</strong>
        </p>
      </div>
    </div>

    <!-- Loan 5 results -->
    <div v-if="loan5Schedule.length" class="card">
      <div class="card-body space-y-4">
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">{{ loanDisplayName(5) }}</h2>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Date</th>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Disposable per paycheck</th>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Running total</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <tr v-for="(row, idx) in loan5Schedule" :key="'l5-' + idx">
                <td class="px-3 py-2 text-sm">{{ row.dateLabel }}</td>
                <td class="px-3 py-2 text-sm">${{ formatMoney(row.disposableApplied) }}</td>
                <td class="px-3 py-2 text-sm">${{ formatMoney(row.runningTotal) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <pre
          v-if="fifteenthRunningTotalsText(loan5Schedule, form.loan5_minimum_payment_percent)"
          class="overflow-x-auto rounded bg-gray-50 p-3 text-xs dark:bg-gray-900"
        >{{ fifteenthRunningTotalsText(loan5Schedule, form.loan5_minimum_payment_percent) }}</pre>
        <p v-if="loan5PayoffLeftover !== null" class="text-base">
          Money left over from paying {{ loanDisplayName(5) }}:
          <strong>${{ formatMoney(loan5PayoffLeftover) }}</strong>
        </p>
      </div>
    </div>

      <div v-if="hasResults" class="flex justify-end pb-2">
        <button
          type="button"
          class="btn bg-gray-200 text-sm text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200"
          @click="scrollToTop"
        >
          Back to Top
        </button>
      </div>
    </div>
  </div>
</template>
