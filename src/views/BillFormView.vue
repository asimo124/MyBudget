<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/api/client'

const props = defineProps({
  mode: {
    type: String,
    default: 'create', // create | edit
  },
})

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const saving = ref(false)
const error = ref('')
const message = ref('')

const form = reactive({
  vnd_bill: '',
  amount: '',
  vnd_is_auto: false,
  vnd_frequency: 'Once Per Month',
  vnd_frequency_type: 'Day of Month',
  vnd_frequency_value_original: '',
  vnd_frequency_value: '',
  can_be_multiplied_by: 1,
  start_date: '',
  end_date: '',
  vnd_frequency_notes: '',
})

const isEdit = computed(() => props.mode === 'edit')
const pageTitle = computed(() => (isEdit.value ? 'Edit Bill' : 'Create Bill'))
const showFrequencyOriginal = computed(() => form.vnd_frequency === 'Once Per Month')

const frequencyOptions = [
  'Once Per Month',
  'Every 4 Weeks',
  'Every 2 Weeks',
  'Every 1 Week',
]

function computeFrequencyValueFromOriginal(raw) {
  const day2 = parseInt(raw, 10)
  if (Number.isNaN(day2)) return ''
  let day3
  if (day2 <= 14) {
    day3 = day2 + 5
    if (day3 > 14) day3 = 14
  } else {
    day3 = day2 + 5
    if (day3 > 31) day3 = 28
  }
  return String(day3)
}

watch(
  () => form.vnd_frequency,
  (val, oldVal) => {
    if (oldVal === undefined) return
    if (val !== 'Once Per Month') {
      form.vnd_frequency_value_original = ''
    }
  }
)

watch(
  () => form.vnd_frequency_value_original,
  (val) => {
    if (!showFrequencyOriginal.value) return
    const computed = computeFrequencyValueFromOriginal(val)
    if (computed !== '') {
      form.vnd_frequency_value = computed
    }
  }
)

function normalizeFrequencyForSelect(bill) {
  const freq = bill.vnd_frequency || ''
  if (frequencyOptions.includes(freq)) return freq
  // Legacy rows may store combined labels; map back to form options.
  if (freq.startsWith('Once Per Month')) return 'Once Per Month'
  return frequencyOptions.includes(bill.vnd_frequency_notes)
    ? bill.vnd_frequency_notes
    : 'Once Per Month'
}

async function loadBill() {
  if (!isEdit.value) return
  const id = Number(route.params.id)
  if (!id) {
    error.value = 'Invalid bill id'
    return
  }
  loading.value = true
  error.value = ''
  try {
    const { data } = await api.get('/api/bills_admin/get.php', { params: { id } })
    const bill = data.bill
    form.vnd_bill = bill.vnd_bill || ''
    form.amount = bill.amount ?? ''
    form.vnd_is_auto = Number(bill.vnd_is_auto) === 1
    form.vnd_frequency = normalizeFrequencyForSelect(bill)
    form.vnd_frequency_type = bill.vnd_frequency_type || 'Day of Month'
    form.vnd_frequency_value_original = bill.vnd_frequency_value_original || ''
    form.vnd_frequency_value = bill.vnd_frequency_value || ''
    form.can_be_multiplied_by = bill.can_be_multiplied_by || 1
    form.start_date = bill.start_date || ''
    form.end_date = bill.end_date || ''
    form.vnd_frequency_notes = bill.vnd_frequency_notes || ''
  } catch (err) {
    error.value = err.response?.data?.message || 'Failed to load bill.'
  } finally {
    loading.value = false
  }
}

function buildPayload() {
  return {
    vnd_bill: form.vnd_bill.trim(),
    amount: Number(form.amount),
    vnd_is_auto: form.vnd_is_auto ? 1 : 0,
    vnd_frequency: form.vnd_frequency,
    vnd_frequency_type: form.vnd_frequency_type,
    vnd_frequency_value: form.vnd_frequency_value,
    vnd_frequency_value_original: showFrequencyOriginal.value
      ? form.vnd_frequency_value_original
      : '',
    can_be_multiplied_by: Number(form.can_be_multiplied_by) || 1,
    start_date: form.start_date || '',
    end_date: form.end_date || '',
    vnd_frequency_notes: form.vnd_frequency_notes,
  }
}

async function onSubmit() {
  error.value = ''
  message.value = ''
  const payload = buildPayload()
  if (!payload.vnd_bill || !(payload.amount > 0)) {
    error.value = 'You did not fill in all the required fields.'
    return
  }

  saving.value = true
  try {
    if (isEdit.value) {
      const id = Number(route.params.id)
      const { data } = await api.post('/api/bills_admin/update.php', { ...payload, id })
      message.value = data.message || 'Bill has been updated.'
    } else {
      const { data } = await api.post('/api/bills_admin/create.php', payload)
      message.value = data.message || 'Bill has been created.'
    }
    router.push({
      name: 'bills-admin',
      query: { message: message.value },
    })
  } catch (err) {
    error.value = err.response?.data?.message || 'Save failed.'
  } finally {
    saving.value = false
  }
}

