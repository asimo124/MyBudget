<script setup>
import { onMounted, ref } from 'vue'
import {
  buildPayPeriods,
  emptyRow,
  loadSavedRows,
  robPeterPayPaul,
  saveRows,
} from '@/utils/disposableBalancer'

const expenseRows = ref([])
const payPeriods = ref([])
const message = ref('')
const errorMessage = ref('')

function addRow() {
  expenseRows.value.push(emptyRow())
}

function clearRows() {
  expenseRows.value = []
  addRow()
  message.value = ''
  errorMessage.value = ''
}

function saveCurrent() {
  saveRows(expenseRows.value)
  errorMessage.value = ''
  message.value = 'Rows saved successfully!'
}

function reloadPrevious() {
  const saved = loadSavedRows()
  if (saved) {
    expenseRows.value = saved
    errorMessage.value = ''
    message.value = 'Previous rows loaded.'
  } else {
    errorMessage.value = 'No saved data found!'
    message.value = ''
  }
}

function runRobPeter() {
  const result = robPeterPayPaul(expenseRows.value)
  if (!result.ok) {
    errorMessage.value = result.error
    message.value = ''
    return
  }
  expenseRows.value = result.rows
  errorMessage.value = ''
  message.value = 'Rob Peter & Pay Paul applied.'
}

onMounted(() => {
  payPeriods.value = buildPayPeriods()
  addRow()
})
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Disposable Balancer</h1>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Balance disposable income across pay periods. Data is saved in your browser only.
      </p>
    </div>

    <div
      v-if="message"
      class="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300"
    >
      {{ message }}
    </div>
    <div
      v-if="errorMessage"
      class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
    >
      {{ errorMessage }}
    </div>

    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex flex-wrap gap-2">
        <button type="button" class="btn bg-success-600 text-white hover:bg-success-700" @click="addRow">
          Add
        </button>
        <button type="button" class="btn bg-primary-600 text-white hover:bg-primary-700" @click="runRobPeter">
          Rob Peter &amp; Pay Paul
        </button>
        <button
          type="button"
          class="btn bg-neutral-200 text-neutral-800 hover:bg-neutral-300 dark:bg-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-600"
          @click="clearRows"
        >
          Clear
        </button>
      </div>
      <div class="flex flex-wrap gap-2">
        <button type="button" class="btn bg-danger-500 text-white hover:bg-danger-600" @click="saveCurrent">
          Save Current
        </button>
        <button type="button" class="btn bg-info-500 text-white hover:bg-info-600" @click="reloadPrevious">
          Reload Previous
        </button>
      </div>
    </div>

    <div class="card overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Pay Period</th>
              <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Disposable</th>
              <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Expense Amount</th>
              <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Transfer Type</th>
              <th class="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Rob Peter</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
            <tr v-for="(row, index) in expenseRows" :key="index">
              <td class="px-3 py-2">
                <select v-model="row.payPeriod" class="form-input min-w-[10rem]">
                  <option value="">Select Pay Period</option>
                  <option v-for="payPeriod in payPeriods" :key="payPeriod" :value="payPeriod">
                    {{ payPeriod }}
                  </option>
                </select>
              </td>
              <td class="px-3 py-2">
                <input v-model.number="row.disposable" type="number" step="any" class="form-input w-28" />
              </td>
              <td class="px-3 py-2">
                <input v-model.number="row.expenseAmount" type="number" step="any" class="form-input w-28" />
              </td>
              <td class="px-3 py-2">
                <select v-model="row.transferType" class="form-input min-w-[7rem]">
                  <option value="">None</option>
                  <option value="Peter">Peter</option>
                  <option value="Paul">Paul</option>
                </select>
              </td>
              <td class="px-3 py-2">
                <input v-model.number="row.robPeter" type="number" step="any" class="form-input w-28" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
