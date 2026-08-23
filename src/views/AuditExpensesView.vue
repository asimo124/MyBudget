<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import api from '@/api/client'

const AE_MAX_CHARS = 33

const expensesAppData = ref([])
const rocketMoneyData = ref([])
const matchedTitlesData = ref([])
const budgetDiscrepancies = ref([])

const mainMsg = ref('')
const mainError = ref('')
const uploading = ref(false)
const uploadFile = ref(null)

const hoveredItemIndex = ref(null)
const popoverVisible = ref(false)
const rocketMatchHoveredIndex = ref(null)
const rocketMatchPopoverVisible = ref(false)
const expensesMatchHoveredIndex = ref(null)
const expensesMatchPopoverVisible = ref(false)

const rocketItem = ref(null)
const rocketIndex = ref(-1)
const expenseDiscrepanciesModalVisible = ref(false)

function truncate(str, len = AE_MAX_CHARS) {
  if (!str) return ''
  return str.length > len ? str.substring(0, len) : str
}

async function loadExpensesAppData() {
  try {
    const { data } = await api.get('/api/loadExpensesAppData.php')
    expensesAppData.value = (data?.items || []).map((item) => ({
      ...item,
      collapsed: Boolean(Number(item.collapsed)),
    }))
  } catch {
    expensesAppData.value = []
  }
}

async function loadRocketMoneyData() {
  try {
    const { data } = await api.get('/api/loadRocketMoneyData.php')
    rocketMoneyData.value = (data?.items || []).map((item) => ({
      ...item,
      Collapsed: Boolean(Number(item.Collapsed)),
    }))
  } catch {
    rocketMoneyData.value = []
  }
}

async function loadTitleMatches() {
  try {
    const { data } = await api.get('/api/loadTitleMatches.php')
    matchedTitlesData.value = data?.items || []
  } catch {
    matchedTitlesData.value = []
  }
}

async function loadPage() {
  await Promise.all([loadExpensesAppData(), loadRocketMoneyData(), loadTitleMatches()])
}

function showPopover(index) {
  hoveredItemIndex.value = index
  popoverVisible.value = true
}

function hidePopover() {
  hoveredItemIndex.value = null
  popoverVisible.value = false
}

function togglePopover(index) {
  if (popoverVisible.value && hoveredItemIndex.value === index) {
    hidePopover()
  } else {
    showPopover(index)
  }
}

function showRocketMatchPopover(index) {
  rocketMatchHoveredIndex.value = index
  rocketMatchPopoverVisible.value = true
}

function hideRocketMatchPopover() {
  rocketMatchHoveredIndex.value = null
  rocketMatchPopoverVisible.value = false
}

function toggleRocketMatchPopover(index) {
  if (rocketMatchPopoverVisible.value && rocketMatchHoveredIndex.value === index) {
    hideRocketMatchPopover()
  } else {
    showRocketMatchPopover(index)
  }
}

function showExpensesMatchPopover(index) {
  expensesMatchHoveredIndex.value = index
  expensesMatchPopoverVisible.value = true
}

function hideExpensesMatchPopover() {
  expensesMatchHoveredIndex.value = null
  expensesMatchPopoverVisible.value = false
}

function toggleExpensesMatchPopover(index) {
  if (expensesMatchPopoverVisible.value && expensesMatchHoveredIndex.value === index) {
    hideExpensesMatchPopover()
  } else {
    showExpensesMatchPopover(index)
  }
}

function handleClickOutside(event) {
  const isPopoverClick =
    event.target.closest('.popover-trigger') || event.target.closest('[class*="popover"]')
  if (!isPopoverClick) {
    hidePopover()
    hideRocketMatchPopover()
    hideExpensesMatchPopover()
  }
}

function toggleRocketItemCollapse(index) {
  const item = rocketMoneyData.value[index]
  if (item.Collapsed) {
    item.Collapsed = false
  } else {
    rocketItem.value = item
    rocketIndex.value = index
    item.Collapsed = true
  }
}