onMounted(loadBill)
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-4">
    <div class="flex items-center justify-between gap-3">
      <h2 class="text-2xl font-semibold text-neutral-900 dark:text-white">{{ pageTitle }}</h2>
      <RouterLink
        :to="{ name: 'bills-admin' }"
        class="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:border-primary-600 hover:text-primary-600 dark:border-neutral-600 dark:text-neutral-200"
      >
        Back to Bills
      </RouterLink>
    </div>

    <div
      v-if="error"
      class="rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-danger-700 dark:border-danger-800 dark:bg-danger-900/30 dark:text-danger-200"
    >
      {{ error }}
    </div>

    <div
      v-if="loading"
      class="rounded-2xl border border-neutral-200 bg-white p-8 text-center text-neutral-500 dark:border-neutral-600 dark:bg-dark-2"
    >
      Loading…
    </div>

    <form
      v-else
      class="space-y-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-600 dark:bg-dark-2"
      @submit.prevent="onSubmit"
    >
      <div class="grid gap-4 md:grid-cols-2">
        <div class="md:col-span-2">
          <label class="mb-1.5 block text-sm font-medium" for="vnd_bill">Bill</label>
          <input
            id="vnd_bill"
            v-model="form.vnd_bill"
            type="text"
            class="form-control h-11 rounded-xl px-3"
            placeholder="Bill Desc"
            required
          />
        </div>

        <div>
          <label class="mb-1.5 block text-sm font-medium" for="amount">Amount</label>
          <input
            id="amount"
            v-model="form.amount"
            type="number"
            step="0.01"
            min="0"
            class="form-control h-11 rounded-xl px-3"
            placeholder="Amount"
            required
          />
        </div>

        <div class="flex items-end pb-2">
          <label class="inline-flex items-center gap-2 text-sm">
            <input v-model="form.vnd_is_auto" type="checkbox" class="rounded" />
            Needs Monitoring
          </label>
        </div>

        <div>
          <label class="mb-1.5 block text-sm font-medium" for="vnd_frequency">Frequency</label>
          <select
            id="vnd_frequency"
            v-model="form.vnd_frequency"
            class="form-control h-11 rounded-xl px-3"
          >
            <option v-for="opt in frequencyOptions" :key="opt" :value="opt">{{ opt }}</option>
          </select>
        </div>

        <div>
          <label class="mb-1.5 block text-sm font-medium" for="vnd_frequency_type">
            Frequency Type
          </label>
          <select
            id="vnd_frequency_type"
            v-model="form.vnd_frequency_type"
            class="form-control h-11 rounded-xl px-3"
          >
            <option value="Day of Month">Day of Month</option>
            <option value="Starting From">Starting From</option>
          </select>
        </div>

        <div v-if="showFrequencyOriginal">
          <label class="mb-1.5 block text-sm font-medium" for="vnd_frequency_value_original">
            Frequency Value Original
          </label>
          <input
            id="vnd_frequency_value_original"
            v-model="form.vnd_frequency_value_original"
            type="text"
            class="form-control h-11 rounded-xl px-3"
            placeholder="Actual day"
          />
        </div>

        <div>
          <label class="mb-1.5 block text-sm font-medium" for="vnd_frequency_value">
            Frequency Value
          </label>
          <input
            id="vnd_frequency_value"
            v-model="form.vnd_frequency_value"
            type="text"
            class="form-control h-11 rounded-xl px-3"
            placeholder="Month day / start date"
          />
        </div>

        <div>
          <label class="mb-1.5 block text-sm font-medium" for="can_be_multiplied_by">
            Can Be Multiplied By
          </label>
          <input
            id="can_be_multiplied_by"
            v-model.number="form.can_be_multiplied_by"
            type="number"
            min="1"
            class="form-control h-11 rounded-xl px-3"
          />
        </div>

        <div>
          <label class="mb-1.5 block text-sm font-medium" for="start_date">Start Date</label>
          <input
            id="start_date"
            v-model="form.start_date"
            type="date"
            class="form-control h-11 rounded-xl px-3"
          />
        </div>

        <div>
          <label class="mb-1.5 block text-sm font-medium" for="end_date">End Date</label>
          <input
            id="end_date"
            v-model="form.end_date"
            type="date"
            class="form-control h-11 rounded-xl px-3"
          />
        </div>

        <div class="md:col-span-2">
          <label class="mb-1.5 block text-sm font-medium" for="vnd_frequency_notes">
            Frequency Notes
          </label>
          <input
            id="vnd_frequency_notes"
            v-model="form.vnd_frequency_notes"
            type="text"
            class="form-control h-11 rounded-xl px-3"
            placeholder="Frequency Info"
          />
        </div>
      </div>

      <div class="flex flex-wrap gap-2 pt-2">
        <button
          type="submit"
          class="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
          :disabled="saving"
        >
          {{ saving ? 'Saving…' : isEdit ? 'Update' : 'Create Bill' }}
        </button>
        <RouterLink
          :to="{ name: 'bills-admin' }"
          class="rounded-xl border border-neutral-300 px-5 py-2.5 text-sm font-medium dark:border-neutral-600"
        >
          Cancel
        </RouterLink>
      </div>
    </form>
  </div>
</template>
