<script setup>
import { computed, onMounted, ref } from 'vue'
import api from '@/api/client'

const defaultBalanceFirst = 6584
const defaultBalanceFifteenth = 3584

const daysCount = ref(0)
const sumItems = ref([])
const spaItems = ref([])
const dateItems = ref([])
const testMode = ref(false)
const nextDate = ref(0)
const prevDate = ref(0)
const spaAmount = 57.5
const initBalance = ref(0)
const initBalanceFirst = ref(defaultBalanceFirst)
const initBalanceFifteenth = ref(defaultBalanceFifteenth)
const extraSum = ref(0)
const disposablePerDay = ref(11)
const remove15Days = ref(false)
const payDate = ref(new Date())
const payDateFormatted = ref('')
const determinedDisposable = ref(0)
const titleDate = ref('')
const dateValue = ref('')
const day40 = ref('')
const balance = ref(0)
const sumTotal = ref(0)
const sumSpa = ref(0)
const averages = ref([])
const showDisposableUpdated = ref(false)
const deductLabel1 = ref('Test1')
const deductValue1 = ref(0)
const deductLabel2 = ref('Test2')
const deductValue2 = ref(0)
const loading = ref(false)
const mainError = ref('')

const latestPaycheckAvg = computed(() => {
  for (let i = averages.value.length - 1; i >= 0; i--) {
    if (averages.value[i] != null && averages.value[i] !== '') {
      return parseFloat(averages.value[i])
    }
  }
  return null
})

const monthlyDisposable = computed(() => {
  if (latestPaycheckAvg.value == null || Number.isNaN(latestPaycheckAvg.value)) return null
  return Math.round(latestPaycheckAvg.value * 2 * 100) / 100
})

const monthlyDisposableAfter = computed(() => {
  if (monthlyDisposable.value == null) return null
  const v1 = parseFloat(deductValue1.value) || 0
  const v2 = parseFloat(deductValue2.value) || 0
  return Math.round((monthlyDisposable.value - v1 - v2) * 100) / 100
})

const monthlyDisposableDisplay = computed(() =>
  monthlyDisposable.value == null ? '—' : monthlyDisposable.value
)
const monthlyDisposableAfterDisplay = computed(() =>
  monthlyDisposableAfter.value == null ? '—' : monthlyDisposableAfter.value
)

function saveTestMode() {
  localStorage.setItem('testMode', testMode.value ? '1' : '0')
}
function saveRemove15Days() {
  localStorage.setItem('remove15Days', remove15Days.value ? '1' : '0')
  getExpenseDays()
}
function saveDeductLabel1() {
  localStorage.setItem('deductLabel1', deductLabel1.value == null ? '' : String(deductLabel1.value))
}
function saveDeductLabel2() {
  localStorage.setItem('deductLabel2', deductLabel2.value == null ? '' : String(deductLabel2.value))
}
function saveDeductValue1() {
  const value = parseFloat(deductValue1.value)
  deductValue1.value = Number.isNaN(value) ? 0 : value
  localStorage.setItem('deductValue1', String(deductValue1.value))
}
function saveDeductValue2() {
  const value = parseFloat(deductValue2.value)
  deductValue2.value = Number.isNaN(value) ? 0 : value
  localStorage.setItem('deductValue2', String(deductValue2.value))
}

function initializeBalance() {
  const date2 = parseInt(payDate.value.getDate(), 10)
  if (date2 >= 15) {
    initBalance.value = parseFloat(initBalanceFirst.value) || defaultBalanceFirst
  } else {
    initBalance.value = parseFloat(initBalanceFifteenth.value) || defaultBalanceFifteenth
  }
}

function updatePayDateFormatted() {
  const date2 = parseInt(payDate.value.getDate(), 10)
  const formatted = new Date(payDate.value.getFullYear(), payDate.value.getMonth(), date2)
  if (date2 < 15) {
    formatted.setDate(1)
  } else {
    formatted.setDate(15)
  }
  payDateFormatted.value = formatted.toISOString().split('T')[0]
}

function saveInitBalanceFirst() {
  const value = parseFloat(initBalanceFirst.value)
  if (Number.isNaN(value)) return
  initBalanceFirst.value = value
  localStorage.setItem('initBalanceFirst', String(value))
  initializeBalance()
  if (parseInt(payDate.value.getDate(), 10) >= 15) {
    getExpenseDays()
  }
}

