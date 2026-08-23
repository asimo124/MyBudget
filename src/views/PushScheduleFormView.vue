<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/api/client'
import {
  cronLinesFromRows,
  defaultCronRows,
  pad2,
  parseCronLines,
} from '@/utils/pushNotificationSchedule'

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

const form = reactive({
  title: '',
  cron_schedule: '',
})

const cronRows = ref(defaultCronRows())

const isEdit = computed(() => props.mode === 'edit')
const pageTitle = computed(() => (isEdit.value ? 'Edit Schedule' : 'Create Schedule'))

const minuteOptions = Array.from({ length: 60 }, (_, i) => i)
const hourOptions = Array.from({ length: 24 }, (_, i) => i)

watch(
  cronRows,
  (rows) => {
    form.cron_schedule = cronLinesFromRows(rows)
  },
  { deep: true, immediate: true }
)

function addCronRow() {
  cronRows.value.push({ minute: 0, hour: 8 })
}

function removeCronRow(index) {
  if (cronRows.value.length <= 1) return
  cronRows.value.splice(index, 1)
}

async function loadSchedule() {
  const { data } = await api.get('/api/push_notifications/schedule_get.php', {
    params: { id: route.params.id },
  })
  const schedule = data.schedule
  form.title = schedule.title || ''
  const parsed = parseCronLines(schedule.cron_schedule)
  cronRows.value = parsed.length ? parsed : defaultCronRows()
}

async function save() {
  saving.value = true
  error.value = ''
  try {
    const payload = {
      title: form.title,
      cron_schedule: form.cron_schedule,
    }

    if (isEdit.value) {
      const { data } = await api.post('/api/push_notifications/schedule_update.php', {
        ...payload,
        id: Number(route.params.id),
      })
      await router.push({
        name: 'push-notifications',
        query: { tab: 'schedules', Message: data.message || 'Schedule has been updated.' },
      })
    } else {
      const { data } = await api.post('/api/push_notifications/schedule_create.php', payload)
      await router.push({
        name: 'push-notifications',
        query: { tab: 'schedules', Message: data.message || 'Schedule has been created.' },
      })
    }
  } catch (err) {
    error.value = err.response?.data?.message || 'Failed to save schedule.'
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  loading.value = true
  error.value = ''
  try {
    if (isEdit.value) {
      await loadSchedule()
    }
  } catch (err) {
    error.value = err.response?.data?.message || 'Failed to load schedule.'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">{{ pageTitle }}</h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Minute and hour times; day, month, and weekday stay <code>* * *</code>.
        </p>
      </div>
      <button
        type="button"
        class="btn bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
        @click="router.push({ name: 'push-notifications', query: { tab: 'schedules' } })"
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

    <div v-if="loading" class="text-sm text-gray-500">Loading…</div>

    <form v-else class="card max-w-xl space-y-4 p-6" @submit.prevent="save">
      <div>
        <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400" for="title">Title</label>
        <input
          id="title"
          v-model="form.title"
          type="text"
          maxlength="120"
          required
          class="form-input w-full"
          placeholder="Title"
        />
      </div>

      <div>
        <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400">Times</label>
        <p class="mb-2 text-xs text-gray-500">Minute (0–59) and hour (0–23).</p>
        <div class="space-y-2">
          <div v-for="(row, index) in cronRows" :key="index" class="flex flex-wrap items-center gap-2">
            <select v-model.number="row.minute" class="form-input w-24">
              <option v-for="m in minuteOptions" :key="m" :value="m">{{ pad2(m) }}</option>
            </select>
            <select v-model.number="row.hour" class="form-input w-24">
              <option v-for="h in hourOptions" :key="h" :value="h">{{ pad2(h) }}</option>
            </select>
            <button
              type="button"
              class="btn bg-gray-200 px-3 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
              title="Remove time"
              :disabled="cronRows.length <= 1"
              @click="removeCronRow(index)"
            >
              ×
            </button>
          </div>
        </div>
        <button type="button" class="btn mt-2 bg-primary-500 text-white hover:bg-primary-600" @click="addCronRow">
          +
        </button>
      </div>

      <div>
        <label class="mb-1 block text-sm text-gray-600 dark:text-gray-400" for="cron_schedule">
          Cron Schedule
        </label>
        <textarea
          id="cron_schedule"
          v-model="form.cron_schedule"
          rows="8"
          readonly
          required
          class="form-input w-full font-mono text-sm"
        />
      </div>

      <div class="flex gap-2 pt-2">
        <button
          type="submit"
          class="btn bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50"
          :disabled="saving"
        >
          {{ isEdit ? 'Update' : 'Create Schedule' }}
        </button>
        <button
          type="button"
          class="btn bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
          @click="router.push({ name: 'push-notifications', query: { tab: 'schedules' } })"
        >
          Cancel
        </button>
      </div>
    </form>
  </div>
</template>
