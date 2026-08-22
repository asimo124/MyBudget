<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/api/client'

const route = useRoute()
const router = useRouter()

const FREQUENCY_OPTIONS = [
  'Once Per Month - Day of Month',
  'Once',
  'Every 1 Week',
  'Every 2 Weeks',
  'Every 4 Weeks',
  'Once Per Month - Starting From',
  'Every 3 Months',
]

const filters = reactive({
  vnd_bill2: '',
  sort1: 'bill',
  sort1_dir: 'ASC',
  sort2: '',
  sort2_dir: 'ASC',
  showAuditFields: false,
  multiplierGreaterThan1: false,
  frequency: Object.fromEntries(FREQUENCY_OPTIONS.map((f) => [f, true])),
})

const groups = ref({})
const loading = ref(false)
const mainMsg = ref('')
const mainError = ref('')
const tempMsg = ref('')
const didQueue = ref(false)
const timesRun = ref(0)
const deleteId = ref(null)
const showDeleteModal = ref(false)
const savingAudit = ref(false)

const groupEntries = computed(() => Object.entries(groups.value))

const allFrequenciesChecked = computed({
  get() {
    return FREQUENCY_OPTIONS.every((f) => filters.frequency[f])
  },
  set(val) {
    FREQUENCY_OPTIONS.forEach((f) => {
      filters.frequency[f] = val
    })
  },
})

function billNameClass(bill) {
  if (bill.watch_flag) return 'text-warning-600 font-semibold'
  if (bill.is_heavy) return 'text-danger-600 font-semibold'
  return 'font-semibold text-neutral-900 dark:text-white'
}

function multiplierColor(multiplier) {
  if (Number(multiplier) === 4) return 'text-[#8252E9]'
  if (Number(multiplier) === 2) return 'text-primary-600'
  return 'text-neutral-700 dark:text-neutral-300'
}

function frequencyInfo(bill) {
  if (bill.vnd_frequency_type !== 'Day of Month') {
    return `${bill.vnd_frequency_type || ''} (${bill.vnd_frequency_value ?? ''})`
  }
  return bill.vnd_frequency_value ?? ''
}

function buildPayload() {
  return {
    vnd_bill2: filters.vnd_bill2,
    sort1: filters.sort1,
    sort1_dir: filters.sort1_dir,
    sort2: filters.sort2,
    sort2_dir: filters.sort2_dir,
    showAuditFields: filters.showAuditFields ? 1 : 0,
    multiplierGreaterThan1: filters.multiplierGreaterThan1 ? 1 : 0,
    frequency: Object.fromEntries(
      FREQUENCY_OPTIONS.map((f) => [f, filters.frequency[f] ? 1 : 0])
    ),
  }
}

async function loadBills() {
  loading.value = true
  mainError.value = ''
  try {
    const { data } = await api.post('/api/bills_admin/list.php', buildPayload())
    groups.value = data.groups || {}
  } catch (err) {
    mainError.value = err.response?.data?.message || 'Failed to load bills.'
  } finally {
    loading.value = false
  }
}

