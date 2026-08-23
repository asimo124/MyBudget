<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/api/client'

const props = defineProps({
  mode: {
    type: String,
    default: 'create',
  },
})

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const saving = ref(false)
const error = ref('')
const bills = ref([])

const form = reactive({
  title: '',
  debt_owed: '',
  credit_limit: '',
  min_payment: '',
  amount_to_principal: '',
  sort_order: '',
  milestone_order: '',
  bill_id: '',
  adjust_disposable_amount: '',
  can_update_end_date: false,
})

const isEdit = computed(() => props.mode === 'edit')
const pageTitle = computed(() => (isEdit.value ? 'Edit Loan/Card' : 'Create Loan/Card'))

async function loadBills() {
  const { data } = await api.get('/api/credit_utilization/bills.php')
  bills.value = data.bills || []
}

async function loadLoan() {
  const id = route.params.id
  const { data } = await api.get('/api/credit_utilization/get.php', { params: { id } })
  const loan = data.loan
  form.title = loan.title || ''
  form.debt_owed = loan.debt_owed
  form.credit_limit = loan.credit_limit
  form.min_payment = loan.min_payment
  form.amount_to_principal = loan.amount_to_principal
  form.sort_order = loan.sort_order
  form.milestone_order = loan.milestone_order
  form.bill_id = loan.bill_id || ''
  form.adjust_disposable_amount = loan.adjust_disposable_amount
  form.can_update_end_date = Boolean(loan.can_update_end_date)
  bills.value = data.bills || []
}

async function save() {
  saving.value = true
  error.value = ''
  try {
    if (isEdit.value) {
      const { data } = await api.post('/api/credit_utilization/update.php', {
        id: Number(route.params.id),
        title: form.title,
        debt_owed: form.debt_owed,
        credit_limit: form.credit_limit,
        min_payment: form.min_payment,
        amount_to_principal: form.amount_to_principal,
        sort_order: form.sort_order,
        milestone_order: form.milestone_order,
        bill_id: form.bill_id || 0,
        adjust_disposable_amount: form.adjust_disposable_amount,
        can_update_end_date: form.can_update_end_date ? 1 : 0,
      })
      await router.push({
        name: 'credit-utilization',
        query: { Message: data.message || 'Loan/Card has been updated.' },
      })
    } else {
      const { data } = await api.post('/api/credit_utilization/create.php', {
        title: form.title,
        debt_owed: form.debt_owed,
        credit_limit: form.credit_limit,
        min_payment: form.min_payment,
        amount_to_principal: form.amount_to_principal,
        sort_order: form.sort_order,
        milestone_order: form.milestone_order,
      })
      await router.push({
        name: 'credit-utilization',
        query: { Message: data.message || 'Loan/Card has been created.' },
      })
    }
  } catch (err) {
    error.value = err.response?.data?.message || 'Failed to save loan/card.'
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  loading.value = true
  error.value = ''
  try {
    if (isEdit.value) {
      await loadLoan()
    } else {
      await loadBills()
    }
  } catch (err) {
    error.value = err.response?.data?.message || 'Failed to load form.'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">{{ pageTitle }}</h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {{ isEdit ? 'Update loan or credit card details.' : 'Add a new loan or credit card.' }}
        </p>
      </div>
      <button
        type="button"
        class="btn bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200"
        @click="router.push({ name: 'credit-utilization' })"
      >
        Back
      </button>
    </div>

    <div
      v-if="error"
      class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
    >
      {{ error }}
    </div>

    <div class="card">
      <div class="card-body space-y-4">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">Loan/Card</label>
            <input v-model="form.title" type="text" class="form-input w-full" placeholder="Loan/Card Desc" />
          </div>
          <div>
            <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">Debt Owed</label>
            <input v-model="form.debt_owed" type="number" step="any" class="form-input w-full" />
          </div>
          <div>
            <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">Credit Limit</label>
            <input v-model="form.credit_limit" type="number" step="any" class="form-input w-full" />
          </div>
          <div>
            <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">Minimum Payment</label>
            <input v-model="form.min_payment" type="number" step="any" class="form-input w-full" />
          </div>
          <div>
            <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">Amount Goes To Principal</label>
            <input v-model="form.amount_to_principal" type="number" step="any" class="form-input w-full" />
          </div>
          <div>
            <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">Sort Order</label>
            <input v-model="form.sort_order" type="number" class="form-input w-full" placeholder="Blank allowed" />
          </div>
          <div>
            <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">Milestone Order</label>
            <input v-model="form.milestone_order" type="number" class="form-input w-full" />
          </div>

          <template v-if="isEdit">
            <div>
              <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">Vnd Bill</label>
              <select v-model="form.bill_id" class="form-input w-full">
                <option value="">— None —</option>
                <option v-for="bill in bills" :key="bill.vnd_id" :value="bill.vnd_id">
                  {{ bill.vnd_bill }}
                </option>
              </select>
            </div>
            <div>
              <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">
                Adjustment to Disposable Income
              </label>
              <input v-model="form.adjust_disposable_amount" type="number" step="any" class="form-input w-full" />
              <p class="mt-1 text-xs text-gray-500">
                Added to disposable income in addition to the minimum payment.
              </p>
            </div>
            <div class="flex items-center gap-2 pt-6">
              <input
                id="can_update_end_date"
                v-model="form.can_update_end_date"
                type="checkbox"
                class="rounded"
              />
              <label for="can_update_end_date" class="text-sm text-gray-700 dark:text-gray-300">
                Should Update End Date?
              </label>
            </div>
          </template>
        </div>

        <div class="flex flex-wrap gap-2 border-t border-gray-200 pt-4 dark:border-gray-700">
          <button
            type="button"
            class="btn bg-primary-500 text-white hover:bg-primary-600"
            :disabled="saving || loading"
            @click="save"
          >
            {{ saving ? 'Saving…' : isEdit ? 'Update' : 'Create Loan/Card' }}
          </button>
          <button
            type="button"
            class="btn bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200"
            @click="router.push({ name: 'credit-utilization' })"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
      <div class="rounded-lg bg-white px-6 py-4 shadow-lg dark:bg-gray-800">Loading…</div>
    </div>
  </div>
</template>
