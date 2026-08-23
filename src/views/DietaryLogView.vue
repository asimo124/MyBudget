<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import api from '@/api/client'

const API = {
  foods: '/api/dietlog_foods.php',
  log: '/api/dietlog_log.php',
  lookups: '/api/dietlog_lookups.php',
  foodCreate: '/api/dietlog_food_create.php',
  foodUpdate: '/api/dietlog_food_update.php',
  entryCreate: '/api/dietlog_entry_create.php',
  entryUpdate: '/api/dietlog_entry_update.php',
  foodDelete: '/api/dietlog_food_delete.php',
  entryDelete: '/api/dietlog_entry_delete.php',
  suggestedMeal: '/api/dietlog_suggested_meal.php',
  addOatmeal: '/api/dietlog/add_oatmeal.php',
}

function todayYmd() {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}

const activeTab = ref('log')
const loading = ref(false)
const loadError = ref(false)
const mainMsg = ref('')

const foods = ref([])
const logByDate = ref({})
const macros = ref([])
const types = ref([])
const units_of_measure = ref([])
const meals_of_day = ref([])

const showFoodModal = ref(false)
const showLogModal = ref(false)
const showConfirmModal = ref(false)
const editingFoodId = ref(null)
const editingLogId = ref(null)
const confirmDeleteType = ref(null)
const pendingDeleteId = ref(null)
const pendingBulkLogIds = ref(null)
const selectedLogIds = ref([])

const newFood = reactive({
  title: '',
  macro_type_id: '',
  type_id: 1,
  is_cruciferous: 0,
  has_fiber: 0,
  percent_fiber: 0,
  percent_soluble_fiber: 0,
  unit_of_measure_id: '',
  default_amount: 0,
})

const newLog = reactive({
  food_id: '',
  amount: 0,
  date_consumed: todayYmd(),
  meal_of_day_id: '',
})

const sortedLogDates = computed(() => Object.keys(logByDate.value).sort().reverse())

const foodsByMacro = computed(() => {
  const groups = {}
  for (const f of foods.value) {
    const key = f.macro_type || 'Other'
    if (!groups[key]) groups[key] = []
    groups[key].push(f)
  }
  return groups
})

const confirmMessage = computed(() => {
  if (confirmDeleteType.value === 'log_bulk' && pendingBulkLogIds.value) {
    const n = pendingBulkLogIds.value.length
    return `Are you sure you want to delete ${n} selected log ${n === 1 ? 'entry' : 'entries'}? This cannot be undone.`
  }
  if (confirmDeleteType.value === 'log') {
    return 'Are you sure you want to delete this log entry? This cannot be undone.'
  }
  if (confirmDeleteType.value === 'food') {
    return 'Are you sure you want to delete this food? This cannot be undone.'
  }
  return ''
})

const foodModalTitle = computed(() => (editingFoodId.value ? 'Edit Food' : 'Create Food'))
const foodModalSaveLabel = computed(() => (editingFoodId.value ? 'Save' : 'Create'))
const logModalTitle = computed(() => (editingLogId.value ? 'Edit Log Entry' : 'Log Food Consumed'))
const logModalSaveLabel = computed(() => (editingLogId.value ? 'Save' : 'Create'))

