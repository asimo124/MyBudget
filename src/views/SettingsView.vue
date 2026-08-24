<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/api/client'
import { fetchTestMode, saveTestMode } from '@/utils/testMode'

const route = useRoute()
const router = useRouter()

const testMode = ref(false)
const mainMsg = ref('')
const mainError = ref('')
const resetting = ref(false)
const savingTestMode = ref(false)
const showResetConfirm = ref(false)

const legacyBase =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || 'https://budget.hawleywebdesign.com'

const trackProgress2Url = `${legacyBase}/bills/admin/budget_track2.php?allow_blank_sort_order=1`

async function loadTestMode() {
  testMode.value = await fetchTestMode()
}

async function onSaveTestMode(enabled) {
  savingTestMode.value = true
  mainError.value = ''
  try {
    const result = await saveTestMode(enabled)
    testMode.value = result.enabled
    mainMsg.value = result.message
  } catch (err) {
    mainError.value = err.response?.data?.message || 'Failed to update test mode.'
  } finally {
    savingTestMode.value = false
  }
}

async function confirmResetDb() {
  resetting.value = true
  mainError.value = ''
  mainMsg.value = ''
  try {
    const { data } = await api.post('/api/settings/reset_test_db.php', {})
    showResetConfirm.value = false
    mainMsg.value = data.message || 'Test database has been reset from production.'
  } catch (err) {
    mainError.value = err.response?.data?.message || 'Failed to reset test database.'
  } finally {
    resetting.value = false
  }
}

function goCreditUtilization() {
  router.push({ name: 'credit-utilization' })
}

onMounted(async () => {
  await loadTestMode()
  if (route.query.Message) {
    mainMsg.value = String(route.query.Message)
  }
})
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Settings</h1>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Test mode and admin utilities.
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

    <div class="card max-w-xl">
      <div class="card-body space-y-6">
        <div>
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Test Mode</h2>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Stored in the live database (<code>asimo124_bills.app_settings</code>). When ON, only
            Bills Admin list / create / edit / delete use the test database. Login and everything
            else stay on live.
          </p>
          <div class="mt-4 inline-flex overflow-hidden rounded-lg border border-gray-300 dark:border-gray-600">
            <button
              type="button"
              class="px-4 py-2 text-sm font-medium disabled:opacity-50"
              :class="
                testMode
                  ? 'bg-primary-500 text-white'
                  : 'bg-white text-gray-700 dark:bg-gray-800 dark:text-gray-300'
              "
              :disabled="savingTestMode"
              @click="onSaveTestMode(true)"
            >
              ON
            </button>
            <button
              type="button"
              class="px-4 py-2 text-sm font-medium disabled:opacity-50"
              :class="
                !testMode
                  ? 'bg-primary-500 text-white'
                  : 'bg-white text-gray-700 dark:bg-gray-800 dark:text-gray-300'
              "
              :disabled="savingTestMode"
              @click="onSaveTestMode(false)"
            >
              OFF
            </button>
          </div>
        </div>

        <div class="border-t border-gray-200 pt-6 dark:border-gray-700">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Test Database</h2>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Copy production bills and income-purchase data into the test database.
          </p>
          <button
            type="button"
            class="btn mt-4 bg-primary-500 text-white hover:bg-primary-600"
            @click="showResetConfirm = true"
          >
            Reset Test DB
          </button>
        </div>

        <div class="border-t border-gray-200 pt-6 dark:border-gray-700">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Legacy Tools</h2>
          <div class="mt-4 flex flex-wrap gap-3">
            <a
              :href="trackProgress2Url"
              target="_blank"
              rel="noopener noreferrer"
              class="btn bg-red-500 text-white hover:bg-red-600"
            >
              Track Progress 2
            </a>
            <button type="button" class="btn bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200" @click="goCreditUtilization">
              Credit Utilization
            </button>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="showResetConfirm"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      @click.self="showResetConfirm = false"
    >
      <div class="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Reset Test DB?</h3>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
          This will truncate the test database and copy all production bills and income-purchase
          records into it. This cannot be undone.
        </p>
        <div class="mt-6 flex justify-end gap-2">
          <button
            type="button"
            class="btn bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
            :disabled="resetting"
            @click="showResetConfirm = false"
          >
            Cancel
          </button>
          <button
            type="button"
            class="btn bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
            :disabled="resetting"
            @click="confirmResetDb"
          >
            {{ resetting ? 'Resetting…' : 'Reset Test DB' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