async function onSearch() {
  mainMsg.value = ''
  await loadBills()
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

async function toggleFlag(bill, flag) {
  const currentlyOn = flag === 'heavy' ? bill.is_heavy : bill.watch_flag
  const action = currentlyOn ? 'unmark' : 'mark'
  try {
    const { data } = await api.post('/api/bills_admin/update_flags.php', {
      id: bill.vnd_id,
      flag,
      action,
    })
    mainMsg.value = data.message || 'Bill has been updated.'
    mainError.value = ''
    await loadBills()
  } catch (err) {
    mainError.value = err.response?.data?.message || 'Failed to update bill.'
  }
}

function openDelete(bill) {
  deleteId.value = bill.vnd_id
  showDeleteModal.value = true
}

function closeDelete() {
  showDeleteModal.value = false
  deleteId.value = null
}

async function confirmDelete() {
  if (!deleteId.value) return
  try {
    const { data } = await api.post('/api/bills_admin/delete.php', { id: deleteId.value })
    mainMsg.value = data.message || 'You have deleted a bill.'
    mainError.value = ''
    closeDelete()
    await loadBills()
  } catch (err) {
    mainError.value = err.response?.data?.message || 'Failed to delete bill.'
  }
}

async function saveAuditFields() {
  const items = []
  for (const bills of Object.values(groups.value)) {
    for (const bill of bills) {
      items.push({
        vnd_id: bill.vnd_id,
        audit_regex: bill.audit_regex || '',
        audit_keyword1: bill.audit_keyword1 || '',
        audit_keyword2: bill.audit_keyword2 || '',
      })
    }
  }
  if (!items.length) return

  savingAudit.value = true
  try {
    const { data } = await api.post('/api/bills_admin/update_audit.php', { items })
    mainMsg.value = data.message || 'Updated audit fields.'
    mainError.value = ''
  } catch (err) {
    mainError.value = err.response?.data?.message || 'Failed to update audit fields.'
  } finally {
    savingAudit.value = false
  }
}

onMounted(async () => {
  if (route.query.message) {
    mainMsg.value = String(route.query.message)
    const nextQuery = { ...route.query }
    delete nextQuery.message
    router.replace({ query: nextQuery })
  }
  await loadBills()
})
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <h2 class="text-xl font-semibold text-neutral-900 sm:text-2xl dark:text-white">Bills</h2>
      <div class="grid grid-cols-1 gap-2 xs:grid-cols-2 sm:flex sm:flex-wrap">
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
      <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <RouterLink
          :to="{ name: 'bills-admin-create' }"
          class="inline-flex items-center justify-center rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
        >
          Create Bill
        </RouterLink>
        <button
          v-if="filters.showAuditFields"
          type="button"
          class="rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
          :disabled="savingAudit"
          @click="saveAuditFields"
        >
          {{ savingAudit ? 'Saving…' : 'Update Audit Fields' }}
        </button>
      </div>

      <form class="space-y-4" @submit.prevent="onSearch">
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <input
            v-model="filters.vnd_bill2"
            type="text"
            placeholder="Bill Name"
            class="form-control h-11 rounded-xl px-3 sm:col-span-2 lg:col-span-1"
          />
          <select v-model="filters.sort1" class="form-control h-11 rounded-xl px-3">
            <option value="">- Select Sort 1 -</option>
            <option value="bill">Bill Name</option>
            <option value="frequency">Frequency</option>
            <option value="amount">Amount</option>
            <option value="start_date">Start Date</option>
            <option value="end_date">End Date</option>
          </select>
          <select v-model="filters.sort1_dir" class="form-control h-11 rounded-xl px-3">
            <option value="ASC">ASC</option>
            <option value="DESC">DESC</option>
          </select>
          <select v-model="filters.sort2" class="form-control h-11 rounded-xl px-3">
            <option value="">- Select Sort 2 -</option>
            <option value="bill">Bill Name</option>
            <option value="frequency">Frequency</option>
            <option value="amount">Amount</option>
            <option value="start_date">Start Date</option>
            <option value="end_date">End Date</option>
          </select>
          <select v-model="filters.sort2_dir" class="form-control h-11 rounded-xl px-3">
            <option value="ASC">ASC</option>
            <option value="DESC">DESC</option>
          </select>
        </div>

        <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-6">
          <label class="inline-flex items-center gap-2 text-sm">
            <input v-model="filters.multiplierGreaterThan1" type="checkbox" class="rounded" />
            Multiplier
          </label>
          <label class="inline-flex items-center gap-2 text-sm">
            <input v-model="filters.showAuditFields" type="checkbox" class="rounded" />
            Show Audit Fields
          </label>
          <label class="inline-flex items-center gap-2 text-sm">
            <input v-model="allFrequenciesChecked" type="checkbox" class="rounded" />
            Check All
          </label>
        </div>

        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <label
            v-for="freq in FREQUENCY_OPTIONS"
            :key="freq"
            class="inline-flex items-start gap-2 text-sm text-neutral-700 dark:text-neutral-300"
          >
            <input v-model="filters.frequency[freq]" type="checkbox" class="mt-0.5 rounded" />
            <span>{{ freq }}</span>
          </label>
        </div>

        <button
          type="submit"
          class="w-full rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700 sm:w-auto"
          :disabled="loading"
        >
          {{ loading ? 'Searching…' : 'Search' }}
        </button>
      </form>
    </div>

    <div v-if="loading && !groupEntries.length" class="py-10 text-center text-neutral-500">
      Loading bills…
    </div>

    <div
      v-for="[frequency, bills] in groupEntries"
      :key="frequency"
      class="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-600 dark:bg-dark-2"
    >
      <div class="border-b border-neutral-200 px-4 py-3 sm:px-5 dark:border-neutral-600">
        <h3 class="text-base font-semibold text-neutral-900 sm:text-lg dark:text-white">
          {{ frequency }}
        </h3>
      </div>

      <!-- Mobile cards -->
      <div class="space-y-3 p-3 md:hidden">
        <div
          v-for="bill in bills"
          :key="`m-${bill.vnd_id}`"
          class="rounded-xl border border-neutral-200 p-3 dark:border-neutral-600"
        >
          <div class="mb-2 flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="text-xs text-neutral-500">#{{ bill.vnd_id }}</p>
              <p :class="billNameClass(bill)" class="break-words">
                {{ bill.vnd_bill }}
                <span
                  v-if="bill.can_be_multiplied_by > 1"
                  :class="multiplierColor(bill.can_be_multiplied_by)"
                >
                  {{ bill.can_be_multiplied_by }}x
                </span>
              </p>
            </div>
            <p v-if="!filters.showAuditFields" class="shrink-0 text-sm font-medium">
              {{ bill.amount_formatted }}
            </p>
          </div>

          <template v-if="!filters.showAuditFields">
            <dl class="mb-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-neutral-600 dark:text-neutral-300">
              <div>
                <dt class="text-neutral-400">Frequency</dt>
                <dd>{{ bill.vnd_frequency }}</dd>
              </div>
              <div>
                <dt class="text-neutral-400">Info</dt>
                <dd>{{ frequencyInfo(bill) }}</dd>
              </div>
              <div>
                <dt class="text-neutral-400">Start</dt>
                <dd>{{ bill.start_date_display || '—' }}</dd>
              </div>
              <div>
                <dt class="text-neutral-400">End</dt>
                <dd>{{ bill.end_date_display || '—' }}</dd>
              </div>
            </dl>
          </template>
          <template v-else>
            <div class="mb-3 space-y-2">
              <input
                v-model="bill.audit_regex"
                type="text"
                class="form-control h-10 rounded-lg px-3 text-sm"
                placeholder="Regex"
              />
              <input
                v-model="bill.audit_keyword1"
                type="text"
                class="form-control h-10 rounded-lg px-3 text-sm"
                placeholder="Keyword1"
              />
              <input
                v-model="bill.audit_keyword2"
                type="text"
                class="form-control h-10 rounded-lg px-3 text-sm"
                placeholder="Keyword2"
              />
            </div>
          </template>

          <div class="grid grid-cols-2 gap-2">
            <RouterLink
              :to="{ name: 'bills-admin-edit', params: { id: bill.vnd_id } }"
              class="inline-flex items-center justify-center rounded-lg bg-primary-600 px-2.5 py-2 text-xs font-medium text-white hover:bg-primary-700"
            >
              Edit
            </RouterLink>
            <button
              type="button"
              class="rounded-lg bg-primary-600 px-2.5 py-2 text-xs font-medium text-white hover:bg-primary-700"
              @click="toggleFlag(bill, 'heavy')"
            >
              {{ bill.is_heavy ? 'Un-Mark Heavy' : 'Mark Heavy' }}
            </button>
            <button
              type="button"
              class="rounded-lg bg-primary-600 px-2.5 py-2 text-xs font-medium text-white hover:bg-primary-700"
              @click="toggleFlag(bill, 'watch')"
            >
              {{ bill.watch_flag ? 'Un-Mark Watched' : 'Mark Watched' }}
            </button>
            <button
              type="button"
              class="rounded-lg bg-danger-600 px-2.5 py-2 text-xs font-medium text-white hover:bg-danger-700"
              @click="openDelete(bill)"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      <!-- Desktop table -->
      <div class="hidden overflow-x-auto md:block">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-neutral-50 text-neutral-600 dark:bg-dark-3 dark:text-neutral-300">
            <tr>
              <th class="px-4 py-3 font-medium">ID</th>
              <th class="px-4 py-3 font-medium">Bill</th>
              <template v-if="!filters.showAuditFields">
                <th class="px-4 py-3 font-medium">Amount</th>
                <th class="px-4 py-3 font-medium">Frequency</th>
                <th class="px-4 py-3 font-medium">Frequency Info</th>
                <th class="px-4 py-3 font-medium">Start Date</th>
                <th class="px-4 py-3 font-medium">End Date</th>
              </template>
              <template v-else>
                <th class="px-4 py-3 font-medium">Audit Regex</th>
                <th class="px-4 py-3 font-medium">Audit Keyword1</th>
                <th class="px-4 py-3 font-medium">Audit Keyword2</th>
              </template>
              <th class="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="bill in bills"
              :key="bill.vnd_id"
              class="border-t border-neutral-100 dark:border-neutral-700"
            >
              <td class="px-4 py-3 align-top">{{ bill.vnd_id }}</td>
              <td class="px-4 py-3 align-top">
                <span :class="billNameClass(bill)">
                  {{ bill.vnd_bill }}
                  <span
                    v-if="bill.can_be_multiplied_by > 1"
                    :class="multiplierColor(bill.can_be_multiplied_by)"
                  >
                    {{ bill.can_be_multiplied_by }}x
                  </span>
                </span>
              </td>
              <template v-if="!filters.showAuditFields">
                <td class="px-4 py-3 align-top">{{ bill.amount_formatted }}</td>
                <td class="px-4 py-3 align-top">{{ bill.vnd_frequency }}</td>
                <td class="px-4 py-3 align-top">{{ frequencyInfo(bill) }}</td>
                <td class="px-4 py-3 align-top">{{ bill.start_date_display }}</td>
                <td class="px-4 py-3 align-top">{{ bill.end_date_display }}</td>
              </template>
              <template v-else>
                <td class="px-4 py-3 align-top">
                  <input
                    v-model="bill.audit_regex"
                    type="text"
                    class="form-control h-10 rounded-lg px-3"
                    placeholder="Regex"
                  />
                </td>
                <td class="px-4 py-3 align-top">
                  <input
                    v-model="bill.audit_keyword1"
                    type="text"
                    class="form-control h-10 rounded-lg px-3"
                    placeholder="Keyword1"
                  />
                </td>
                <td class="px-4 py-3 align-top">
                  <input
                    v-model="bill.audit_keyword2"
                    type="text"
                    class="form-control h-10 rounded-lg px-3"
                    placeholder="Keyword2"
                  />
                </td>
              </template>
              <td class="px-4 py-3 align-top">
                <div class="flex flex-wrap gap-2">
                  <RouterLink
                    :to="{ name: 'bills-admin-edit', params: { id: bill.vnd_id } }"
                    class="rounded-lg bg-primary-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-primary-700"
                  >
                    Edit
                  </RouterLink>
                  <button
                    type="button"
                    class="rounded-lg bg-primary-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-primary-700"
                    @click="toggleFlag(bill, 'heavy')"
                  >
                    {{ bill.is_heavy ? 'Un-Mark Heavy' : 'Mark Heavy' }}
                  </button>
                  <button
                    type="button"
                    class="rounded-lg bg-primary-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-primary-700"
                    @click="toggleFlag(bill, 'watch')"
                  >
                    {{ bill.watch_flag ? 'Un-Mark Watched' : 'Mark Watched' }}
                  </button>
                  <button
                    type="button"
                    class="rounded-lg bg-danger-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-danger-700"
                    @click="openDelete(bill)"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div
      v-if="!loading && !groupEntries.length"
      class="rounded-2xl border border-neutral-200 bg-white p-8 text-center text-neutral-500 dark:border-neutral-600 dark:bg-dark-2"
    >
      No bills match your filters.
    </div>

    <!-- Delete modal -->
    <div
      v-if="showDeleteModal"
      class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      @click.self="closeDelete"
    >
      <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-dark-2">
        <h5 class="mb-2 text-lg font-semibold text-neutral-900 dark:text-white">Delete Bill</h5>
        <p class="mb-6 text-neutral-600 dark:text-neutral-300">
          Are you sure you wish to delete this Bill?
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