async function updateRocketItemCollapsed() {
  if (!rocketItem.value || rocketIndex.value < 0) return
  const collapsed = rocketItem.value.Collapsed ? 1 : 0
  try {
    await api.get('/api/updateRocketMoneyCollapsed.php', {
      params: { index: rocketIndex.value, collapsed },
    })
  } catch {
    /* ignore */
  }
}

async function updateExpensesItemCollapsed(index) {
  const item = expensesAppData.value[index]
  if (!item) return
  try {
    await api.post(
      `/api/updateExpensesAppCollapsed.php?vnd_id=${item.vnd_id}&collapsed=${item.collapsed ? 1 : 0}`
    )
  } catch {
    /* ignore */
  }
}

async function insertTitleMatch(matchedItem) {
  try {
    await api.get('/api/insertTitleMatch.php', { params: matchedItem })
  } catch {
    /* ignore */
  }
}

async function removeTitleMatchFromDB(matchedItem) {
  try {
    await api.get('/api/removeTitleMatch.php', { params: matchedItem })
  } catch {
    /* ignore */
  }
}

async function toggleExpensesItemCollapse(index) {
  const item = expensesAppData.value[index]
  if (item.collapsed) {
    item.collapsed = false
    await updateExpensesItemCollapsed(index)
    return
  }

  if (!rocketItem.value) {
    mainError.value = 'Please select a Rocket Money title first (click + on the left).'
    return
  }
  mainError.value = ''

  const matchedItem = {
    rocket_money_index: rocketItem.value.Index,
    rocket_money_id: rocketItem.value.id,
    expenses_app_id: item.vnd_id,
    rocket_money_title: rocketItem.value.Name,
    rocket_money_amount: rocketItem.value.Amount,
    rocket_money_date: rocketItem.value.Date,
    rocket_money_medium_title: rocketItem.value.MediumName,
    rocket_money_long_title: rocketItem.value.LongName,
    expenses_app_index: item.index,
    expenses_app_title: item.title,
    expenses_app_amount: item.amount,
    expenses_app_date: item.day_of_month,
    expenses_app_medium_title: item.medium_title,
    expenses_app_long_title: item.long_title,
  }

  matchedTitlesData.value.push(matchedItem)

  for (let i = 0; i < rocketIndex.value; i++) {
    rocketMoneyData.value[i].Collapsed = true
  }
  item.collapsed = true

  await insertTitleMatch(matchedItem)
  await updateExpensesItemCollapsed(index)
  await updateRocketItemCollapsed()

  rocketItem.value = null
  rocketIndex.value = -1
}

async function removeMatchedTitle(index) {
  const matchedItem = matchedTitlesData.value[index]
  const rmIndex = matchedItem.rocket_money_index
  const expensesIndex = matchedItem.expenses_app_index

  if (rocketMoneyData.value[rmIndex]) {
    rocketMoneyData.value[rmIndex].Collapsed = false
  }
  for (let i = 0; i <= rmIndex; i++) {
    if (rocketMoneyData.value[i]) {
      rocketMoneyData.value[i].Collapsed = false
    }
  }
  if (expensesAppData.value[expensesIndex]) {
    expensesAppData.value[expensesIndex].collapsed = false
  }

  matchedTitlesData.value.splice(index, 1)

  rocketItem.value = rocketMoneyData.value[rmIndex] || null
  rocketIndex.value = rmIndex

  await updateRocketItemCollapsed()
  await updateExpensesItemCollapsed(expensesIndex)
  await removeTitleMatchFromDB(matchedItem)

  rocketItem.value = null
  rocketIndex.value = -1
}

async function loadBudgetDiscrepancies() {
  try {
    const { data } = await api.get('/api/loadBudgetDiscrepancies.php')
    budgetDiscrepancies.value = data?.items || []
  } catch {
    budgetDiscrepancies.value = []
  }
}