function saveInitBalanceFifteenth() {
  const value = parseFloat(initBalanceFifteenth.value)
  if (Number.isNaN(value)) return
  initBalanceFifteenth.value = value
  localStorage.setItem('initBalanceFifteenth', String(value))
  initializeBalance()
  if (parseInt(payDate.value.getDate(), 10) < 15) {
    getExpenseDays()
  }
}

function loadPage(action) {
  nextDate.value = 0
  prevDate.value = 0
  if (action === 'next') {
    nextDate.value = 1
  } else if (action === 'prev') {
    prevDate.value = 1
  }

  titleDate.value = payDate.value.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  dateValue.value = `${payDate.value.getMonth() + 1}/${payDate.value.getDate()}`
  initializeBalance()
  getExpenseDays()
}

function checkBalance() {
  loadPage('')
}

function addSumItem() {
  const amount = parseFloat(day40.value) || 0
  sumItems.value.push(amount)
  dateItems.value.push(dateValue.value)
  spaItems.value.push(0)
  calcFinalSums()
}

function removeSumItem(index) {
  sumItems.value.splice(index, 1)
  dateItems.value.splice(index, 1)
  spaItems.value.splice(index, 1)
  calcFinalSums()
}

function updateDisposablePerDay() {
  localStorage.setItem('disposable_per_day', String(disposablePerDay.value))
  getExpenseDays()
}

function saveSpa(index) {
  spaItems.value[index] = spaAmount
  sumItems.value[index] -= spaAmount
  calcFinalSums()
}

function removeSpaItem(index) {
  sumItems.value[index] += spaAmount
  spaItems.value[index] = 0
  calcFinalSums()
}

function calcFinalSums() {
  let sumAmount = 0
  sumItems.value.forEach((item) => {
    sumAmount += parseFloat(item) || 0
  })
  sumAmount += parseFloat(extraSum.value) || 0
  sumTotal.value = sumAmount

  let spaTotal = 0
  spaItems.value.forEach((item) => {
    spaTotal += parseFloat(item) || 0
  })
  sumSpa.value = spaTotal
  calcAverages()
}

function monthlyFromAvg(avg) {
  const value = parseFloat(avg)
  if (Number.isNaN(value)) return ''
  return Math.round(value * 2 * 100) / 100
}

function calcAverages() {
  averages.value = []
  for (let i = 0; i < sumItems.value.length; i += 2) {
    if (i + 1 < sumItems.value.length) {
      const firstVal = parseFloat(sumItems.value[i]) || 0
      const secondVal = parseFloat(sumItems.value[i + 1]) || 0
      if (firstVal !== 0 && secondVal !== 0) {
        const avg = Math.round(((firstVal + secondVal) / 2) * 100) / 100
        averages.value.push(null)
        averages.value.push(avg)
      } else {
        averages.value.push(null)
        averages.value.push(null)
      }
    } else {
      averages.value.push(null)
    }
  }
}

function calcDisposable() {
  const perDay = parseFloat(disposablePerDay.value) || 0
  return balance.value - perDay * daysCount.value
}

async function addDeterminedDisposable() {
  try {
    const { data } = await api.get('/api/updatePaycheckDisposable.php', {
      params: {
        paycheck_date: payDateFormatted.value,
        amount: determinedDisposable.value,
      },
    })
    if (data?.success) {
      showDisposableUpdated.value = true
      setTimeout(() => {
        showDisposableUpdated.value = false
      }, 8000)
    }
  } catch (err) {
    mainError.value = err.response?.data?.error || 'Failed to update paycheck disposable.'
  }
}

