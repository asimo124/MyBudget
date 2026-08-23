<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import ApexCharts from 'apexcharts'
import api from '@/api/client'

const activeTab = ref('tracker')
const loading = ref(false)
const mainMsg = ref('')
const mainError = ref('')
const uploadImportFile = ref(null)
const uploadPreviewFile = ref(null)
const uploadingImport = ref(false)
const uploadingPreview = ref(false)

const paycheckDate = ref('')
const paycheckDateDisplay = ref('')
const transactionDate = ref(null)
const categoryName = ref(null)
const drilldownLevel = ref('root')
const chartLabel = ref('Dates')
const cumulative = ref(false)

const transactions = ref([])
const allTransactions = ref([])
const allTransactionsAmountTotal = ref(0)
const disposableAccountNames = ref([])
const disposableAccountTypes = ref([])
const disposableAccountNumbers = ref([])
const disposableInstitutionNames = ref([])
const disposableCategoryNames = ref([])

const allTxStartDate = ref('')
const allTxEndDate = ref('')
const allTxCategoryName = ref('')
const allTxAccountType = ref('')
const allTxAccountName = ref('')
const allTxAccountNumber = ref('')
const allTxInstitutionName = ref('')
const allTxName1 = ref('')
const allTxName2 = ref('')
const allTxName3 = ref('')
const allTxAmountStart = ref('')
const allTxAmountEnd = ref('')
const allTxSortBy1 = ref('transaction_date')
const allTxSortDir1 = ref('DESC')
const allTxSortBy2 = ref('name')
const allTxSortDir2 = ref('ASC')

const transactionCategories = ref([])
const drilldownTransactions = ref([])
const drilldownTransactionsAmountTotal = ref(0)
const txCategoriesStartDate = ref('')
const txCategoriesEndDate = ref('')
const txCategoriesSortBy = ref('title')
const txCategoriesSortDir = ref('ASC')
const transactionCategoryDrilldownLevel = ref('root')
const transactionCategoryName = ref(null)

const chartRef = ref(null)
let chartInstance = null

function initDefaultDateRange() {
  const end = new Date()
  const start = new Date()
  start.setMonth(start.getMonth() - 3)
  const endStr = end.toISOString().split('T')[0]
  const startStr = start.toISOString().split('T')[0]
  txCategoriesEndDate.value = endStr
  txCategoriesStartDate.value = startStr
  allTxEndDate.value = endStr
  allTxStartDate.value = startStr
}

function getDefaultPaycheckDate() {
  const today = new Date()
  const day = today.getDate()
  let paycheck

  if (day <= 15) {
    const previousMonth = today.getMonth() - 1
    const year = previousMonth < 0 ? today.getFullYear() - 1 : today.getFullYear()
    paycheck = new Date(year, previousMonth < 0 ? 11 : previousMonth, 15)
  } else {
    paycheck = new Date(today.getFullYear(), today.getMonth(), 1)
  }

  paycheckDateDisplay.value = paycheck.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
  return paycheck.toISOString().split('T')[0]
}

function previousDate() {
  const [year, month, day] = paycheckDate.value.split('-').map(Number)
  const currentDate = new Date(year, month - 1, day)
  let newDate

  if (currentDate.getDate() === 15) {
    newDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
  } else if (currentDate.getMonth() === 0) {
    newDate = new Date(currentDate.getFullYear() - 1, 11, 15)
  } else {
    newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 15)
  }

  paycheckDate.value = newDate.toISOString().split('T')[0]
  paycheckDateDisplay.value = newDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
  loadData()
}

function nextDate() {
  const [year, month, day] = paycheckDate.value.split('-').map(Number)
  const currentDate = new Date(year, month - 1, day)
  let newDate

  if (currentDate.getDate() === 15) {
    if (currentDate.getMonth() === 11) {
      newDate = new Date(currentDate.getFullYear() + 1, 0, 1)
    } else {
      newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
    }
  } else {
    newDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 15)
  }

  paycheckDate.value = newDate.toISOString().split('T')[0]
  paycheckDateDisplay.value = newDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
  loadData()
}