function openExpenseDiscrepanciesModal() {
  expenseDiscrepanciesModalVisible.value = true
  loadBudgetDiscrepancies()
}

function closeExpenseDiscrepanciesModal() {
  expenseDiscrepanciesModalVisible.value = false
}

function onUploadFileChange(event) {
  uploadFile.value = event.target.files?.[0] || null
}

async function submitUpload() {
  if (!uploadFile.value) {
    mainError.value = 'Please select a CSV file.'
    return
  }
  uploading.value = true
  mainMsg.value = ''
  mainError.value = ''
  try {
    const formData = new FormData()
    formData.append('rocket_money_file', uploadFile.value)
    const { data } = await api.post('/api/audit/upload.php', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    mainMsg.value = data.message || 'File uploaded successfully.'
    uploadFile.value = null
    await loadPage()
  } catch (err) {
    mainError.value = err.response?.data?.message || 'Upload failed.'
  } finally {
    uploading.value = false
  }
}

onMounted(async () => {
  document.addEventListener('click', handleClickOutside)
  await loadPage()
  setTimeout(() => {
    document.getElementById('matched-titles-label')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, 2000)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Audit Expenses</h1>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Match Rocket Money transactions to your expenses app bills.
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

    <!-- Expenses App Data -->
    <div class="card">
      <div class="card-body">
        <h3 class="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">Expenses App Data</h3>
        <div class="overflow-x-auto overflow-y-auto max-h-[300px]">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Title</th>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Amount</th>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Date</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <tr v-for="(item, index) in expensesAppData" :key="'ea-' + index">
                <td class="relative px-3 py-2 text-sm">
                  <span
                    class="popover-trigger cursor-help hover:text-primary-600"
                    @click="togglePopover(index)"
                    @mouseenter="showPopover(index)"
                    @mouseleave="hidePopover"
                  >
                    {{ item.title }}
                  </span>
                  <div
                    v-show="popoverVisible && hoveredItemIndex === index"
                    class="absolute z-50 -top-12 left-0 max-w-xs rounded-lg bg-gray-800 px-3 py-2 text-sm text-white shadow-lg sm:-top-2 sm:left-full sm:ml-2"
                  >
                    {{ item.long_title || 'No detailed title available' }}
                  </div>
                </td>
                <td class="px-3 py-2 text-sm">${{ item.amount }}</td>
                <td class="px-3 py-2 text-sm">{{ item.day_of_month }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Upload -->
    <div class="card">
      <div class="card-body space-y-4">
        <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300">Upload Rocket Money Data</h3>
        <input type="file" accept=".csv" class="form-input w-full max-w-lg" @change="onUploadFileChange" />
        <button
          type="button"
          class="btn bg-primary-500 text-white hover:bg-primary-600"
          :disabled="uploading"
          @click="submitUpload"
        >
          {{ uploading ? 'Uploading…' : 'Upload File' }}
        </button>
      </div>
    </div>

    <!-- Rocket Money Data -->
    <div class="card">
      <div class="card-body">
        <h3 class="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">Rocket Money Data</h3>
        <div class="overflow-x-auto overflow-y-auto max-h-[300px]">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Title</th>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Amount</th>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Date</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <tr v-if="!rocketMoneyData.length">
                <td colspan="3" class="px-3 py-6 text-center text-sm italic text-gray-500">
                  No rocket money data available
                </td>
              </tr>
              <tr v-for="(item, index) in rocketMoneyData" :key="'rm-' + index">
                <td class="relative px-3 py-2 text-sm">
                  <span
                    class="popover-trigger cursor-help hover:text-primary-600"
                    @click="togglePopover(index)"
                    @mouseenter="showPopover(index)"
                    @mouseleave="hidePopover"
                  >
                    {{ item.Name }}
                  </span>
                  <div
                    v-show="popoverVisible && hoveredItemIndex === index"
                    class="absolute z-50 -top-12 left-0 max-w-xs rounded-lg bg-gray-800 px-3 py-2 text-sm text-white shadow-lg sm:-top-2 sm:left-full sm:ml-2"
                  >
                    {{ item.LongName || 'No detailed name available' }}
                  </div>
                </td>
                <td class="px-3 py-2 text-sm">${{ item.Amount }}</td>
                <td class="px-3 py-2 text-sm">{{ item.Date }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Matched Titles -->
    <div class="card">
      <div class="card-body">
        <h3 id="matched-titles-label" class="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
          Matched Titles
          <button type="button" class="ml-2 text-primary-600 hover:underline" @click="openExpenseDiscrepanciesModal">
            Generate
          </button>
        </h3>
        <div v-if="matchedTitlesData.length" class="overflow-x-auto overflow-y-auto max-h-[300px]">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Rocket Money</th>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Expenses App</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <tr v-for="(item, index) in matchedTitlesData" :key="'mt-' + index">
                <td class="px-3 py-2 text-sm">
                  {{ truncate(item.rocket_money_title) }}: ${{ item.rocket_money_amount }}
                </td>
                <td class="px-3 py-2 text-sm">
                  <span>{{ truncate(item.expenses_app_title) }}: ${{ item.expenses_app_amount }}</span>
                  <button
                    type="button"
                    class="ml-2 inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white hover:bg-red-600"
                    @click="removeMatchedTitle(index)"
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

    <!-- Title Matching -->
    <div>
      <h3 class="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
        Title Matching
        <span class="text-xs text-gray-500">(select Rocket Money + on left, then Expenses App + on right)</span>
      </h3>
      <div class="grid grid-cols-1 gap-2 lg:grid-cols-2">
        <!-- Rocket Money -->
        <div class="overflow-y-auto max-h-96 rounded-lg border border-gray-200 p-1 dark:border-gray-700 lg:max-h-[650px]">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Title</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <tr
                v-for="(item, index) in rocketMoneyData"
                :key="'rm-match-' + index"
                class="transition-all duration-300"
                :class="{ 'h-4 overflow-hidden': item.Collapsed, 'hover:bg-gray-50 dark:hover:bg-gray-800/50': !item.Collapsed }"
              >
                <td
                  class="relative px-3 text-sm transition-all duration-300"
                  :class="item.Collapsed ? 'py-0' : 'py-3'"
                >
                  <div class="flex items-center">
                    <span
                      class="popover-trigger cursor-help hover:text-primary-600"
                      :class="{ 'text-xs opacity-30': item.Collapsed }"
                      @click="toggleRocketMatchPopover(index)"
                      @mouseenter="showRocketMatchPopover(index)"
                      @mouseleave="hideRocketMatchPopover"
                    >
                      {{ item.Name }}: ${{ item.Amount }}
                    </span>
                    <button
                      type="button"
                      class="ml-2 flex items-center justify-center rounded-full text-xs font-bold transition-all duration-300"
                      :class="
                        item.Collapsed
                          ? 'h-3 w-3 bg-yellow-500 text-black hover:bg-yellow-600'
                          : 'h-4 w-4 bg-green-500 text-white hover:bg-green-600'
                      "
                      @click="toggleRocketItemCollapse(index)"
                    >
                      +
                    </button>
                  </div>
                  <div
                    v-show="rocketMatchPopoverVisible && rocketMatchHoveredIndex === index"
                    class="absolute z-50 -top-12 left-0 max-w-xs rounded-lg bg-gray-800 px-3 py-2 text-sm text-white shadow-lg sm:-top-2 sm:left-full sm:ml-2"
                  >
                    {{ item.LongName || 'No detailed name available' }}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Expenses App -->
        <div class="overflow-y-auto max-h-96 rounded-lg border border-gray-200 p-1 dark:border-gray-700 lg:max-h-[650px]">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Title</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <tr v-if="!expensesAppData.length">
                <td class="px-3 py-6 text-center text-sm italic text-gray-500">No expenses app data available</td>
              </tr>
              <tr
                v-for="(item, index) in expensesAppData"
                :key="'ea-match-' + index"
                class="transition-all duration-300"
                :class="{ 'h-4 overflow-hidden': item.collapsed, 'hover:bg-gray-50 dark:hover:bg-gray-800/50': !item.collapsed }"
              >
                <td
                  class="relative px-3 text-sm transition-all duration-300"
                  :class="item.collapsed ? 'py-0' : 'py-3'"
                >
                  <div class="flex items-center">
                    <span
                      class="popover-trigger cursor-help hover:text-primary-600"
                      :class="{ 'text-xs opacity-30': item.collapsed }"
                      @click="toggleExpensesMatchPopover(index)"
                      @mouseenter="showExpensesMatchPopover(index)"
                      @mouseleave="hideExpensesMatchPopover"
                    >
                      {{ item.title }}: ${{ item.amount }}
                    </span>
                    <button
                      type="button"
                      class="ml-2 flex items-center justify-center rounded-full text-xs font-bold transition-all duration-300"
                      :class="
                        item.collapsed
                          ? 'h-3 w-3 bg-yellow-500 text-black hover:bg-yellow-600'
                          : 'h-4 w-4 bg-green-500 text-white hover:bg-green-600'
                      "
                      @click="toggleExpensesItemCollapse(index)"
                    >
                      +
                    </button>
                  </div>
                  <div
                    v-show="expensesMatchPopoverVisible && expensesMatchHoveredIndex === index && !item.collapsed"
                    class="absolute z-50 -top-12 left-0 max-w-xs rounded-lg bg-gray-800 px-3 py-2 text-sm text-white shadow-lg sm:-top-2 sm:left-full sm:ml-2"
                  >
                    {{ item.long_title || 'No detailed title available' }}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Discrepancies Modal -->
    <div
      v-if="expenseDiscrepanciesModalVisible"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      @click.self="closeExpenseDiscrepanciesModal"
    >
      <div class="relative max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-lg bg-white shadow-xl dark:bg-gray-800">
        <button
          type="button"
          class="absolute right-3 top-3 text-gray-500 hover:text-gray-700 dark:text-gray-400"
          @click="closeExpenseDiscrepanciesModal"
        >
          ✕
        </button>
        <div class="p-6">
          <h3 class="mb-4 text-xl font-bold text-gray-900 dark:text-white">Budget Discrepancies</h3>
          <div class="overflow-x-auto overflow-y-auto max-h-[calc(90vh-140px)]">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead class="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Rocket Money Name</th>
                  <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Amount</th>
                  <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Day</th>
                  <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Expenses App Name</th>
                  <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Amount</th>
                  <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Day</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                <tr
                  v-for="(item, index) in budgetDiscrepancies"
                  :key="'bd-' + index"
                  :class="{ 'bg-red-100 dark:bg-red-900/30': item.is_discrepancy }"
                >
                  <td class="px-3 py-2 text-sm">{{ item.rocket_money_title }}</td>
                  <td class="px-3 py-2 text-sm">${{ item.rocket_money_amount }}</td>
                  <td class="px-3 py-2 text-sm">{{ item.rocket_money_date }}</td>
                  <td class="px-3 py-2 text-sm">{{ item.expenses_app_title }}</td>
                  <td class="px-3 py-2 text-sm">${{ item.expenses_app_amount }}</td>
                  <td class="px-3 py-2 text-sm">{{ item.expenses_app_date }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="mt-6 flex justify-end">
            <button
              type="button"
              class="btn bg-gray-500 text-white hover:bg-gray-600"
              @click="closeExpenseDiscrepanciesModal"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