async function getExpenseDays() {
  loading.value = true
  mainError.value = ''
  const curBalance = parseFloat(initBalance.value) || 0
  const payDateStr = payDate.value.toLocaleDateString()

  try {
    const { data } = await api.get('/api/loadBillDates2.php', {
      params: {
        user_id: 1,
        pay_date: payDateStr,
        current_balance: curBalance,
        test_mode: testMode.value ? 1 : 0,
        includeWeekends: 1,
        next_date: nextDate.value,
        prev_date: prevDate.value,
      },
    })

    if (data?.results?.length > 0) {
      if (!data.pay_date) {
        payDate.value = new Date()
      } else {
        payDate.value = new Date(data.pay_date)
        nextDate.value = 0
        prevDate.value = 0
      }

      updatePayDateFormatted()
      titleDate.value = payDate.value.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
      dateValue.value = `${payDate.value.getMonth() + 1}/${payDate.value.getDate()}`

      const runningTotalBalance = data.curBalance
        ? data.curBalance
        : parseFloat(initBalance.value) || 0

      daysCount.value = 0
      balance.value = runningTotalBalance

      data.results.forEach((week) => {
        week.days.forEach((day) => {
          day.desc.forEach((expense) => {
            balance.value -= expense.amount
          })
          if (day.showAsDay == 1) {
            daysCount.value += 1
          }
        })
      })

      if (remove15Days.value) {
        daysCount.value = 15
      }

      determinedDisposable.value = data.paycheck_disposable_amount
        ? parseFloat(data.paycheck_disposable_amount)
        : 0

      day40.value = calcDisposable()
    } else {
      balance.value = 0
    }
  } catch (err) {
    mainError.value = err.response?.data?.message || 'Failed to load bill dates.'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  const savedFirst = localStorage.getItem('initBalanceFirst')
  if (savedFirst !== null && savedFirst !== '') {
    initBalanceFirst.value = parseFloat(savedFirst)
  }
  const savedFifteenth = localStorage.getItem('initBalanceFifteenth')
  if (savedFifteenth !== null && savedFifteenth !== '') {
    initBalanceFifteenth.value = parseFloat(savedFifteenth)
  }

  const savedDeductLabel1 = localStorage.getItem('deductLabel1')
  if (savedDeductLabel1 !== null) deductLabel1.value = savedDeductLabel1
  const savedDeductLabel2 = localStorage.getItem('deductLabel2')
  if (savedDeductLabel2 !== null) deductLabel2.value = savedDeductLabel2

  const savedDeductValue1 = localStorage.getItem('deductValue1')
  if (savedDeductValue1 !== null && savedDeductValue1 !== '') {
    deductValue1.value = parseFloat(savedDeductValue1) || 0
  }
  const savedDeductValue2 = localStorage.getItem('deductValue2')
  if (savedDeductValue2 !== null && savedDeductValue2 !== '') {
    deductValue2.value = parseFloat(savedDeductValue2) || 0
  }

  const savedTestMode = localStorage.getItem('testMode')
  if (savedTestMode !== null) {
    testMode.value = savedTestMode === '1' || savedTestMode === 'true'
  }
  const savedRemove15Days = localStorage.getItem('remove15Days')
  if (savedRemove15Days !== null) {
    remove15Days.value = savedRemove15Days === '1' || savedRemove15Days === 'true'
  }
  if (localStorage.getItem('disposable_per_day')) {
    disposablePerDay.value = localStorage.getItem('disposable_per_day')
  }

  initializeBalance()
  loadPage('')
})
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <h2 class="text-xl font-semibold text-neutral-900 sm:text-2xl dark:text-white">
        Budget Progress
      </h2>
      <p v-if="loading" class="text-sm text-neutral-500">Loading…</p>
    </div>

    <div
      v-if="showDisposableUpdated"
      class="rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700 dark:border-success-800 dark:bg-success-900/30 dark:text-success-200"
    >
      Paycheck disposable updated successfully!
    </div>
    <div
      v-if="mainError"
      class="rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700 dark:border-danger-800 dark:bg-danger-900/30 dark:text-danger-200"
    >
      {{ mainError }}
    </div>

    <div
      class="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5 dark:border-neutral-600 dark:bg-dark-2"
    >
      <div class="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          v-model="initBalanceFirst"
          type="number"
          class="form-control h-11 rounded-xl px-3"
          placeholder="Initial Balance 1st"
          @change="saveInitBalanceFirst"
        />
        <input
          v-model="initBalanceFifteenth"
          type="number"
          class="form-control h-11 rounded-xl px-3"
          placeholder="Initial Balance 15th"
          @change="saveInitBalanceFifteenth"
        />
      </div>

      <div class="mb-4 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          class="rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600"
          @click="checkBalance"
        >
          +
        </button>
        <button
          type="button"
          class="rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600"
          @click="loadPage('prev')"
        >
          &lt;
        </button>
        <h4 class="min-w-[9rem] text-center text-base font-semibold text-neutral-900 dark:text-white">
          {{ titleDate }}
        </h4>
        <button
          type="button"
          class="rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600"
          @click="loadPage('next')"
        >
          &gt;
        </button>
        <button
          type="button"
          class="rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-600"
          @click="addSumItem"
        >
          +
        </button>
        <input
          v-model="day40"
          type="number"
          readonly
          class="form-control h-10 w-24 rounded-lg px-2 text-sm"
        />
      </div>

      <div class="mb-4 space-y-3">
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input
            v-model="deductLabel1"
            type="text"
            class="form-control h-11 rounded-xl px-3"
            placeholder="Label 1"
            @blur="saveDeductLabel1"
          />
          <input
            v-model="deductValue1"
            type="number"
            class="form-control h-11 rounded-xl px-3"
            placeholder="0"
            @blur="saveDeductValue1"
          />
        </div>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input
            v-model="deductLabel2"
            type="text"
            class="form-control h-11 rounded-xl px-3"
            placeholder="Label 2"
            @blur="saveDeductLabel2"
          />
          <input
            v-model="deductValue2"
            type="number"
            class="form-control h-11 rounded-xl px-3"
            placeholder="0"
            @blur="saveDeductValue2"
          />
        </div>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div class="rounded-xl bg-neutral-50 p-3 dark:bg-dark-3">
            <div class="text-xs text-neutral-500">Monthly Disposable</div>
            <div class="text-lg font-semibold">{{ monthlyDisposableDisplay }}</div>
          </div>
          <div class="rounded-xl bg-neutral-50 p-3 dark:bg-dark-3">
            <div class="text-xs text-neutral-500">
              After {{ deductLabel1 }} + {{ deductLabel2 }}
            </div>
            <div class="text-lg font-semibold">{{ monthlyDisposableAfterDisplay }}</div>
          </div>
        </div>
      </div>

      <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          v-model="determinedDisposable"
          type="number"
          class="form-control h-11 w-full rounded-xl px-3 sm:w-40"
          placeholder="Determined Disposable"
        />
        <button
          type="button"
          class="rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
          @click="addDeterminedDisposable"
        >
          Update Paycheck Disposable
        </button>
      </div>

      <div class="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          v-model="extraSum"
          type="number"
          class="form-control h-11 rounded-xl px-3"
          placeholder="Extra Sum"
          @change="calcFinalSums"
        />
        <div class="flex flex-wrap items-center gap-3 text-sm">
          <label class="inline-flex items-center gap-2">
            <input v-model="testMode" type="checkbox" class="rounded" @change="saveTestMode" />
            Test Mode
          </label>
          <label class="inline-flex items-center gap-2">
            <input
              v-model="disposablePerDay"
              type="number"
              class="form-control h-9 w-16 rounded-lg px-2"
              @blur="updateDisposablePerDay"
            />
            Disposable
          </label>
          <label class="inline-flex items-center gap-2">
            <input
              v-model="remove15Days"
              type="checkbox"
              class="rounded"
              @change="saveRemove15Days"
            />
            15 Days
          </label>
        </div>
      </div>

      <div>
        <div
          class="mb-3 hidden grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 lg:grid"
        >
          <h5 class="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Totals
          </h5>
          <h5 class="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Avg / Month
          </h5>
        </div>
        <h5 class="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500 lg:hidden">
          Totals
        </h5>

        <div class="space-y-2">
          <div
            v-for="(item, index) in sumItems"
            :key="`sum-${index}`"
            class="grid grid-cols-1 items-center gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-4"
          >
            <div class="flex min-w-0 items-center gap-2">
              <input
                v-model="sumItems[index]"
                type="number"
                class="form-control h-10 w-20 shrink-0 rounded-lg px-2 sm:w-24"
                @change="calcFinalSums"
              />
              <button
                type="button"
                class="inline-flex h-10 w-8 shrink-0 items-center justify-center rounded-lg border border-neutral-300 text-xs dark:border-neutral-600"
                @click="removeSumItem(index)"
              >
                X
              </button>
              <span class="truncate text-sm text-neutral-600 dark:text-neutral-300">{{
                dateItems[index]
              }}</span>
            </div>

            <div
              v-if="averages[index]"
              class="grid grid-cols-2 gap-2"
            >
              <input
                type="number"
                :value="averages[index]"
                class="form-control h-10 rounded-lg px-2"
                readonly
                title="Average disposable per paycheck"
              />
              <input
                type="number"
                :value="monthlyFromAvg(averages[index])"
                class="form-control h-10 rounded-lg px-2"
                readonly
                title="Average disposable per month"
              />
            </div>
            <div v-else class="hidden h-10 lg:block" aria-hidden="true"></div>
          </div>
        </div>
      </div>

      <div class="mt-4">
        <input
          type="number"
          :value="sumTotal"
          class="form-control h-11 w-full max-w-xs rounded-xl px-3"
          placeholder="Total"
          readonly
        />
      </div>
    </div>
  </div>
</template>