function formatLogHeading(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`)
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function formatFiberTotal(n) {
  const v = parseFloat(n)
  if (Number.isNaN(v)) return '0.00'
  return v.toFixed(2)
}

function stepNumeric(obj, key, direction, min, max, step) {
  let v = parseFloat(obj[key])
  if (Number.isNaN(v)) v = min
  v += direction * step
  let snapped = min + Math.round((v - min) / step) * step
  if (snapped < min) snapped = min
  if (snapped > max) snapped = max
  const stepDecimals = (String(step).split('.')[1] || '').length
  obj[key] = stepDecimals > 0 ? Number(snapped.toFixed(stepDecimals)) : Math.round(snapped)
}

function mapLogResponse(data) {
  logByDate.value = data?.by_date ? data.by_date : {}
}

function applyDefaultAmountFromFood() {
  if (editingLogId.value) return
  const food = foods.value.find((f) => f.id == newLog.food_id)
  if (food && food.default_amount != null) {
    newLog.amount = parseFloat(food.default_amount)
  }
}

function resetNewFoodForm() {
  Object.assign(newFood, {
    title: '',
    macro_type_id: '',
    type_id: types.value[0]?.id ?? 1,
    is_cruciferous: 0,
    has_fiber: 0,
    percent_fiber: 0,
    percent_soluble_fiber: 0,
    unit_of_measure_id: units_of_measure.value[0]?.id ?? '',
    default_amount: 0,
  })
}

async function bootstrapData() {
  loading.value = true
  loadError.value = false
  try {
    const [foodsRes, logRes, lookRes] = await Promise.all([
      api.get(API.foods),
      api.get(API.log),
      api.get(API.lookups),
    ])
    foods.value = foodsRes.data?.foods || []
    mapLogResponse(logRes.data)
    pruneSelectedLogIds()
    if (lookRes.data) {
      macros.value = lookRes.data.macros || []
      types.value = lookRes.data.types || []
      units_of_measure.value = lookRes.data.units_of_measure || []
      meals_of_day.value = lookRes.data.meals_of_day || []
      if (newFood.type_id && !types.value.some((t) => t.id == newFood.type_id)) {
        newFood.type_id = types.value[0]?.id ?? ''
      }
      if (!newFood.unit_of_measure_id && units_of_measure.value[0]) {
        newFood.unit_of_measure_id = units_of_measure.value[0].id
      }
      if (!newLog.meal_of_day_id && meals_of_day.value[0]) {
        newLog.meal_of_day_id = meals_of_day.value[0].id
      }
    }
  } catch {
    loadError.value = true
  } finally {
    loading.value = false
  }
}

function openCreateFoodModal() {
  editingFoodId.value = null
  resetNewFoodForm()
  showFoodModal.value = true
}

function openEditFood(food) {
  const pf = parseFloat(food.percent_fiber) || 0
  const psf = parseFloat(food.percent_soluble_fiber) || 0
  editingFoodId.value = food.id
  Object.assign(newFood, {
    title: food.title,
    macro_type_id: food.macro_type_id,
    type_id: food.type_id,
    is_cruciferous: parseInt(food.is_cruciferous, 10) || 0,
    has_fiber: parseInt(food.has_fiber, 10) || 0,
    percent_fiber: Math.round(pf * 10000) / 100,
    percent_soluble_fiber: Math.round(psf * 10000) / 100,
    unit_of_measure_id: food.unit_of_measure_id,
    default_amount: parseFloat(food.default_amount) || 0,
  })
  showFoodModal.value = true
}

function closeFoodModal() {
  showFoodModal.value = false
  editingFoodId.value = null
  resetNewFoodForm()
}

async function openCreateLogModal() {
  editingLogId.value = null
  let mealId = meals_of_day.value[0]?.id ?? ''
  try {
    const { data } = await api.get(API.suggestedMeal)
    if (data?.success && data.meal_of_day_id != null) {
      const sid = Number(data.meal_of_day_id)
      if (meals_of_day.value.some((m) => Number(m.id) === sid)) {
        mealId = sid
      }
    }
  } catch {
    /* ignore */
  }
  Object.assign(newLog, {
    food_id: '',
    amount: 0,
    date_consumed: todayYmd(),
    meal_of_day_id: mealId,
  })
  showLogModal.value = true
}

function openEditLog(log) {
  let ymd = ''
  if (log.date_consumed_date) {
    ymd = String(log.date_consumed_date).slice(0, 10)
  } else if (log.date_consumed) {
    ymd = String(log.date_consumed).slice(0, 10)
  }
  editingLogId.value = log.log_id
  Object.assign(newLog, {
    food_id: log.food_id,
    amount: parseFloat(log.amount_value) || 0,
    date_consumed: ymd,
    meal_of_day_id: log.meal_of_day_id,
  })
  showLogModal.value = true
}

function closeLogModal() {
  showLogModal.value = false
  editingLogId.value = null
  Object.assign(newLog, {
    food_id: '',
    amount: 0,
    date_consumed: todayYmd(),
    meal_of_day_id: meals_of_day.value[0]?.id ?? '',
  })
}

async function saveFood() {
  try {
    const payload = { ...newFood }
    if (editingFoodId.value) {
      payload.food_id = editingFoodId.value
      await api.post(API.foodUpdate, payload)
    } else {
      await api.post(API.foodCreate, payload)
    }
    closeFoodModal()
    await bootstrapData()
  } catch {
    /* ignore */
  }
}

async function saveLogEntry() {
  try {
    const payload = {
      food_id: newLog.food_id,
      amount: newLog.amount,
      date_consumed: newLog.date_consumed,
      meal_of_day_id: newLog.meal_of_day_id,
    }
    if (editingLogId.value) {
      payload.log_id = editingLogId.value
      await api.post(API.entryUpdate, payload)
    } else {
      await api.post(API.entryCreate, payload)
    }
    closeLogModal()
    await bootstrapData()
  } catch {
    /* ignore */
  }
}

async function addOatmeal(withBlueberries = false) {
  mainMsg.value = ''
  try {
    const { data } = await api.post(API.addOatmeal, withBlueberries ? { blueberries: 1 } : {})
    mainMsg.value = data.message || 'Oatmeal added.'
    await bootstrapData()
  } catch {
    /* ignore */
  }
}

function normalizeLogId(logId) {
  const n = Number(logId)
  return Number.isNaN(n) ? logId : n
}

function isLogSelected(logId) {
  const id = normalizeLogId(logId)
  return selectedLogIds.value.some((x) => normalizeLogId(x) === id)
}

function toggleLogSelection(logId) {
  const id = normalizeLogId(logId)
  const i = selectedLogIds.value.findIndex((x) => normalizeLogId(x) === id)
  if (i === -1) {
    selectedLogIds.value.push(id)
  } else {
    selectedLogIds.value.splice(i, 1)
  }
}

function logIdsForDate(dateConsumed) {
  const items = logByDate.value[dateConsumed]?.items || []
  return items.map((l) => normalizeLogId(l.log_id))
}

function allLogsSelectedForDate(dateConsumed) {
  const ids = logIdsForDate(dateConsumed)
  if (!ids.length) return false
  return ids.every((id) => isLogSelected(id))
}

function toggleSelectAllForDate(dateConsumed) {
  const ids = logIdsForDate(dateConsumed)
  if (!ids.length) return
  if (allLogsSelectedForDate(dateConsumed)) {
    selectedLogIds.value = selectedLogIds.value.filter((x) => !ids.includes(normalizeLogId(x)))
  } else {
    const set = new Set(selectedLogIds.value.map((x) => normalizeLogId(x)))
    ids.forEach((id) => set.add(id))
    selectedLogIds.value = [...set]
  }
}

function pruneSelectedLogIds() {
  const existing = new Set()
  for (const d of Object.keys(logByDate.value)) {
    for (const row of logByDate.value[d].items || []) {
      existing.add(normalizeLogId(row.log_id))
    }
  }
  selectedLogIds.value = selectedLogIds.value.filter((id) => existing.has(normalizeLogId(id)))
}

function openBulkDeleteLogConfirm() {
  if (!selectedLogIds.value.length) return
  confirmDeleteType.value = 'log_bulk'
  pendingBulkLogIds.value = selectedLogIds.value.slice()
  pendingDeleteId.value = null
  showConfirmModal.value = true
}

function openDeleteLogConfirm(logId) {
  confirmDeleteType.value = 'log'
  pendingDeleteId.value = logId
  pendingBulkLogIds.value = null
  showConfirmModal.value = true
}

function openDeleteFoodConfirm(foodId) {
  confirmDeleteType.value = 'food'
  pendingDeleteId.value = foodId
  pendingBulkLogIds.value = null
  showConfirmModal.value = true
}

function closeConfirmModal() {
  showConfirmModal.value = false
  confirmDeleteType.value = null
  pendingDeleteId.value = null
  pendingBulkLogIds.value = null
}

async function executeConfirmDelete() {
  try {
    if (confirmDeleteType.value === 'log_bulk' && pendingBulkLogIds.value?.length) {
      await Promise.all(
        pendingBulkLogIds.value.map((logId) =>
          api.post(API.entryDelete, { log_id: logId })
        )
      )
      selectedLogIds.value = []
    } else if (confirmDeleteType.value === 'log' && pendingDeleteId.value != null) {
      await api.post(API.entryDelete, { log_id: pendingDeleteId.value })
      const id = normalizeLogId(pendingDeleteId.value)
      selectedLogIds.value = selectedLogIds.value.filter((x) => normalizeLogId(x) !== id)
    } else if (confirmDeleteType.value === 'food' && pendingDeleteId.value != null) {
      await api.post(API.foodDelete, { food_id: pendingDeleteId.value })
    } else {
      return
    }
    closeConfirmModal()
    await bootstrapData()
  } catch {
    /* ignore */
  }
}

onMounted(() => {
  bootstrapData()
})
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Dietary Log</h1>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Track foods consumed and fiber intake.</p>
    </div>

    <div
      v-if="mainMsg"
      class="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300"
    >
      {{ mainMsg }}
    </div>
    <div
      v-if="loadError"
      class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
    >
      Could not load diet log data. Check the browser console or network tab.
    </div>

    <div class="border-b border-gray-200 dark:border-gray-700">
      <nav class="-mb-px flex gap-4">
        <button
          type="button"
          class="border-b-2 px-1 py-3 text-sm font-medium"
          :class="
            activeTab === 'log'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
          "
          @click="activeTab = 'log'"
        >
          Log
        </button>
        <button
          type="button"
          class="border-b-2 px-1 py-3 text-sm font-medium"
          :class="
            activeTab === 'foods'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
          "
          @click="activeTab = 'foods'"
        >
          Foods
        </button>
      </nav>
    </div>

    <!-- Log tab -->
    <div v-show="activeTab === 'log'" class="space-y-6">
      <div class="flex flex-wrap gap-2">
        <button type="button" class="btn bg-primary-500 text-white hover:bg-primary-600" @click="openCreateLogModal">
          Log Food Consumed
        </button>
        <button
          type="button"
          class="btn bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
          :disabled="selectedLogIds.length === 0"
          @click="openBulkDeleteLogConfirm"
        >
          Delete selected
        </button>
        <button type="button" class="btn bg-info-500 text-white hover:bg-info-600" @click="addOatmeal(false)">
          Add Oatmeal
        </button>
        <button type="button" class="btn bg-info-500 text-white hover:bg-info-600" @click="addOatmeal(true)">
          Add Oatmeal w/ Blueberries
        </button>
      </div>

      <p v-if="!loading && !sortedLogDates.length" class="text-sm text-gray-500">No log entries loaded.</p>

      <div v-for="dateConsumed in sortedLogDates" :key="dateConsumed" class="space-y-3">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ formatLogHeading(dateConsumed) }}</h3>
        <div class="card overflow-hidden">
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead class="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th class="w-11 px-2 py-2">
                    <input
                      type="checkbox"
                      :checked="allLogsSelectedForDate(dateConsumed)"
                      title="Select all for this day"
                      @change="toggleSelectAllForDate(dateConsumed)"
                    />
                  </th>
                  <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Meal</th>
                  <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Food</th>
                  <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Macro</th>
                  <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Amount</th>
                  <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Grams</th>
                  <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Fiber (g)</th>
                  <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Soluble (g)</th>
                  <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                <tr v-for="log in logByDate[dateConsumed].items" :key="log.log_id">
                  <td class="px-2 py-2">
                    <input
                      type="checkbox"
                      :checked="isLogSelected(log.log_id)"
                      @change="toggleLogSelection(log.log_id)"
                    />
                  </td>
                  <td class="px-3 py-2 text-sm">{{ log.meal_of_day }}</td>
                  <td class="px-3 py-2 text-sm">{{ log.food }}</td>
                  <td class="px-3 py-2 text-sm">{{ log.macro_type }}</td>
                  <td class="px-3 py-2 text-sm">{{ log.amount }}</td>
                  <td class="px-3 py-2 text-sm">{{ log.amount_grams }}</td>
                  <td class="px-3 py-2 text-sm">{{ log.fiber_amount_grams }}</td>
                  <td class="px-3 py-2 text-sm">{{ log.soluble_fiber_amount_grams }}</td>
                  <td class="whitespace-nowrap px-3 py-2 text-sm">
                    <button
                      type="button"
                      class="btn mr-1 bg-gray-200 px-2 py-1 text-xs text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                      @click="openEditLog(log)"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      class="btn bg-red-500 px-2 py-1 text-xs text-white hover:bg-red-600"
                      @click="openDeleteLogConfirm(log.log_id)"
                    >
                      X
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div class="space-y-1 text-sm font-medium text-gray-800 dark:text-gray-200">
          <p>Total Fiber: {{ formatFiberTotal(logByDate[dateConsumed].total_fiber) }} grams</p>
          <p>Total Soluble Fiber: {{ formatFiberTotal(logByDate[dateConsumed].total_soluble_fiber) }} grams</p>
          <p>Total Percent Soluble: {{ logByDate[dateConsumed].total_percent_soluble }}</p>
        </div>
      </div>
    </div>

    <!-- Foods tab -->
    <div v-show="activeTab === 'foods'" class="space-y-4">
      <button type="button" class="btn bg-primary-500 text-white hover:bg-primary-600" @click="openCreateFoodModal">
        Add Food
      </button>
      <div class="card overflow-hidden">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Title</th>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Macro Type</th>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Type</th>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <tr v-for="food in foods" :key="food.id">
                <td class="px-3 py-2 text-sm">{{ food.title }}</td>
                <td class="px-3 py-2 text-sm">{{ food.macro_type }}</td>
                <td class="px-3 py-2 text-sm">{{ food.type }}</td>
                <td class="whitespace-nowrap px-3 py-2 text-sm">
                  <button
                    type="button"
                    class="btn mr-1 bg-gray-200 px-2 py-1 text-xs text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                    @click="openEditFood(food)"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    class="btn bg-red-500 px-2 py-1 text-xs text-white hover:bg-red-600"
                    @click="openDeleteFoodConfirm(food.id)"
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

    <!-- Food modal -->
    <div
      v-if="showFoodModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      @click.self="closeFoodModal"
    >
      <div class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white shadow-xl dark:bg-gray-800">
        <div class="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ foodModalTitle }}</h3>
        </div>
        <div class="space-y-4 px-6 py-4">
          <div>
            <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">Food Title</label>
            <input v-model="newFood.title" type="text" class="form-input w-full" />
          </div>
          <div>
            <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">Macro Type</label>
            <select v-model.number="newFood.macro_type_id" class="form-input w-full">
              <option value="">— Select —</option>
              <option v-for="m in macros" :key="m.id" :value="m.id">{{ m.title }}</option>
            </select>
          </div>
          <div>
            <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">Food Type</label>
            <select v-model.number="newFood.type_id" class="form-input w-full">
              <option v-for="t in types" :key="t.id" :value="t.id">{{ t.title }}</option>
            </select>
          </div>
          <label class="flex items-center gap-2 text-sm">
            <input v-model="newFood.is_cruciferous" type="checkbox" :true-value="1" :false-value="0" class="rounded" />
            Is Cruciferous
          </label>
          <label class="flex items-center gap-2 text-sm">
            <input v-model="newFood.has_fiber" type="checkbox" :true-value="1" :false-value="0" class="rounded" />
            Has Fiber
          </label>
          <div>
            <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">Percent Fiber</label>
            <div class="flex items-center gap-2">
              <button type="button" class="dietlog-step-btn" @click="stepNumeric(newFood, 'percent_fiber', -1, 0, 100, 1)">−</button>
              <input v-model.number="newFood.percent_fiber" type="number" min="0" max="100" step="1" class="form-input flex-1 text-center" />
              <button type="button" class="dietlog-step-btn" @click="stepNumeric(newFood, 'percent_fiber', 1, 0, 100, 1)">+</button>
            </div>
          </div>
          <div>
            <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">Percent Soluble Fiber</label>
            <div class="flex items-center gap-2">
              <button type="button" class="dietlog-step-btn" @click="stepNumeric(newFood, 'percent_soluble_fiber', -1, 0, 100, 1)">−</button>
              <input v-model.number="newFood.percent_soluble_fiber" type="number" min="0" max="100" step="1" class="form-input flex-1 text-center" />
              <button type="button" class="dietlog-step-btn" @click="stepNumeric(newFood, 'percent_soluble_fiber', 1, 0, 100, 1)">+</button>
            </div>
          </div>
          <div>
            <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">Unit Of Measure</label>
            <select v-model.number="newFood.unit_of_measure_id" class="form-input w-full">
              <option v-for="u in units_of_measure" :key="u.id" :value="u.id">{{ u.title }}</option>
            </select>
          </div>
          <div>
            <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">Default Amount</label>
            <div class="flex items-center gap-2">
              <button type="button" class="dietlog-step-btn" @click="stepNumeric(newFood, 'default_amount', -1, 0, 50, 0.5)">−</button>
              <input v-model.number="newFood.default_amount" type="number" min="0" max="50" step="0.5" class="form-input flex-1 text-center" />
              <button type="button" class="dietlog-step-btn" @click="stepNumeric(newFood, 'default_amount', 1, 0, 50, 0.5)">+</button>
            </div>
          </div>
        </div>
        <div class="flex justify-end gap-2 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
          <button type="button" class="btn bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200" @click="closeFoodModal">Cancel</button>
          <button type="button" class="btn bg-primary-500 text-white hover:bg-primary-600" @click="saveFood">{{ foodModalSaveLabel }}</button>
        </div>
      </div>
    </div>

    <!-- Log entry modal -->
    <div
      v-if="showLogModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      @click.self="closeLogModal"
    >
      <div class="w-full max-w-lg rounded-lg bg-white shadow-xl dark:bg-gray-800">
        <div class="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ logModalTitle }}</h3>
        </div>
        <div class="space-y-4 px-6 py-4">
          <div>
            <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">Food Consumed</label>
            <select v-model.number="newLog.food_id" class="form-input w-full" @change="applyDefaultAmountFromFood">
              <option value="">— Select —</option>
              <optgroup v-for="(groupFoods, macroType) in foodsByMacro" :key="macroType" :label="macroType">
                <option v-for="f in groupFoods" :key="f.id" :value="f.id">
                  {{ f.title_display || f.title }}
                </option>
              </optgroup>
            </select>
          </div>
          <div>
            <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">Amount</label>
            <div class="flex items-center gap-2">
              <button type="button" class="dietlog-step-btn" @click="stepNumeric(newLog, 'amount', -1, 0, 100, 0.5)">−</button>
              <input v-model.number="newLog.amount" type="number" min="0" max="100" step="0.5" class="form-input flex-1 text-center" />
              <button type="button" class="dietlog-step-btn" @click="stepNumeric(newLog, 'amount', 1, 0, 100, 0.5)">+</button>
            </div>
          </div>
          <div>
            <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">Date Consumed</label>
            <input v-model="newLog.date_consumed" type="date" class="form-input w-full" />
          </div>
          <div>
            <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">Meal of Day</label>
            <select v-model.number="newLog.meal_of_day_id" class="form-input w-full">
              <option v-for="meal in meals_of_day" :key="meal.id" :value="meal.id">{{ meal.title }}</option>
            </select>
          </div>
        </div>
        <div class="flex justify-end gap-2 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
          <button type="button" class="btn bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200" @click="closeLogModal">Cancel</button>
          <button type="button" class="btn bg-primary-500 text-white hover:bg-primary-600" @click="saveLogEntry">{{ logModalSaveLabel }}</button>
        </div>
      </div>
    </div>

    <!-- Confirm delete modal -->
    <div
      v-if="showConfirmModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      @click.self="closeConfirmModal"
    >
      <div class="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Are you sure?</h3>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-300">{{ confirmMessage }}</p>
        <div class="mt-6 flex justify-end gap-2">
          <button type="button" class="btn bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200" @click="closeConfirmModal">Cancel</button>
          <button type="button" class="btn bg-red-500 text-white hover:bg-red-600" @click="executeConfirmDelete">Delete</button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="fixed inset-0 z-40 flex items-center justify-center bg-black/20">
      <div class="rounded-lg bg-white px-6 py-4 shadow-lg dark:bg-gray-800">Loading…</div>
    </div>
  </div>
</template>

<style scoped>
.dietlog-step-btn {
  min-width: 44px;
  min-height: 44px;
  border-radius: 0.5rem;
  border: 1px solid rgb(209 213 219);
  background: rgb(249 250 251);
  font-size: 1.25rem;
  font-weight: 600;
  line-height: 1;
  touch-action: manipulation;
  user-select: none;
}
.dark .dietlog-step-btn {
  border-color: rgb(75 85 99);
  background: rgb(31 41 55);
  color: rgb(229 231 235);
}
</style>
