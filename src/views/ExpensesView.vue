<script setup>
import { onMounted, reactive, ref } from 'vue'
import api from '@/api/client'

const expenses = ref([])
const loading = ref(false)
const saving = ref(false)
const adding = ref(false)
const mainMsg = ref('')
const mainError = ref('')
const tempMsg = ref('')
const didQueue = ref(false)
const timesRun = ref(0)
const deleteId = ref(null)
const showDeleteModal = ref(false)

const newExpense = reactive({
  vnd_bill: '',
  vnd_frequency_value: '',
  amount: '',
})

async function loadExpenses() {
  loading.value = true
  mainError.value = ''
  try {
    const { data } = await api.get('/api/expenses/list.php')
    expenses.value = (data.expenses || []).map((item) => ({
      ...item,
      watch_flag: Boolean(item.watch_flag),
    }))
  } catch (err) {
    mainError.value = err.response?.data?.message || 'Failed to load expenses.'
  } finally {
    loading.value = false
  }
}

async function updateAll() {
  saving.value = true
  mainMsg.value = ''
  mainError.value = ''
  try {
    const { data } = await api.post('/api/expenses/update.php', {
      items: expenses.value.map((item) => ({
        vnd_id: item.vnd_id,
        vnd_frequency_value: item.vnd_frequency_value,
        amount: item.amount,
        watch_flag: item.watch_flag ? 1 : 0,
      })),
    })
    mainMsg.value = data.message || 'You have updated your Future Expenses.'
    await loadExpenses()
  } catch (err) {
    mainError.value = err.response?.data?.message || 'Failed to update expenses.'
  } finally {
    saving.value = false
  }
}

async function addExpense() {
  adding.value = true
  mainMsg.value = ''
  mainError.value = ''
  try {
    const { data } = await api.post('/api/expenses/create.php', {
      vnd_bill: newExpense.vnd_bill.trim(),
      vnd_frequency_value: newExpense.vnd_frequency_value,
      amount: Number(newExpense.amount) || 0,
    })
    mainMsg.value = data.message || 'You have added a future expense.'
    newExpense.vnd_bill = ''
    newExpense.vnd_frequency_value = ''
    newExpense.amount = ''
    await loadExpenses()
  } catch (err) {
    mainError.value = err.response?.data?.message || 'Failed to add expense.'
  } finally {
    adding.value = false
  }
}

function openDelete(item) {
  deleteId.value = item.vnd_id
  showDeleteModal.value = true
}

function closeDelete() {
  deleteId.value = null
  showDeleteModal.value = false
}

async function confirmDelete() {
  if (!deleteId.value) return
  try {
    const { data } = await api.post('/api/expenses/delete.php', { vnd_id: deleteId.value })
    mainMsg.value = data.message || 'You have deleted a future expense.'
    mainError.value = ''
    closeDelete()
    await loadExpenses()
  } catch (err) {
    mainError.value = err.response?.data?.message || 'Failed to delete expense.'
  }
}

async function queueDateJob(testMode) {
  mainMsg.value = ''
  mainError.value = ''
  tempMsg.value = 'Queueing job...'
  didQueue.value = true
  timesRun.value = 0
  try {
    const { data } = await api.get(`/api/queue_date_job.php?test_mode=${testMode}`)
    if (data?.return_status === 'success') {
      checkJobsDone()
    } else {
      tempMsg.value = ''
      mainError.value = data?.error || 'Error queueing job.'
      didQueue.value = false
    }
  } catch (err) {
    tempMsg.value = ''
    mainError.value = err.response?.data?.message || 'Error queueing job.'
    didQueue.value = false
  }
}

async function checkJobsDone() {
  if (!didQueue.value) return
  try {
    const { data } = await api.get('/api/check_date_job_done.php')
    if (data?.return_status === 'done') {
      tempMsg.value = ''
      mainMsg.value = 'All jobs completed.'
      mainError.value = ''
      didQueue.value = false
    } else {
      setTimeout(checkJobsDone, 5000)
    }
  } catch {
    if (timesRun.value > 12) {
      mainError.value = 'Error checking job status. Please try again later.'
      tempMsg.value = ''
      didQueue.value = false
      return
    }
    timesRun.value += 1
    setTimeout(checkJobsDone, 5000)
  }
}