async function loadTransactions() {
  try {
    const { data } = await api.get('/api/loadDisposableTransactions.php', {
      params: { paycheck_date: paycheckDate.value },
    })
    transactions.value = data?.items || []
  } catch {
    transactions.value = []
  }
}

async function loadTransactionCategories() {
  try {
    const { data } = await api.get('/api/loadTransactionCategories.php', {
      params: {
        start_date: txCategoriesStartDate.value,
        end_date: txCategoriesEndDate.value,
        sort_by: txCategoriesSortBy.value,
        sort_dir: txCategoriesSortDir.value,
      },
    })
    if (data?.error) {
      transactionCategories.value = []
      return
    }
    transactionCategories.value = data?.items || []
  } catch {
    transactionCategories.value = []
  }
}

function resetTransactionCategoryDrilldown() {
  transactionCategoryDrilldownLevel.value = 'root'
  transactionCategoryName.value = null
  drilldownTransactions.value = []
  drilldownTransactionsAmountTotal.value = 0
}

async function drilldownIntoTransactionCategory(category) {
  transactionCategoryDrilldownLevel.value = 'category'
  transactionCategoryName.value = category
  await loadDrilldownTransactions()
}

async function loadDrilldownTransactions() {
  try {
    const { data } = await api.get('/api/loadTransactionDrilldown.php', {
      params: {
        category_name: transactionCategoryName.value,
        start_date: txCategoriesStartDate.value,
        end_date: txCategoriesEndDate.value,
        sort_by: txCategoriesSortBy.value,
        sort_dir: txCategoriesSortDir.value,
      },
    })
    if (data?.error) {
      drilldownTransactions.value = []
      drilldownTransactionsAmountTotal.value = 0
      return
    }
    drilldownTransactions.value = data?.items || []
    drilldownTransactionsAmountTotal.value =
      data?.amount_total != null ? Number(data.amount_total) : 0
  } catch {
    drilldownTransactions.value = []
    drilldownTransactionsAmountTotal.value = 0
  }
}

async function loadDisposableFilterOptions() {
  try {
    const [names, types, numbers, institutions, categories] = await Promise.all([
      api.get('/api/loadDisposableAccountNames.php'),
      api.get('/api/loadDisposableAccountTypes.php'),
      api.get('/api/loadDisposableAccountNumbers.php'),
      api.get('/api/loadDisposableInstitutionNames.php'),
      api.get('/api/loadDisposableCategoryNames.php'),
    ])
    disposableAccountNames.value = names.data?.items || []
    disposableAccountTypes.value = types.data?.items || []
    disposableAccountNumbers.value = numbers.data?.items || []
    disposableInstitutionNames.value = institutions.data?.items || []
    disposableCategoryNames.value = categories.data?.items || []
  } catch {
    /* ignore */
  }
}

function clearAllTxFilters() {
  initDefaultDateRange()
  allTxCategoryName.value = ''
  allTxAccountType.value = ''
  allTxAccountName.value = ''
  allTxAccountNumber.value = ''
  allTxInstitutionName.value = ''
  allTxName1.value = ''
  allTxName2.value = ''
  allTxName3.value = ''
  allTxAmountStart.value = ''
  allTxAmountEnd.value = ''
  allTxSortBy1.value = 'transaction_date'
  allTxSortDir1.value = 'DESC'
  allTxSortBy2.value = 'name'
  allTxSortDir2.value = 'ASC'
  loadAllTransactions()
}

