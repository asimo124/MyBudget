<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import api from '@/api/client'

const activeTab = ref('list')
const loading = ref(false)
const mainMsg = ref('')
const mainError = ref('')

const foods = ref([])
const foodsGeneral = ref([])
const foodLog = ref([])
const foodSearchTitle = ref('')

const showLogModal = ref(false)
const showGeneralCreateModal = ref(false)
const showGeneralEditModal = ref(false)
const addLogError = ref('')
const addGeneralError = ref('')
const editGeneralError = ref('')

const foodItem = reactive({
  food_id: 0,
  food_general_id: 0,
  date_consumed: todayMdY(),
})

const foodGeneralCreate = reactive({ title: '' })
const foodGeneralEdit = reactive({ id: 0, title: '' })

const foodsSortedByTitle = computed(() =>
  [...foods.value].sort((a, b) => String(a.title).localeCompare(String(b.title)))
)

function todayMdY() {
  const d = new Date()
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`
}

function mdYToInputValue(mdY) {
  const match = String(mdY || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!match) return ''
  return `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`
}

function inputValueToMdY(ymd) {
  if (!ymd) return ''
  const [y, m, d] = String(ymd).split('-')
  if (!y || !m || !d) return ''
  return `${m}/${d}/${y}`
}

const dateConsumedInput = computed({
  get: () => mdYToInputValue(foodItem.date_consumed),
  set: (val) => {
    foodItem.date_consumed = inputValueToMdY(val) || todayMdY()
  },
})

function inflammationStyle(isInflammation) {
  return {
    color: isInflammation ? 'red' : 'orange',
    fontWeight: 'bold',
  }
}

async function loadFoodSensitivities() {
  try {
    const { data } = await api.get('/api/loadFoodSensitivities.php', {
      params: { title: foodSearchTitle.value },
    })
    foods.value = data.items || []
  } catch {
    foods.value = []
  }
}

async function loadFoodGeneral() {
  try {
    const { data } = await api.get('/api/loadFoodSensitivitiesGeneral.php')
    foodsGeneral.value = data.items || []
  } catch {
    foodsGeneral.value = []
  }
}

async function loadFoodLog() {
  try {
    const { data } = await api.get('/api/loadFoodLog.php')
    foodLog.value = data.items || []
  } catch {
    foodLog.value = []
  }
}

async function bootstrapData() {
  loading.value = true
  mainError.value = ''
  try {
    await Promise.all([loadFoodSensitivities(), loadFoodGeneral(), loadFoodLog()])
  } catch {
    mainError.value = 'Failed to load food sensitivities.'
  } finally {
    loading.value = false
  }
}

function onFoodSelect() {
  foodItem.food_general_id = 0
}

function onGeneralSelect() {
  foodItem.food_id = 0
}

function openFoodLogModal() {
  foodItem.food_id = 0
  foodItem.food_general_id = 0
  foodItem.date_consumed = todayMdY()
  addLogError.value = ''
  showLogModal.value = true
}

function closeFoodLogModal() {
  showLogModal.value = false
  addLogError.value = ''
}

async function addFoodLogItem() {
  addLogError.value = ''
  try {
    const { data } = await api.post('/api/addFoodLogItem.php', {
      food_id: Number(foodItem.food_id) || 0,
      food_general_id: Number(foodItem.food_general_id) || 0,
      consumed_date: foodItem.date_consumed,
    })
    if (data?.item) {
      closeFoodLogModal()
      await loadFoodLog()
      mainMsg.value = 'Food consumption logged.'
    }
  } catch (err) {
    addLogError.value = err.response?.data?.message || 'Failed to add food consumption.'
  }
}

function openAddFoodGeneralModal() {
  foodGeneralCreate.title = ''
  addGeneralError.value = ''
  showGeneralCreateModal.value = true
}

function closeGeneralCreateModal() {
  showGeneralCreateModal.value = false
  addGeneralError.value = ''
}

async function addFoodGeneralItem() {
  addGeneralError.value = ''
  try {
    const { data } = await api.post('/api/addFoodLogGeneralItem.php', {
      title: foodGeneralCreate.title,
    })
    if (data?.item) {
      closeGeneralCreateModal()
      await loadFoodGeneral()
      mainMsg.value = 'Food general item created.'
    }
  } catch (err) {
    addGeneralError.value = err.response?.data?.message || 'Failed to create item.'
  }
}

function openEditFoodGeneralModal(food) {
  foodGeneralEdit.id = food.id
  foodGeneralEdit.title = food.title
  editGeneralError.value = ''
  showGeneralEditModal.value = true
}

function closeGeneralEditModal() {
  showGeneralEditModal.value = false
  editGeneralError.value = ''
}

async function editFoodGeneralItem() {
  editGeneralError.value = ''
  try {
    const { data } = await api.post('/api/editFoodLogGeneralItem.php', {
      id: foodGeneralEdit.id,
      title: foodGeneralEdit.title,
    })
    if (data?.item) {
      closeGeneralEditModal()
      await loadFoodGeneral()
      mainMsg.value = 'Food general item updated.'
    }
  } catch (err) {
    editGeneralError.value = err.response?.data?.message || 'Failed to update item.'
  }
}

async function removeFoodLogGeneralItem(foodId) {
  mainError.value = ''
  try {
    const { data } = await api.post('/api/removeFoodLogGeneralItem.php', { food_id: foodId })
    if (data?.success) {
      await loadFoodGeneral()
      mainMsg.value = 'Food general item deleted.'
    }
  } catch (err) {
    mainError.value = err.response?.data?.message || 'Failed to delete item.'
  }
}

async function removeFoodLogItem(foodId) {
  mainError.value = ''
  try {
    const { data } = await api.post('/api/removeFoodLogItem.php', { food_id: foodId })
    if (data?.success) {
      await loadFoodLog()
      mainMsg.value = 'Food log entry deleted.'
    }
  } catch (err) {
    mainError.value = err.response?.data?.message || 'Failed to delete log entry.'
  }
}

onMounted(() => {
  bootstrapData()
})
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Food Sensitivities</h1>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Browse sensitivity foods, log consumption, and manage general food items.
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
          type="button"
          class="border-b-2 px-1 py-3 text-sm font-medium"
          :class="
            activeTab === 'list'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
          "
          @click="activeTab = 'list'"
        >
          Food List
        </button>
        <button
          type="button"
          class="border-b-2 px-1 py-3 text-sm font-medium"
          :class="
            activeTab === 'history'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
          "
          @click="activeTab = 'history'"
        >
          Food History
        </button>
        <button
          type="button"
          class="border-b-2 px-1 py-3 text-sm font-medium"
          :class="
            activeTab === 'general'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
          "
          @click="activeTab = 'general'"
        >
          Food General
        </button>
      </nav>
    </div>

    <!-- Food List -->
    <div v-show="activeTab === 'list'" class="space-y-4">
      <input
        v-model="foodSearchTitle"
        type="text"
        placeholder="Search by Title"
        class="form-input max-w-md"
        @input="loadFoodSensitivities"
      />

      <div class="card overflow-hidden">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Title</th>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Is Inflammation</th>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">
                  Percentage Towards Inflammation
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <tr v-if="!loading && !foods.length">
                <td colspan="3" class="px-3 py-6 text-center text-sm text-gray-500">No foods found.</td>
              </tr>
              <tr v-for="food in foods" :key="food.id">
                <td class="px-3 py-2 text-sm font-medium text-gray-900 dark:text-white">{{ food.title }}</td>
                <td class="px-3 py-2 text-sm" :style="inflammationStyle(food.is_inflammation)">
                  {{ food.is_inflammation ? 'Yes' : 'No' }}
                </td>
                <td class="px-3 py-2 text-sm">{{ food.percentage_towards_inflammation }}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Food History -->
    <div v-show="activeTab === 'history'" class="space-y-4">
      <button type="button" class="btn bg-primary-500 text-white hover:bg-primary-600" @click="openFoodLogModal">
        Add Food Consumption
      </button>

      <div class="card overflow-hidden">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Title</th>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Last Eaten Date</th>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Is Inflammation</th>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">
                  Percentage Towards Inflammation
                </th>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <tr v-if="!loading && !foodLog.length">
                <td colspan="5" class="px-3 py-6 text-center text-sm text-gray-500">No history yet.</td>
              </tr>
              <tr v-for="food in foodLog" :key="food.id">
                <td class="px-3 py-2 text-sm font-medium text-gray-900 dark:text-white">{{ food.title }}</td>
                <td class="px-3 py-2 text-sm">{{ food.consumed_date }}</td>
                <td class="px-3 py-2 text-sm" :style="inflammationStyle(food.is_inflammation)">
                  {{ food.is_inflammation ? 'Yes' : 'No' }}
                </td>
                <td class="px-3 py-2 text-sm">{{ food.percentage_towards_inflammation }}%</td>
                <td class="px-3 py-2 text-sm">
                  <button
                    type="button"
                    class="btn bg-red-500 px-2 py-1 text-xs text-white hover:bg-red-600"
                    @click="removeFoodLogItem(food.id)"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Food General -->
    <div v-show="activeTab === 'general'" class="space-y-4">
      <button type="button" class="btn bg-primary-500 text-white hover:bg-primary-600" @click="openAddFoodGeneralModal">
        Add Food General
      </button>

      <div class="card max-w-xl overflow-hidden">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Title</th>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <tr v-if="!loading && !foodsGeneral.length">
                <td colspan="2" class="px-3 py-6 text-center text-sm text-gray-500">No general foods yet.</td>
              </tr>
              <tr v-for="food in foodsGeneral" :key="food.id">
                <td class="px-3 py-2 text-sm font-medium text-gray-900 dark:text-white">{{ food.title }}</td>
                <td class="whitespace-nowrap px-3 py-2 text-sm">
                  <button
                    type="button"
                    class="btn mr-1 bg-gray-200 px-2 py-1 text-xs text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                    @click="openEditFoodGeneralModal(food)"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    class="btn bg-red-500 px-2 py-1 text-xs text-white hover:bg-red-600"
                    @click="removeFoodLogGeneralItem(food.id)"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Add food log modal -->
    <div
      v-if="showLogModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      @click.self="closeFoodLogModal"
    >
      <div class="w-full max-w-lg rounded-lg bg-white shadow-xl dark:bg-gray-800">
        <div class="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Add Food Consumption</h3>
        </div>
        <div class="space-y-4 px-6 py-4">
          <div
            v-if="addLogError"
            class="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
          >
            {{ addLogError }}
          </div>
          <div>
            <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">Food Sensitivity</label>
            <select
              v-model.number="foodItem.food_id"
              class="form-input w-full"
              @change="onFoodSelect"
            >
              <option :value="0">-- Select Food --</option>
              <option v-for="food in foodsSortedByTitle" :key="food.id" :value="food.id">
                {{ food.title }}
              </option>
            </select>
          </div>
          <div>
            <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">Food Sensitivity General</label>
            <select
              v-model.number="foodItem.food_general_id"
              class="form-input w-full"
              @change="onGeneralSelect"
            >
              <option :value="0">-- Select General Food --</option>
              <option v-for="food in foodsGeneral" :key="food.id" :value="food.id">
                {{ food.title }}
              </option>
            </select>
          </div>
          <div>
            <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">Date Consumed</label>
            <input v-model="dateConsumedInput" type="date" class="form-input w-full" />
          </div>
        </div>
        <div class="flex justify-end gap-2 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
          <button
            type="button"
            class="btn bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
            @click="closeFoodLogModal"
          >
            Cancel
          </button>
          <button type="button" class="btn bg-primary-500 text-white hover:bg-primary-600" @click="addFoodLogItem">
            Create
          </button>
        </div>
      </div>
    </div>

    <!-- Create general modal -->
    <div
      v-if="showGeneralCreateModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      @click.self="closeGeneralCreateModal"
    >
      <div class="w-full max-w-md rounded-lg bg-white shadow-xl dark:bg-gray-800">
        <div class="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Add Food General</h3>
        </div>
        <div class="px-6 py-4">
          <div
            v-if="addGeneralError"
            class="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
          >
            {{ addGeneralError }}
          </div>
          <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">Food General</label>
          <input v-model="foodGeneralCreate.title" type="text" class="form-input w-full" />
        </div>
        <div class="flex justify-end gap-2 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
          <button
            type="button"
            class="btn bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
            @click="closeGeneralCreateModal"
          >
            Cancel
          </button>
          <button type="button" class="btn bg-primary-500 text-white hover:bg-primary-600" @click="addFoodGeneralItem">
            Create
          </button>
        </div>
      </div>
    </div>

    <!-- Edit general modal -->
    <div
      v-if="showGeneralEditModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      @click.self="closeGeneralEditModal"
    >
      <div class="w-full max-w-md rounded-lg bg-white shadow-xl dark:bg-gray-800">
        <div class="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Edit Food General</h3>
        </div>
        <div class="px-6 py-4">
          <div
            v-if="editGeneralError"
            class="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
          >
            {{ editGeneralError }}
          </div>
          <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">Food General</label>
          <input v-model="foodGeneralEdit.title" type="text" class="form-input w-full" />
        </div>
        <div class="flex justify-end gap-2 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
          <button
            type="button"
            class="btn bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
            @click="closeGeneralEditModal"
          >
            Cancel
          </button>
          <button type="button" class="btn bg-primary-500 text-white hover:bg-primary-600" @click="editFoodGeneralItem">
            Update
          </button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="fixed inset-0 z-40 flex items-center justify-center bg-black/20">
      <div class="rounded-lg bg-white px-6 py-4 shadow-lg dark:bg-gray-800">Loading…</div>
    </div>
  </div>
</template>