onMounted(loadExpenses)
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h2 class="text-xl font-semibold text-neutral-900 sm:text-2xl dark:text-white">
        Future Expenses
      </h2>
      <div class="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
        <button
          type="button"
          class="rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
          @click="queueDateJob(0)"
        >
          Run Dates Job
        </button>
        <button
          type="button"
          class="rounded-xl bg-danger-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-danger-700"
          @click="queueDateJob(1)"
        >
          Run Dates Job Test
        </button>
      </div>
    </div>

    <div
      v-if="mainError"
      class="rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700 dark:border-danger-800 dark:bg-danger-900/30 dark:text-danger-200"
    >
      {{ mainError }}
    </div>
    <div
      v-if="mainMsg"
      class="rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700 dark:border-success-800 dark:bg-success-900/30 dark:text-success-200"
    >
      {{ mainMsg }}
    </div>
    <div
      v-if="tempMsg"
      class="rounded-xl border border-info-200 bg-info-50 px-4 py-3 text-sm text-info-700 dark:border-info-800 dark:bg-info-900/30 dark:text-info-200"
    >
      {{ tempMsg }}
    </div>

    <div
      class="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5 dark:border-neutral-600 dark:bg-dark-2"
    >
      <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 class="text-lg font-semibold text-neutral-900 dark:text-white">Current List</h3>
        <button
          type="button"
          class="rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
          :disabled="saving || !expenses.length"
          @click="updateAll"
        >
          {{ saving ? 'Updating…' : 'Update All' }}
        </button>
      </div>

      <div v-if="loading" class="py-8 text-center text-neutral-500">Loading expenses…</div>

      <div v-else-if="!expenses.length" class="py-8 text-center text-neutral-500">
        No future expenses yet.
      </div>

      <!-- Mobile cards -->
      <div v-else class="space-y-3 md:hidden">
        <div
          v-for="item in expenses"
          :key="`m-${item.vnd_id}`"
          class="rounded-xl border border-neutral-200 p-3 dark:border-neutral-600"
        >
          <p class="mb-3 font-semibold text-neutral-900 dark:text-white">{{ item.vnd_bill }}</p>
          <div class="mb-3 space-y-2">
            <div>
              <label class="mb-1 block text-xs text-neutral-500">Date</label>
              <input
                v-model="item.vnd_frequency_value"
                type="text"
                placeholder="YYYY-MM-DD"
                class="form-control h-10 rounded-lg px-3 text-sm"
              />
            </div>
            <div>
              <label class="mb-1 block text-xs text-neutral-500">Amount</label>
              <input
                v-model="item.amount"
                type="number"
                step="0.01"
                class="form-control h-10 rounded-lg px-3 text-sm"
              />
            </div>
            <label class="inline-flex items-center gap-2 text-sm">
              <input v-model="item.watch_flag" type="checkbox" class="rounded" />
              Watched
            </label>
          </div>
          <button
            type="button"
            class="w-full rounded-lg bg-danger-600 px-3 py-2 text-xs font-medium text-white hover:bg-danger-700"
            @click="openDelete(item)"
          >
            Delete
          </button>
        </div>
      </div>

      <!-- Desktop table -->
      <div v-if="expenses.length" class="hidden overflow-x-auto md:block">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-neutral-50 text-neutral-600 dark:bg-dark-3 dark:text-neutral-300">
            <tr>
              <th class="px-4 py-3 font-medium">Description</th>
              <th class="px-4 py-3 font-medium">Date</th>
              <th class="px-4 py-3 font-medium">Amount</th>
              <th class="px-4 py-3 font-medium">Watched</th>
              <th class="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in expenses"
              :key="item.vnd_id"
              class="border-t border-neutral-100 dark:border-neutral-700"
            >
              <td class="px-4 py-3 align-middle font-medium text-neutral-900 dark:text-white">
                {{ item.vnd_bill }}
              </td>
              <td class="px-4 py-3 align-middle">
                <input
                  v-model="item.vnd_frequency_value"
                  type="text"
                  placeholder="YYYY-MM-DD"
                  class="form-control h-10 max-w-[11rem] rounded-lg px-3"
                />
              </td>
              <td class="px-4 py-3 align-middle">
                <input
                  v-model="item.amount"
                  type="number"
                  step="0.01"
                  class="form-control h-10 max-w-[8rem] rounded-lg px-3"
                />
              </td>
              <td class="px-4 py-3 align-middle">
                <label class="inline-flex items-center gap-2">
                  <input v-model="item.watch_flag" type="checkbox" class="rounded" />
                  Watched
                </label>
              </td>
              <td class="px-4 py-3 align-middle">
                <button
                  type="button"
                  class="rounded-lg bg-danger-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-danger-700"
                  @click="openDelete(item)"
                >
                  Delete
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div
      class="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5 dark:border-neutral-600 dark:bg-dark-2"
    >
      <h3 class="mb-4 text-lg font-semibold text-neutral-900 dark:text-white">
        Add Future Expense
      </h3>
      <form class="space-y-4" @submit.prevent="addExpense">
        <div class="grid gap-4 sm:grid-cols-3">
          <div class="sm:col-span-1">
            <label class="mb-1.5 block text-sm font-medium" for="vnd_bill">Desc</label>
            <input
              id="vnd_bill"
              v-model="newExpense.vnd_bill"
              type="text"
              required
              class="form-control h-11 rounded-xl px-3"
              placeholder="Description"
            />
          </div>
          <div>
            <label class="mb-1.5 block text-sm font-medium" for="vnd_frequency_value">Date</label>
            <input
              id="vnd_frequency_value"
              v-model="newExpense.vnd_frequency_value"
              type="date"
              required
              class="form-control h-11 rounded-xl px-3"
            />
          </div>
          <div>
            <label class="mb-1.5 block text-sm font-medium" for="amount">Amount</label>
            <input
              id="amount"
              v-model="newExpense.amount"
              type="number"
              step="0.01"
              required
              class="form-control h-11 rounded-xl px-3"
              placeholder="0.00"
            />
          </div>
        </div>
        <button
          type="submit"
          class="w-full rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700 sm:w-auto disabled:opacity-60"
          :disabled="adding"
        >
          {{ adding ? 'Adding…' : 'Add' }}
        </button>
      </form>
    </div>

    <div
      v-if="showDeleteModal"
      class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      @click.self="closeDelete"
    >
      <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-dark-2">
        <h5 class="mb-2 text-lg font-semibold text-neutral-900 dark:text-white">Delete Expense</h5>
        <p class="mb-6 text-neutral-600 dark:text-neutral-300">
          Are you sure you wish to delete this future expense?
        </p>
        <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            class="rounded-xl border border-neutral-300 px-4 py-2.5 text-sm dark:border-neutral-600"
            @click="closeDelete"
          >
            Close
          </button>
          <button
            type="button"
            class="rounded-xl bg-danger-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-danger-700"
            @click="confirmDelete"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