async function loadAllTransactions() {
  try {
    const params = {
      start_date: allTxStartDate.value,
      end_date: allTxEndDate.value,
      sort_by1: allTxSortBy1.value,
      sort_dir1: allTxSortDir1.value,
      sort_by2: allTxSortBy2.value,
      sort_dir2: allTxSortDir2.value,
    }
    if (allTxCategoryName.value) params.category_name = allTxCategoryName.value
    if (allTxAccountType.value) params.account_type = allTxAccountType.value
    if (allTxAccountName.value) params.account_name = allTxAccountName.value
    if (allTxAccountNumber.value) params.account_number = allTxAccountNumber.value
    if (allTxInstitutionName.value) params.institution_name = allTxInstitutionName.value
    if (allTxName1.value) params.name1 = allTxName1.value
    if (allTxName2.value) params.name2 = allTxName2.value
    if (allTxName3.value) params.name3 = allTxName3.value
    if (allTxAmountStart.value !== '') params.amount_start = allTxAmountStart.value
    if (allTxAmountEnd.value !== '') params.amount_end = allTxAmountEnd.value

    const { data } = await api.get('/api/loadTransactionAll.php', { params })
    if (data?.error) {
      allTransactions.value = []
      allTransactionsAmountTotal.value = 0
      return
    }
    allTransactions.value = data?.items || []
    allTransactionsAmountTotal.value = data?.amount_total != null ? Number(data.amount_total) : 0
  } catch {
    allTransactions.value = []
    allTransactionsAmountTotal.value = 0
  }
}

async function drilldownIntoChart(dimension) {
  if (drilldownLevel.value === 'root') {
    const dayOfMonth = parseInt(dimension.split(', ')[1], 10)
    const yearMonth = paycheckDate.value.slice(0, 7)
    transactionDate.value = `${yearMonth}-${String(dayOfMonth).padStart(2, '0')}`
    drilldownLevel.value = 'day'
    await loadChartData()
  } else if (drilldownLevel.value === 'day') {
    categoryName.value = dimension
    drilldownLevel.value = 'category'
    await loadChartData()
  }
}

async function reverseDrilldownChart() {
  if (drilldownLevel.value === 'category') {
    drilldownLevel.value = 'day'
    categoryName.value = null
    await loadChartData()
  } else if (drilldownLevel.value === 'day') {
    drilldownLevel.value = 'root'
    transactionDate.value = null
    await loadChartData()
  }
}

async function loadChartData() {
  const cumulativeParam = cumulative.value ? 1 : 0

  if (drilldownLevel.value === 'root') {
    chartLabel.value = 'Dates'
    try {
      const { data } = await api.get('/api/loadDisposableTransactionsChartData.php', {
        params: { paycheck_date: paycheckDate.value, cumulative: cumulativeParam },
      })
      if (data && chartInstance) {
        chartInstance.updateOptions(data.chartOptions)
        chartInstance.updateSeries(data.series)
        chartInstance.updateOptions({
          yaxis: { min: 0, max: data.maxY || undefined },
        })
      }
    } catch {
      /* ignore */
    }
  } else if (drilldownLevel.value === 'day') {
    chartLabel.value = 'Categories'
    try {
      const { data } = await api.get('/api/loadDisposableTransactionsChartDataDay.php', {
        params: {
          paycheck_date: paycheckDate.value,
          transaction_date: transactionDate.value,
          cumulative: cumulativeParam,
        },
      })
      if (data && chartInstance) {
        chartInstance.updateOptions(data.chartOptions)
        chartInstance.updateSeries(data.series)
      }
    } catch {
      /* ignore */
    }
  } else if (drilldownLevel.value === 'category') {
    chartLabel.value = 'Transactions'
    try {
      const { data } = await api.get('/api/loadDisposableTransactionsChartDataCategory.php', {
        params: {
          paycheck_date: paycheckDate.value,
          transaction_date: transactionDate.value,
          category_name: categoryName.value,
          cumulative: cumulativeParam,
        },
      })
      if (data && chartInstance) {
        chartInstance.updateOptions(data.chartOptions)
        chartInstance.updateSeries(data.series)
      }
    } catch {
      /* ignore */
    }
  }
}

async function updateIsCovered(id, isCovered) {
  try {
    const { data } = await api.get('/api/updateDisposableTransactionCovered.php', {
      params: { id, is_covered: isCovered },
    })
    if (data?.success) {
      await loadData()
    }
  } catch {
    /* ignore */
  }
}

async function updateAllNotCovered() {
  try {
    const { data } = await api.get('/api/updateAllNotCovered.php', {
      params: { paycheck_date: paycheckDate.value },
    })
    if (data?.success) {
      await loadData()
    }
  } catch {
    /* ignore */
  }
}

async function loadData() {
  await Promise.all([loadTransactions(), loadChartData(), loadTransactionCategories()])
}

function onImportFileChange(event) {
  uploadImportFile.value = event.target.files?.[0] || null
}

function onPreviewFileChange(event) {
  uploadPreviewFile.value = event.target.files?.[0] || null
}

async function submitImportUpload() {
  if (!uploadImportFile.value) {
    mainError.value = 'Please select a CSV file.'
    return
  }
  uploadingImport.value = true
  mainMsg.value = ''
  mainError.value = ''
  try {
    const formData = new FormData()
    formData.append('rocket_money_file', uploadImportFile.value)
    const { data } = await api.post('/api/disposable/upload_import.php', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    mainMsg.value = data.message || 'File uploaded successfully.'
    uploadImportFile.value = null
    await loadData()
  } catch (err) {
    mainError.value = err.response?.data?.message || 'Upload failed.'
  } finally {
    uploadingImport.value = false
  }
}

async function submitPreviewUpload() {
  if (!uploadPreviewFile.value) {
    mainError.value = 'Please select a CSV file.'
    return
  }
  uploadingPreview.value = true
  mainMsg.value = ''
  mainError.value = ''
  try {
    const formData = new FormData()
    formData.append('rocket_money_file', uploadPreviewFile.value)
    const { data } = await api.post('/api/disposable/upload_preview.php', formData, {
      responseType: 'blob',
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    const url = URL.createObjectURL(data)
    const link = document.createElement('a')
    link.href = url
    link.download = 'disposable_income_tracker_main_output.csv'
    link.click()
    URL.revokeObjectURL(url)
    mainMsg.value = 'CSV downloaded.'
    uploadPreviewFile.value = null
  } catch (err) {
    mainError.value = err.response?.data?.message || 'Upload failed.'
  } finally {
    uploadingPreview.value = false
  }
}

function initChart() {
  if (!chartRef.value) return
  chartInstance = new ApexCharts(chartRef.value, {
    chart: {
      type: 'bar',
      events: {
        dataPointSelection(_event, _chartContext, config) {
          const categories = config.w.config.xaxis.categories || []
          const clicked = categories[config.dataPointIndex]
          if (clicked) {
            drilldownIntoChart(clicked)
          }
        },
      },
    },
    xaxis: { categories: [] },
    series: [{ name: 'Spent', data: [] }],
  })
  chartInstance.render()
}

onMounted(async () => {
  initDefaultDateRange()
  paycheckDate.value = getDefaultPaycheckDate()
  loading.value = true
  try {
    await loadData()
    await loadDisposableFilterOptions()
    await loadAllTransactions()
  } finally {
    loading.value = false
  }
  await nextTick()
  initChart()
  await loadChartData()
})

onBeforeUnmount(() => {
  if (chartInstance) {
    chartInstance.destroy()
    chartInstance = null
  }
})
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Disposable Income Tracker</h1>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Track Rocket Money spending by paycheck period.
      </p>
    </div>

    <div
      v-if="mainMsg"
      class="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300"
    >
      {{ mainMsg }}
    </div>
    <div
      v-if="mainError"
      class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
    >
      {{ mainError }}
    </div>

    <div class="border-b border-gray-200 dark:border-gray-700">
      <nav class="-mb-px flex gap-4">
        <button
          v-for="tab in [
            { id: 'tracker', label: 'Tracker' },
            { id: 'upload', label: 'Upload' },
            { id: 'transactions', label: 'Transactions' },
          ]"
          :key="tab.id"
          type="button"
          class="border-b-2 px-1 py-3 text-sm font-medium transition-colors"
          :class="
            activeTab === tab.id
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400'
          "
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </nav>
    </div>

    <!-- Tracker tab -->
    <div v-show="activeTab === 'tracker'" class="space-y-6">
      <div class="card">
        <div class="card-body space-y-4">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Upload Rocket Money Data</h2>
          <input
            type="file"
            accept=".csv"
            class="form-input w-full max-w-lg"
            @change="onImportFileChange"
          />
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              class="btn bg-primary-500 text-white hover:bg-primary-600"
              :disabled="uploadingImport"
              @click="submitImportUpload"
            >
              {{ uploadingImport ? 'Uploading…' : 'Upload File' }}
            </button>
            <button
              type="button"
              class="btn bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200"
              @click="updateAllNotCovered"
            >
              Mark All Not Covered
            </button>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-3 items-center gap-2">
        <button
          type="button"
          class="btn bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200"
          @click="previousDate"
        >
          &lt;
        </button>
        <span class="text-center text-lg font-medium text-gray-900 dark:text-white">
          {{ paycheckDateDisplay }}
        </span>
        <button
          type="button"
          class="btn bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 justify-self-end"
          @click="nextDate"
        >
          &gt;
        </button>
      </div>

      <div class="card">
        <div class="card-body">
          <h3 class="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">Rocket Money Data</h3>
          <div class="overflow-x-auto overflow-y-auto max-h-[450px]">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead class="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Name</th>
                  <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500 w-24">Amount</th>
                  <th class="px-3 py-2 w-16"></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                <tr v-if="!transactions.length">
                  <td colspan="3" class="px-3 py-6 text-center text-sm italic text-gray-500">
                    No rocket money data available
                  </td>
                </tr>
                <tr v-for="item in transactions" :key="item.id" class="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td class="px-3 py-2 text-sm text-gray-900 dark:text-gray-100 break-words">{{ item.name }}</td>
                  <td class="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">${{ item.amount }}</td>
                  <td class="px-3 py-2">
                    <button
                      type="button"
                      class="rounded bg-red-500 px-2 py-1 text-xs font-semibold text-white hover:bg-red-600"
                      title="Mark covered"
                      @click="updateIsCovered(item.id, 1)"
                    >
                      X
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-3 items-center gap-2">
        <button
          type="button"
          class="btn bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200"
          @click="previousDate"
        >
          &lt;
        </button>
        <span class="text-center text-lg font-medium text-gray-900 dark:text-white">
          {{ paycheckDateDisplay }}
        </span>
        <button
          type="button"
          class="btn bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 justify-self-end"
          @click="nextDate"
        >
          &gt;
        </button>
      </div>

      <div class="card">
        <div class="card-body">
          <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ chartLabel }}</h3>
            <div class="flex items-center gap-4">
              <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input v-model="cumulative" type="checkbox" class="rounded" @change="loadChartData" />
                Cumulative
              </label>
              <button
                v-if="chartLabel !== 'Dates'"
                type="button"
                class="btn bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200"
                @click="reverseDrilldownChart"
              >
                Back
              </button>
            </div>
          </div>
          <div ref="chartRef" class="h-[350px] w-full"></div>
        </div>
      </div>
    </div>

    <!-- Upload tab -->
    <div v-show="activeTab === 'upload'" class="space-y-6">
      <div class="card">
        <div class="card-body space-y-4">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Upload Rocket Money Data</h2>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            Adds a Paycheck Date column and downloads the CSV.
          </p>
          <input
            type="file"
            accept=".csv"
            class="form-input w-full max-w-lg"
            @change="onPreviewFileChange"
          />
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              class="btn bg-primary-500 text-white hover:bg-primary-600"
              :disabled="uploadingPreview"
              @click="submitPreviewUpload"
            >
              {{ uploadingPreview ? 'Processing…' : 'Upload File' }}
            </button>
            <button
              type="button"
              class="btn bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200"
              @click="updateAllNotCovered"
            >
              Mark All Not Covered
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Transactions tab -->
    <div v-show="activeTab === 'transactions'" class="space-y-6">
      <div class="card">
        <div class="card-body space-y-4">
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Category summary filters</h3>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">Start date</label>
              <input v-model="txCategoriesStartDate" type="date" class="form-input w-full" />
            </div>
            <div>
              <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">End date</label>
              <input v-model="txCategoriesEndDate" type="date" class="form-input w-full" />
            </div>
            <div>
              <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">Order by</label>
              <select v-model="txCategoriesSortBy" class="form-input w-full">
                <option value="title">Title</option>
                <option value="amount">Amount</option>
              </select>
            </div>
            <div>
              <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">Direction</label>
              <select v-model="txCategoriesSortDir" class="form-input w-full">
                <option value="ASC">Ascending</option>
                <option value="DESC">Descending</option>
              </select>
            </div>
          </div>
          <div class="flex justify-end border-t border-gray-200 pt-4 dark:border-gray-700">
            <button
              type="button"
              class="btn bg-primary-500 text-white hover:bg-primary-600"
              @click="loadTransactionCategories"
            >
              Apply filters
            </button>
          </div>
        </div>
      </div>

      <div v-if="transactionCategoryDrilldownLevel === 'root'" class="card">
        <div class="card-body">
          <h3 class="mb-3 text-lg font-semibold text-gray-900 dark:text-white">Transaction categories</h3>
          <div class="overflow-x-auto overflow-y-auto max-h-[450px]">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead class="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Category</th>
                  <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500 w-24">Amount</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                <tr v-if="!transactionCategories.length">
                  <td colspan="2" class="px-3 py-6 text-center text-sm italic text-gray-500">No data for this range</td>
                </tr>
                <tr v-for="(item, index) in transactionCategories" :key="index">
                  <td class="px-3 py-2 text-sm">
                    <button
                      type="button"
                      class="text-primary-600 hover:underline dark:text-primary-400"
                      @click="drilldownIntoTransactionCategory(item.title)"
                    >
                      {{ item.title }}
                    </button>
                  </td>
                  <td class="px-3 py-2 text-sm">${{ item.amount_per_category }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div v-else class="card">
        <div class="card-body">
          <div class="mb-3 flex items-center gap-3">
            <button
              type="button"
              class="btn bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200"
              @click="resetTransactionCategoryDrilldown"
            >
              Back
            </button>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ transactionCategoryName }}</h3>
          </div>
          <div class="overflow-x-auto overflow-y-auto max-h-[450px]">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead class="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Category</th>
                  <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500 w-24">Amount</th>
                  <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Date</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                <tr v-if="!drilldownTransactions.length">
                  <td colspan="3" class="px-3 py-6 text-center text-sm italic text-gray-500">No data for this range</td>
                </tr>
                <tr v-for="(item, index) in drilldownTransactions" :key="index">
                  <td class="px-3 py-2 text-sm break-words">{{ item.name }}</td>
                  <td class="px-3 py-2 text-sm">${{ item.amount }}</td>
                  <td class="px-3 py-2 text-sm">{{ item.transaction_date }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="mt-3 flex justify-end border-t border-gray-200 pt-3 dark:border-gray-700">
            <span class="text-sm font-semibold">
              Total: ${{ Number(drilldownTransactionsAmountTotal).toFixed(2) }}
            </span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-body space-y-4">
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">All transactions — filters</h3>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">Start date</label>
              <input v-model="allTxStartDate" type="date" class="form-input w-full" />
            </div>
            <div>
              <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">End date</label>
              <input v-model="allTxEndDate" type="date" class="form-input w-full" />
            </div>
            <div>
              <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">Category</label>
              <select v-model="allTxCategoryName" class="form-input w-full">
                <option value="">All</option>
                <option v-for="(row, idx) in disposableCategoryNames" :key="'cat-' + idx" :value="row.category_name">
                  {{ row.category_name }}
                </option>
              </select>
            </div>
            <div>
              <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">Account type</label>
              <select v-model="allTxAccountType" class="form-input w-full">
                <option value="">All</option>
                <option v-for="(row, idx) in disposableAccountTypes" :key="'at-' + idx" :value="row.account_type">
                  {{ row.account_type }}
                </option>
              </select>
            </div>
            <div>
              <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">Account name</label>
              <select v-model="allTxAccountName" class="form-input w-full">
                <option value="">All</option>
                <option v-for="(row, idx) in disposableAccountNames" :key="'an-' + idx" :value="row.account_name">
                  {{ row.account_name }}
                </option>
              </select>
            </div>
            <div>
              <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">Account number</label>
              <select v-model="allTxAccountNumber" class="form-input w-full">
                <option value="">All</option>
                <option v-for="(row, idx) in disposableAccountNumbers" :key="'ano-' + idx" :value="row.account_number">
                  {{ row.account_number }}
                </option>
              </select>
            </div>
            <div>
              <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">Institution</label>
              <select v-model="allTxInstitutionName" class="form-input w-full">
                <option value="">All</option>
                <option
                  v-for="(row, idx) in disposableInstitutionNames"
                  :key="'in-' + idx"
                  :value="row.institution_name"
                >
                  {{ row.institution_name }}
                </option>
              </select>
            </div>
            <div>
              <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">Name search 1</label>
              <input v-model="allTxName1" type="text" placeholder="Contains…" class="form-input w-full" />
            </div>
            <div>
              <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">Name search 2</label>
              <input v-model="allTxName2" type="text" placeholder="Contains…" class="form-input w-full" />
            </div>
            <div>
              <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">Name search 3</label>
              <input v-model="allTxName3" type="text" placeholder="Contains…" class="form-input w-full" />
            </div>
            <div>
              <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">Amount min</label>
              <input v-model="allTxAmountStart" type="text" placeholder="Optional" class="form-input w-full" />
            </div>
            <div>
              <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">Amount max</label>
              <input v-model="allTxAmountEnd" type="text" placeholder="Optional" class="form-input w-full" />
            </div>
            <div>
              <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">Sort by</label>
              <select v-model="allTxSortBy1" class="form-input w-full">
                <option value="transaction_date">Transaction date</option>
                <option value="amount">Amount</option>
                <option value="name">Name</option>
                <option value="category">Category</option>
              </select>
            </div>
            <div>
              <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">Direction</label>
              <select v-model="allTxSortDir1" class="form-input w-full">
                <option value="ASC">Ascending</option>
                <option value="DESC">Descending</option>
              </select>
            </div>
            <div>
              <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">Then sort by</label>
              <select v-model="allTxSortBy2" class="form-input w-full">
                <option value="name">Name</option>
                <option value="transaction_date">Transaction date</option>
                <option value="amount">Amount</option>
                <option value="category">Category</option>
              </select>
            </div>
            <div>
              <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">Then direction</label>
              <select v-model="allTxSortDir2" class="form-input w-full">
                <option value="ASC">Ascending</option>
                <option value="DESC">Descending</option>
              </select>
            </div>
          </div>
          <div class="flex justify-end gap-2 border-t border-gray-200 pt-4 dark:border-gray-700">
            <button
              type="button"
              class="btn bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200"
              @click="clearAllTxFilters"
            >
              Clear filters
            </button>
            <button
              type="button"
              class="btn bg-primary-500 text-white hover:bg-primary-600"
              @click="loadAllTransactions"
            >
              Apply filters
            </button>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-body">
          <h3 class="mb-3 text-lg font-semibold text-gray-900 dark:text-white">All transactions</h3>
          <div class="overflow-x-auto overflow-y-auto max-h-[450px]">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead class="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Category</th>
                  <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Expense</th>
                  <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500 w-24">Amount</th>
                  <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Date</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                <tr v-if="!allTransactions.length">
                  <td colspan="4" class="px-3 py-6 text-center text-sm italic text-gray-500">No data for this range</td>
                </tr>
                <tr v-for="(item, index) in allTransactions" :key="index">
                  <td class="px-3 py-2 text-sm break-words">{{ item.category_name }}</td>
                  <td class="px-3 py-2 text-sm break-words">{{ item.name }}</td>
                  <td class="px-3 py-2 text-sm">${{ item.amount }}</td>
                  <td class="px-3 py-2 text-sm">{{ item.transaction_date }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="mt-3 flex justify-end border-t border-gray-200 pt-3 dark:border-gray-700">
            <span class="text-sm font-semibold">
              Total: ${{ Number(allTransactionsAmountTotal).toFixed(2) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="loading" class="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
      <div class="rounded-lg bg-white px-6 py-4 shadow-lg dark:bg-gray-800">Loading…</div>
    </div>
  </div>
</template>
